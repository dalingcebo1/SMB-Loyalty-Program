"""
Beauty Package/Bundle Models

Allows salons to create service packages (e.g., "Spa Day" bundle with multiple services).
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Float, Index, Table
from sqlalchemy.orm import relationship
from app.core.database import Base


# Association table for package-service many-to-many relationship
package_services = Table(
    'beauty_package_services',
    Base.metadata,
    Column('id', Integer, primary_key=True),
    Column('package_id', Integer, ForeignKey('beauty_packages.id'), nullable=False),
    Column('service_id', Integer, ForeignKey('beauty_services.id'), nullable=False),
    Column('sequence', Integer, default=0),  # Order in which services are performed
    Index('ix_package_service', 'package_id', 'service_id', unique=True)
)


class BeautyPackage(Base):
    """Service package/bundle (e.g., 'Spa Day', 'Bridal Package')."""
    __tablename__ = "beauty_packages"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Package details
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # spa, bridal, membership, seasonal
    
    # Pricing (total package price, usually discounted vs individual services)
    price_cents = Column(Integer, nullable=False)
    discount_percent = Column(Integer, default=0)  # Discount vs sum of individual services
    
    # Duration (total time including all services)
    total_duration_minutes = Column(Integer, nullable=False)
    
    # Validity
    valid_from = Column(DateTime, nullable=True)  # Package availability start
    valid_until = Column(DateTime, nullable=True)  # Package expiry
    
    # Limits
    max_bookings = Column(Integer, nullable=True)  # Limit number of bookings (e.g., seasonal specials)
    current_bookings = Column(Integer, default=0)
    
    # Settings
    active = Column(Boolean, default=True, nullable=False)
    online_booking_enabled = Column(Boolean, default=True)
    requires_deposit = Column(Boolean, default=False)
    deposit_cents = Column(Integer, default=0)
    
    # Loyalty
    points_multiplier = Column(Float, default=1.0)  # Bonus multiplier for package bookings
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    services = relationship(
        "BeautyService",
        secondary=package_services,
        backref="packages"
    )
    
    __table_args__ = (
        Index('ix_beauty_packages_tenant_active', 'tenant_id', 'active'),
    )
    
    @property
    def price(self) -> float:
        """Package price in currency."""
        return self.price_cents / 100.0
    
    @property
    def is_available(self) -> bool:
        """Check if package is currently available for booking."""
        now = datetime.utcnow()
        if not self.active:
            return False
        if self.valid_from and now < self.valid_from:
            return False
        if self.valid_until and now > self.valid_until:
            return False
        if self.max_bookings and self.current_bookings >= self.max_bookings:
            return False
        return True


class PackageBooking(Base):
    """Track package bookings (links to multiple appointments)."""
    __tablename__ = "beauty_package_bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    package_id = Column(Integer, ForeignKey("beauty_packages.id"), nullable=False, index=True)
    
    # Pricing snapshot (at time of booking)
    package_name = Column(String(200), nullable=False)
    price_paid_cents = Column(Integer, nullable=False)
    deposit_paid_cents = Column(Integer, default=0)
    
    # Status
    status = Column(String(20), nullable=False, default="pending", index=True)
    # Status: pending, confirmed, in_progress, completed, cancelled
    
    # Timestamps
    booked_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    confirmed_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    
    # Notes
    customer_notes = Column(Text)
    cancellation_reason = Column(String(500))
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    package = relationship("BeautyPackage")
    
    __table_args__ = (
        Index('ix_package_bookings_customer', 'tenant_id', 'customer_id'),
        Index('ix_package_bookings_status', 'tenant_id', 'status'),
    )
