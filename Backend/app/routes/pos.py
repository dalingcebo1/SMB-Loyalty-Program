"""
POS (Point of Sale) API endpoints for retail sales transactions.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, and_, or_
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel, Field, validator
from decimal import Decimal

from app.core.database import get_db
from app.models import Sale, SaleItem, SalePayment, Product, InventoryLevel, StockMovement, User, LoyaltyProgram, PointBalance, LoyaltyTransaction
from app.core.tenant_context import get_tenant_context, TenantContext
from app.plugins.auth.routes import get_current_user

router = APIRouter(prefix="/api/retail/pos", tags=["pos"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    discount_cents: int = Field(default=0, ge=0)
    
    @validator('discount_cents')
    def validate_discount(cls, v):
        if v < 0:
            raise ValueError("Discount cannot be negative")
        return v


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    quantity: int
    unit_price_cents: int
    discount_cents: int
    total_cents: int
    product_name: str
    product_sku: Optional[str]
    
    class Config:
        from_attributes = True


class PaymentCreate(BaseModel):
    amount_cents: int = Field(gt=0)
    payment_method: str = Field(pattern="^(cash|card|mobile|wallet|other)$")
    transaction_id: Optional[str] = None


class PaymentResponse(BaseModel):
    id: int
    amount_cents: int
    payment_method: str
    transaction_id: Optional[str]
    status: str
    change_given_cents: int
    created_at: datetime
    
    class Config:
        from_attributes = True


class SaleCreate(BaseModel):
    location: str = Field(default="main", max_length=100)
    customer_id: Optional[int] = None
    tax_rate: int = Field(default=1500, description="Tax rate in basis points (1500 = 15%)")
    notes: Optional[str] = Field(default=None, max_length=500)


class SaleResponse(BaseModel):
    id: int
    receipt_number: str
    location: str
    customer_id: Optional[int]
    subtotal_cents: int
    tax_cents: int
    discount_cents: int
    total_cents: int
    tax_rate: int
    sale_status: str
    payment_status: str
    created_at: datetime
    completed_at: Optional[datetime]
    items: List[SaleItemResponse] = []
    sale_payments: List[PaymentResponse] = []
    
    class Config:
        from_attributes = True


class SaleUpdate(BaseModel):
    notes: Optional[str] = Field(default=None, max_length=500)


class SaleStats(BaseModel):
    total_sales: int
    total_revenue_cents: int
    average_sale_cents: int
    sales_today: int
    revenue_today_cents: int


# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────────────────────

def generate_receipt_number(db: Session, tenant_id: str, location: str) -> str:
    """Generate unique receipt number: POS-{location}-{YYYYMMDD}-{sequence}"""
    today = datetime.utcnow().date()
    prefix = f"POS-{location}-{today.strftime('%Y%m%d')}"
    
    # Find highest sequence number for today
    last_sale = db.query(Sale).filter(
        and_(
            Sale.tenant_id == tenant_id,
            Sale.receipt_number.like(f"{prefix}-%"),
            func.date(Sale.created_at) == today
        )
    ).order_by(desc(Sale.receipt_number)).first()
    
    if last_sale:
        # Extract sequence number
        try:
            last_seq = int(last_sale.receipt_number.split("-")[-1])
            sequence = last_seq + 1
        except (ValueError, IndexError):
            sequence = 1
    else:
        sequence = 1
    
    return f"{prefix}-{sequence:04d}"


def calculate_sale_totals(items: List[SaleItem], tax_rate_bp: int) -> dict:
    """Calculate sale totals from line items."""
    subtotal = sum(item.total_cents for item in items)
    discount = sum(item.discount_cents for item in items)
    
    # Tax calculation: tax = (subtotal - discount) * (tax_rate_bp / 10000)
    taxable_amount = subtotal - discount
    tax = int(taxable_amount * tax_rate_bp / 10000)
    
    total = taxable_amount + tax
    
    return {
        "subtotal_cents": subtotal,
        "discount_cents": discount,
        "tax_cents": tax,
        "total_cents": total
    }


def decrement_inventory(
    db: Session,
    tenant_id: str,
    product_id: int,
    quantity: int,
    sale_id: int,
    user_id: int
) -> None:
    """Decrement product inventory and create stock movement record."""
    # Find inventory level
    inventory = db.query(InventoryLevel).filter(
        and_(
            InventoryLevel.tenant_id == tenant_id,
            InventoryLevel.product_id == product_id
        )
    ).first()
    
    if not inventory:
        raise HTTPException(
            status_code=400,
            detail=f"No inventory record found for product {product_id}"
        )
    
    if inventory.quantity_in_stock < quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock for product {product_id}. Available: {inventory.quantity_in_stock}, Required: {quantity}"
        )
    
    # Update inventory
    inventory.quantity_in_stock -= quantity
    inventory.last_updated = datetime.utcnow()
    
    # Create stock movement
    movement = StockMovement(
        tenant_id=tenant_id,
        product_id=product_id,
        quantity_change=-quantity,
        movement_type="sale",
        reference_id=str(sale_id),
        notes=f"POS Sale #{sale_id}",
        user_id=user_id
    )
    db.add(movement)


def award_loyalty_points(
    db: Session,
    tenant_id: str,
    customer_id: int,
    sale_amount_cents: int,
    sale_id: int
) -> Optional[int]:
    """Calculate and award loyalty points to customer based on sale amount."""
    # Get loyalty program configuration
    loyalty_program = db.query(LoyaltyProgram).filter(
        LoyaltyProgram.tenant_id == tenant_id
    ).first()
    
    if not loyalty_program or not loyalty_program.active:
        return None
    
    # Calculate points: sale_amount_cents * accrual_ratio
    # Example: R100 (10000 cents) * 0.1 = 1000 points
    points_earned = int(sale_amount_cents * loyalty_program.accrual_ratio)
    
    if points_earned <= 0:
        return None
    
    # Get or create point balance
    point_balance = db.query(PointBalance).filter(
        and_(
            PointBalance.tenant_id == tenant_id,
            PointBalance.user_id == customer_id
        )
    ).first()
    
    if not point_balance:
        point_balance = PointBalance(
            tenant_id=tenant_id,
            user_id=customer_id,
            points=0,
            lifetime_points=0,
            updated_at=datetime.utcnow()
        )
        db.add(point_balance)
        db.flush()
    
    # Add points to balance
    point_balance.points += points_earned
    point_balance.lifetime_points += points_earned
    point_balance.updated_at = datetime.utcnow()
    
    # Create loyalty transaction record
    transaction = LoyaltyTransaction(
        tenant_id=tenant_id,
        user_id=customer_id,
        type="EARN",
        points=points_earned,
        reference_type="sale",
        reference_id=str(sale_id),
        description=f"Points earned from POS sale #{sale_id}"
    )
    db.add(transaction)
    
    return points_earned


# ──────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.post("/sales", response_model=SaleResponse, status_code=201)
async def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Create a new POS sale transaction."""
    tenant_id = tenant_ctx.tenant_id
    
    receipt_number = generate_receipt_number(db, tenant_id, sale_data.location)
    
    sale = Sale(
        tenant_id=tenant_id,
        user_id=current_user.id,
        customer_id=sale_data.customer_id,
        receipt_number=receipt_number,
        location=sale_data.location,
        tax_rate=sale_data.tax_rate,
        notes=sale_data.notes,
        subtotal_cents=0,
        tax_cents=0,
        discount_cents=0,
        total_cents=0,
        sale_status="pending",
        payment_status="pending"
    )
    
    db.add(sale)
    db.commit()
    db.refresh(sale)
    
    return sale


@router.post("/sales/{sale_id}/items", response_model=SaleItemResponse, status_code=201)
async def add_sale_item(
    sale_id: int,
    item_data: SaleItemCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Add a line item to a pending sale."""
    tenant_id = tenant_ctx.tenant_id
    # Verify sale exists and is pending
    sale = db.query(Sale).filter(
        and_(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id,
            Sale.sale_status == "pending"
        )
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found or already completed")
    
    # Verify product exists
    product = db.query(Product).filter(
        and_(
            Product.id == item_data.product_id,
            Product.tenant_id == tenant_id
        )
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Check stock availability
    inventory = db.query(InventoryLevel).filter(
        and_(
            InventoryLevel.tenant_id == tenant_id,
            InventoryLevel.product_id == product.id
        )
    ).first()
    
    if inventory and inventory.quantity_in_stock < item_data.quantity:
        raise HTTPException(
            status_code=400,
            detail=f"Insufficient stock. Available: {inventory.quantity_in_stock}"
        )
    
    # Calculate item total
    unit_price = product.price_cents
    item_total = (unit_price * item_data.quantity) - item_data.discount_cents
    
    # Create sale item
    sale_item = SaleItem(
        sale_id=sale.id,
        product_id=product.id,
        quantity=item_data.quantity,
        unit_price_cents=unit_price,
        discount_cents=item_data.discount_cents,
        total_cents=item_total,
        product_name=product.name,
        product_sku=product.sku
    )
    
    db.add(sale_item)
    
    # Recalculate sale totals
    db.flush()  # Ensure item is in session
    all_items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
    totals = calculate_sale_totals(all_items, sale.tax_rate)
    
    sale.subtotal_cents = totals["subtotal_cents"]
    sale.discount_cents = totals["discount_cents"]
    sale.tax_cents = totals["tax_cents"]
    sale.total_cents = totals["total_cents"]
    
    db.commit()
    db.refresh(sale_item)
    
    return sale_item


@router.delete("/sales/{sale_id}/items/{item_id}", status_code=204)
async def remove_sale_item(
    sale_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Remove a line item from a pending sale."""
    tenant_id = tenant_ctx.tenant_id
    # Verify sale exists and is pending
    sale = db.query(Sale).filter(
        and_(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id,
            Sale.sale_status == "pending"
        )
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found or already completed")
    
    # Find and delete item
    item = db.query(SaleItem).filter(
        and_(
            SaleItem.id == item_id,
            SaleItem.sale_id == sale_id
        )
    ).first()
    
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    db.delete(item)
    
    # Recalculate sale totals
    remaining_items = db.query(SaleItem).filter(
        and_(
            SaleItem.sale_id == sale.id,
            SaleItem.id != item_id
        )
    ).all()
    
    if remaining_items:
        totals = calculate_sale_totals(remaining_items, sale.tax_rate)
        sale.subtotal_cents = totals["subtotal_cents"]
        sale.discount_cents = totals["discount_cents"]
        sale.tax_cents = totals["tax_cents"]
        sale.total_cents = totals["total_cents"]
    else:
        # No items left, reset totals
        sale.subtotal_cents = 0
        sale.discount_cents = 0
        sale.tax_cents = 0
        sale.total_cents = 0
    
    db.commit()
    
    return None


@router.post("/sales/{sale_id}/payments", response_model=PaymentResponse, status_code=201)
async def add_payment(
    sale_id: int,
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Add a payment to a sale."""
    tenant_id = tenant_ctx.tenant_id
    # Verify sale exists
    sale = db.query(Sale).filter(
        and_(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id
        )
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    if sale.sale_status not in ["pending", "completed"]:
        raise HTTPException(status_code=400, detail="Cannot add payment to voided/refunded sale")
    
    # Calculate change for cash payments
    change_given = 0
    if payment_data.payment_method == "cash":
        total_paid = sum(p.amount_cents for p in sale.sale_payments if p.status == "completed")
        total_paid += payment_data.amount_cents
        if total_paid > sale.total_cents:
            change_given = total_paid - sale.total_cents
    
    # Create payment
    payment = SalePayment(
        sale_id=sale.id,
        amount_cents=payment_data.amount_cents,
        payment_method=payment_data.payment_method,
        transaction_id=payment_data.transaction_id,
        status="completed",
        change_given_cents=change_given,
        completed_at=datetime.utcnow()
    )
    
    db.add(payment)
    
    # Update payment status if fully paid
    total_paid = sum(p.amount_cents for p in sale.sale_payments if p.status == "completed")
    total_paid += payment_data.amount_cents
    
    if total_paid >= sale.total_cents:
        sale.payment_status = "completed"
    
    db.commit()
    db.refresh(payment)
    
    return payment


@router.post("/sales/{sale_id}/complete", response_model=SaleResponse)
async def complete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Complete a sale and decrement inventory."""
    tenant_id = tenant_ctx.tenant_id
    # Verify sale exists
    sale = db.query(Sale).options(
        joinedload(Sale.items),
        joinedload(Sale.sale_payments)
    ).filter(
        and_(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id,
            Sale.sale_status == "pending"
        )
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found or already completed")
    
    # Verify sale has items
    if not sale.items:
        raise HTTPException(status_code=400, detail="Cannot complete sale with no items")
    
    # Verify payment is complete
    if sale.payment_status != "completed":
        raise HTTPException(status_code=400, detail="Payment not completed")
    
    # Decrement inventory for all items
    for item in sale.items:
        decrement_inventory(
            db=db,
            tenant_id=tenant_id,
            product_id=item.product_id,
            quantity=item.quantity,
            sale_id=sale.id,
            user_id=current_user.id
        )
    
    # Award loyalty points if customer is linked
    if sale.customer_id:
        award_loyalty_points(
            db=db,
            tenant_id=tenant_id,
            customer_id=sale.customer_id,
            sale_amount_cents=sale.total_cents,
            sale_id=sale.id
        )
    
    # Mark sale as completed
    sale.sale_status = "completed"
    sale.completed_at = datetime.utcnow()
    
    db.commit()
    db.refresh(sale)
    
    return sale


@router.post("/sales/{sale_id}/void", response_model=SaleResponse)
async def void_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Void a pending sale."""
    tenant_id = tenant_ctx.tenant_id
    sale = db.query(Sale).filter(
        and_(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id,
            Sale.sale_status == "pending"
        )
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found or already completed")
    
    sale.sale_status = "voided"
    sale.voided_at = datetime.utcnow()
    
    db.commit()
    db.refresh(sale)
    
    return sale


@router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Get sale details."""
    tenant_id = tenant_ctx.tenant_id
    sale = db.query(Sale).options(
        joinedload(Sale.items),
        joinedload(Sale.sale_payments)
    ).filter(
        and_(
            Sale.id == sale_id,
            Sale.tenant_id == tenant_id
        )
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    return sale


@router.get("/sales", response_model=List[SaleResponse])
async def list_sales(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    status: Optional[str] = Query(None, pattern="^(pending|completed|voided|refunded)$"),
    location: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100)
):
    """List sales with optional filters."""
    tenant_id = tenant_ctx.tenant_id
    query = db.query(Sale).options(
        joinedload(Sale.items),
        joinedload(Sale.sale_payments)
    ).filter(Sale.tenant_id == tenant_id)
    
    if status:
        query = query.filter(Sale.sale_status == status)
    
    if location:
        query = query.filter(Sale.location == location)
    
    if start_date:
        query = query.filter(Sale.created_at >= start_date)
    
    if end_date:
        query = query.filter(Sale.created_at <= end_date)
    
    query = query.order_by(desc(Sale.created_at))
    sales = query.offset(skip).limit(limit).all()
    
    return sales


@router.get("/stats", response_model=SaleStats)
async def get_sales_stats(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user)
):
    """Get sales statistics."""
    tenant_id = tenant_ctx.tenant_id
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    
    # All-time stats
    all_time = db.query(
        func.count(Sale.id),
        func.coalesce(func.sum(Sale.total_cents), 0)
    ).filter(
        and_(
            Sale.tenant_id == tenant_id,
            Sale.sale_status == "completed"
        )
    ).first()
    
    total_sales = all_time[0] or 0
    total_revenue = all_time[1] or 0
    avg_sale = int(total_revenue / total_sales) if total_sales > 0 else 0
    
    # Today's stats
    today = db.query(
        func.count(Sale.id),
        func.coalesce(func.sum(Sale.total_cents), 0)
    ).filter(
        and_(
            Sale.tenant_id == tenant_id,
            Sale.sale_status == "completed",
            Sale.created_at >= today_start
        )
    ).first()
    
    sales_today = today[0] or 0
    revenue_today = today[1] or 0
    
    return SaleStats(
        total_sales=total_sales,
        total_revenue_cents=total_revenue,
        average_sale_cents=avg_sale,
        sales_today=sales_today,
        revenue_today_cents=revenue_today
    )
