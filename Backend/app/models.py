from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Table,
    JSON,
    Index,
)
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
from app.core.database import Base
from enum import Enum
from sqlalchemy.dialects.sqlite import JSON as SQLITE_JSON


class VerticalType(str, Enum):
        """Business verticals supported by the unified multi-tenant platform.

        NOTE: When adding a new vertical update:
            - This enum
            - Any validation lists (e.g. in create/update tenant schemas)
            - Frontend vertical mapping (TenantConfigProvider)
        """
        carwash = "carwash"
        dispensary = "dispensary"
        padel = "padel"
        flowershop = "flowershop"
        beauty = "beauty"

# association table for tenant admins
tenant_admins = Table(
    "tenant_admins",
    Base.metadata,
    Column("tenant_id", String, ForeignKey("tenants.id"), primary_key=True),
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
)


class Tenant(Base):
    __tablename__ = "tenants"
    id             = Column(String, primary_key=True)
    name           = Column(String, nullable=False)
    loyalty_type   = Column(String, nullable=False)
    # Multi-vertical support
    vertical_type  = Column(String, nullable=False, default=VerticalType.carwash.value, index=True)
    # Domain mapping (either full domain e.g. flowershop.com) for host-based resolution
    primary_domain = Column(String, nullable=True, unique=True)
    # Existing subdomain (retain for backward compatibility / internal routing)
    subdomain      = Column(String, nullable=True)
    logo_url       = Column(String, nullable=True)
    theme_color    = Column(String, nullable=True)
    # Arbitrary per-tenant configuration (feature flags, branding variants, etc.)
    config         = Column(JSON, nullable=False, default=dict)
    created_at     = Column(DateTime)
    rewards        = relationship("Reward", back_populates="tenant")
    # tenant-admin many-to-many
    admins         = relationship(
        "User",
        secondary=tenant_admins,
        back_populates="tenants",
    )
    branding       = relationship("TenantBranding", back_populates="tenant", uselist=False, cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_tenants_vertical_domain", "vertical_type", "primary_domain"),
    )


class Service(Base):
    __tablename__ = "services"
    id             = Column(Integer, primary_key=True, index=True, autoincrement=True)
    category       = Column(String, nullable=False, index=True)
    name           = Column(String, nullable=False)
    base_price     = Column(Integer, nullable=False)
    loyalty_eligible = Column(Boolean, default=False)


class Extra(Base):
    __tablename__ = "extras"
    id        = Column(Integer, primary_key=True, index=True)
    name      = Column(String, nullable=False)
    price_map = Column(JSON, nullable=False)


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email = Column(String, unique=True, index=True)
    # Phone uniqueness relaxed to avoid cross-module fixture collisions in tests
    phone = Column(String, unique=False, index=True)
    hashed_password = Column(String, nullable=True)
    first_name = Column(String, nullable=True)
    last_name = Column(String, nullable=True)
    onboarded = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=False)
    role = Column(String, nullable=False, default="user")

    tenant = relationship("Tenant", back_populates="users")
    # tenants this user administers
    tenants = relationship(
        "Tenant",
        secondary=tenant_admins,
        back_populates="admins",
    )


Tenant.users = relationship("User", back_populates="tenant")


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
    status       = Column(String, default="pending")
    pin          = Column(String, nullable=True)
    milestone    = Column(Integer, nullable=True)
    redeemed_at  = Column(DateTime, nullable=True)
    qr_code      = Column(Text, nullable=True)
    reward_name  = Column(String, nullable=True)
    order_id     = Column(String, ForeignKey("orders.id"), nullable=True)
    __table_args__ = (
        UniqueConstraint("user_id", "milestone", "status", name="uq_redemption_user_milestone_status"),
    )

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

# --- Invite tokens for onboarding ---
class InviteToken(Base):
    __tablename__ = "invite_tokens"
    token = Column(String, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False)
    email = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, nullable=False)
    used = Column(Boolean, default=False)

    tenant = relationship("Tenant")

# --- Tenant Branding (white-label) ---
class TenantBranding(Base):
    __tablename__ = "tenant_branding"
    tenant_id        = Column(String, ForeignKey("tenants.id"), primary_key=True)
    public_name      = Column(String, nullable=True)
    short_name       = Column(String, nullable=True)
    primary_color    = Column(String, nullable=True)
    secondary_color  = Column(String, nullable=True)
    accent_color     = Column(String, nullable=True)
    logo_light_url   = Column(String, nullable=True)
    logo_dark_url    = Column(String, nullable=True)
    favicon_url      = Column(String, nullable=True)
    app_icon_url     = Column(String, nullable=True)
    support_email    = Column(String, nullable=True)
    support_phone    = Column(String, nullable=True)
    updated_at       = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    # Extensible JSON for future custom tokens (typography, spacing, etc.)
    extra            = Column(JSON, nullable=False, default=dict)

    tenant = relationship("Tenant", back_populates="branding")


# --- Subscription Plans ---
class SubscriptionPlan(Base):
    __tablename__ = "subscription_plans"
    id             = Column(Integer, primary_key=True, autoincrement=True)
    name           = Column(String, nullable=False, unique=True, index=True)
    price_cents    = Column(Integer, nullable=False, default=0)
    billing_period = Column(String, nullable=False, default="monthly")  # "monthly" | "annual"
    # Use JSON column for modules list; SQLite JSON type aliased for portability
    modules        = Column(JSON, nullable=False, default=list)
    description    = Column(Text, nullable=True)
    active         = Column(Boolean, nullable=False, default=True, index=True)
    created_at     = Column(DateTime, default=datetime.utcnow)
    updated_at     = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


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


# --- Audit logs ---
class AuditLog(Base):
    __tablename__ = "audit_logs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id  = Column(String, nullable=True, index=True)
    user_id    = Column(Integer, nullable=True, index=True)
    action     = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    details    = Column(JSON, nullable=True)


# Precomputed customer analytics metrics (refreshable snapshot)
class AggregatedCustomerMetrics(Base):
    __tablename__ = "aggregated_customer_metrics"
    user_id              = Column(Integer, ForeignKey("users.id"), primary_key=True)
    last_visit_at        = Column(DateTime)
    first_visit_at       = Column(DateTime)
    lifetime_washes      = Column(Integer, default=0)
    lifetime_revenue     = Column(Integer, default=0)  # cents
    washes_30d           = Column(Integer, default=0)
    washes_90d           = Column(Integer, default=0)
    revenue_30d          = Column(Integer, default=0)  # cents
    revenue_90d          = Column(Integer, default=0)  # cents
    loyalty_washes_total = Column(Integer, default=0)
    loyalty_washes_30d   = Column(Integer, default=0)
    points_redeemed_total= Column(Integer, default=0)
    points_outstanding   = Column(Integer, default=0)
    points_redeemed_30d  = Column(Integer, default=0)
    r_score              = Column(Integer, default=0)
    f_score              = Column(Integer, default=0)
    m_score              = Column(Integer, default=0)
    segment              = Column(String, nullable=True)
    snapshot_at          = Column(DateTime, default=datetime.utcnow)
    tenant_id            = Column(String, ForeignKey("tenants.id"), nullable=True)

    user = relationship("User")

# --- Optional persistence models (flag gated) ---
from config import settings  # placed at end to avoid circular import during settings init
from sqlalchemy.sql import func

if getattr(settings, 'enable_rate_limit_persistence', False):  # pragma: no cover (disabled default)
    class RateLimitOverrideModel(Base):
        __tablename__ = 'rate_limit_overrides'
        scope = Column(String, primary_key=True, index=True)
        capacity = Column(Integer, nullable=False)
        per_seconds = Column(Integer, nullable=False)
        created_at = Column(DateTime, server_default=func.now())
        updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

if getattr(settings, 'enable_job_persistence', False):  # pragma: no cover (disabled default)
    class JobRecordModel(Base):
        __tablename__ = 'job_records'
        id = Column(String, primary_key=True, index=True)
        name = Column(String, nullable=False, index=True)
        status = Column(String, nullable=False)
        attempts = Column(Integer, default=0)
        max_retries = Column(Integer, default=0)
        interval_seconds = Column(Integer, nullable=True)
        next_run_at = Column(Integer, nullable=True)
        last_error = Column(Text, nullable=True)
        created_at = Column(DateTime, server_default=func.now())
        updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
