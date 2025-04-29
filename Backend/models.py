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

# ─────────────────────────────────────────────────────────────────────────────
# Existing models…

class Tenant(Base):
    __tablename__ = "tenants"
    id         = Column(String, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    loyalty_type = Column(String, nullable=False)  # e.g. "milestone" or "points"
    created_at = Column(DateTime, default=datetime.utcnow)

    users   = relationship("User", back_populates="tenant", cascade="all, delete")
    rewards = relationship("Reward", back_populates="tenant", cascade="all, delete")

class User(Base):
    __tablename__ = "users"
    id         = Column(Integer, primary_key=True, index=True)
    phone      = Column(String, unique=True, index=True, nullable=False)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    tenant       = relationship("Tenant",    back_populates="users")
    visits       = relationship("VisitCount", back_populates="user", cascade="all, delete")
    points       = relationship("PointBalance", back_populates="user", cascade="all, delete")
    redemptions  = relationship("Redemption", back_populates="user", cascade="all, delete")

    # ← NEW: backrefs for orders & vehicles
    orders       = relationship("Order", back_populates="user", cascade="all, delete")
    vehicles     = relationship("Vehicle", back_populates="user", cascade="all, delete")

class Reward(Base):
    __tablename__ = "rewards"
    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(String, ForeignKey("tenants.id"), nullable=False)
    title       = Column(String, nullable=False)
    description = Column(Text,   nullable=True)
    type        = Column(String, nullable=False)       # "milestone" or "points"
    milestone   = Column(Integer, nullable=True)       # visits needed
    cost        = Column(Integer, nullable=True)       # points cost
    created_at  = Column(DateTime, default=datetime.utcnow)

    tenant       = relationship("Tenant",    back_populates="rewards")
    redemptions  = relationship("Redemption", back_populates="reward", cascade="all, delete")

class VisitCount(Base):
    __tablename__ = "visit_counts"
    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    count       = Column(Integer, default=0, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user        = relationship("User", back_populates="visits")

class PointBalance(Base):
    __tablename__ = "point_balances"
    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    points      = Column(Integer, default=0, nullable=False)
    updated_at  = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user        = relationship("User", back_populates="points")

class Redemption(Base):
    __tablename__ = "redemptions"
    id          = Column(Integer, primary_key=True, index=True)
    tenant_id   = Column(String, ForeignKey("tenants.id"), nullable=False)
    user_id     = Column(Integer, ForeignKey("users.id"), nullable=False)
    reward_id   = Column(Integer, ForeignKey("rewards.id"), nullable=False)
    created_at  = Column(DateTime, default=datetime.utcnow)

    user        = relationship("User",    back_populates="redemptions")
    reward      = relationship("Reward",  back_populates="redemptions")

# ─────────────────────────────────────────────────────────────────────────────
# Catalog models (already present)

class Service(Base):
    __tablename__ = "services"
    id         = Column(Integer, primary_key=True, index=True)
    category   = Column(String,  nullable=False)    # "car/bike", "suv/4x4", etc.
    name       = Column(String,  nullable=False)    # "Full House", etc.
    base_price = Column(Integer, nullable=False)    # price in Rands

class Extra(Base):
    __tablename__ = "extras"
    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String,  nullable=False)     # "Vacuum Only", etc.
    price_map = Column(JSON,    nullable=False)     # {"car/bike":50,…}

# ─────────────────────────────────────────────────────────────────────────────
# NEW Order & Vehicle models

class Vehicle(Base):
    __tablename__ = "vehicles"
    id       = Column(Integer, primary_key=True, index=True)
    user_id  = Column(Integer, ForeignKey("users.id"), nullable=False)
    plate    = Column(String, nullable=False, unique=True)
    make     = Column(String, nullable=True)
    model    = Column(String, nullable=True)

    user     = relationship("User", back_populates="vehicles")

class Order(Base):
    __tablename__ = "orders"
    id            = Column(Integer, primary_key=True, index=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False)
    status        = Column(String, default="pending", nullable=False)
    total_amount  = Column(Integer, nullable=False)
    created_at    = Column(DateTime, default=datetime.utcnow)

    user          = relationship("User",  back_populates="orders")
    items         = relationship("OrderItem",    back_populates="order",   cascade="all, delete")
    vehicles      = relationship("OrderVehicle", back_populates="order",   cascade="all, delete")

class OrderItem(Base):
    __tablename__ = "order_items"
    id          = Column(Integer, primary_key=True, index=True)
    order_id    = Column(Integer, ForeignKey("orders.id"), nullable=False)
    service_id  = Column(Integer, ForeignKey("services.id"), nullable=False)
    category    = Column(String,  nullable=False)
    qty         = Column(Integer, nullable=False)
    extras      = Column(JSON,    nullable=True)   # list of extra IDs
    line_total  = Column(Integer, nullable=False)

    order       = relationship("Order",    back_populates="items")
    service     = relationship("Service")

class OrderVehicle(Base):
    __tablename__ = "order_vehicles"
    id          = Column(Integer, primary_key=True, index=True)
    order_id    = Column(Integer, ForeignKey("orders.id"),    nullable=False)
    vehicle_id  = Column(Integer, ForeignKey("vehicles.id"),  nullable=False)

    order       = relationship("Order",   back_populates="vehicles")
    vehicle     = relationship("Vehicle")
