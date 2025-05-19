# Backend/models.py
from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    JSON,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Boolean,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class Tenant(Base):
    __tablename__ = "tenants"
    id           = Column(String, primary_key=True)
    name         = Column(String, nullable=False)
    loyalty_type = Column(String, nullable=False)
    created_at   = Column(DateTime)


class Service(Base):
    __tablename__ = "services"
    id         = Column(Integer, primary_key=True, index=True)
    category   = Column(String, nullable=False, index=True)
    name       = Column(String, nullable=False)
    base_price = Column(Integer, nullable=False)


class Extra(Base):
    __tablename__ = "extras"
    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String, nullable=False)
    price_map = Column(JSON, nullable=False)  # { category: price }


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    phone = Column(String, unique=True, index=True)
    hashed_password = Column(String, nullable=True)  # For password login
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    onboarded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=False)
    role = Column(String, nullable=False, default="user")

    tenant = relationship("Tenant", back_populates="users")


Tenant.users = relationship("User", back_populates="tenant")


class Reward(Base):
    __tablename__ = "rewards"
    id           = Column(Integer, primary_key=True)
    tenant_id    = Column(String, ForeignKey("tenants.id"), nullable=False)
    title        = Column(String, nullable=False)
    description  = Column(Text)
    type         = Column(String, nullable=False)
    milestone    = Column(Integer)
    cost         = Column(Integer)
    created_at   = Column(DateTime)

    tenant = relationship("Tenant", back_populates="rewards")


Tenant.rewards = relationship("Reward", back_populates="tenant")


class Order(Base):
    __tablename__ = "orders"
    id         = Column(String, primary_key=True)  # uuid4
    service_id = Column(Integer, ForeignKey("services.id"), nullable=False)
    quantity   = Column(Integer, nullable=False, default=1)
    extras     = Column(JSON, nullable=False, default=[])
    payment_pin = Column(String(4), nullable=True, unique=True)
    status     = Column(String, default="pending")
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    redeemed   = Column(Boolean, default=False)
    started_at = Column(DateTime, nullable=True)
    ended_at   = Column(DateTime, nullable=True)

    service = relationship("Service")
    user    = relationship("User")
    items = relationship("OrderItem", back_populates="order")


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
    updated_at = Column(DateTime)

    tenant = relationship("Tenant")
    user   = relationship("User")


class Redemption(Base):
    __tablename__ = "redemptions"
    id           = Column(Integer, primary_key=True)
    tenant_id    = Column(String, ForeignKey("tenants.id"),   nullable=False)
    user_id      = Column(Integer, ForeignKey("users.id"),    nullable=False)
    reward_id    = Column(Integer, ForeignKey("rewards.id"),  nullable=False)
    created_at   = Column(DateTime, default=datetime.utcnow)
    status       = Column(String, default="pending")  # "pending", "used", "expired"
    pin          = Column(String, nullable=True)      # Store the voucher PIN/token
    milestone    = Column(Integer, nullable=True)     # Optional: milestone number
    redeemed_at  = Column(DateTime, nullable=True)    # When voucher was used
    qr_code      = Column(Text, nullable=True)        # base64 or URL
    reward_name  = Column(String, nullable=True)
    order_id     = Column(String, ForeignKey("orders.id"), nullable=True)  # <-- Add this line

    tenant = relationship("Tenant")
    user   = relationship("User")
    reward = relationship("Reward")
    order  = relationship("Order")


class Vehicle(Base):
    __tablename__ = "vehicles"
    id      = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plate   = Column(String, nullable=False)
    make    = Column(String)
    model   = Column(String)

    __table_args__ = (UniqueConstraint("plate", name="uq_vehicle_plate"),)
    user = relationship("User")


class OrderItem(Base):
    __tablename__ = "order_items"
    id         = Column(Integer, primary_key=True)
    # <--- changed to String to match orders.id
    order_id   = Column(String, ForeignKey("orders.id"), nullable=False)
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
    order_id     = Column(String, ForeignKey("orders.id"),   nullable=False)
    vehicle_id   = Column(Integer, ForeignKey("vehicles.id"),nullable=False)
    # …any other fields…

    order   = relationship("Order")
    vehicle = relationship("Vehicle")


class Payment(Base):
    __tablename__ = "payments"
    id            = Column(Integer, primary_key=True)
    order_id      = Column(String, ForeignKey("orders.id"), nullable=False)
    amount        = Column(Integer, nullable=False)
    method        = Column(String, nullable=False)  # e.g. "paystack", "yoco", "manual"
    transaction_id= Column(String)
    reference     = Column(String, unique=True)
    status        = Column(String, default="initialized")
    raw_response  = Column(JSON, nullable=True)
    created_at    = Column(DateTime, default=datetime.utcnow)
    card_brand    = Column(String(32))  # <-- Add this line
    qr_code_base64 = Column(Text, nullable=True)  # <-- Add this line

    order = relationship("Order")
