"""Loyalty program models."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Float,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Reward(Base):
    __tablename__ = "rewards"
    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    tenant_id    = Column(String, ForeignKey("tenants.id"), nullable=False)
    title        = Column(String, nullable=False)
    description  = Column(Text)
    type         = Column(String, nullable=False)
    milestone    = Column(Integer)
    cost         = Column(Integer)
    created_at   = Column(DateTime)
    service_id   = Column(Integer, ForeignKey("services.id"), nullable=True)

    tenant = relationship("Tenant", back_populates="rewards")


class LoyaltyProgram(Base):
    __tablename__ = "loyalty_programs"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), unique=True, nullable=False)
    
    # Program Configuration
    name = Column(String, default="Loyalty Program")
    currency_name = Column(String, default="Points")
    
    # Accrual: Points earned per unit of currency spent (e.g., 1 point per 100 cents)
    # If accrual_ratio is 0.1, spending 1000 cents (R10) gives 100 points.
    accrual_ratio = Column(Float, default=1.0) 
    
    # Redemption: Value of one point in cents (e.g., 1 point = 5 cents)
    redemption_ratio = Column(Float, default=1.0)
    
    # Expiry Policy
    points_expiry_days = Column(Integer, nullable=True) # None = no expiry
    
    # Tiers Configuration
    tiers_enabled = Column(Boolean, default=False)

    # Program active flag (referenced by beauty vertical award_loyalty_points)
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="loyalty_program")
    tiers = relationship("LoyaltyTier", back_populates="program", cascade="all, delete-orphan")


class LoyaltyTier(Base):
    __tablename__ = "loyalty_tiers"
    id = Column(Integer, primary_key=True, autoincrement=True)
    program_id = Column(Integer, ForeignKey("loyalty_programs.id"), nullable=False)
    
    name = Column(String, nullable=False) # e.g., Bronze, Silver, Gold
    min_points = Column(Integer, default=0) # Lifetime points required to reach this tier
    multiplier = Column(Float, default=1.0) # Point accrual multiplier (e.g., 1.5x)
    color = Column(String, default="#000000") # UI color
    description = Column(String, nullable=True)
    
    program = relationship("LoyaltyProgram", back_populates="tiers")


class LoyaltyTransaction(Base):
    """Ledger for all point movements (Earn, Burn, Expire, Adjust)."""
    __tablename__ = "loyalty_transactions"
    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    type = Column(String, nullable=False) # EARN, REDEEM, EXPIRE, ADJUST, BONUS, TIER_UPGRADE
    points = Column(Integer, nullable=False) # Positive (credit) or Negative (debit)
    
    # Audit trail
    reference_type = Column(String, nullable=True) # 'order', 'manual', 'system'
    reference_id = Column(String, nullable=True) # e.g., order_id
    
    description = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    tenant = relationship("Tenant")
    user = relationship("User")


class VisitCount(Base):
    __tablename__ = "visit_counts"
    id         = Column(Integer, primary_key=True)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"),    nullable=False)
    count      = Column(Integer, nullable=False)
    updated_at = Column(DateTime)

    tenant = relationship("Tenant")
    user   = relationship("User")


class PointBalance(Base):
    __tablename__ = "point_balances"
    id         = Column(Integer, primary_key=True)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id    = Column(Integer, ForeignKey("users.id"),    nullable=False)
    points     = Column(Integer, nullable=False)
    
    # New fields for advanced loyalty
    lifetime_points = Column(Integer, default=0) # Total points ever earned (for tier calculation)
    tier_id    = Column(Integer, ForeignKey("loyalty_tiers.id"), nullable=True)
    
    updated_at = Column(DateTime)

    tenant = relationship("Tenant")
    user   = relationship("User")
    tier   = relationship("LoyaltyTier")


class Redemption(Base):
    __tablename__ = "redemptions"
    id           = Column(Integer, primary_key=True)
    tenant_id    = Column(String, ForeignKey("tenants.id"),   nullable=False)
    user_id      = Column(Integer, ForeignKey("users.id"),    nullable=False)
    reward_id    = Column(Integer, ForeignKey("rewards.id"),  nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    status       = Column(String, default="pending")
    pin          = Column(String, nullable=True)
    milestone    = Column(Integer, nullable=True)
    redeemed_at  = Column(DateTime, nullable=True)
    qr_code      = Column(Text, nullable=True)
    reward_name  = Column(String, nullable=True)
    # Backward compat note: API schemas expose order_id as string, but the
    # underlying orders table uses an integer primary key. Store FK as Integer
    # to keep the relational integrity enforced by the database layer while
    # allowing the API to continue returning stringified ids.
    order_id     = Column(Integer, ForeignKey("orders.id"), nullable=True)
    __table_args__ = (
        UniqueConstraint("user_id", "milestone", "status", name="uq_redemption_user_milestone_status"),
    )

    tenant = relationship("Tenant")
    user   = relationship("User")
    reward = relationship("Reward")
    order  = relationship("Order")
