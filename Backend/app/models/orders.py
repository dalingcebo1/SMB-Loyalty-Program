"""Order and payment models."""
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    Boolean,
    JSON,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Order(Base):
    __tablename__ = "orders"
    # Existing DB uses integer primary key; keep in sync with current schema
    id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)
    quantity   = Column(Integer, nullable=False, default=1)
    # Store extras as JSON list in SQLite
    extras     = Column(JSON, nullable=False, default=list)
    payment_pin = Column(String(4), nullable=True, unique=True)
    status     = Column(String, default="pending")
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=True)
    # Optional direct tenant reference (used by analytics + some tests)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    redeemed   = Column(Boolean, default=False)
    started_at = Column(DateTime, nullable=True)
    ended_at   = Column(DateTime, nullable=True)
    type       = Column(String, default="paid")
    amount     = Column(Integer, default=0)
    order_redeemed_at = Column(DateTime, nullable=True)

    service = relationship("Service")
    user    = relationship("User")
    items = relationship("OrderItem", back_populates="order")
    # Vehicles assigned to this order
    vehicles = relationship("OrderVehicle", back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    id         = Column(Integer, primary_key=True)
    order_id   = Column(Integer, ForeignKey("orders.id"), nullable=False)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    category   = Column(String, nullable=False)
    qty        = Column(Integer, nullable=False)
    extras     = Column(JSON)
    line_total = Column(Integer, nullable=False)

    order   = relationship("Order", back_populates="items")
    service = relationship("Service")


class OrderVehicle(Base):
    __tablename__ = "order_vehicles"
    id           = Column(Integer, primary_key=True)
    order_id     = Column(Integer, ForeignKey("orders.id"),   nullable=False)
    vehicle_id   = Column(Integer, ForeignKey("vehicles.id"),nullable=False)

    order   = relationship("Order", back_populates="vehicles")
    vehicle = relationship("Vehicle")


class Payment(Base):
    __tablename__ = "payments"
    id            = Column(Integer, primary_key=True)
    order_id      = Column(Integer, ForeignKey("orders.id"), nullable=False)
    # Make amount optional with default to support webhook updates without initial amount
    amount        = Column(Integer, nullable=True, default=0)
    # Make method optional with default to support webhook entries without initial method
    method        = Column(String, nullable=True, default="")
    transaction_id= Column(String)
    reference     = Column(String, unique=True)
    status        = Column(String, default="initialized")
    raw_response  = Column(JSON, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    card_brand    = Column(String(32))
    qr_code_base64 = Column(Text, nullable=True)
    source        = Column(String, default="yoco")

    order = relationship("Order")
