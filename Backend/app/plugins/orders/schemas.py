from pydantic import BaseModel  # type: ignore
from typing import Optional, List
from datetime import datetime

# Legacy order creation schema for legacy endpoints
class OrderItemCreate(BaseModel):
    service_id: int
    category: str
    qty: int
    extras: Optional[List[int]] = None

class OrderCreate(BaseModel):
    user_id: int
    items: List[OrderItemCreate]

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
    payment_pin: Optional[str] = None
    # ID of the user's default vehicle, if auto-assigned
    default_vehicle_id: Optional[int] = None

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

    class Config:
        from_attributes = True

class OrderResponse(OrderBase):
    pass

class OrderDetailResponse(OrderResponse):
    # List of vehicle IDs assigned to the order
    vehicles: List[int] = []
    # Loyalty status
    visits: Optional[int] = 0
    progress: Optional[int] = 0  # visits % REWARD_INTERVAL
    nextMilestone: Optional[int] = None
    upcomingRewards: Optional[List[dict]] = []
    # Estimated wash time in minutes, bay assignment and notification
    estimatedWashTime: Optional[int] = None
    bayNumber: Optional[int] = None
    notificationMessage: Optional[str] = None

class AssignVehicleRequest(BaseModel):
    vehicle_id: Optional[int] = None
    plate: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
