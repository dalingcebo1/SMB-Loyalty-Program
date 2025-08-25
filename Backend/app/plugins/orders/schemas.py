from pydantic import BaseModel, Field  # type: ignore
from typing import Optional, List, Union
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
    order_id: Union[str, int]
    qr_data: Union[str, int]
    payment_pin: Optional[str] = None
    # ID of the user's default vehicle, if auto-assigned
    default_vehicle_id: Optional[int] = None

class OrderBase(BaseModel):
    id: Union[str, int] = Field(alias="orderId")
    service_id: int = Field(alias="serviceId")
    quantity: int
    extras: list
    payment_pin: Optional[str] = Field(alias="paymentPin")
    status: str
    user_id: int = Field(alias="userId")
    created_at: datetime = Field(alias="createdAt")
    redeemed: bool
    started_at: Optional[datetime] = Field(None, alias="startedAt")
    ended_at: Optional[datetime] = Field(None, alias="endedAt")

    class Config:
        from_attributes = True
        populate_by_name = True

class OrderResponse(OrderBase):
    pass

class OrderDetailResponse(OrderResponse):
    # List of vehicle IDs assigned to the order
    vehicles: List[int] = []
    # Service details
    serviceName: Optional[str] = None
    loyaltyEligible: Optional[bool] = None
    category: Optional[str] = None
    qrData: Optional[str] = None
    amount: Optional[int] = None
    # Loyalty status
    visits: Optional[int] = 0
    progress: Optional[int] = 0  # visits % REWARD_INTERVAL
    nextMilestone: Optional[int] = None
    upcomingRewards: Optional[List[dict]] = []
    # Estimated wash time in minutes, bay assignment and notification
    estimatedWashTime: Optional[int] = None
    bayNumber: Optional[int] = None
    notificationMessage: Optional[str] = None
    # Link to next action (redeem wash for loyalty points)
    nextActionUrl: Optional[str] = None

class AssignVehicleRequest(BaseModel):
    vehicle_id: Optional[int] = None
    plate: Optional[str] = None
    make: Optional[str] = None
    model: Optional[str] = None
