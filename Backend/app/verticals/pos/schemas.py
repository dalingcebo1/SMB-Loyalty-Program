"""
Pydantic schemas for the POS vertical.

Extracted from the monolithic ``app/routes/pos.py`` — every schema keeps the
exact same field names, types, and defaults so that existing API consumers
continue to work unchanged.
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field, validator


# ── Sale item ───────────────────────────────────────────────────────────────

class SaleItemCreate(BaseModel):
    product_id: int
    quantity: int = Field(gt=0)
    discount_cents: int = Field(default=0, ge=0)

    @validator("discount_cents")
    def validate_discount(cls, v):  # noqa: N805
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


# ── Payment ─────────────────────────────────────────────────────────────────

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


# ── Sale ────────────────────────────────────────────────────────────────────

class SaleCreate(BaseModel):
    location: str = Field(default="main", max_length=100)
    customer_id: Optional[int] = None
    tax_rate: int = Field(default=1500, description="Tax rate in basis points (1500 = 15%)")
    notes: Optional[str] = Field(default=None, max_length=500)


class SaleUpdate(BaseModel):
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


# ── Stats ───────────────────────────────────────────────────────────────────

class SaleStats(BaseModel):
    total_sales: int
    total_revenue_cents: int
    average_sale_cents: int
    sales_today: int
    revenue_today_cents: int
