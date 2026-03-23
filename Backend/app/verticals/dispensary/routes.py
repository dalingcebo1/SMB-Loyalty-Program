"""Dispensary vertical route handlers."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import TenantContext, get_tenant_context

from .schemas import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    VerificationCreate,
    VerificationUpdate,
    VerificationResponse,
    SaleCreate,
    SaleResponse,
    PurchaseLimitResponse,
)
from .services import (
    CategoryService,
    ComplianceService,
    ProductService,
    SaleService,
    VerificationService,
)

router = APIRouter(prefix="/api/dispensary", tags=["Dispensary"])


# ============================================================================
# Category Endpoints
# ============================================================================


@router.post("/categories", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    category_data: CategoryCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Create a new dispensary product category."""
    return CategoryService.create_category(db, tenant_ctx.id, category_data)


@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
    active_only: bool = Query(True, description="Filter by active status"),
):
    """Get all dispensary categories for the tenant."""
    return CategoryService.list_categories(db, tenant_ctx.id, active_only)


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get a specific category by ID."""
    return CategoryService.get_category(db, tenant_ctx.id, category_id)


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update a category."""
    return CategoryService.update_category(db, tenant_ctx.id, category_id, category_data)


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Delete a category (soft delete by setting active=False)."""
    CategoryService.delete_category(db, tenant_ctx.id, category_id)


# ============================================================================
# Product Endpoints
# ============================================================================


@router.post("/products", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_data: ProductCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Create a new dispensary product."""
    return ProductService.create_product(db, tenant_ctx.id, product_data)


@router.get("/products", response_model=List[ProductResponse])
def get_products(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    strain_type: Optional[str] = Query(None, description="Filter by strain type (indica, sativa, hybrid)"),
    requires_medical_card: Optional[bool] = Query(None, description="Filter by medical card requirement"),
    active_only: bool = Query(True, description="Filter by active status"),
    featured_only: bool = Query(False, description="Show only featured products"),
    in_stock_only: bool = Query(False, description="Show only in-stock products"),
):
    """Get all dispensary products with optional filters."""
    return ProductService.list_products(
        db, tenant_ctx.id,
        category_id=category_id,
        strain_type=strain_type,
        requires_medical_card=requires_medical_card,
        active_only=active_only,
        featured_only=featured_only,
        in_stock_only=in_stock_only,
    )


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get a specific product by ID."""
    return ProductService.get_product(db, tenant_ctx.id, product_id)


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update a product."""
    return ProductService.update_product(db, tenant_ctx.id, product_id, product_data)


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Delete a product (soft delete by setting active=False)."""
    ProductService.delete_product(db, tenant_ctx.id, product_id)


# ============================================================================
# Customer Verification Endpoints
# ============================================================================


@router.post("/verifications", response_model=VerificationResponse, status_code=status.HTTP_201_CREATED)
def create_verification(
    verification_data: VerificationCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Create or update customer verification record."""
    return VerificationService.create_verification(db, tenant_ctx.id, verification_data)


@router.get("/verifications", response_model=List[VerificationResponse])
def list_verifications(
    status: Optional[str] = Query(None, description="Filter by verification status"),
    has_medical_card: Optional[bool] = Query(None, description="Filter by medical card status"),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List all customer verification records (admin only)."""
    return VerificationService.list_verifications(db, tenant_ctx.id, status=status, has_medical_card=has_medical_card)


@router.get("/verifications/{customer_id}", response_model=VerificationResponse)
def get_verification(
    customer_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get customer verification status."""
    return VerificationService.get_verification(db, tenant_ctx.id, customer_id)


@router.put("/verifications/{customer_id}", response_model=VerificationResponse)
def update_verification(
    customer_id: int,
    verification_data: VerificationUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update customer verification record."""
    return VerificationService.update_verification(db, tenant_ctx.id, customer_id, verification_data)


# ============================================================================
# Purchase Limit Endpoints
# ============================================================================


@router.get("/purchase-limits/{customer_id}", response_model=PurchaseLimitResponse)
def get_purchase_limits(
    customer_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get customer's current purchase limits and remaining allowance."""
    return ComplianceService.get_remaining_allowance(db, tenant_ctx.id, customer_id)


# ============================================================================
# Sale Endpoints
# ============================================================================


@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_data: SaleCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Process a dispensary sale with compliance checks."""
    return SaleService.create_sale(db, tenant_ctx.id, sale_data)


@router.get("/sales", response_model=List[SaleResponse])
def get_sales(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
    customer_id: Optional[int] = Query(None, description="Filter by customer"),
    start_date: Optional[date] = Query(None, description="Filter sales from this date"),
    end_date: Optional[date] = Query(None, description="Filter sales until this date"),
    limit: int = Query(50, ge=1, le=200, description="Number of records to return"),
):
    """Get dispensary sales with optional filters."""
    return SaleService.list_sales(
        db, tenant_ctx.id,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
    )


@router.get("/sales/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get a specific sale by ID."""
    return SaleService.get_sale(db, tenant_ctx.id, sale_id)


# ============================================================================
# Compliance Reporting Endpoints
# ============================================================================


@router.get("/compliance/sales-report")
def get_compliance_sales_report(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
    start_date: date = Query(..., description="Report start date"),
    end_date: date = Query(..., description="Report end date"),
):
    """Generate compliance sales report for regulatory requirements."""
    return ComplianceService.generate_sales_report(db, tenant_ctx.id, start_date, end_date)
