# Backend/schemas.py

from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel

### ─── Order & Items ────────────────────────────────────────────────────────────

class OrderItemCreate(BaseModel):
    service_id: int
    category: str
    qty: int
    extras: Optional[List[int]] = []

class OrderCreate(BaseModel):
    user_id: int
    items: List[OrderItemCreate]

class OrderItemRead(BaseModel):
    id: int
    service_id: int
    category: str
    qty: int
    extras: List[int]
    line_total: int

    model_config = { "from_attributes": True }

class OrderResponse(BaseModel):
    id: int
    user_id: int
    total_amount: int
    status: str

    model_config = { "from_attributes": True }

class OrderDetailResponse(OrderResponse):
    created_at: datetime
    items:     List[OrderItemRead]
    vehicles:  List[int]

    model_config = { "from_attributes": True }


### ─── Vehicle Assignment ───────────────────────────────────────────────────────

class AssignVehicleRequest(BaseModel):
    vehicle_id: Optional[int] = None
    plate:       Optional[str] = None
    make:        Optional[str] = None
    model:       Optional[str] = None


### ─── Payments ────────────────────────────────────────────────────────────────

class PaymentInitRequest(BaseModel):
    order_id: int
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


### ─── New: User‐exists check ────────────────────────────────────────────────────

class ExistsResponse(BaseModel):
    """
    Returned by GET /users/{uid}/exists.
    """
    exists: bool
