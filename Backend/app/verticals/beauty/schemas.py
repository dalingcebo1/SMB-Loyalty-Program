"""Beauty vertical Pydantic schemas."""

from datetime import date, datetime, time
from typing import List, Optional

from pydantic import BaseModel, Field


class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=100)
    price_cents: int = Field(..., ge=0)
    duration_minutes: int = Field(..., gt=0)
    buffer_minutes: int = Field(default=0, ge=0)
    online_booking_enabled: bool = True
    points_multiplier: float = Field(default=1.0, ge=0)
    active: bool = True


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: str
    price_cents: int
    duration_minutes: int
    buffer_minutes: int
    online_booking_enabled: bool
    points_multiplier: float
    active: bool

    class Config:
        from_attributes = True


class StylistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    commission_rate: float = Field(default=0.0, ge=0, le=100)
    accepts_walk_ins: bool = True
    active: bool = True


class StylistResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    title: Optional[str]
    bio: Optional[str]
    photo_url: Optional[str]
    commission_rate: float
    accepts_walk_ins: bool
    active: bool

    class Config:
        from_attributes = True


class StylistServiceCreate(BaseModel):
    service_id: int
    custom_price_cents: Optional[int] = Field(None, ge=0)
    custom_duration_minutes: Optional[int] = Field(None, gt=0)


class AvailabilityCreate(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)  # 0=Monday, 6=Sunday
    start_time: time
    end_time: time
    specific_date: Optional[date] = None
    is_available: bool = True


class AppointmentCreate(BaseModel):
    customer_id: int
    stylist_id: int
    service_id: int
    appointment_date: date
    start_time: time
    customer_notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(pending|confirmed|in_progress|completed|cancelled|no_show)$")
    staff_notes: Optional[str] = None
    reminder_sent: Optional[bool] = None


class AppointmentResponse(BaseModel):
    id: int
    customer_id: int
    stylist_id: int
    service_id: int
    appointment_date: date
    start_time: time
    end_time: time
    status: str
    customer_notes: Optional[str]
    staff_notes: Optional[str]
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AvailableSlot(BaseModel):
    stylist_id: int
    stylist_name: str
    start_time: time
    end_time: time


class PackageCreate(BaseModel):
    """Schema for creating a beauty package."""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    price_cents: int = Field(..., gt=0)
    discount_percent: float = Field(default=0, ge=0, le=100)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    max_bookings: Optional[int] = Field(None, gt=0)
    service_ids: List[int] = Field(..., min_items=1)
    points_multiplier: float = Field(default=1.0, ge=0)
    online_booking_enabled: bool = True
    requires_deposit: bool = False
    active: bool = True


class PackageUpdate(BaseModel):
    """Schema for updating a package."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    price_cents: Optional[int] = Field(None, gt=0)
    discount_percent: Optional[float] = Field(None, ge=0, le=100)
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    max_bookings: Optional[int] = Field(None, gt=0)
    service_ids: Optional[List[int]] = None
    points_multiplier: Optional[float] = Field(None, ge=0)
    online_booking_enabled: Optional[bool] = None
    requires_deposit: Optional[bool] = None
    active: Optional[bool] = None


class PackageResponse(BaseModel):
    """Schema for package response."""
    id: int
    tenant_id: str
    name: str
    description: Optional[str]
    price: float
    discount_percent: float
    valid_from: Optional[datetime]
    valid_until: Optional[datetime]
    max_bookings: Optional[int]
    current_bookings: int
    is_available: bool
    points_multiplier: float
    online_booking_enabled: bool
    requires_deposit: bool
    active: bool
    created_at: datetime
    services: List[dict]

    class Config:
        from_attributes = True


class PackageBookingCreate(BaseModel):
    """Schema for booking a package."""
    package_id: int
    notes: Optional[str] = None


class PackageBookingResponse(BaseModel):
    """Schema for package booking response."""
    id: int
    package_id: int
    package_name: str
    customer_id: int
    status: str
    booked_at: datetime
    redeemed_at: Optional[datetime]
    expires_at: Optional[datetime]
    price_paid_cents: int
    notes: Optional[str]

    class Config:
        from_attributes = True


class ReviewCreate(BaseModel):
    """Schema for creating a service review."""
    appointment_id: int
    overall_rating: int = Field(..., ge=1, le=5)
    service_quality_rating: int = Field(..., ge=1, le=5)
    stylist_rating: int = Field(..., ge=1, le=5)
    cleanliness_rating: int = Field(..., ge=1, le=5)
    value_rating: int = Field(..., ge=1, le=5)
    review_title: Optional[str] = Field(None, max_length=200)
    review_text: Optional[str] = Field(None, max_length=2000)


class ReviewResponse(BaseModel):
    """Schema for review response."""
    id: int
    appointment_id: int
    customer_id: int
    customer_name: str
    service_id: int
    service_name: str
    stylist_id: int
    stylist_name: str
    overall_rating: int
    service_quality_rating: int
    stylist_rating: int
    cleanliness_rating: int
    value_rating: int
    average_rating: float
    review_title: Optional[str]
    review_text: Optional[str]
    approved: bool
    featured: bool
    created_at: datetime

    class Config:
        from_attributes = True
