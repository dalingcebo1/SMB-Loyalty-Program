"""Padel court booking models."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Time,
    ForeignKey,
    Boolean,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class PadelCourt(Base):
    """Padel court definition."""
    __tablename__ = "padel_courts"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Court details
    court_number = Column(String(50), nullable=False)  # "Court 1", "Court A", etc.
    court_type = Column(String(50))  # "Indoor", "Outdoor", "Covered"
    surface_type = Column(String(50))  # "Glass", "Concrete", "Artificial Grass"
    has_lighting = Column(Boolean, default=True)
    
    # Pricing (base price, can be overridden by CourtPricing for time slots)
    base_price_cents = Column(Integer, nullable=False, default=0)  # Price per hour
    
    # Status
    active = Column(Boolean, default=True, nullable=False)
    maintenance_mode = Column(Boolean, default=False)
    notes = Column(Text)
    
    # Relationships
    bookings = relationship("CourtBooking", back_populates="court")
    pricing_rules = relationship("CourtPricing", back_populates="court")
    
    __table_args__ = (
        Index('ix_padel_courts_tenant_active', 'tenant_id', 'active'),
    )


class CourtPricing(Base):
    """Time-based pricing rules for courts (peak/off-peak)."""
    __tablename__ = "court_pricing"
    
    id = Column(Integer, primary_key=True, index=True)
    court_id = Column(Integer, ForeignKey("padel_courts.id"), nullable=False, index=True)
    
    # Time rules (NULL = applies to all)
    day_of_week = Column(Integer)  # 0=Monday, 6=Sunday, NULL=all days
    start_time = Column(Time)  # Start of pricing window
    end_time = Column(Time)    # End of pricing window
    
    # Pricing
    price_per_hour_cents = Column(Integer, nullable=False)
    label = Column(String(100))  # "Peak Hours", "Weekend Rate", etc.
    
    # Priority (higher number = higher priority when rules overlap)
    priority = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    
    # Relationships
    court = relationship("PadelCourt", back_populates="pricing_rules")
    
    __table_args__ = (
        Index('ix_court_pricing_court_day', 'court_id', 'day_of_week'),
    )


class PadelEquipment(Base):
    """Equipment available for rent (rackets, balls, etc.)."""
    __tablename__ = "padel_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Equipment details
    name = Column(String(200), nullable=False)  # "Padel Racket", "Balls (3-pack)"
    equipment_type = Column(String(50), nullable=False)  # "racket", "balls", "shoes"
    description = Column(Text)
    
    # Inventory
    quantity_available = Column(Integer, default=1)
    
    # Pricing
    rental_price_cents = Column(Integer, nullable=False, default=0)  # Price per booking
    
    # Status
    active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('ix_padel_equipment_tenant_type', 'tenant_id', 'equipment_type'),
    )


class CourtBooking(Base):
    """Padel court booking record."""
    __tablename__ = "court_bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Booking details
    court_id = Column(Integer, ForeignKey("padel_courts.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Time slot
    booking_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # Typically 60, 90, or 120
    
    # Pricing
    court_price_cents = Column(Integer, nullable=False)  # Court rental cost
    equipment_price_cents = Column(Integer, default=0)   # Equipment rental cost
    total_price_cents = Column(Integer, nullable=False)  # Total booking cost
    
    # Participants
    player_count = Column(Integer, default=4)  # Standard padel is 2v2
    player_names = Column(Text)  # JSON array or comma-separated names
    
    # Status
    status = Column(String(20), default="pending", nullable=False)
    # pending, confirmed, in_progress, completed, cancelled, no_show
    
    # Notes
    customer_notes = Column(Text)
    staff_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    # Payment status
    paid = Column(Boolean, default=False)
    payment_method = Column(String(50))
    
    # Reminders
    reminder_sent = Column(Boolean, default=False)
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    court = relationship("PadelCourt", back_populates="bookings")
    equipment_rentals = relationship("BookingEquipment", back_populates="booking")
    
    __table_args__ = (
        Index('ix_court_bookings_date_court', 'booking_date', 'court_id'),
        Index('ix_court_bookings_customer', 'customer_id', 'booking_date'),
        Index('ix_court_bookings_status', 'tenant_id', 'status'),
    )


class BookingEquipment(Base):
    """Equipment rented with a court booking."""
    __tablename__ = "booking_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("court_bookings.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("padel_equipment.id"), nullable=False, index=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    price_cents = Column(Integer, nullable=False)  # Price at time of booking
    
    # Relationships
    booking = relationship("CourtBooking", back_populates="equipment_rentals")
    equipment = relationship("PadelEquipment")
    
    __table_args__ = (
        Index('ix_booking_equipment_booking', 'booking_id'),
    )
