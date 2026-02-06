"""
Retail Inventory API Routes

Endpoints for managing products, suppliers, categories, and stock levels.
"""

from typing import List, Optional
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.plugins.auth.routes import get_current_user
from app.models import (
    User,
    Product,
    ProductCategory,
    Supplier,
    InventoryLevel,
    StockMovement,
    LowStockAlert,
)

router = APIRouter(prefix="/api/retail", tags=["retail"])


# ──────────────────────────────────────────────────────────────────────────────
# Pydantic Schemas
# ──────────────────────────────────────────────────────────────────────────────

class SupplierCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    notes: Optional[str] = None


class SupplierResponse(BaseModel):
    id: int
    name: str
    contact_person: Optional[str]
    email: Optional[str]
    phone: Optional[str]
    address: Optional[str]
    active: bool
    product_count: int = 0
    created_at: datetime


class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    parent_id: Optional[int] = None


class CategoryResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    parent_id: Optional[int]
    active: bool
    product_count: int = 0


class InventoryStatsResponse(BaseModel):
    """Dashboard stats for inventory overview."""
    total_products: int
    low_stock_count: int
    total_inventory_value_cents: int
    total_suppliers: int
    total_categories: int


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    cost_cents: int = Field(0, ge=0)
    price_cents: int = Field(0, ge=0)
    barcode: Optional[str] = None
    unit_of_measure: str = "unit"
    track_inventory: bool = True
    low_stock_threshold: int = 10
    initial_stock: int = 0  # Initial inventory quantity


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    category_id: Optional[int] = None
    supplier_id: Optional[int] = None
    cost_cents: Optional[int] = None
    price_cents: Optional[int] = None
    barcode: Optional[str] = None
    low_stock_threshold: Optional[int] = None
    active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    sku: str
    name: str
    description: Optional[str]
    category_id: Optional[int]
    category_name: Optional[str]
    supplier_id: Optional[int]
    supplier_name: Optional[str]
    cost: float  # In currency
    price: float  # In currency
    margin_percent: float
    barcode: Optional[str]
    unit_of_measure: str
    track_inventory: bool
    low_stock_threshold: int
    current_stock: int = 0
    is_low_stock: bool = False
    active: bool
    created_at: datetime


class StockAdjustment(BaseModel):
    product_id: int
    quantity: int  # Positive to add, negative to remove
    reason: str = Field(..., min_length=1)
    location: str = "main"


class StockMovementResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    type: str
    quantity: int
    location: str
    reason: Optional[str]
    unit_cost: float
    performed_by: Optional[int]
    created_at: datetime


class LowStockAlertResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    product_sku: str
    current_quantity: int
    threshold: int
    location: str
    acknowledged: bool
    created_at: datetime


# ──────────────────────────────────────────────────────────────────────────────
# Helper Functions
# ──────────────────────────────────────────────────────────────────────────────

def require_retail_access(user: User) -> None:
    """Ensure user has access to retail features."""
    if user.role not in {"admin", "staff"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Retail inventory access restricted to admin/staff"
        )


def create_stock_movement(
    db: Session,
    tenant_id: str,
    product_id: int,
    quantity: int,
    movement_type: str,
    reason: Optional[str],
    user_id: int,
    unit_cost_cents: Optional[int] = None,
    location: str = "main"
) -> StockMovement:
    """Create a stock movement record and update inventory level."""
    movement = StockMovement(
        tenant_id=tenant_id,
        product_id=product_id,
        quantity=quantity,
        type=movement_type,
        reason=reason,
        performed_by=user_id,
        unit_cost_cents=unit_cost_cents,
        location=location,
    )
    db.add(movement)
    
    # Update inventory level
    inv_level = db.query(InventoryLevel).filter(
        InventoryLevel.tenant_id == tenant_id,
        InventoryLevel.product_id == product_id,
        InventoryLevel.location == location
    ).first()
    
    if not inv_level:
        inv_level = InventoryLevel(
            tenant_id=tenant_id,
            product_id=product_id,
            location=location,
            quantity=0
        )
        db.add(inv_level)
    
    inv_level.quantity += quantity
    inv_level.updated_at = datetime.utcnow()
    
    return movement


def check_low_stock_alerts(
    db: Session,
    tenant_id: str,
    product_id: int,
    location: str = "main"
) -> None:
    """Check if product has fallen below threshold and create alert if needed."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.track_inventory:
        return
    
    inv_level = db.query(InventoryLevel).filter(
        InventoryLevel.tenant_id == tenant_id,
        InventoryLevel.product_id == product_id,
        InventoryLevel.location == location
    ).first()
    
    if not inv_level:
        return
    
    if inv_level.available_quantity <= product.low_stock_threshold:
        # Check if alert already exists
        existing = db.query(LowStockAlert).filter(
            LowStockAlert.tenant_id == tenant_id,
            LowStockAlert.product_id == product_id,
            LowStockAlert.location == location,
            LowStockAlert.resolved == False
        ).first()
        
        if not existing:
            alert = LowStockAlert(
                tenant_id=tenant_id,
                product_id=product_id,
                location=location,
                current_quantity=inv_level.available_quantity,
                threshold=product.low_stock_threshold
            )
            db.add(alert)


# ──────────────────────────────────────────────────────────────────────────────
# API Endpoints
# ──────────────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=InventoryStatsResponse)
def get_inventory_stats(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get inventory statistics for dashboard."""
    require_retail_access(current_user)
    
    # Total products
    total_products = db.query(func.count(Product.id))\
        .filter(Product.tenant_id == tenant_ctx.tenant_id)\
        .scalar() or 0
    
    # Low stock alerts count (unresolved)
    low_stock_count = db.query(func.count(LowStockAlert.id))\
        .filter(
            LowStockAlert.tenant_id == tenant_ctx.tenant_id,
            LowStockAlert.resolved == False
        )\
        .scalar() or 0
    
    # Total inventory value (at cost)
    inventory_value_query = db.query(
        func.sum(Product.cost_cents * InventoryLevel.quantity)
    ).join(
        InventoryLevel, Product.id == InventoryLevel.product_id
    ).filter(
        Product.tenant_id == tenant_ctx.tenant_id
    ).scalar()
    
    total_inventory_value_cents = int(inventory_value_query) if inventory_value_query else 0
    
    # Total suppliers
    total_suppliers = db.query(func.count(Supplier.id))\
        .filter(Supplier.tenant_id == tenant_ctx.tenant_id)\
        .scalar() or 0
    
    # Total categories
    total_categories = db.query(func.count(ProductCategory.id))\
        .filter(ProductCategory.tenant_id == tenant_ctx.tenant_id)\
        .scalar() or 0
    
    return InventoryStatsResponse(
        total_products=total_products,
        low_stock_count=low_stock_count,
        total_inventory_value_cents=total_inventory_value_cents,
        total_suppliers=total_suppliers,
        total_categories=total_categories,
    )


@router.get("/products", response_model=List[ProductResponse])
def list_products(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    low_stock_only: bool = Query(False),
    active_only: bool = Query(True),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all products with inventory levels."""
    require_retail_access(current_user)
    
    query = db.query(Product).filter(Product.tenant_id == tenant_ctx.tenant_id)
    
    if active_only:
        query = query.filter(Product.active == True)
    
    if category_id:
        query = query.filter(Product.category_id == category_id)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(search_term)) |
            (Product.sku.ilike(search_term)) |
            (Product.barcode.ilike(search_term))
        )
    
    products = query.all()
    
    # Fetch inventory levels
    product_ids = [p.id for p in products]
    inv_levels = db.query(InventoryLevel).filter(
        InventoryLevel.tenant_id == tenant_ctx.tenant_id,
        InventoryLevel.product_id.in_(product_ids)
    ).all()
    inv_map = {inv.product_id: inv for inv in inv_levels}
    
    result = []
    for product in products:
        inv = inv_map.get(product.id)
        current_stock = inv.available_quantity if inv else 0
        is_low = inv.is_low_stock if inv else False
        
        if low_stock_only and not is_low:
            continue
        
        result.append(ProductResponse(
            id=product.id,
            sku=product.sku,
            name=product.name,
            description=product.description,
            category_id=product.category_id,
            category_name=product.category.name if product.category else None,
            supplier_id=product.supplier_id,
            supplier_name=product.supplier.name if product.supplier else None,
            cost=product.cost,
            price=product.price,
            margin_percent=product.margin_percent,
            barcode=product.barcode,
            unit_of_measure=product.unit_of_measure,
            track_inventory=product.track_inventory,
            low_stock_threshold=product.low_stock_threshold,
            current_stock=current_stock,
            is_low_stock=is_low,
            active=product.active,
            created_at=product.created_at
        ))
    
    return result


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new product."""
    require_retail_access(current_user)
    
    # Check SKU uniqueness
    existing = db.query(Product).filter(
        Product.tenant_id == tenant_ctx.tenant_id,
        Product.sku == data.sku
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Product with SKU '{data.sku}' already exists"
        )
    
    product = Product(
        tenant_id=tenant_ctx.tenant_id,
        sku=data.sku,
        name=data.name,
        description=data.description,
        category_id=data.category_id,
        supplier_id=data.supplier_id,
        cost_cents=data.cost_cents,
        price_cents=data.price_cents,
        barcode=data.barcode,
        unit_of_measure=data.unit_of_measure,
        track_inventory=data.track_inventory,
        low_stock_threshold=data.low_stock_threshold,
    )
    db.add(product)
    db.flush()
    
    # Create initial inventory if specified
    if data.initial_stock > 0:
        create_stock_movement(
            db=db,
            tenant_id=tenant_ctx.tenant_id,
            product_id=product.id,
            quantity=data.initial_stock,
            movement_type="purchase",
            reason="Initial stock",
            user_id=current_user.id,
            unit_cost_cents=data.cost_cents
        )
    
    db.commit()
    db.refresh(product)
    
    # Get current stock
    inv = db.query(InventoryLevel).filter(
        InventoryLevel.tenant_id == tenant_ctx.tenant_id,
        InventoryLevel.product_id == product.id
    ).first()
    
    return ProductResponse(
        id=product.id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        supplier_id=product.supplier_id,
        supplier_name=product.supplier.name if product.supplier else None,
        cost=product.cost,
        price=product.price,
        margin_percent=product.margin_percent,
        barcode=product.barcode,
        unit_of_measure=product.unit_of_measure,
        track_inventory=product.track_inventory,
        low_stock_threshold=product.low_stock_threshold,
        current_stock=inv.available_quantity if inv else 0,
        is_low_stock=inv.is_low_stock if inv else False,
        active=product.active,
        created_at=product.created_at
    )


@router.post("/stock/adjust")
def adjust_stock(
    data: StockAdjustment,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Adjust inventory level for a product."""
    require_retail_access(current_user)
    
    product = db.query(Product).filter(
        Product.id == data.product_id,
        Product.tenant_id == tenant_ctx.tenant_id
    ).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    create_stock_movement(
        db=db,
        tenant_id=tenant_ctx.tenant_id,
        product_id=data.product_id,
        quantity=data.quantity,
        movement_type="adjustment",
        reason=data.reason,
        user_id=current_user.id,
        location=data.location
    )
    
    # Check for low stock alerts
    check_low_stock_alerts(db, tenant_ctx.tenant_id, data.product_id, data.location)
    
    db.commit()
    
    return {"message": "Stock adjusted successfully"}


@router.get("/stock/low-alerts", response_model=List[LowStockAlertResponse])
def list_low_stock_alerts(
    resolved: bool = Query(False),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List low stock alerts."""
    require_retail_access(current_user)
    
    alerts = db.query(LowStockAlert).join(Product).filter(
        LowStockAlert.tenant_id == tenant_ctx.tenant_id,
        LowStockAlert.resolved == resolved
    ).order_by(desc(LowStockAlert.created_at)).all()
    
    return [
        LowStockAlertResponse(
            id=alert.id,
            product_id=alert.product_id,
            product_name=alert.product.name,
            product_sku=alert.product.sku,
            current_quantity=alert.current_quantity,
            threshold=alert.threshold,
            location=alert.location,
            acknowledged=alert.acknowledged,
            created_at=alert.created_at
        )
        for alert in alerts
    ]


@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    active_only: bool = Query(True),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all suppliers."""
    require_retail_access(current_user)
    
    query = db.query(Supplier).filter(Supplier.tenant_id == tenant_ctx.tenant_id)
    if active_only:
        query = query.filter(Supplier.active == True)
    
    suppliers = query.all()
    
    # Get product counts
    product_counts = db.query(
        Product.supplier_id,
        func.count(Product.id).label('count')
    ).filter(
        Product.tenant_id == tenant_ctx.tenant_id
    ).group_by(Product.supplier_id).all()
    count_map = {supplier_id: count for supplier_id, count in product_counts}
    
    return [
        SupplierResponse(
            id=s.id,
            name=s.name,
            contact_person=s.contact_person,
            email=s.email,
            phone=s.phone,
            address=s.address,
            active=s.active,
            product_count=count_map.get(s.id, 0),
            created_at=s.created_at
        )
        for s in suppliers
    ]


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new supplier."""
    require_retail_access(current_user)
    
    supplier = Supplier(
        tenant_id=tenant_ctx.tenant_id,
        **data.dict()
    )
    db.add(supplier)
    db.commit()
    db.refresh(supplier)
    
    return SupplierResponse(
        id=supplier.id,
        name=supplier.name,
        contact_person=supplier.contact_person,
        email=supplier.email,
        phone=supplier.phone,
        address=supplier.address,
        active=supplier.active,
        product_count=0,
        created_at=supplier.created_at
    )


@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all product categories."""
    require_retail_access(current_user)
    
    categories = db.query(ProductCategory).filter(
        ProductCategory.tenant_id == tenant_ctx.tenant_id,
        ProductCategory.active == True
    ).all()
    
    # Get product counts
    product_counts = db.query(
        Product.category_id,
        func.count(Product.id).label('count')
    ).filter(
        Product.tenant_id == tenant_ctx.tenant_id
    ).group_by(Product.category_id).all()
    count_map = {cat_id: count for cat_id, count in product_counts}
    
    return [
        CategoryResponse(
            id=c.id,
            name=c.name,
            description=c.description,
            parent_id=c.parent_id,
            active=c.active,
            product_count=count_map.get(c.id, 0)
        )
        for c in categories
    ]


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new product category."""
    require_retail_access(current_user)
    
    category = ProductCategory(
        tenant_id=tenant_ctx.tenant_id,
        **data.dict()
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    return CategoryResponse(
        id=category.id,
        name=category.name,
        description=category.description,
        parent_id=category.parent_id,
        active=category.active,
        product_count=0
    )
