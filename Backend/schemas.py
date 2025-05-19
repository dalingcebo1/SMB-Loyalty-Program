# Backend/schemas.py

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# ─── Order Schemas ──────────────────────────────────────────────────────────────

class OrderBase(BaseModel):
    id: str
    service_id: int
    quantity: int
    extras: list
    payment_pin: Optional[str]
    status: str
    user_id: int
    created_at: datetime
    redeemed: bool
    started_at: Optional[datetime] = None
    ended_at: Optional[datetime] = None

class OrderCreate(BaseModel):
    # ...fields for creating an order...
    pass

class Order(OrderBase):
    class Config:
        from_attributes = True

class OrderResponse(Order):
    pass

class OrderDetailResponse(Order):
    pass

# ─── Vehicle Schemas ────────────────────────────────────────────────────────────

class VehicleBase(BaseModel):
    id: int
    user_id: int
    plate: str
    make: Optional[str]
    model: Optional[str]

class Vehicle(VehicleBase):
    class Config:
        from_attributes = True

# ─── OrderVehicle Schemas ───────────────────────────────────────────────────────

class OrderVehicleBase(BaseModel):
    id: int
    order_id: str
    vehicle_id: int

class OrderVehicle(OrderVehicleBase):
    class Config:
        from_attributes = True

# ─── User Schemas ───────────────────────────────────────────────────────────────

class UserBase(BaseModel):
    id: int
    email: Optional[str]
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    role: Optional[str]

class User(UserBase):
    class Config:
        from_attributes = True

# ─── Active Wash Schema (for frontend active washes list) ───────────────────────

class ActiveWash(BaseModel):
    order_id: str
    user: Optional[User]
    vehicle: Optional[Vehicle]
    payment_pin: Optional[str]
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    status: str

    class Config:
        from_attributes = True

# ─── Vehicle Assignment ─────────────────────────────────────────────────────────

class AssignVehicleRequest(BaseModel):
    vehicle_id: Optional[int] = None
    plate:       Optional[str] = None
    make:        Optional[str] = None
    model:       Optional[str] = None

# ─── Payments ───────────────────────────────────────────────────────────────────

class PaymentInitRequest(BaseModel):
    order_id: str  # was int
    email: Optional[str] = None  # if not stored on the user

class PaymentInitResponse(BaseModel):
    reference:         str
    access_code:       str
    authorization_url: str

class QRResponse(BaseModel):
    reference:       str
    qr_code_base64:  str

class ExtraItem(BaseModel):
    id: int
    quantity: int

class OrderCreateRequest(BaseModel):
    service_id: int
    quantity: int
    extras: List[ExtraItem]

class OrderCreateResponse(BaseModel):
    order_id: str
    qr_data: str

class PaymentRead(BaseModel):
    id: int
    order_id: str  # was int
    amount: int
    method: str
    transaction_id: str
    reference: str
    status: str
    created_at: datetime
    card_brand: Optional[str] = None
    qr_code_base64: Optional[str] = None  # <-- PATCH: add this field

    class Config:
        from_attributes = True

class PaymentVerifyResponse(BaseModel):
    status: str
    order_id: Optional[str] = None
    created_at: Optional[datetime] = None
    redeemed: Optional[bool] = None

# ─── New: User‐exists check ─────────────────────────────────────────────────────

class ExistsResponse(BaseModel):
    """
    Returned by GET /users/{uid}/exists.
    """
    exists: bool

class UserOut(UserBase):
    pass

class StaffRegisterRequest(BaseModel):
    email: str
    password: str
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    tenant_id: Optional[str] = "default"

# ─── Redemption Schemas ─────────────────────────────────────────────────────────

class RedemptionBase(BaseModel):
    id: int
    tenant_id: str
    user_id: int
    reward_id: int
    created_at: datetime
    status: str
    pin: Optional[str]
    milestone: Optional[int]
    redeemed_at: Optional[datetime]
    qr_code: Optional[str]
    reward_name: Optional[str] = None  # <-- Add this line

    class Config:
        from_attributes = True
