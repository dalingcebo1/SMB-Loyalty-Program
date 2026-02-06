"""
Cannabis Dispensary Routes - Week 9
Comprehensive endpoints for cannabis retail with compliance tracking.
"""
from datetime import datetime, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, or_
from pydantic import BaseModel, Field, validator
from decimal import Decimal

from app.core.database import get_db
from app.core.tenant_context import TenantContext, get_tenant_context
from app.models import (
    DispensaryProductCategory,
    DispensaryProduct,
    DispensaryCustomerVerification,
    DispensaryPurchaseLimitTracking,
    DispensarySale,
    DispensarySaleItem,
    User,
    LoyaltyProgram,
    LoyaltyTransaction,
    PointBalance,
)

router = APIRouter(prefix="/dispensary", tags=["Dispensary"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

# Category Schemas
class CategoryCreate(BaseModel):
    name: str = Field(..., max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    display_order: int = 0
    requires_medical_card: bool = False
    active: bool = True


class CategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    icon: Optional[str] = Field(None, max_length=50)
    display_order: Optional[int] = None
    requires_medical_card: Optional[bool] = None
    active: Optional[bool] = None


class CategoryResponse(BaseModel):
    id: int
    tenant_id: str
    name: str
    description: Optional[str]
    icon: Optional[str]
    display_order: int
    requires_medical_card: bool
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Product Schemas
class ProductCreate(BaseModel):
    category_id: int
    name: str = Field(..., max_length=200)
    strain: Optional[str] = Field(None, max_length=100)
    strain_type: Optional[str] = Field(None, max_length=20)  # indica, sativa, hybrid
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=50)
    thc_percentage: Optional[float] = Field(None, ge=0, le=100)
    cbd_percentage: Optional[float] = Field(None, ge=0, le=100)
    terpenes: Optional[str] = None
    effects: Optional[str] = None
    medical_uses: Optional[str] = None
    price_cents: int = Field(..., ge=0)
    unit_size: str = Field(..., max_length=50)
    stock_quantity: int = Field(0, ge=0)
    batch_number: Optional[str] = Field(None, max_length=100)
    harvest_date: Optional[date] = None
    package_date: Optional[date] = None
    expiry_date: Optional[date] = None
    requires_medical_card: bool = False
    potency_level: Optional[str] = Field(None, max_length=20)  # low, medium, high, very_high
    image_url: Optional[str] = Field(None, max_length=500)
    featured: bool = False
    display_order: int = 0
    active: bool = True


class ProductUpdate(BaseModel):
    category_id: Optional[int] = None
    name: Optional[str] = Field(None, max_length=200)
    strain: Optional[str] = Field(None, max_length=100)
    strain_type: Optional[str] = Field(None, max_length=20)
    description: Optional[str] = None
    sku: Optional[str] = Field(None, max_length=50)
    thc_percentage: Optional[float] = Field(None, ge=0, le=100)
    cbd_percentage: Optional[float] = Field(None, ge=0, le=100)
    terpenes: Optional[str] = None
    effects: Optional[str] = None
    medical_uses: Optional[str] = None
    price_cents: Optional[int] = Field(None, ge=0)
    unit_size: Optional[str] = Field(None, max_length=50)
    stock_quantity: Optional[int] = Field(None, ge=0)
    batch_number: Optional[str] = Field(None, max_length=100)
    harvest_date: Optional[date] = None
    package_date: Optional[date] = None
    expiry_date: Optional[date] = None
    requires_medical_card: Optional[bool] = None
    potency_level: Optional[str] = Field(None, max_length=20)
    image_url: Optional[str] = Field(None, max_length=500)
    featured: Optional[bool] = None
    display_order: Optional[int] = None
    active: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    tenant_id: str
    category_id: int
    category_name: Optional[str] = None
    name: str
    strain: Optional[str]
    strain_type: Optional[str]
    description: Optional[str]
    sku: Optional[str]
    thc_percentage: Optional[float]
    cbd_percentage: Optional[float]
    terpenes: Optional[str]
    effects: Optional[str]
    medical_uses: Optional[str]
    price_cents: int
    unit_size: str
    stock_quantity: int
    batch_number: Optional[str]
    harvest_date: Optional[date]
    package_date: Optional[date]
    expiry_date: Optional[date]
    requires_medical_card: bool
    potency_level: Optional[str]
    image_url: Optional[str]
    featured: bool
    display_order: int
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Customer Verification Schemas
class VerificationCreate(BaseModel):
    customer_id: int
    age_verified: bool = False
    date_of_birth: Optional[date] = None
    age_verification_method: Optional[str] = Field(None, max_length=50)
    has_medical_card: bool = False
    medical_card_number: Optional[str] = Field(None, max_length=100)
    medical_card_expiry: Optional[date] = None
    medical_condition: Optional[str] = Field(None, max_length=200)
    id_document_type: Optional[str] = Field(None, max_length=50)
    id_document_number: Optional[str] = Field(None, max_length=100)
    id_document_expiry: Optional[date] = None
    verified_by_staff_id: int
    verification_status: str = Field("pending", max_length=20)
    notes: Optional[str] = None


class VerificationUpdate(BaseModel):
    age_verified: Optional[bool] = None
    date_of_birth: Optional[date] = None
    age_verification_method: Optional[str] = Field(None, max_length=50)
    has_medical_card: Optional[bool] = None
    medical_card_number: Optional[str] = Field(None, max_length=100)
    medical_card_expiry: Optional[date] = None
    medical_condition: Optional[str] = Field(None, max_length=200)
    id_document_type: Optional[str] = Field(None, max_length=50)
    id_document_number: Optional[str] = Field(None, max_length=100)
    id_document_expiry: Optional[date] = None
    verification_status: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None


class VerificationResponse(BaseModel):
    id: int
    tenant_id: str
    customer_id: int
    customer_name: Optional[str] = None
    age_verified: bool
    date_of_birth: Optional[date]
    age_verification_date: Optional[datetime]
    age_verification_method: Optional[str]
    has_medical_card: bool
    medical_card_number: Optional[str]
    medical_card_expiry: Optional[date]
    medical_card_verified_date: Optional[datetime]
    medical_condition: Optional[str]
    id_document_type: Optional[str]
    id_document_number: Optional[str]
    id_document_expiry: Optional[date]
    verified_by_staff_id: Optional[int]
    verification_status: str
    notes: Optional[str]
    created_at: datetime
    
    class Config:
        from_attributes = True


# Sale Schemas
class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(..., ge=1)


class SaleCreate(BaseModel):
    customer_id: int
    items: List[SaleItemCreate] = Field(..., min_items=1)
    staff_id: int
    payment_method: str = Field(..., max_length=50)
    payment_reference: Optional[str] = Field(None, max_length=100)
    compliance_notes: Optional[str] = None


class SaleItemResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: int
    unit_price_cents: int
    subtotal_cents: int
    grams_sold: float
    batch_number: Optional[str]
    thc_percentage: Optional[float]
    cbd_percentage: Optional[float]
    strain_type: Optional[str]
    
    class Config:
        from_attributes = True


class SaleResponse(BaseModel):
    id: int
    tenant_id: str
    customer_id: int
    customer_name: Optional[str] = None
    verification_id: int
    sale_number: str
    sale_date: datetime
    customer_age_at_sale: int
    medical_card_used: bool
    total_grams_sold: float
    staff_id: int
    staff_name: Optional[str] = None
    subtotal_cents: int
    tax_cents: int
    discount_cents: int
    total_cents: int
    payment_method: str
    payment_status: str
    payment_reference: Optional[str]
    loyalty_points_awarded: int
    loyalty_points_awarded_at: Optional[datetime]
    compliance_notes: Optional[str]
    items: List[SaleItemResponse] = []
    created_at: datetime
    
    class Config:
        from_attributes = True


# Purchase Limit Schemas
class PurchaseLimitResponse(BaseModel):
    id: int
    tenant_id: str
    customer_id: int
    daily_limit_grams: float
    monthly_limit_grams: float
    current_day: date
    current_month: str
    daily_purchased_grams: float
    monthly_purchased_grams: float
    daily_transaction_count: int
    monthly_transaction_count: int
    daily_remaining_grams: float
    monthly_remaining_grams: float
    can_purchase: bool
    
    class Config:
        from_attributes = True


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
    category = DispensaryProductCategory(
        tenant_id=tenant_ctx.tenant_id,
        **category_data.dict()
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@router.get("/categories", response_model=List[CategoryResponse])
def get_categories(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
    active_only: bool = Query(True, description="Filter by active status"),
):
    """Get all dispensary categories for the tenant."""
    query = db.query(DispensaryProductCategory).filter(
        DispensaryProductCategory.tenant_id == tenant_ctx.tenant_id
    )
    
    if active_only:
        query = query.filter(DispensaryProductCategory.active == True)
    
    categories = query.order_by(DispensaryProductCategory.display_order, DispensaryProductCategory.name).all()
    return categories


@router.get("/categories/{category_id}", response_model=CategoryResponse)
def get_category(
    category_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get a specific category by ID."""
    category = db.query(DispensaryProductCategory).filter(
        DispensaryProductCategory.id == category_id,
        DispensaryProductCategory.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return category


@router.put("/categories/{category_id}", response_model=CategoryResponse)
def update_category(
    category_id: int,
    category_data: CategoryUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update a category."""
    category = db.query(DispensaryProductCategory).filter(
        DispensaryProductCategory.id == category_id,
        DispensaryProductCategory.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    for field, value in category_data.dict(exclude_unset=True).items():
        setattr(category, field, value)
    
    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    category_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Delete a category (soft delete by setting active=False)."""
    category = db.query(DispensaryProductCategory).filter(
        DispensaryProductCategory.id == category_id,
        DispensaryProductCategory.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    category.active = False
    db.commit()


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
    # Verify category exists
    category = db.query(DispensaryProductCategory).filter(
        DispensaryProductCategory.id == product_data.category_id,
        DispensaryProductCategory.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    product = DispensaryProduct(
        tenant_id=tenant_ctx.tenant_id,
        **product_data.dict()
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    
    # Add category name to response
    response = ProductResponse.from_orm(product)
    response.category_name = category.name
    return response


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
    query = db.query(DispensaryProduct).options(
        joinedload(DispensaryProduct.category)
    ).filter(
        DispensaryProduct.tenant_id == tenant_ctx.tenant_id
    )
    
    if category_id is not None:
        query = query.filter(DispensaryProduct.category_id == category_id)
    
    if strain_type:
        query = query.filter(DispensaryProduct.strain_type == strain_type)
    
    if requires_medical_card is not None:
        query = query.filter(DispensaryProduct.requires_medical_card == requires_medical_card)
    
    if active_only:
        query = query.filter(DispensaryProduct.active == True)
    
    if featured_only:
        query = query.filter(DispensaryProduct.featured == True)
    
    if in_stock_only:
        query = query.filter(DispensaryProduct.stock_quantity > 0)
    
    products = query.order_by(
        DispensaryProduct.display_order,
        DispensaryProduct.name
    ).all()
    
    # Add category names to responses
    response_list = []
    for product in products:
        response = ProductResponse.from_orm(product)
        response.category_name = product.category.name if product.category else None
        response_list.append(response)
    
    return response_list


@router.get("/products/{product_id}", response_model=ProductResponse)
def get_product(
    product_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get a specific product by ID."""
    product = db.query(DispensaryProduct).options(
        joinedload(DispensaryProduct.category)
    ).filter(
        DispensaryProduct.id == product_id,
        DispensaryProduct.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    response = ProductResponse.from_orm(product)
    response.category_name = product.category.name if product.category else None
    return response


@router.put("/products/{product_id}", response_model=ProductResponse)
def update_product(
    product_id: int,
    product_data: ProductUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update a product."""
    product = db.query(DispensaryProduct).options(
        joinedload(DispensaryProduct.category)
    ).filter(
        DispensaryProduct.id == product_id,
        DispensaryProduct.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    # If category_id is being updated, verify it exists
    if product_data.category_id is not None:
        category = db.query(DispensaryProductCategory).filter(
            DispensaryProductCategory.id == product_data.category_id,
            DispensaryProductCategory.tenant_id == tenant_ctx.tenant_id
        ).first()
        
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
    
    for field, value in product_data.dict(exclude_unset=True).items():
        setattr(product, field, value)
    
    db.commit()
    db.refresh(product)
    
    response = ProductResponse.from_orm(product)
    response.category_name = product.category.name if product.category else None
    return response


@router.delete("/products/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Delete a product (soft delete by setting active=False)."""
    product = db.query(DispensaryProduct).filter(
        DispensaryProduct.id == product_id,
        DispensaryProduct.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    product.active = False
    db.commit()


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
    # Check if verification already exists
    existing = db.query(DispensaryCustomerVerification).filter(
        DispensaryCustomerVerification.tenant_id == tenant_ctx.tenant_id,
        DispensaryCustomerVerification.customer_id == verification_data.customer_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Verification record already exists. Use PUT to update."
        )
    
    # Verify customer exists
    customer = db.query(User).filter(User.id == verification_data.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Set verification timestamps
    now = datetime.utcnow()
    verification = DispensaryCustomerVerification(
        tenant_id=tenant_ctx.tenant_id,
        **verification_data.dict()
    )
    
    if verification_data.age_verified:
        verification.age_verification_date = now
    
    if verification_data.has_medical_card:
        verification.medical_card_verified_date = now
    
    db.add(verification)
    db.commit()
    db.refresh(verification)
    
    response = VerificationResponse.from_orm(verification)
    response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
    return response


@router.get("/verifications", response_model=List[VerificationResponse])
def list_verifications(
    status: Optional[str] = Query(None, description="Filter by verification status"),
    has_medical_card: Optional[bool] = Query(None, description="Filter by medical card status"),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List all customer verification records (admin only)."""
    query = db.query(DispensaryCustomerVerification).filter(
        DispensaryCustomerVerification.tenant_id == tenant_ctx.tenant_id
    )
    
    if status:
        query = query.filter(DispensaryCustomerVerification.verification_status == status)
    
    if has_medical_card is not None:
        query = query.filter(DispensaryCustomerVerification.has_medical_card == has_medical_card)
    
    verifications = query.order_by(DispensaryCustomerVerification.created_at.desc()).all()
    
    # Enrich with customer names
    results = []
    for verification in verifications:
        customer = db.query(User).filter(User.id == verification.customer_id).first()
        response = VerificationResponse.from_orm(verification)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        results.append(response)
    
    return results


@router.get("/verifications/{customer_id}", response_model=VerificationResponse)
def get_verification(
    customer_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get customer verification status."""
    verification = db.query(DispensaryCustomerVerification).filter(
        DispensaryCustomerVerification.tenant_id == tenant_ctx.tenant_id,
        DispensaryCustomerVerification.customer_id == customer_id
    ).first()
    
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record not found")
    
    customer = db.query(User).filter(User.id == customer_id).first()
    response = VerificationResponse.from_orm(verification)
    response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
    return response


@router.put("/verifications/{customer_id}", response_model=VerificationResponse)
def update_verification(
    customer_id: int,
    verification_data: VerificationUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update customer verification record."""
    verification = db.query(DispensaryCustomerVerification).filter(
        DispensaryCustomerVerification.tenant_id == tenant_ctx.tenant_id,
        DispensaryCustomerVerification.customer_id == customer_id
    ).first()
    
    if not verification:
        raise HTTPException(status_code=404, detail="Verification record not found")
    
    # Update verification timestamps
    now = datetime.utcnow()
    for field, value in verification_data.dict(exclude_unset=True).items():
        if field == "age_verified" and value and not verification.age_verified:
            verification.age_verification_date = now
        if field == "has_medical_card" and value and not verification.has_medical_card:
            verification.medical_card_verified_date = now
        setattr(verification, field, value)
    
    db.commit()
    db.refresh(verification)
    
    customer = db.query(User).filter(User.id == customer_id).first()
    response = VerificationResponse.from_orm(verification)
    response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
    return response


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
    today = date.today()
    current_month = today.strftime("%Y-%m")
    
    # Get or create purchase limit tracking
    limit_tracking = db.query(DispensaryPurchaseLimitTracking).filter(
        DispensaryPurchaseLimitTracking.tenant_id == tenant_ctx.tenant_id,
        DispensaryPurchaseLimitTracking.customer_id == customer_id,
        DispensaryPurchaseLimitTracking.current_day == today
    ).first()
    
    if not limit_tracking:
        # Create new tracking record for today
        limit_tracking = DispensaryPurchaseLimitTracking(
            tenant_id=tenant_ctx.tenant_id,
            customer_id=customer_id,
            current_day=today,
            current_month=current_month,
            daily_limit_grams=28.0,  # Default 1 oz per day
            monthly_limit_grams=150.0,  # Default 150g per month
            daily_purchased_grams=0.0,
            monthly_purchased_grams=0.0,
            daily_transaction_count=0,
            monthly_transaction_count=0
        )
        db.add(limit_tracking)
        db.commit()
        db.refresh(limit_tracking)
    
    # Calculate remaining allowances
    daily_remaining = limit_tracking.daily_limit_grams - limit_tracking.daily_purchased_grams
    monthly_remaining = limit_tracking.monthly_limit_grams - limit_tracking.monthly_purchased_grams
    can_purchase = daily_remaining > 0 and monthly_remaining > 0
    
    response = PurchaseLimitResponse.from_orm(limit_tracking)
    response.daily_remaining_grams = max(0, daily_remaining)
    response.monthly_remaining_grams = max(0, monthly_remaining)
    response.can_purchase = can_purchase
    
    return response


# ============================================================================
# Sale Endpoints
# ============================================================================

def generate_sale_number() -> str:
    """Generate unique sale number in format DSP-YYYYMMDD-####."""
    now = datetime.utcnow()
    return f"DSP-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"


def calculate_grams_from_unit_size(unit_size: str, quantity: int) -> float:
    """Calculate total grams from unit size string (e.g., '3.5g', '100mg')."""
    unit_size = unit_size.lower().strip()
    
    # Extract numeric value
    import re
    match = re.match(r'([\d.]+)\s*([a-z]+)', unit_size)
    if not match:
        return 0.0
    
    value = float(match.group(1))
    unit = match.group(2)
    
    # Convert to grams
    if unit == 'g':
        return value * quantity
    elif unit == 'mg':
        return (value / 1000.0) * quantity
    elif unit == 'oz':
        return value * 28.35 * quantity
    else:
        return 0.0


def award_loyalty_points_for_sale(
    db: Session,
    tenant_id: str,
    customer_id: int,
    sale_id: int,
    total_cents: int,
    sale_number: str
) -> int:
    """Award loyalty points for a dispensary sale (1 point per R10)."""
    # Get active loyalty program
    program = db.query(LoyaltyProgram).filter(
        LoyaltyProgram.tenant_id == tenant_id,
        LoyaltyProgram.program_status == "active"
    ).first()
    
    if not program:
        return 0
    
    # Calculate points: 1 point per R10
    points = int(total_cents / 1000)  # 1000 cents = R10
    
    if points <= 0:
        return 0
    
    # Get or create point balance
    balance = db.query(PointBalance).filter(
        PointBalance.tenant_id == tenant_id,
        PointBalance.customer_id == customer_id
    ).first()
    
    if not balance:
        balance = PointBalance(
            tenant_id=tenant_id,
            customer_id=customer_id,
            program_id=program.id,
            current_points=0,
            lifetime_points=0
        )
        db.add(balance)
        db.flush()
    
    # Update balance
    balance.current_points += points
    balance.lifetime_points += points
    
    # Create loyalty transaction
    transaction = LoyaltyTransaction(
        tenant_id=tenant_id,
        customer_id=customer_id,
        program_id=program.id,
        transaction_type="earn",
        points=points,
        description=f"Earned from dispensary sale {sale_number}",
        reference_type="dispensary_sale",
        reference_id=str(sale_id)
    )
    db.add(transaction)
    
    return points


@router.post("/sales", response_model=SaleResponse, status_code=status.HTTP_201_CREATED)
def create_sale(
    sale_data: SaleCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Process a dispensary sale with compliance checks."""
    # 1. Verify customer verification status
    verification = db.query(DispensaryCustomerVerification).filter(
        DispensaryCustomerVerification.tenant_id == tenant_ctx.tenant_id,
        DispensaryCustomerVerification.customer_id == sale_data.customer_id,
        DispensaryCustomerVerification.age_verified == True,
        DispensaryCustomerVerification.verification_status == "verified"
    ).first()
    
    if not verification:
        raise HTTPException(
            status_code=403,
            detail="Customer age verification required before purchase"
        )
    
    # Calculate age
    if not verification.date_of_birth:
        raise HTTPException(status_code=400, detail="Customer date of birth required")
    
    today = date.today()
    age = today.year - verification.date_of_birth.year
    if today.month < verification.date_of_birth.month or \
       (today.month == verification.date_of_birth.month and today.day < verification.date_of_birth.day):
        age -= 1
    
    if age < 18:  # Minimum age requirement
        raise HTTPException(status_code=403, detail="Customer must be 18+ to purchase")
    
    # 2. Calculate total grams and check limits
    total_grams = 0.0
    sale_items_data = []
    
    for item in sale_data.items:
        product = db.query(DispensaryProduct).filter(
            DispensaryProduct.id == item.product_id,
            DispensaryProduct.tenant_id == tenant_ctx.tenant_id,
            DispensaryProduct.active == True
        ).first()
        
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        
        # Check stock
        if product.stock_quantity < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}"
            )
        
        # Check medical card requirement
        if product.requires_medical_card and not verification.has_medical_card:
            raise HTTPException(
                status_code=403,
                detail=f"Medical card required for {product.name}"
            )
        
        # Calculate grams for this item
        item_grams = calculate_grams_from_unit_size(product.unit_size, item.quantity)
        total_grams += item_grams
        
        sale_items_data.append({
            "product": product,
            "quantity": item.quantity,
            "item_grams": item_grams
        })
    
    # 3. Check purchase limits
    current_month = today.strftime("%Y-%m")
    limit_tracking = db.query(DispensaryPurchaseLimitTracking).filter(
        DispensaryPurchaseLimitTracking.tenant_id == tenant_ctx.tenant_id,
        DispensaryPurchaseLimitTracking.customer_id == sale_data.customer_id,
        DispensaryPurchaseLimitTracking.current_day == today
    ).first()
    
    if not limit_tracking:
        limit_tracking = DispensaryPurchaseLimitTracking(
            tenant_id=tenant_ctx.tenant_id,
            customer_id=sale_data.customer_id,
            current_day=today,
            current_month=current_month,
            daily_limit_grams=28.0,
            monthly_limit_grams=150.0,
            daily_purchased_grams=0.0,
            monthly_purchased_grams=0.0,
            daily_transaction_count=0,
            monthly_transaction_count=0
        )
        db.add(limit_tracking)
        db.flush()
    
    # Check daily limit
    if limit_tracking.daily_purchased_grams + total_grams > limit_tracking.daily_limit_grams:
        raise HTTPException(
            status_code=403,
            detail=f"Daily purchase limit exceeded. Remaining: {limit_tracking.daily_limit_grams - limit_tracking.daily_purchased_grams:.1f}g"
        )
    
    # Check monthly limit
    if limit_tracking.monthly_purchased_grams + total_grams > limit_tracking.monthly_limit_grams:
        raise HTTPException(
            status_code=403,
            detail=f"Monthly purchase limit exceeded. Remaining: {limit_tracking.monthly_limit_grams - limit_tracking.monthly_purchased_grams:.1f}g"
        )
    
    # 4. Calculate pricing
    subtotal_cents = sum(item["product"].price_cents * item["quantity"] for item in sale_items_data)
    tax_cents = int(subtotal_cents * 0.15)  # 15% tax rate (adjustable)
    total_cents = subtotal_cents + tax_cents
    
    # 5. Create sale record
    sale_number = generate_sale_number()
    sale = DispensarySale(
        tenant_id=tenant_ctx.tenant_id,
        customer_id=sale_data.customer_id,
        verification_id=verification.id,
        sale_number=sale_number,
        customer_age_at_sale=age,
        medical_card_used=verification.has_medical_card,
        total_grams_sold=total_grams,
        staff_id=sale_data.staff_id,
        subtotal_cents=subtotal_cents,
        tax_cents=tax_cents,
        discount_cents=0,
        total_cents=total_cents,
        payment_method=sale_data.payment_method,
        payment_status="completed",
        payment_reference=sale_data.payment_reference,
        compliance_notes=sale_data.compliance_notes
    )
    db.add(sale)
    db.flush()
    
    # 6. Create sale items and update inventory
    for item_data in sale_items_data:
        product = item_data["product"]
        quantity = item_data["quantity"]
        
        sale_item = DispensarySaleItem(
            sale_id=sale.id,
            product_id=product.id,
            quantity=quantity,
            unit_price_cents=product.price_cents,
            subtotal_cents=product.price_cents * quantity,
            grams_sold=item_data["item_grams"],
            batch_number=product.batch_number,
            product_name=product.name,
            thc_percentage=product.thc_percentage,
            cbd_percentage=product.cbd_percentage,
            strain_type=product.strain_type
        )
        db.add(sale_item)
        
        # Update product stock
        product.stock_quantity -= quantity
    
    # 7. Update purchase limits
    limit_tracking.daily_purchased_grams += total_grams
    limit_tracking.monthly_purchased_grams += total_grams
    limit_tracking.daily_transaction_count += 1
    limit_tracking.monthly_transaction_count += 1
    
    # 8. Award loyalty points
    points = award_loyalty_points_for_sale(
        db=db,
        tenant_id=tenant_ctx.tenant_id,
        customer_id=sale_data.customer_id,
        sale_id=sale.id,
        total_cents=total_cents,
        sale_number=sale_number
    )
    
    if points > 0:
        sale.loyalty_points_awarded = points
        sale.loyalty_points_awarded_at = datetime.utcnow()
    
    db.commit()
    db.refresh(sale)
    
    # Build response
    customer = db.query(User).filter(User.id == sale_data.customer_id).first()
    staff = db.query(User).filter(User.id == sale_data.staff_id).first()
    
    response = SaleResponse.from_orm(sale)
    response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
    response.staff_name = f"{staff.first_name} {staff.last_name}" if staff else None
    response.items = [SaleItemResponse.from_orm(item) for item in sale.items]
    
    return response


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
    query = db.query(DispensarySale).filter(
        DispensarySale.tenant_id == tenant_ctx.tenant_id
    )
    
    if customer_id:
        query = query.filter(DispensarySale.customer_id == customer_id)
    
    if start_date:
        query = query.filter(DispensarySale.sale_date >= start_date)
    
    if end_date:
        query = query.filter(DispensarySale.sale_date <= end_date)
    
    sales = query.order_by(DispensarySale.sale_date.desc()).limit(limit).all()
    
    # Build responses with customer/staff names
    response_list = []
    for sale in sales:
        customer = db.query(User).filter(User.id == sale.customer_id).first()
        staff = db.query(User).filter(User.id == sale.staff_id).first()
        
        response = SaleResponse.from_orm(sale)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        response.staff_name = f"{staff.first_name} {staff.last_name}" if staff else None
        response.items = [SaleItemResponse.from_orm(item) for item in sale.items]
        response_list.append(response)
    
    return response_list


@router.get("/sales/{sale_id}", response_model=SaleResponse)
def get_sale(
    sale_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Get a specific sale by ID."""
    sale = db.query(DispensarySale).filter(
        DispensarySale.id == sale_id,
        DispensarySale.tenant_id == tenant_ctx.tenant_id
    ).first()
    
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    customer = db.query(User).filter(User.id == sale.customer_id).first()
    staff = db.query(User).filter(User.id == sale.staff_id).first()
    
    response = SaleResponse.from_orm(sale)
    response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
    response.staff_name = f"{staff.first_name} {staff.last_name}" if staff else None
    response.items = [SaleItemResponse.from_orm(item) for item in sale.items]
    
    return response


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
    sales = db.query(DispensarySale).filter(
        DispensarySale.tenant_id == tenant_ctx.tenant_id,
        DispensarySale.sale_date >= start_date,
        DispensarySale.sale_date <= end_date
    ).all()
    
    total_sales = len(sales)
    total_grams_sold = sum(sale.total_grams_sold for sale in sales)
    total_revenue_cents = sum(sale.total_cents for sale in sales)
    medical_card_sales = sum(1 for sale in sales if sale.medical_card_used)
    
    return {
        "period": {
            "start_date": start_date,
            "end_date": end_date
        },
        "summary": {
            "total_transactions": total_sales,
            "total_grams_sold": round(total_grams_sold, 2),
            "total_revenue_cents": total_revenue_cents,
            "medical_card_transactions": medical_card_sales,
            "recreational_transactions": total_sales - medical_card_sales
        },
        "sales": [
            {
                "sale_number": sale.sale_number,
                "sale_date": sale.sale_date,
                "customer_age": sale.customer_age_at_sale,
                "medical_card_used": sale.medical_card_used,
                "total_grams": sale.total_grams_sold,
                "total_cents": sale.total_cents
            }
            for sale in sales
        ]
    }
