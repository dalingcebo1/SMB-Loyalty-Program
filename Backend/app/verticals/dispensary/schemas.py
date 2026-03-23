"""Dispensary vertical Pydantic schemas."""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ============================================================================
# Category Schemas
# ============================================================================

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


# ============================================================================
# Product Schemas
# ============================================================================

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


# ============================================================================
# Customer Verification Schemas
# ============================================================================

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


# ============================================================================
# Sale Schemas
# ============================================================================

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


# ============================================================================
# Purchase Limit Schemas
# ============================================================================

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
