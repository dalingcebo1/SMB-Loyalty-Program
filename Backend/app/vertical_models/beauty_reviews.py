"""
Beauty Service Review/Rating Models

Allows customers to rate and review services after appointments.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Index, Float
from sqlalchemy.orm import relationship
from app.core.database import Base


class ServiceReview(Base):
    """Customer review for a completed appointment."""
    __tablename__ = "beauty_service_reviews"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True, unique=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("beauty_services.id"), nullable=False, index=True)
    
    # Ratings (1-5 stars)
    overall_rating = Column(Integer, nullable=False)  # Overall experience
    service_quality_rating = Column(Integer, nullable=True)  # Quality of service
    stylist_rating = Column(Integer, nullable=True)  # Stylist performance
    cleanliness_rating = Column(Integer, nullable=True)  # Facility cleanliness
    value_rating = Column(Integer, nullable=True)  # Value for money
    
    # Review content
    review_text = Column(Text, nullable=True)
    review_title = Column(String(200), nullable=True)
    
    # Moderation
    approved = Column(Boolean, default=False, nullable=False, index=True)
    featured = Column(Boolean, default=False)
    flagged = Column(Boolean, default=False)
    moderation_notes = Column(Text, nullable=True)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    stylist = relationship("Stylist", foreign_keys=[stylist_id])
    service = relationship("BeautyService", foreign_keys=[service_id])
    appointment = relationship("Appointment", foreign_keys=[appointment_id])
    
    __table_args__ = (
        Index('ix_reviews_tenant_approved', 'tenant_id', 'approved'),
        Index('ix_reviews_stylist', 'stylist_id', 'approved'),
        Index('ix_reviews_service', 'service_id', 'approved'),
    )
    
    @property
    def average_rating(self) -> float:
        """Calculate average across all rating categories."""
        ratings = [
            self.overall_rating,
            self.service_quality_rating,
            self.stylist_rating,
            self.cleanliness_rating,
            self.value_rating,
        ]
        valid_ratings = [r for r in ratings if r is not None]
        return sum(valid_ratings) / len(valid_ratings) if valid_ratings else 0.0


class AppointmentReminder(Base):
    """Track appointment reminders sent to customers."""
    __tablename__ = "beauty_appointment_reminders"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id"), nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Reminder details
    reminder_type = Column(String(20), nullable=False)  # sms, email, push
    hours_before = Column(Integer, nullable=False)  # How many hours before appointment
    
    # Status
    status = Column(String(20), nullable=False, default="pending", index=True)
    # Status: pending, sent, failed, cancelled
    
    # Delivery tracking
    sent_at = Column(DateTime, nullable=True)
    delivered_at = Column(DateTime, nullable=True)
    failed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)
    
    # External tracking
    external_id = Column(String(200), nullable=True)  # Twilio/SendGrid message ID
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    appointment = relationship("Appointment", foreign_keys=[appointment_id])
    customer = relationship("User", foreign_keys=[customer_id])
    
    __table_args__ = (
        Index('ix_reminders_status', 'tenant_id', 'status'),
        Index('ix_reminders_appointment', 'appointment_id'),
    )
