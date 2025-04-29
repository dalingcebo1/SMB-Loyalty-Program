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
