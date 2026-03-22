"""
Pydantic schemas for the Flowershop vertical.

Extracted from the monolithic ``app/routes/flowershop.py`` — every schema keeps the
exact same field names, types, and defaults so that existing API consumers
continue to work unchanged.
"""

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, Field


# ── Category ────────────────────────────────────────────────────────────────

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


# ── Occasion ────────────────────────────────────────────────────────────────

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


# ── Product ─────────────────────────────────────────────────────────────────

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


# ── Order ───────────────────────────────────────────────────────────────────

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


# ── Delivery Slot ───────────────────────────────────────────────────────────

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


# ── Payment ─────────────────────────────────────────────────────────────────

class FlowerOrderPayRequest(BaseModel):
    token: str


class FlowerOrderPayResponse(BaseModel):
    order_id: int
    order_number: str
    payment_status: str
    total_cents: int
    message: str
