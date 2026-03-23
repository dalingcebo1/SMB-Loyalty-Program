"""Core / tenant models."""
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
    Float,
)
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from .enums import VerticalType


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
    # Vertical-specific feature flags (e.g., {"appointments": true, "inventory": false})
    vertical_features = Column(JSON, nullable=True, default=dict)
    # Schema-per-tenant support (nullable for backward compatibility with row-level isolation)
    schema_name    = Column(String, nullable=True, unique=True, index=True)
    # Domain mapping (either full domain e.g. flowershop.com) for host-based resolution
    primary_domain = Column(String, nullable=True, unique=True)
    # Existing subdomain (retain for backward compatibility / internal routing)
    subdomain      = Column(String, nullable=True)
    logo_url       = Column(String, nullable=True)
    theme_color    = Column(String, nullable=True)
    # Arbitrary per-tenant configuration (feature flags, branding variants, etc.)
    config         = Column(JSON, nullable=False, default=dict)
    
    # Onboarding wizard completion flag
    onboarding_completed = Column(Boolean, default=False, nullable=False, server_default="0")

    # Subscription & Billing
    subscription_plan_id   = Column(String, default="free", nullable=False) # Maps to app.core.plans.PLAN_REGISTRY keys
    subscription_status    = Column(String, default="active") # active, past_due, canceled, trial
    stripe_customer_id     = Column(String, nullable=True, index=True)
    stripe_subscription_id = Column(String, nullable=True, index=True)

    created_at     = Column(DateTime)
    rewards        = relationship("Reward", back_populates="tenant")
    loyalty_program = relationship("LoyaltyProgram", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    # tenant-admin many-to-many
    admins         = relationship(
        "User",
        secondary=tenant_admins,
        back_populates="tenants",
    )
    branding       = relationship("TenantBranding", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    integrations   = relationship("TenantIntegration", back_populates="tenant", cascade="all, delete-orphan")
    domains        = relationship("TenantDomain", back_populates="tenant", cascade="all, delete-orphan")
    invoices       = relationship("Invoice", back_populates="tenant", cascade="all, delete-orphan")
    expenses       = relationship("Expense", back_populates="tenant", cascade="all, delete-orphan")
    financial_years = relationship("FinancialYear", back_populates="tenant", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_tenants_vertical_domain", "vertical_type", "primary_domain"),
    )


class TenantDomain(Base):
    """Dynamic domain mappings for tenants.
    
    Allows multiple domains per tenant for:
    - Production custom domains (e.g., loyalty.carwash.com)
    - Dev/staging environments (e.g., orange-pond-06eea490f.3.azurestaticapps.net)
    - Testing domains
    
    The tenant resolution will check this table first before falling back to primary_domain.
    """
    __tablename__ = "tenant_domains"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id   = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    domain      = Column(String, nullable=False, unique=True, index=True)
    is_primary  = Column(Boolean, default=False)
    environment = Column(String, nullable=True)  # 'production', 'dev', 'staging', etc.
    created_at  = Column(DateTime, default=datetime.utcnow)
    
    tenant = relationship("Tenant", back_populates="domains")
    
    __table_args__ = (
        Index("ix_tenant_domains_lookup", "domain", "tenant_id"),
    )


class TenantVerticalConfig(Base):
    """Vertical-specific configuration for tenants.
    
    Stores vertical-specific settings separate from the main tenant config.
    Allows verticals to define custom configuration without cluttering
    the main tenant.config JSON field.
    
    Examples:
    - carwash: bay_count, queue_size_limit, default_wash_duration
    - retail: pos_terminal_count, tax_rate, receipt_footer
    - beauty: appointment_slot_duration, stylist_count, booking_buffer_minutes
    """
    __tablename__ = "tenant_vertical_config"
    
    id           = Column(String, primary_key=True)
    tenant_id    = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False, index=True)
    config_key   = Column(String(100), nullable=False, index=True)
    config_value = Column(JSON, nullable=False)
    created_at   = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at   = Column(DateTime, nullable=False, default=datetime.utcnow)
    
    # Relationships
    tenant = relationship("Tenant", backref="vertical_configs")
    
    __table_args__ = (
        # Ensure unique config_key per tenant
        UniqueConstraint("tenant_id", "config_key", name="uq_tenant_config_key"),
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


class Vehicle(Base):
    __tablename__ = "vehicles"
    id      = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    plate   = Column(String, nullable=False)
    make    = Column(String)
    model   = Column(String)

    __table_args__ = (UniqueConstraint("plate", name="uq_vehicle_plate"),)
    user = relationship("User")


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


class TenantIntegration(Base):
    __tablename__ = "tenant_integrations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(String, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    category = Column(String, nullable=False)
    provider = Column(String, nullable=False)
    config = Column(JSON, nullable=False, default=dict)
    secrets = Column(JSON, nullable=False, default=dict)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    tenant = relationship("Tenant", back_populates="integrations")

    __table_args__ = (
        UniqueConstraint("tenant_id", "category", "provider", name="uq_tenant_category_provider"),
    )


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


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id  = Column(String, nullable=True, index=True)
    user_id    = Column(Integer, nullable=True, index=True)
    action     = Column(String, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    details    = Column(JSON, nullable=True)


class BusinessMetrics(Base):
    __tablename__ = "business_metrics"
    id               = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id        = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    date             = Column(DateTime, nullable=False, index=True)
    revenue_cents    = Column(Integer, default=0)
    order_count      = Column(Integer, default=0)
    customer_count   = Column(Integer, default=0)
    new_customers    = Column(Integer, default=0)
    redemption_count = Column(Integer, default=0)
    points_issued    = Column(Integer, default=0)
    points_redeemed  = Column(Integer, default=0)
    created_at       = Column(DateTime, default=datetime.utcnow)
    
    tenant = relationship("Tenant")


class StaffPermission(Base):
    __tablename__ = "staff_permissions"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    user_id       = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    tenant_id     = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    permission    = Column(String, nullable=False, index=True)  # "view_customers", "manage_orders", etc.
    granted_by    = Column(Integer, ForeignKey("users.id"), nullable=True)
    granted_at    = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", foreign_keys=[user_id])
    granter = relationship("User", foreign_keys=[granted_by])
    tenant = relationship("Tenant")


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
