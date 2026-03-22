"""
Retail Inventory API Routes

Thin endpoint handlers that delegate to the service layer.
URL paths are preserved exactly as they were in the monolithic ``app/routes/retail.py``.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.plugins.auth.routes import get_current_user, require_capability
from app.models import User

from .schemas import (
    CategoryCreate,
    CategoryResponse,
    InventoryStatsResponse,
    LowStockAlertResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    StockAdjustment,
    SupplierCreate,
    SupplierResponse,
)
from .services import (
    CategoryService,
    InventoryService,
    ProductService,
    SupplierService,
)

router = APIRouter(prefix="/api/retail", tags=["retail"])


# ── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=InventoryStatsResponse)
def get_inventory_stats(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.inventory.read")),
    db: Session = Depends(get_db),
):
    """Get inventory statistics for dashboard."""
    return InventoryService.get_stats(db, tenant_ctx.id)


# ── Products ────────────────────────────────────────────────────────────────

@router.get("/products", response_model=List[ProductResponse])
def list_products(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    low_stock_only: bool = Query(False),
    active_only: bool = Query(True),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.products.read")),
    db: Session = Depends(get_db),
):
    """List all products with inventory levels."""
    return ProductService.list_products(
        db,
        tenant_ctx.id,
        search=search,
        category_id=category_id,
        low_stock_only=low_stock_only,
        active_only=active_only,
    )


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    data: ProductCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.products.write")),
    db: Session = Depends(get_db),
):
    """Create a new product."""
    return ProductService.create_product(db, tenant_ctx.id, data, current_user.id)


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    data: ProductUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.products.write")),
    db: Session = Depends(get_db),
):
    """Update an existing product."""
    return ProductService.update_product(db, tenant_ctx.id, product_id, data)


# ── Stock ───────────────────────────────────────────────────────────────────

@router.post("/stock/adjust")
def adjust_stock(
    data: StockAdjustment,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.inventory.write")),
    db: Session = Depends(get_db),
):
    """Adjust inventory level for a product."""
    return InventoryService.adjust_stock(
        db,
        tenant_ctx.id,
        data.product_id,
        data.quantity,
        data.reason,
        current_user.id,
        data.location,
    )


@router.get("/stock/low-alerts", response_model=List[LowStockAlertResponse])
def list_low_stock_alerts(
    resolved: bool = Query(False),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.inventory.read")),
    db: Session = Depends(get_db),
):
    """List low stock alerts."""
    return InventoryService.list_low_stock_alerts(db, tenant_ctx.id, resolved)


# ── Suppliers ───────────────────────────────────────────────────────────────

@router.get("/suppliers", response_model=List[SupplierResponse])
def list_suppliers(
    active_only: bool = Query(True),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.suppliers.read")),
    db: Session = Depends(get_db),
):
    """List all suppliers."""
    return SupplierService.list_suppliers(db, tenant_ctx.id, active_only)


@router.post("/suppliers", response_model=SupplierResponse, status_code=status.HTTP_201_CREATED)
def create_supplier(
    data: SupplierCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.suppliers.write")),
    db: Session = Depends(get_db),
):
    """Create a new supplier."""
    return SupplierService.create_supplier(db, tenant_ctx.id, data)


# ── Categories ──────────────────────────────────────────────────────────────

@router.get("/categories", response_model=List[CategoryResponse])
def list_categories(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.categories.read")),
    db: Session = Depends(get_db),
):
    """List all product categories."""
    return CategoryService.list_categories(db, tenant_ctx.id)


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    data: CategoryCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("retail.categories.write")),
    db: Session = Depends(get_db),
):
    """Create a new product category."""
    return CategoryService.create_category(db, tenant_ctx.id, data)
