# Backend/models.py

from datetime import datetime
from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Text,
    JSON,
)
from sqlalchemy.orm import relationship
from database import Base

class Tenant(Base):
    __tablename__ = "tenants"
    id = Column(String, primary_key=True, index=True)
    name = Column(String, nullable=False)
    loyalty_type = Column(String, nullable=False)  # e.g. "milestone" or "points"
    created_at = Column(DateTime, default=datetime.utcnow)

    users = relationship("User", back_populates="tenant", cascade="all, delete")
    rewards = relationship("Reward", back_populates="tenant", cascade="all, delete")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="users")
    visits = relationship("VisitCount", back_populates="user", cascade="all, delete")
    points = relationship("PointBalance", back_populates="user", cascade="all, delete")
    redemptions = relationship("Redemption", back_populates="user", cascade="all, delete")

class Reward(Base):
    __tablename__ = "rewards"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    type = Column(String, nullable=False)       # "milestone" or "points"
    milestone = Column(Integer, nullable=True)  # visits needed (for milestone)
    cost = Column(Integer, nullable=True)       # points cost (for points)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="rewards")
    redemptions = relationship("Redemption", back_populates="reward", cascade="all, delete")

class VisitCount(Base):
    __tablename__ = "visit_counts"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    count = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="visits")

class PointBalance(Base):
    __tablename__ = "point_balances"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    points = Column(Integer, default=0, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="points")

class Redemption(Base):
    __tablename__ = "redemptions"
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    reward_id = Column(Integer, ForeignKey("rewards.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="redemptions")
    reward = relationship("Reward", back_populates="redemptions")

# ─────────────────────────────────────────────────────────────────────────────

class Service(Base):
    __tablename__ = "services"
    id         = Column(Integer, primary_key=True, index=True)
    category   = Column(String,  nullable=False)    # e.g. "car/bike", "suv/4x4", "minibus"
    name       = Column(String,  nullable=False)    # e.g. "Full House"
    base_price = Column(Integer, nullable=False)    # price in Rands

class Extra(Base):
    __tablename__ = "extras"
    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String,  nullable=False)     # e.g. "Vacuum Only"
    price_map = Column(JSON,    nullable=False)     # {"car/bike":60, "suv/4x4":80, ...}
