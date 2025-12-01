"""
Carwash vertical database models.

These models extend the core platform with carwash-specific functionality.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from database import Base


class Vehicle(Base):
    """Customer vehicle tracking"""
    __tablename__ = "vehicles"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Vehicle details
    license_plate = Column(String, nullable=False, index=True)
    make = Column(String, nullable=True)
    model = Column(String, nullable=True)
    year = Column(Integer, nullable=True)
    color = Column(String, nullable=True)
    
    # Metadata
    notes = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="vehicles")
    user = relationship("User", back_populates="vehicles")
    orders = relationship("Order", back_populates="vehicle")


class WashPackage(Base):
    """Wash service packages"""
    __tablename__ = "wash_packages"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Package details
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    price_cents = Column(Integer, nullable=False)  # Price in cents
    duration_minutes = Column(Integer, default=30)  # Estimated duration
    
    # Features
    features = Column(JSON, nullable=True)  # {"exterior": true, "interior": true, "wax": false}
    
    # Status
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    # Loyalty integration
    points_awarded = Column(Integer, default=0)  # Points for completing this package
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="wash_packages")


class CarwashMembership(Base):
    """Carwash-specific membership tiers"""
    __tablename__ = "carwash_memberships"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Membership details
    tier = Column(String, nullable=False)  # "basic", "premium", "platinum"
    monthly_price_cents = Column(Integer, nullable=False)
    
    # Benefits
    washes_per_month = Column(Integer, default=4)
    discount_percentage = Column(Float, default=0.0)  # 0.0 to 100.0
    priority_service = Column(Boolean, default=False)
    
    # Status
    status = Column(String, default="active")  # "active", "paused", "cancelled"
    
    # Billing
    billing_day = Column(Integer, default=1)  # Day of month for billing
    next_billing_date = Column(DateTime, nullable=True)
    
    # Usage tracking
    washes_used_this_month = Column(Integer, default=0)
    last_reset_date = Column(DateTime, default=datetime.utcnow)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    cancelled_at = Column(DateTime, nullable=True)
    
    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User")


class WashHistory(Base):
    """Track individual wash service history"""
    __tablename__ = "wash_history"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    vehicle_id = Column(Integer, ForeignKey("vehicles.id"), nullable=True, index=True)
    order_id = Column(String, ForeignKey("orders.id"), nullable=True, index=True)
    package_id = Column(Integer, ForeignKey("wash_packages.id"), nullable=True)
    
    # Service details
    service_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    service_type = Column(String, nullable=False)  # "wash", "detail", "maintenance"
    
    # Staff assignment
    staff_user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    
    # Status tracking
    status = Column(String, default="pending")  # "pending", "in_progress", "completed", "cancelled"
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    
    # Quality & feedback
    quality_rating = Column(Integer, nullable=True)  # 1-5 stars
    customer_notes = Column(Text, nullable=True)
    staff_notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User", foreign_keys=[user_id])
    vehicle = relationship("Vehicle")
    order = relationship("Order")
    package = relationship("WashPackage")
    staff = relationship("User", foreign_keys=[staff_user_id])
