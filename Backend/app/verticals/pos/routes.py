"""
POS (Point of Sale) API Routes

Thin endpoint handlers that delegate to the ``TransactionService``.
URL paths are preserved exactly as they were in ``app/routes/pos.py``.
"""

from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.plugins.auth.routes import get_current_user, require_capability
from app.models import User

from .schemas import (
    PaymentCreate,
    PaymentResponse,
    SaleCreate,
    SaleItemCreate,
    SaleItemResponse,
    SaleResponse,
    SaleStats,
)
from .services import TransactionService

router = APIRouter(prefix="/api/retail/pos", tags=["pos"])


# ── Sales lifecycle ─────────────────────────────────────────────────────────

@router.post("/sales", response_model=SaleResponse, status_code=201)
async def create_sale(
    sale_data: SaleCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.write")),
):
    """Create a new POS sale transaction."""
    return TransactionService.create_sale(db, tenant_ctx.tenant_id, current_user.id, sale_data)


@router.post("/sales/{sale_id}/items", response_model=SaleItemResponse, status_code=201)
async def add_sale_item(
    sale_id: int,
    item_data: SaleItemCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.write")),
):
    """Add a line item to a pending sale."""
    return TransactionService.add_item(db, tenant_ctx.tenant_id, sale_id, item_data)


@router.delete("/sales/{sale_id}/items/{item_id}", status_code=204)
async def remove_sale_item(
    sale_id: int,
    item_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.write")),
):
    """Remove a line item from a pending sale."""
    TransactionService.remove_item(db, tenant_ctx.tenant_id, sale_id, item_id)
    return None


@router.post("/sales/{sale_id}/payments", response_model=PaymentResponse, status_code=201)
async def add_payment(
    sale_id: int,
    payment_data: PaymentCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.write")),
):
    """Add a payment to a sale."""
    return TransactionService.record_payment(db, tenant_ctx.tenant_id, sale_id, payment_data)


@router.post("/sales/{sale_id}/complete", response_model=SaleResponse)
async def complete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.write")),
):
    """Complete a sale and decrement inventory."""
    return TransactionService.complete_sale(db, tenant_ctx.tenant_id, sale_id, current_user.id)


@router.post("/sales/{sale_id}/void", response_model=SaleResponse)
async def void_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.write")),
):
    """Void a pending sale."""
    return TransactionService.void_sale(db, tenant_ctx.tenant_id, sale_id)


# ── Read operations ─────────────────────────────────────────────────────────

@router.get("/sales/{sale_id}", response_model=SaleResponse)
async def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.read")),
):
    """Get sale details."""
    return TransactionService.get_sale(db, tenant_ctx.tenant_id, sale_id)


@router.get("/sales", response_model=List[SaleResponse])
async def list_sales(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.read")),
    status: Optional[str] = Query(None, pattern="^(pending|completed|voided|refunded)$"),
    location: Optional[str] = None,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
):
    """List sales with optional filters."""
    return TransactionService.list_sales(
        db,
        tenant_ctx.tenant_id,
        status=status,
        location=location,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=limit,
    )


# ── Stats ───────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=SaleStats)
async def get_sales_stats(
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    current_user: User = Depends(require_capability("pos.sales.read")),
):
    """Get sales statistics."""
    return TransactionService.get_stats(db, tenant_ctx.tenant_id)
