"""
Flowershop Vertical API Endpoints

Handles flower shop operations including:
- Product catalog management (bouquets, arrangements, plants)
- Category and occasion management
- Order processing with delivery scheduling
- Inventory tracking
- Loyalty points integration
"""

from datetime import date, datetime, timedelta
from typing import List, Optional
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from pydantic import BaseModel, Field, validate_email
import logging

from app.core.database import get_db
from app.core.tenant_context import TenantContext, get_tenant_context
from app.models import (
    FlowerCategory,
    FlowerOccasion,
    FlowerProduct,
    FlowerOrder,
    FlowerOrderItem,
    DeliverySlot,
    User,
    LoyaltyTransaction,
    PointBalance,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/flowershop", tags=["Flowershop"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

# Category Schemas
class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    display_order: int = Field(default=0)


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    display_order: Optional[int] = None
    active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    icon: Optional[str]
    display_order: int
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Occasion Schemas
class OccasionCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    color_scheme: Optional[str] = Field(None, max_length=50)


class OccasionResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    icon: Optional[str]
    color_scheme: Optional[str]
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Product Schemas
class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(..., max_length=200)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=50)
    price_cents: int = Field(..., ge=0)
    sale_price_cents: Optional[int] = Field(None, ge=0)
    stock_quantity: int = Field(default=0, ge=0)
    track_inventory: bool = Field(default=True)
    low_stock_threshold: int = Field(default=5, ge=0)
    size: Optional[str] = Field(None, max_length=50)
    color_scheme: Optional[str] = Field(None, max_length=100)
    includes_vase: bool = Field(default=False)
    includes_card: bool = Field(default=True)
    image_url: Optional[str] = Field(None, max_length=500)
    featured: bool = Field(default=False)
    seasonal: bool = Field(default=False)
    occasion_ids: List[int] = Field(default_factory=list)
    available_for_delivery: bool = Field(default=True)
    available_for_pickup: bool = Field(default=True)


class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=200)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=50)
    price_cents: Optional[int] = Field(None, ge=0)
    sale_price_cents: Optional[int] = Field(None, ge=0)
    stock_quantity: Optional[int] = Field(None, ge=0)
    track_inventory: Optional[bool] = None
    low_stock_threshold: Optional[int] = Field(None, ge=0)
    size: Optional[str] = Field(None, max_length=50)
    color_scheme: Optional[str] = Field(None, max_length=100)
    includes_vase: Optional[bool] = None
    includes_card: Optional[bool] = None
    image_url: Optional[str] = Field(None, max_length=500)
    featured: Optional[bool] = None
    seasonal: Optional[bool] = None
    active: Optional[bool] = None
    occasion_ids: Optional[List[int]] = None
    available_for_delivery: Optional[bool] = None
    available_for_pickup: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    category_id: int
    name: str
    description: Optional[str]
    sku: Optional[str]
    price_cents: int
    sale_price_cents: Optional[int]
    stock_quantity: int
    track_inventory: bool
    low_stock_threshold: int
    size: Optional[str]
    color_scheme: Optional[str]
    includes_vase: bool
    includes_card: bool
    image_url: Optional[str]
    featured: bool
    seasonal: bool
    display_order: int
    active: bool
    available_for_delivery: bool
    available_for_pickup: bool
    created_at: datetime
    updated_at: Optional[datetime]
    occasions: List[OccasionResponse]
    
    class Config:
        from_attributes = True


# Order Schemas
class OrderItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=1)


class OrderCreate(BaseModel):
    customer_id: int
    delivery_type: str = Field(..., pattern="^(delivery|pickup)$")
    delivery_date: date
    delivery_time_slot: Optional[str] = Field(None, max_length=50)
    
    recipient_name: str = Field(..., max_length=200)
    recipient_phone: Optional[str] = Field(None, max_length=20)
    
    # Delivery address (required if delivery_type=delivery)
    delivery_address_line1: Optional[str] = Field(None, max_length=200)
    delivery_address_line2: Optional[str] = Field(None, max_length=200)
    delivery_city: Optional[str] = Field(None, max_length=100)
    delivery_postal_code: Optional[str] = Field(None, max_length=20)
    delivery_instructions: Optional[str] = None
    
    gift_message: Optional[str] = Field(None, max_length=200)
    include_sender_name: bool = Field(default=True)
    
    payment_method: str = Field(..., max_length=50)
    
    items: List[OrderItemCreate] = Field(..., min_length=1)


class OrderUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(pending|confirmed|preparing|out_for_delivery|delivered|cancelled)$")
    payment_status: Optional[str] = Field(None, pattern="^(pending|paid|failed|refunded)$")
    payment_reference: Optional[str] = Field(None, max_length=100)
    staff_notes: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_description: Optional[str]
    quantity: int
    unit_price_cents: int
    subtotal_cents: int
    
    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    id: int
    order_number: str
    customer_id: int
    order_date: datetime
    delivery_type: str
    delivery_date: date
    delivery_time_slot: Optional[str]
    recipient_name: str
    recipient_phone: Optional[str]
    delivery_address_line1: Optional[str]
    delivery_address_line2: Optional[str]
    delivery_city: Optional[str]
    delivery_postal_code: Optional[str]
    delivery_instructions: Optional[str]
    gift_message: Optional[str]
    include_sender_name: bool
    subtotal_cents: int
    delivery_fee_cents: int
    discount_cents: int
    total_cents: int
    payment_status: str
    payment_method: str
    payment_reference: Optional[str]
    status: str
    staff_notes: Optional[str]
    loyalty_points_awarded: int
    created_at: datetime
    updated_at: Optional[datetime]
    confirmed_at: Optional[datetime]
    delivered_at: Optional[datetime]
    items: List[OrderItemResponse]
    
    class Config:
        from_attributes = True


# Delivery Slot Schemas
class DeliverySlotCreate(BaseModel):
    delivery_date: date
    time_slot: str = Field(..., max_length=50)
    max_deliveries: int = Field(default=10, ge=1)
    fee_cents: int = Field(default=0, ge=0)


class DeliverySlotResponse(BaseModel):
    id: int
    delivery_date: date
    time_slot: str
    max_deliveries: int
    current_bookings: int
    available: bool
    fee_cents: int
    created_at: datetime
    
    class Config:
        from_attributes = True


# ============================================================================
# Category Management Endpoints
# ============================================================================

@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new product category."""
    tenant_id = tenant_ctx.tenant_id
    
    # Check for duplicate name
    existing = db.query(FlowerCategory).filter(
        FlowerCategory.tenant_id == tenant_id,
        FlowerCategory.name == category.name
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    
    db_category = FlowerCategory(
        tenant_id=tenant_id,
        **category.model_dump()
    )
    
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    
    logger.info(f"Created flower category {db_category.id} for tenant {tenant_id}")
    return db_category


@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(
    active_only: bool = Query(True, description="Filter active categories only"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all product categories."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(FlowerCategory).filter(FlowerCategory.tenant_id == tenant_id)
    
    if active_only:
        query = query.filter(FlowerCategory.active == True)
    
    categories = query.order_by(FlowerCategory.display_order, FlowerCategory.name).all()
    return categories


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific category."""
    tenant_id = tenant_ctx.tenant_id
    
    category = db.query(FlowerCategory).filter(
        FlowerCategory.id == category_id,
        FlowerCategory.tenant_id == tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_update: CategoryUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a category."""
    tenant_id = tenant_ctx.tenant_id
    
    category = db.query(FlowerCategory).filter(
        FlowerCategory.id == category_id,
        FlowerCategory.tenant_id == tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Update fields
    update_data = category_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    
    logger.info(f"Updated category {category_id}")
    return category


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete a category."""
    tenant_id = tenant_ctx.tenant_id
    
    category = db.query(FlowerCategory).filter(
        FlowerCategory.id == category_id,
        FlowerCategory.tenant_id == tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Check if category has products
    product_count = db.query(FlowerProduct).filter(
        FlowerProduct.category_id == category_id,
        FlowerProduct.tenant_id == tenant_id
    ).count()
    
    if product_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete category with {product_count} products. Move or delete products first."
        )
    
    category.active = False
    db.commit()
    
    logger.info(f"Deleted category {category_id}")


# ============================================================================
# Occasion Management Endpoints
# ============================================================================

@router.post("/occasions", response_model=OccasionResponse, status_code=201)
def create_occasion(
    occasion: OccasionCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new occasion."""
    tenant_id = tenant_ctx.tenant_id
    
    db_occasion = FlowerOccasion(
        tenant_id=tenant_id,
        **occasion.model_dump()
    )
    
    db.add(db_occasion)
    db.commit()
    db.refresh(db_occasion)
    
    logger.info(f"Created occasion {db_occasion.id} for tenant {tenant_id}")
    return db_occasion


@router.get("/occasions", response_model=List[OccasionResponse])
def list_occasions(
    active_only: bool = Query(True, description="Filter active occasions only"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all occasions."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(FlowerOccasion).filter(FlowerOccasion.tenant_id == tenant_id)
    
    if active_only:
        query = query.filter(FlowerOccasion.active == True)
    
    occasions = query.order_by(FlowerOccasion.name).all()
    return occasions


# ============================================================================
# Product Management Endpoints
# ============================================================================

@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new flower product."""
    tenant_id = tenant_ctx.tenant_id
    
    # Verify category exists
    category = db.query(FlowerCategory).filter(
        FlowerCategory.id == product.category_id,
        FlowerCategory.tenant_id == tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    # Create product (exclude occasion_ids from model_dump)
    product_data = product.model_dump(exclude={'occasion_ids'})
    db_product = FlowerProduct(
        tenant_id=tenant_id,
        **product_data
    )
    
    # Add occasions
    if product.occasion_ids:
        occasions = db.query(FlowerOccasion).filter(
            FlowerOccasion.id.in_(product.occasion_ids),
            FlowerOccasion.tenant_id == tenant_id
        ).all()
        db_product.occasions = occasions
    
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    
    logger.info(f"Created product {db_product.id} for tenant {tenant_id}")
    return db_product


@router.get("/products", response_model=List[ProductResponse])
def list_products(
    category_id: Optional[int] = Query(None, description="Filter by category"),
    occasion_id: Optional[int] = Query(None, description="Filter by occasion"),
    featured_only: bool = Query(False, description="Show only featured products"),
    seasonal_only: bool = Query(False, description="Show only seasonal products"),
    active_only: bool = Query(True, description="Filter active products only"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all flower products with optional filters."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(FlowerProduct).filter(FlowerProduct.tenant_id == tenant_id)
    
    if category_id:
        query = query.filter(FlowerProduct.category_id == category_id)
    
    if occasion_id:
        query = query.join(FlowerProduct.occasions).filter(FlowerOccasion.id == occasion_id)
    
    if featured_only:
        query = query.filter(FlowerProduct.featured == True)
    
    if seasonal_only:
        query = query.filter(FlowerProduct.seasonal == True)
    
    if active_only:
        query = query.filter(FlowerProduct.active == True)
    
    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                FlowerProduct.name.ilike(search_pattern),
                FlowerProduct.description.ilike(search_pattern)
            )
        )
    
    products = query.order_by(FlowerProduct.display_order, FlowerProduct.name).all()
    return products


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific product."""
    tenant_id = tenant_ctx.tenant_id
    
    product = db.query(FlowerProduct).filter(
        FlowerProduct.id == product_id,
        FlowerProduct.tenant_id == tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    return product


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a product."""
    tenant_id = tenant_ctx.tenant_id
    
    product = db.query(FlowerProduct).filter(
        FlowerProduct.id == product_id,
        FlowerProduct.tenant_id == tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # Update occasions if provided
    occasion_ids = None
    if product_update.occasion_ids is not None:
        occasion_ids = product_update.occasion_ids
        occasions = db.query(FlowerOccasion).filter(
            FlowerOccasion.id.in_(occasion_ids),
            FlowerOccasion.tenant_id == tenant_id
        ).all()
        product.occasions = occasions
    
    # Update other fields
    update_data = product_update.model_dump(exclude_unset=True, exclude={'occasion_ids'})
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    logger.info(f"Updated product {product_id}")
    return product


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete a product."""
    tenant_id = tenant_ctx.tenant_id
    
    product = db.query(FlowerProduct).filter(
        FlowerProduct.id == product_id,
        FlowerProduct.tenant_id == tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.active = False
    db.commit()
    
    logger.info(f"Deleted product {product_id}")


# ============================================================================
# Order Management Endpoints
# ============================================================================

def generate_order_number(tenant_id: str, db: Session) -> str:
    """Generate unique order number."""
    # Get today's order count
    today = date.today()
    count = db.query(func.count(FlowerOrder.id)).filter(
        FlowerOrder.tenant_id == tenant_id,
        func.date(FlowerOrder.order_date) == today
    ).scalar()
    
    return f"FLO-{today.strftime('%Y%m%d')}-{count + 1:04d}"


def award_loyalty_points_for_order(order: FlowerOrder, db: Session, tenant_ctx: TenantContext):
    """Award loyalty points when order is delivered (1 point per R10)."""
    tenant_id = tenant_ctx.tenant_id
    
    # Calculate points (1 point per R10 spent, similar to other verticals)
    points_to_award = order.total_cents // 1000  # 1000 cents = R10
    
    if points_to_award <= 0:
        return
    
    # Create loyalty transaction
    transaction = LoyaltyTransaction(
        tenant_id=tenant_id,
        customer_id=order.customer_id,
        points=points_to_award,
        transaction_type="earn",
        reference_type="flower_order",
        reference_id=order.id,
        description=f"Flower order {order.order_number}"
    )
    db.add(transaction)
    
    # Update point balance
    balance = db.query(PointBalance).filter(
        PointBalance.tenant_id == tenant_id,
        PointBalance.user_id == order.customer_id
    ).first()
    
    if balance:
        balance.current_balance += points_to_award
        balance.lifetime_earned += points_to_award
        balance.updated_at = func.now()
    else:
        balance = PointBalance(
            tenant_id=tenant_id,
            user_id=order.customer_id,
            current_balance=points_to_award,
            lifetime_earned=points_to_award,
        )
        db.add(balance)
    
    # Update order
    order.loyalty_points_awarded = points_to_award
    order.loyalty_points_awarded_at = func.now()
    
    logger.info(f"Awarded {points_to_award} loyalty points for order {order.id}")


@router.post("/orders", response_model=OrderResponse, status_code=201)
def create_order(
    order: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new flower order."""
    tenant_id = tenant_ctx.tenant_id
    
    # Validate customer exists
    customer = db.query(User).filter(User.id == order.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Validate delivery address for delivery orders
    if order.delivery_type == "delivery":
        if not all([order.delivery_address_line1, order.delivery_city, order.delivery_postal_code]):
            raise HTTPException(
                status_code=400,
                detail="Delivery address is required for delivery orders"
            )
    
    # Validate delivery date (must be today or future)
    if order.delivery_date < date.today():
        raise HTTPException(status_code=400, detail="Delivery date cannot be in the past")
    
    # Calculate order totals
    subtotal_cents = 0
    order_items = []
    
    for item in order.items:
        product = db.query(FlowerProduct).filter(
            FlowerProduct.id == item.product_id,
            FlowerProduct.tenant_id == tenant_id,
            FlowerProduct.active == True
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        # Check inventory
        if product.track_inventory:
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}"
                )
        
        # Use sale price if available
        unit_price = product.sale_price_cents if product.sale_price_cents else product.price_cents
        item_subtotal = unit_price * item.quantity
        
        order_items.append({
            'product_id': product.id,
            'product_name': product.name,
            'product_description': product.description,
            'quantity': item.quantity,
            'unit_price_cents': unit_price,
            'subtotal_cents': item_subtotal
        })
        
        subtotal_cents += item_subtotal
    
    # Calculate delivery fee (check delivery slot or use default)
    delivery_fee_cents = 0
    if order.delivery_type == "delivery":
        if order.delivery_time_slot:
            slot = db.query(DeliverySlot).filter(
                DeliverySlot.tenant_id == tenant_id,
                DeliverySlot.delivery_date == order.delivery_date,
                DeliverySlot.time_slot == order.delivery_time_slot
            ).first()
            
            if slot:
                if not slot.available or slot.current_bookings >= slot.max_deliveries:
                    raise HTTPException(status_code=400, detail="Selected delivery slot is full")
                delivery_fee_cents = slot.fee_cents
                slot.current_bookings += 1
            else:
                delivery_fee_cents = 5000  # Default R50 delivery fee
        else:
            delivery_fee_cents = 5000  # Default R50 delivery fee
    
    total_cents = subtotal_cents + delivery_fee_cents
    
    # Generate order number
    order_number = generate_order_number(tenant_id, db)
    
    # Create order
    db_order = FlowerOrder(
        tenant_id=tenant_id,
        customer_id=order.customer_id,
        order_number=order_number,
        delivery_type=order.delivery_type,
        delivery_date=order.delivery_date,
        delivery_time_slot=order.delivery_time_slot,
        recipient_name=order.recipient_name,
        recipient_phone=order.recipient_phone,
        delivery_address_line1=order.delivery_address_line1,
        delivery_address_line2=order.delivery_address_line2,
        delivery_city=order.delivery_city,
        delivery_postal_code=order.delivery_postal_code,
        delivery_instructions=order.delivery_instructions,
        gift_message=order.gift_message,
        include_sender_name=order.include_sender_name,
        subtotal_cents=subtotal_cents,
        delivery_fee_cents=delivery_fee_cents,
        total_cents=total_cents,
        payment_method=order.payment_method,
        payment_status='pending',
        status='pending'
    )
    
    db.add(db_order)
    db.flush()  # Get order ID
    
    # Create order items and update inventory
    for item_data in order_items:
        db_item = FlowerOrderItem(
            order_id=db_order.id,
            **item_data
        )
        db.add(db_item)
        
        # Update product inventory
        product = db.query(FlowerProduct).filter(FlowerProduct.id == item_data['product_id']).first()
        if product and product.track_inventory:
            product.stock_quantity -= item_data['quantity']
    
    db.commit()
    db.refresh(db_order)
    
    logger.info(f"Created order {db_order.order_number} for tenant {tenant_id}")
    
    # Send order confirmation email
    if customer.email:
        items_summary = ", ".join(
            f"{item['product_name']} x{item['quantity']}" for item in order_items
        )
        from app.services.transactional_notifications import send_flower_order_confirmation
        background_tasks.add_task(
            send_flower_order_confirmation,
            db,
            to_email=customer.email,
            to_name=customer.first_name or "Customer",
            tenant_id=tenant_id,
            order_number=db_order.order_number,
            delivery_date=db_order.delivery_date,
            delivery_time_slot=db_order.delivery_time_slot or "",
            recipient_name=db_order.recipient_name or "",
            items_summary=items_summary,
            total_cents=total_cents,
        )

    # Build response with items
    response_data = {
        **db_order.__dict__,
        'items': [OrderItemResponse(**item.__dict__) for item in db_order.items]
    }
    
    return OrderResponse(**response_data)


@router.get("/orders", response_model=List[OrderResponse])
def list_orders(
    from_date: Optional[date] = Query(None, description="Filter orders from this date"),
    to_date: Optional[date] = Query(None, description="Filter orders to this date"),
    status: Optional[str] = Query(None, description="Filter by status"),
    customer_id: Optional[int] = Query(None, description="Filter by customer"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List orders with optional filters."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(FlowerOrder).filter(FlowerOrder.tenant_id == tenant_id)
    
    if from_date:
        query = query.filter(FlowerOrder.delivery_date >= from_date)
    
    if to_date:
        query = query.filter(FlowerOrder.delivery_date <= to_date)
    
    if status:
        query = query.filter(FlowerOrder.status == status)
    
    if customer_id:
        query = query.filter(FlowerOrder.customer_id == customer_id)
    
    orders = query.order_by(FlowerOrder.order_date.desc()).all()
    
    # Build response with items
    response_list = []
    for order in orders:
        response_data = {
            **order.__dict__,
            'items': [OrderItemResponse(**item.__dict__) for item in order.items]
        }
        response_list.append(OrderResponse(**response_data))
    
    return response_list


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get specific order details."""
    tenant_id = tenant_ctx.tenant_id
    
    order = db.query(FlowerOrder).filter(
        FlowerOrder.id == order_id,
        FlowerOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    response_data = {
        **order.__dict__,
        'items': [OrderItemResponse(**item.__dict__) for item in order.items]
    }
    
    return OrderResponse(**response_data)


@router.put("/orders/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    order_update: OrderUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update an order."""
    tenant_id = tenant_ctx.tenant_id
    
    order = db.query(FlowerOrder).filter(
        FlowerOrder.id == order_id,
        FlowerOrder.tenant_id == tenant_id
    ).first()
    
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    old_status = order.status
    
    # Update fields
    update_data = order_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)
    
    # Update timestamps based on status
    if 'status' in update_data:
        if order.status == 'confirmed' and old_status != 'confirmed':
            order.confirmed_at = func.now()
        elif order.status == 'delivered' and old_status != 'delivered':
            order.delivered_at = func.now()
        elif order.status == 'cancelled' and old_status != 'cancelled':
            order.cancelled_at = func.now()
    
    db.commit()
    db.refresh(order)
    
    # Award loyalty points if transitioning to delivered
    if old_status != 'delivered' and order.status == 'delivered':
        if order.loyalty_points_awarded == 0:
            award_loyalty_points_for_order(order, db, tenant_ctx)
            db.commit()
    
    logger.info(f"Updated order {order_id}")
    
    # Send status update email for key transitions
    if 'status' in update_data and order.status != old_status:
        if order.status in ("out_for_delivery", "delivered"):
            customer = db.query(User).filter(User.id == order.customer_id).first()
            if customer and customer.email:
                from app.services.transactional_notifications import send_flower_order_status_update
                background_tasks.add_task(
                    send_flower_order_status_update,
                    db,
                    to_email=customer.email,
                    to_name=customer.first_name or "Customer",
                    tenant_id=tenant_id,
                    order_number=order.order_number,
                    new_status=order.status,
                )

    response_data = {
        **order.__dict__,
        'items': [OrderItemResponse(**item.__dict__) for item in order.items]
    }
    
    return OrderResponse(**response_data)


# ============================================================================
# Delivery Slot Management Endpoints
# ============================================================================

@router.post("/delivery-slots", response_model=DeliverySlotResponse, status_code=201)
def create_delivery_slot(
    slot: DeliverySlotCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a delivery slot."""
    tenant_id = tenant_ctx.tenant_id
    
    # Check for duplicate
    existing = db.query(DeliverySlot).filter(
        DeliverySlot.tenant_id == tenant_id,
        DeliverySlot.delivery_date == slot.delivery_date,
        DeliverySlot.time_slot == slot.time_slot
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail="Delivery slot already exists")
    
    db_slot = DeliverySlot(
        tenant_id=tenant_id,
        **slot.model_dump()
    )
    
    db.add(db_slot)
    db.commit()
    db.refresh(db_slot)
    
    logger.info(f"Created delivery slot for {slot.delivery_date} {slot.time_slot}")
    return db_slot


@router.get("/delivery-slots", response_model=List[DeliverySlotResponse])
def list_delivery_slots(
    delivery_date: Optional[date] = Query(None, description="Filter by delivery date"),
    available_only: bool = Query(True, description="Show only available slots"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List delivery slots."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(DeliverySlot).filter(DeliverySlot.tenant_id == tenant_id)
    
    if delivery_date:
        query = query.filter(DeliverySlot.delivery_date == delivery_date)
    
    if available_only:
        query = query.filter(
            DeliverySlot.available == True,
            DeliverySlot.current_bookings < DeliverySlot.max_deliveries
        )
    
    slots = query.order_by(DeliverySlot.delivery_date, DeliverySlot.time_slot).all()
    return slots
