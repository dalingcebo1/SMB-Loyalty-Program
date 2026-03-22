"""
Pydantic schemas for the Padel vertical.

Extracted from the monolithic ``app/routes/padel.py`` — every schema keeps the
exact same field names, types, and defaults so that existing API consumers
continue to work unchanged.
"""

from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, Field, validator


# ── Court ───────────────────────────────────────────────────────────────────

class CourtBase(BaseModel):
    court_number: str = Field(..., description="Court number (e.g., '1', 'A', 'Center')")
    court_type: str = Field(default="standard", description="Court type: standard, professional, training")
    surface_type: str = Field(default="synthetic_grass", description="Surface: synthetic_grass, concrete, artificial_turf")
    has_lighting: bool = Field(default=False, description="Whether court has lighting for night play")
    base_price_cents: int = Field(..., gt=0, description="Base hourly price in cents")
    notes: Optional[str] = None

class CourtCreate(CourtBase):
    pass

class CourtUpdate(BaseModel):
    court_number: Optional[str] = None
    court_type: Optional[str] = None
    surface_type: Optional[str] = None
    has_lighting: Optional[bool] = None
    base_price_cents: Optional[int] = None
    active: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    notes: Optional[str] = None

class CourtResponse(CourtBase):
    id: int
    active: bool
    maintenance_mode: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ── Pricing ─────────────────────────────────────────────────────────────────

class PricingRuleBase(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="0=Monday, 6=Sunday, null=all days")
    start_time: time = Field(..., description="Pricing rule start time")
    end_time: time = Field(..., description="Pricing rule end time")
    price_per_hour_cents: int = Field(..., gt=0, description="Price per hour in cents")
    label: str = Field(..., description="Label like 'Peak Hours', 'Weekend Rate'")
    priority: int = Field(default=0, description="Higher priority rules take precedence")

class PricingRuleCreate(PricingRuleBase):
    pass

class PricingRuleResponse(PricingRuleBase):
    id: int
    court_id: int
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ── Equipment ───────────────────────────────────────────────────────────────

class EquipmentBase(BaseModel):
    name: str = Field(..., description="Equipment name like 'Padel Racket', 'Ball Set'")
    equipment_type: str = Field(..., description="Type: racket, balls, shoes, other")
    description: Optional[str] = None
    quantity_available: int = Field(..., ge=0, description="Available quantity for rental")
    rental_price_cents: int = Field(..., ge=0, description="Rental price in cents")

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    equipment_type: Optional[str] = None
    description: Optional[str] = None
    quantity_available: Optional[int] = None
    rental_price_cents: Optional[int] = None
    active: Optional[bool] = None

class EquipmentResponse(EquipmentBase):
    id: int
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# ── Booking ─────────────────────────────────────────────────────────────────

class EquipmentRental(BaseModel):
    equipment_id: int
    quantity: int = Field(..., gt=0)

class BookingCreate(BaseModel):
    customer_id: int
    court_id: int
    booking_date: date
    start_time: time
    duration_minutes: int = Field(..., description="Duration: 60, 90, or 120 minutes")
    player_count: int = Field(default=4, ge=1, le=4, description="Number of players (1-4)")
    player_names: Optional[str] = Field(None, description="Comma-separated player names")
    equipment_rentals: List[EquipmentRental] = Field(default_factory=list)
    customer_notes: Optional[str] = None
    
    @validator('duration_minutes')
    def validate_duration(cls, v):
        if v not in [60, 90, 120]:
            raise ValueError('Duration must be 60, 90, or 120 minutes')
        return v

class BookingUpdate(BaseModel):
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    player_count: Optional[int] = None
    player_names: Optional[str] = None
    status: Optional[str] = None
    staff_notes: Optional[str] = None
    paid: Optional[bool] = None
    payment_method: Optional[str] = None

class BookingResponse(BaseModel):
    id: int
    court_id: int
    court_number: str
    customer_id: int
    booking_date: date
    start_time: time
    end_time: time
    duration_minutes: int
    court_price_cents: int
    equipment_price_cents: int
    total_price_cents: int
    player_count: int
    player_names: Optional[str]
    status: str
    paid: bool
    payment_method: Optional[str]
    customer_notes: Optional[str]
    staff_notes: Optional[str]
    reminder_sent: bool
    created_at: datetime
    equipment_rentals: List[dict]
    
    class Config:
        from_attributes = True


# ── Availability ────────────────────────────────────────────────────────────

class AvailabilityQuery(BaseModel):
    date: date
    duration_minutes: int = Field(..., description="Requested duration: 60, 90, or 120 minutes")
    
    @validator('duration_minutes')
    def validate_duration(cls, v):
        if v not in [60, 90, 120]:
            raise ValueError('Duration must be 60, 90, or 120 minutes')
        return v
