"""
Marketing Campaign Models

Supports SMS and email campaigns with AI-generated content, customer segmentation,
and delivery tracking.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Boolean, Enum as SQLEnum, JSON, Index
from sqlalchemy.orm import relationship
from enum import Enum

from app.core.database import Base


class CampaignType(str, Enum):
    """Campaign delivery channel."""
    EMAIL = "email"
    SMS = "sms"
    PUSH = "push"  #Future: mobile app push notifications


class CampaignStatus(str, Enum):
    """Campaign lifecycle status."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    SENDING = "sending"
    SENT = "sent"
    FAILED = "failed"
    CANCELLED = "cancelled"


class SegmentType(str, Enum):
    """Customer segmentation criteria."""
    ALL = "all"  # All customers
    HIGH_VALUE = "high_value"  # Top spenders
    DORMANT = "dormant"  # Inactive for X days
    NEW = "new"  # Recent signups
    BIRTHDAY = "birthday"  # Birthday this month
    LOYALTY_TIER = "loyalty_tier"  # Specific loyalty tier
    CUSTOM = "custom"  # Custom SQL filter (admin only)


class Campaign(Base):
    """Marketing campaign (emails,SMS, or push notifications)."""
    __tablename__ = "campaigns"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Campaign metadata
    name = Column(String(200), nullable=False)
    campaign_type = Column(SQLEnum(CampaignType), nullable=False, index=True)
    status = Column(SQLEnum(CampaignStatus), default=CampaignStatus.DRAFT, nullable=False, index=True)
    
    # Audience targeting
    segment_type = Column(SQLEnum(SegmentType), default=SegmentType.ALL, nullable=False)
    segment_config = Column(JSON, default={})  # Additional segmentation parameters
    
    # Content
    subject = Column(String(300))  # Email subject or SMS preview
    content = Column(Text, nullable=False)  # Message body (supports basic HTML for email)
    ai_generated = Column(Boolean, default=False)  # Whether content was AI-generated
    ai_prompt = Column(Text)  # Original prompt used for AI generation
    
    # Scheduling
    scheduled_at = Column(DateTime)  # When to send (null = send immediately)
    sent_at = Column(DateTime)  # Actual send time
    
    # Analytics
    total_recipients = Column(Integer, default=0)
    sent_count = Column(Integer, default=0)
    delivered_count = Column(Integer, default=0)
    opened_count = Column(Integer, default=0)  # Email only
    clicked_count = Column(Integer, default=0)  # If links included
    failed_count = Column(Integer, default=0)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    
    # Relationships
    recipients = relationship("CampaignRecipient", back_populates="campaign", cascade="all, delete-orphan")
    
    #Indexes
    __table_args__ = (
        Index("ix_campaigns_tenant_status", "tenant_id", "status"),
        Index("ix_campaigns_scheduled", "scheduled_at"),
    )
    
    @property
    def open_rate(self) -> float:
        """Email open rate percentage."""
        if self.campaign_type != CampaignType.EMAIL or self.sent_count == 0:
            return 0.0
        return (self.opened_count / self.sent_count) * 100
    
    @property
    def click_rate(self) -> float:
        """Click-through rate percentage."""
        if self.sent_count == 0:
            return 0.0
        return (self.clicked_count / self.sent_count) * 100
    
    @property
    def delivery_rate(self) -> float:
        """Successful delivery rate percentage."""
        if self.total_recipients == 0:
            return 0.0
        return (self.delivered_count / self.total_recipients) * 100


class CampaignRecipient(Base):
    """Tracks individual campaign delivery to customers."""
    __tablename__ = "campaign_recipients"
    
    id = Column(Integer, primary_key=True, index=True)
    campaign_id = Column(Integer, ForeignKey("campaigns.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Delivery details
    recipient_email = Column(String(255))  # Email address at send time
    recipient_phone = Column(String(20))  # Phone number at send time
    
    # Status tracking
    sent_at = Column(DateTime)
    delivered_at = Column(DateTime)
    opened_at = Column(DateTime)  # First open (email only)
    clicked_at = Column(DateTime)  # First click
    failed_at = Column(DateTime)
    error_message = Column(Text)
    
    # External provider tracking
    external_id = Column(String(255))  # SendGrid/Twilio message ID
    external_status = Column(String(50))  # Provider-specific status
    
    # Metadata
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    
    # Relationships
    campaign = relationship("Campaign", back_populates="recipients")
    
    # Indexes
    __table_args__ = (
        Index("ix_campaign_recipients_customer", "customer_id", "campaign_id"),
        Index("ix_campaign_recipients_status", "sent_at", "delivered_at"),
    )
    
    @property
    def status(self) -> str:
        """Computed delivery status."""
        if self.failed_at:
            return "failed"
        elif self.clicked_at:
            return "clicked"
        elif self.opened_at:
            return "opened"
        elif self.delivered_at:
            return "delivered"
        elif self.sent_at:
            return "sent"
        else:
            return "pending"


class CustomerSegment(Base):
    """Saved customer segments for reuse across campaigns."""
    __tablename__ = "customer_segments"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Segment definition
    name = Column(String(200), nullable=False)
    description = Column(Text)
    segment_type = Column(SQLEnum(SegmentType), nullable=False)
    filter_config = Column(JSON, default={})  # Detailed filter criteria
    
    # Computed metrics
    customer_count = Column(Integer, default=0)  # Cached count, updated periodically
    last_computed_at = Column(DateTime)
    
    # Metadata
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.now, nullable=False)
    updated_at = Column(DateTime, default=datetime.now, onupdate=datetime.now, nullable=False)
    
    # Indexes
    __table_args__ = (
        Index("ix_segments_tenant", "tenant_id"),
    )
