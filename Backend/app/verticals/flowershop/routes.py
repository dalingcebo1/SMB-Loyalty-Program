"""
Flowershop API Routes

Thin endpoint handlers that delegate to the service layer.
URL paths are preserved exactly as they were in ``app/routes/flowershop.py``.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import User
from app.plugins.auth.routes import require_capability

from .schemas import (
    CategoryCreate,
    CategoryResponse,
    CategoryUpdate,
    DeliverySlotCreate,
    DeliverySlotResponse,
    FlowerOrderPayRequest,
    FlowerOrderPayResponse,
    OccasionCreate,
    OccasionResponse,
    OrderCreate,
    OrderResponse,
    OrderUpdate,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
)
from .services import (
    CategoryService,
    DeliverySlotService,
    OccasionService,
    OrderService,
    PaymentService,
    ProductService,
    _build_order_response,
)

router = APIRouter(prefix="/api/flowershop", tags=["Flowershop"])


# ── Category Management ─────────────────────────────────────────────────────

@router.post("/categories", response_model=CategoryResponse, status_code=201)
def create_category(
    category: CategoryCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_products")),
):
    """Create a new product category."""
    return CategoryService.create_category(db, tenant_ctx.id, category)


@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(
    active_only: bool = Query(True, description="Filter active categories only"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_products")),
):
    """List all product categories."""
    return CategoryService.list_categories(db, tenant_ctx.id, active_only)


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_products")),
):
    """Get a specific category."""
    return CategoryService.get_category(db, tenant_ctx.id, category_id)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_update: CategoryUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_products")),
):
    """Update a category."""
    return CategoryService.update_category(db, tenant_ctx.id, category_id, category_update)


@router.delete("/categories/{category_id}", status_code=204)
def delete_category(
    category_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_products")),
):
    """Soft delete a category."""
    CategoryService.delete_category(db, tenant_ctx.id, category_id)


# ── Occasion Management ─────────────────────────────────────────────────────

@router.post("/occasions", response_model=OccasionResponse, status_code=201)
def create_occasion(
    occasion: OccasionCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_collections")),
):
    """Create a new occasion."""
    return OccasionService.create_occasion(db, tenant_ctx.id, occasion)


@router.get("/occasions", response_model=List[OccasionResponse])
def list_occasions(
    active_only: bool = Query(True, description="Filter active occasions only"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_products")),
):
    """List all occasions."""
    return OccasionService.list_occasions(db, tenant_ctx.id, active_only)


# ── Product Management ──────────────────────────────────────────────────────

@router.post("/products", response_model=ProductResponse, status_code=201)
def create_product(
    product: ProductCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_products")),
):
    """Create a new flower product."""
    return ProductService.create_product(db, tenant_ctx.id, product)


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
    _user: User = Depends(require_capability("flowershop.view_products")),
):
    """List all flower products with optional filters."""
    return ProductService.list_products(
        db, tenant_ctx.id,
        category_id=category_id, occasion_id=occasion_id,
        featured_only=featured_only, seasonal_only=seasonal_only,
        active_only=active_only, search=search,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_products")),
):
    """Get a specific product."""
    return ProductService.get_product(db, tenant_ctx.id, product_id)


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_update: ProductUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_products")),
):
    """Update a product."""
    return ProductService.update_product(db, tenant_ctx.id, product_id, product_update)


@router.delete("/products/{product_id}", status_code=204)
def delete_product(
    product_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_products")),
):
    """Soft delete a product."""
    ProductService.delete_product(db, tenant_ctx.id, product_id)


# ── Orders ──────────────────────────────────────────────────────────────────

@router.post("/orders", response_model=OrderResponse, status_code=201)
def create_order(
    order: OrderCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.process_orders")),
):
    """Create a new flower order."""
    tenant_id = tenant_ctx.id
    db_order, order_items = OrderService.create_order(db, tenant_id, order)

    customer = db.query(User).filter(User.id == order.customer_id).first()
    if customer and customer.email:
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
            total_cents=db_order.total_cents,
        )

    return _build_order_response(db_order)


@router.get("/orders", response_model=List[OrderResponse])
def list_orders(
    from_date: Optional[date] = Query(None, description="Filter orders from this date"),
    to_date: Optional[date] = Query(None, description="Filter orders to this date"),
    status: Optional[str] = Query(None, description="Filter by status"),
    customer_id: Optional[int] = Query(None, description="Filter by customer"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_orders")),
):
    """List orders with optional filters."""
    orders = OrderService.list_orders(
        db, tenant_ctx.id, from_date, to_date, status, customer_id
    )
    return [_build_order_response(o) for o in orders]


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_orders")),
):
    """Get specific order details."""
    order = OrderService.get_order(db, tenant_ctx.id, order_id)
    return _build_order_response(order)


@router.put("/orders/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: int,
    order_update: OrderUpdate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_all_orders")),
):
    """Update an order."""
    tenant_id = tenant_ctx.id
    order, old_status = OrderService.update_order(db, tenant_id, order_id, order_update)

    update_data = order_update.model_dump(exclude_unset=True)
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

    return _build_order_response(order)


# ── Payment ─────────────────────────────────────────────────────────────────

@router.post("/orders/{order_id}/pay", response_model=FlowerOrderPayResponse)
def pay_flower_order(
    order_id: int,
    pay_request: FlowerOrderPayRequest,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.process_orders")),
):
    """Process Yoco card payment for a flower order."""
    tenant_id = tenant_ctx.id
    order = PaymentService.process_payment(db, tenant_id, order_id)
    return PaymentService.charge_yoco(db, tenant_id, order, pay_request.token)


# ── Delivery Slots ──────────────────────────────────────────────────────────

@router.post("/delivery-slots", response_model=DeliverySlotResponse, status_code=201)
def create_delivery_slot(
    slot: DeliverySlotCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.manage_delivery")),
):
    """Create a delivery slot."""
    return DeliverySlotService.create_slot(db, tenant_ctx.id, slot)


@router.get("/delivery-slots", response_model=List[DeliverySlotResponse])
def list_delivery_slots(
    delivery_date: Optional[date] = Query(None, description="Filter by delivery date"),
    available_only: bool = Query(True, description="Show only available slots"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    _user: User = Depends(require_capability("flowershop.view_orders")),
):
    """List delivery slots."""
    return DeliverySlotService.list_slots(db, tenant_ctx.id, delivery_date, available_only)
