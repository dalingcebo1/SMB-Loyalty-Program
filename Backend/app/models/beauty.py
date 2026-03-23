"""Beauty / salon models."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Time,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Float,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class BeautyService(Base):
    """Service offered by beauty salon/spa (haircut, coloring, massage, etc.)."""
    __tablename__ = "beauty_services"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # haircut, coloring, nails, spa, massage
    
    # Pricing
    price_cents = Column(Integer, nullable=False)
    
    # Duration in minutes
    duration_minutes = Column(Integer, nullable=False, default=60)
    
    # Booking settings
    buffer_minutes = Column(Integer, default=0)  # Time between appointments
    requires_deposit = Column(Boolean, default=False)
    deposit_cents = Column(Integer, default=0)
    
    # Availability
    active = Column(Boolean, default=True)
    online_booking_enabled = Column(Boolean, default=True)
    
    # Loyalty
    points_multiplier = Column(Float, default=1.0)  # Bonus points for this service
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    appointments = relationship("Appointment", back_populates="service")
    stylist_services = relationship("StylistService", back_populates="service", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_beauty_services_tenant_category', 'tenant_id', 'category'),
    )


class Stylist(Base):
    """Staff member who provides beauty/salon services."""
    __tablename__ = "stylists"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Link to user account if they have one
    
    name = Column(String(200), nullable=False)
    email = Column(String(200))
    phone = Column(String(50))
    
    # Profile
    title = Column(String(100))  # Senior Stylist, Nail Technician, etc.
    bio = Column(Text)
    photo_url = Column(String(500))
    
    # Settings
    active = Column(Boolean, default=True)
    accepts_walk_ins = Column(Boolean, default=True)
    online_booking_enabled = Column(Boolean, default=True)
    
    # Commission
    commission_rate = Column(Float, default=0.0)  # 0.0 - 1.0 (percentage)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    appointments = relationship("Appointment", back_populates="stylist")
    availability = relationship("StylistAvailability", back_populates="stylist", cascade="all, delete-orphan")
    stylist_services = relationship("StylistService", back_populates="stylist", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_stylists_tenant_active', 'tenant_id', 'active'),
    )


class StylistService(Base):
    """Many-to-many relationship: which stylists can provide which services."""
    __tablename__ = "stylist_services"
    
    id = Column(Integer, primary_key=True, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("beauty_services.id"), nullable=False, index=True)
    
    # Optional: stylist-specific pricing override
    custom_price_cents = Column(Integer)
    custom_duration_minutes = Column(Integer)
    
    stylist = relationship("Stylist", back_populates="stylist_services")
    service = relationship("BeautyService", back_populates="stylist_services")
    
    __table_args__ = (
        UniqueConstraint('stylist_id', 'service_id', name='uq_stylist_service'),
    )


class StylistAvailability(Base):
    """Weekly recurring availability schedule for stylists."""
    __tablename__ = "stylist_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    
    # Day of week (0=Monday, 6=Sunday)
    day_of_week = Column(Integer, nullable=False)
    
    # Time slots
    start_time = Column(Time, nullable=False)  # e.g., 09:00
    end_time = Column(Time, nullable=False)    # e.g., 17:00
    
    # Optional: specific date overrides
    specific_date = Column(Date, nullable=True)  # For one-time schedules
    is_available = Column(Boolean, default=True)  # False for blocking time off
    
    stylist = relationship("Stylist", back_populates="availability")
    
    __table_args__ = (
        Index('ix_stylist_availability_day', 'stylist_id', 'day_of_week'),
        Index('ix_stylist_availability_date', 'stylist_id', 'specific_date'),
    )


class Appointment(Base):
    """Customer appointment booking."""
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("beauty_services.id"), nullable=False, index=True)
    
    # Appointment details
    appointment_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    
    # Pricing (snapshot at booking time)
    price_cents = Column(Integer, nullable=False)
    deposit_paid_cents = Column(Integer, default=0)
    
    # Status: pending, confirmed, in_progress, completed, cancelled, no_show
    status = Column(String(20), nullable=False, default="pending")
    
    # Notes
    customer_notes = Column(Text)  # Customer's special requests
    staff_notes = Column(Text)     # Internal staff notes
    cancellation_reason = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    # Reminders
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime)
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    stylist = relationship("Stylist", back_populates="appointments")
    service = relationship("BeautyService", back_populates="appointments")
    
    __table_args__ = (
        Index('ix_appointments_tenant_date', 'tenant_id', 'appointment_date'),
        Index('ix_appointments_stylist_date', 'stylist_id', 'appointment_date'),
        Index('ix_appointments_status', 'tenant_id', 'status'),
    )
