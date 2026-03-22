"""
Pydantic schemas for the Retail vertical.

Extracted from the monolithic ``app/routes/retail.py`` — every schema keeps the
exact same field names, types, and defaults so that existing API consumers
(including the frontend) continue to work unchanged.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


# ── Supplier ────────────────────────────────────────────────────────────────

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


# ── Category ────────────────────────────────────────────────────────────────

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


# ── Product ─────────────────────────────────────────────────────────────────

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


# ── Stock ───────────────────────────────────────────────────────────────────

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


# ── Stats ───────────────────────────────────────────────────────────────────

class InventoryStatsResponse(BaseModel):
    """Dashboard stats for inventory overview."""
    total_products: int
    low_stock_count: int
    total_inventory_value_cents: int
    total_suppliers: int
    total_categories: int
