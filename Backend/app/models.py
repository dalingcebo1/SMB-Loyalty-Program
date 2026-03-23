from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Date,
    Time,
    ForeignKey,
    UniqueConstraint,
    Boolean,
    Table,
    JSON,
    Index,
    Float,
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
        retail = "retail"
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


# --- Notifications ---
class Notification(Base):
    __tablename__ = "notifications"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id  = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id    = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    title      = Column(String, nullable=False)
    message    = Column(Text, nullable=False)
    type       = Column(String, nullable=False, index=True)  # "reward", "system", "marketing", "order"
    action_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)
    read_at    = Column(DateTime, nullable=True)
    
    tenant = relationship("Tenant")
    user = relationship("User")


# --- Business Analytics ---
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


# --- Staff Permissions ---
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


"""
Retail Inventory Models

Database models for product catalog, inventory tracking, and stock management.
"""

from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, Boolean, Index
from sqlalchemy.orm import relationship
from app.core.database import Base

# Import beauty package and review models
from app.vertical_models.beauty_packages import BeautyPackage, PackageBooking, package_services
from app.vertical_models.beauty_reviews import ServiceReview, AppointmentReminder
from app.vertical_models.campaigns import Campaign, CampaignRecipient, CustomerSegment, CampaignType, CampaignStatus, SegmentType
from app.vertical_models.financial import Invoice, InvoiceLineItem, InvoiceStatus, Expense, ExpenseCategory, PaymentMethod, FinancialYear


class Supplier(Base):
    """Supplier/Vendor information for retail products."""
    __tablename__ = "suppliers"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    contact_person = Column(String(200))
    email = Column(String(200))
    phone = Column(String(50))
    address = Column(Text)
    notes = Column(Text)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    products = relationship("Product", back_populates="supplier")
    
    __table_args__ = (
        Index('ix_suppliers_tenant_active', 'tenant_id', 'active'),
    )


class ProductCategory(Base):
    """Product categories for organization and reporting."""
    __tablename__ = "product_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    description = Column(Text)
    parent_id = Column(Integer, ForeignKey("product_categories.id"))
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    products = relationship("Product", back_populates="category")
    parent = relationship("ProductCategory", remote_side=[id], backref="subcategories")
    
    __table_args__ = (
        Index('ix_categories_tenant_active', 'tenant_id', 'active'),
    )


class Product(Base):
    """Product catalog item with pricing and supplier information."""
    __tablename__ = "products"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    sku = Column(String(100), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category_id = Column(Integer, ForeignKey("product_categories.id"))
    supplier_id = Column(Integer, ForeignKey("suppliers.id"))
    
    # Pricing (stored in cents)
    cost_cents = Column(Integer, nullable=False, default=0)  # What we pay
    price_cents = Column(Integer, nullable=False, default=0)  # What customer pays
    
    # Physical attributes
    barcode = Column(String(100), index=True)
    unit_of_measure = Column(String(20), default='unit')  # unit, kg, liter, etc.
    
    # Stock management
    track_inventory = Column(Boolean, default=True, nullable=False)
    low_stock_threshold = Column(Integer, default=10)
    
    # Status
    active = Column(Boolean, default=True, nullable=False)
    featured = Column(Boolean, default=False)
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    category = relationship("ProductCategory", back_populates="products")
    supplier = relationship("Supplier", back_populates="products")
    inventory_levels = relationship("InventoryLevel", back_populates="product", cascade="all, delete-orphan")
    stock_movements = relationship("StockMovement", back_populates="product", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_products_tenant_active', 'tenant_id', 'active'),
        Index('ix_products_tenant_sku', 'tenant_id', 'sku', unique=True),
    )
    
    @property
    def cost(self) -> float:
        """Cost in currency (dollars/rands)."""
        return self.cost_cents / 100.0
    
    @property
    def price(self) -> float:
        """Price in currency (dollars/rands)."""
        return self.price_cents / 100.0
    
    @property
    def margin_percent(self) -> float:
        """Profit margin percentage."""
        if self.price_cents == 0:
            return 0.0
        return ((self.price_cents - self.cost_cents) / self.price_cents) * 100


class InventoryLevel(Base):
    """Current inventory levels per product and location."""
    __tablename__ = "inventory_levels"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location = Column(String(100), default='main')  # main, warehouse, store-1, etc.
    
    quantity = Column(Integer, nullable=False, default=0)
    reserved_quantity = Column(Integer, default=0)  # Reserved for pending orders
    
    # Computed fields
    last_counted_at = Column(DateTime)
    last_counted_by = Column(Integer, ForeignKey("users.id"))
    last_restocked_at = Column(DateTime)
    
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    product = relationship("Product", back_populates="inventory_levels")
    
    __table_args__ = (
        Index('ix_inventory_tenant_product', 'tenant_id', 'product_id'),
        Index('ix_inventory_tenant_location', 'tenant_id', 'location'),
    )
    
    @property
    def available_quantity(self) -> int:
        """Quantity available for sale (total - reserved)."""
        return max(0, self.quantity - self.reserved_quantity)
    
    @property
    def is_low_stock(self) -> bool:
        """Check if inventory is below product's low stock threshold."""
        if self.product and self.product.track_inventory:
            return self.available_quantity <= (self.product.low_stock_threshold or 0)
        return False


class StockMovement(Base):
    """Audit trail of all stock changes (purchases, sales, adjustments)."""
    __tablename__ = "stock_movements"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location = Column(String(100), default='main')
    
    # Movement details
    type = Column(String(50), nullable=False, index=True)  # purchase, sale, adjustment, transfer, return
    quantity = Column(Integer, nullable=False)  # Positive for increase, negative for decrease
    
    # Context
    reference_type = Column(String(50))  # order, purchase_order, adjustment, etc.
    reference_id = Column(Integer)  # ID of related record
    reason = Column(Text)  # Explanation for adjustment/transfer
    
    # Pricing at time of movement (in cents)
    unit_cost_cents = Column(Integer)
    
    # Metadata
    performed_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    product = relationship("Product", back_populates="stock_movements")
    
    __table_args__ = (
        Index('ix_movements_tenant_product', 'tenant_id', 'product_id'),
        Index('ix_movements_tenant_created', 'tenant_id', 'created_at'),
        Index('ix_movements_type', 'type'),
    )
    
    @property
    def unit_cost(self) -> float:
        """Unit cost in currency."""
        return (self.unit_cost_cents or 0) / 100.0


class LowStockAlert(Base):
    """Alerts for products that have fallen below threshold."""
    __tablename__ = "low_stock_alerts"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    location = Column(String(100), default='main')
    
    current_quantity = Column(Integer, nullable=False)
    threshold = Column(Integer, nullable=False)
    
    # Alert status
    acknowledged = Column(Boolean, default=False, nullable=False)
    acknowledged_by = Column(Integer, ForeignKey("users.id"))
    acknowledged_at = Column(DateTime)
    resolved = Column(Boolean, default=False, nullable=False)
    resolved_at = Column(DateTime)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    product = relationship("Product")
    
    __table_args__ = (
        Index('ix_alerts_tenant_unresolved', 'tenant_id', 'resolved'),
    )


# ──────────────────────────────────────────────────────────────────────────────
# POS (Point of Sale) Models
# ──────────────────────────────────────────────────────────────────────────────

class Sale(Base):
    """POS Sale Transaction - Complete sale with line items and payments."""
    __tablename__ = "sales"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)  # Cashier/staff
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)  # Customer making purchase
    
    receipt_number = Column(String(50), nullable=False, index=True)
    location = Column(String(100), default="main")
    
    # Totals in cents
    subtotal_cents = Column(Integer, nullable=False, default=0)
    tax_cents = Column(Integer, nullable=False, default=0)
    discount_cents = Column(Integer, nullable=False, default=0)
    total_cents = Column(Integer, nullable=False)
    tax_rate = Column(Integer, nullable=False, default=0)  # basis points (1500 = 15%)
    
    sale_status = Column(String(20), nullable=False, default="pending", index=True)
    payment_status = Column(String(20), nullable=False, default="pending")
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime)
    voided_at = Column(DateTime)
    notes = Column(String(500))
    
    # Relationships
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan")
    sale_payments = relationship("SalePayment", back_populates="sale", cascade="all, delete-orphan")
    customer = relationship("User", foreign_keys=[customer_id])
    cashier = relationship("User", foreign_keys=[user_id])
    
    __table_args__ = (
        Index('ix_sales_tenant_receipt', 'tenant_id', 'receipt_number', unique=True),
        Index('ix_sales_tenant_date', 'tenant_id', 'created_at'),
    )


class SaleItem(Base):
    """Individual line item in a sale."""
    __tablename__ = "sale_items"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id"), nullable=False, index=True)
    
    quantity = Column(Integer, nullable=False)
    unit_price_cents = Column(Integer, nullable=False)
    discount_cents = Column(Integer, nullable=False, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Product snapshot
    product_name = Column(String(200), nullable=False)
    product_sku = Column(String(100))
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    sale = relationship("Sale", back_populates="items")


class SalePayment(Base):
    """Payment record for a POS sale (renamed to avoid conflict with order payments)."""
    __tablename__ = "sale_payments"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("sales.id"), nullable=False, index=True)
    
    amount_cents = Column(Integer, nullable=False)
    payment_method = Column(String(20), nullable=False, index=True)
    transaction_id = Column(String(200))
    status = Column(String(20), nullable=False, default="pending")
    change_given_cents = Column(Integer, default=0)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    completed_at = Column(DateTime)
    failed_at = Column(DateTime)
    error_message = Column(String(500))
    
    sale = relationship("Sale", back_populates="sale_payments")

# ──────────────────────────────────────────────────────────────────────────────
# Beauty/Salon Models
# ──────────────────────────────────────────────────────────────────────────────

class BeautyService(Base):
    """Service offered by beauty salon/spa (haircut, coloring, massage, etc.)."""
    __tablename__ = "beauty_services"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(200), nullable=False)
    description = Column(Text)
    category = Column(String(100))  # haircut, coloring, nails, spa, massage
    
    # Pricing
    price_cents = Column(Integer, nullable=False)
    
    # Duration in minutes
    duration_minutes = Column(Integer, nullable=False, default=60)
    
    # Booking settings
    buffer_minutes = Column(Integer, default=0)  # Time between appointments
    requires_deposit = Column(Boolean, default=False)
    deposit_cents = Column(Integer, default=0)
    
    # Availability
    active = Column(Boolean, default=True)
    online_booking_enabled = Column(Boolean, default=True)
    
    # Loyalty
    points_multiplier = Column(Float, default=1.0)  # Bonus points for this service
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    appointments = relationship("Appointment", back_populates="service")
    stylist_services = relationship("StylistService", back_populates="service", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_beauty_services_tenant_category', 'tenant_id', 'category'),
    )


class Stylist(Base):
    """Staff member who provides beauty/salon services."""
    __tablename__ = "stylists"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)  # Link to user account if they have one
    
    name = Column(String(200), nullable=False)
    email = Column(String(200))
    phone = Column(String(50))
    
    # Profile
    title = Column(String(100))  # Senior Stylist, Nail Technician, etc.
    bio = Column(Text)
    photo_url = Column(String(500))
    
    # Settings
    active = Column(Boolean, default=True)
    accepts_walk_ins = Column(Boolean, default=True)
    online_booking_enabled = Column(Boolean, default=True)
    
    # Commission
    commission_rate = Column(Float, default=0.0)  # 0.0 - 1.0 (percentage)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, onupdate=datetime.utcnow)
    
    # Relationships
    appointments = relationship("Appointment", back_populates="stylist")
    availability = relationship("StylistAvailability", back_populates="stylist", cascade="all, delete-orphan")
    stylist_services = relationship("StylistService", back_populates="stylist", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_stylists_tenant_active', 'tenant_id', 'active'),
    )


class StylistService(Base):
    """Many-to-many relationship: which stylists can provide which services."""
    __tablename__ = "stylist_services"
    
    id = Column(Integer, primary_key=True, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("beauty_services.id"), nullable=False, index=True)
    
    # Optional: stylist-specific pricing override
    custom_price_cents = Column(Integer)
    custom_duration_minutes = Column(Integer)
    
    stylist = relationship("Stylist", back_populates="stylist_services")
    service = relationship("BeautyService", back_populates="stylist_services")
    
    __table_args__ = (
        UniqueConstraint('stylist_id', 'service_id', name='uq_stylist_service'),
    )


class StylistAvailability(Base):
    """Weekly recurring availability schedule for stylists."""
    __tablename__ = "stylist_availability"
    
    id = Column(Integer, primary_key=True, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    
    # Day of week (0=Monday, 6=Sunday)
    day_of_week = Column(Integer, nullable=False)
    
    # Time slots
    start_time = Column(Time, nullable=False)  # e.g., 09:00
    end_time = Column(Time, nullable=False)    # e.g., 17:00
    
    # Optional: specific date overrides
    specific_date = Column(Date, nullable=True)  # For one-time schedules
    is_available = Column(Boolean, default=True)  # False for blocking time off
    
    stylist = relationship("Stylist", back_populates="availability")
    
    __table_args__ = (
        Index('ix_stylist_availability_day', 'stylist_id', 'day_of_week'),
        Index('ix_stylist_availability_date', 'stylist_id', 'specific_date'),
    )


class Appointment(Base):
    """Customer appointment booking."""
    __tablename__ = "appointments"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    stylist_id = Column(Integer, ForeignKey("stylists.id"), nullable=False, index=True)
    service_id = Column(Integer, ForeignKey("beauty_services.id"), nullable=False, index=True)
    
    # Appointment details
    appointment_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    
    # Pricing (snapshot at booking time)
    price_cents = Column(Integer, nullable=False)
    deposit_paid_cents = Column(Integer, default=0)
    
    # Status: pending, confirmed, in_progress, completed, cancelled, no_show
    status = Column(String(20), nullable=False, default="pending")
    
    # Notes
    customer_notes = Column(Text)  # Customer's special requests
    staff_notes = Column(Text)     # Internal staff notes
    cancellation_reason = Column(String(500))
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime)
    started_at = Column(DateTime)
    completed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    # Reminders
    reminder_sent = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime)
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    stylist = relationship("Stylist", back_populates="appointments")
    service = relationship("BeautyService", back_populates="appointments")
    
    __table_args__ = (
        Index('ix_appointments_tenant_date', 'tenant_id', 'appointment_date'),
        Index('ix_appointments_stylist_date', 'stylist_id', 'appointment_date'),
        Index('ix_appointments_status', 'tenant_id', 'status'),
    )


# ═══════════════════════════════════════════════════════════════════════════
# PADEL COURT BOOKING MODELS
# ═══════════════════════════════════════════════════════════════════════════

class PadelCourt(Base):
    """Padel court definition."""
    __tablename__ = "padel_courts"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Court details
    court_number = Column(String(50), nullable=False)  # "Court 1", "Court A", etc.
    court_type = Column(String(50))  # "Indoor", "Outdoor", "Covered"
    surface_type = Column(String(50))  # "Glass", "Concrete", "Artificial Grass"
    has_lighting = Column(Boolean, default=True)
    
    # Pricing (base price, can be overridden by CourtPricing for time slots)
    base_price_cents = Column(Integer, nullable=False, default=0)  # Price per hour
    
    # Status
    active = Column(Boolean, default=True, nullable=False)
    maintenance_mode = Column(Boolean, default=False)
    notes = Column(Text)
    
    # Relationships
    bookings = relationship("CourtBooking", back_populates="court")
    pricing_rules = relationship("CourtPricing", back_populates="court")
    
    __table_args__ = (
        Index('ix_padel_courts_tenant_active', 'tenant_id', 'active'),
    )


class CourtPricing(Base):
    """Time-based pricing rules for courts (peak/off-peak)."""
    __tablename__ = "court_pricing"
    
    id = Column(Integer, primary_key=True, index=True)
    court_id = Column(Integer, ForeignKey("padel_courts.id"), nullable=False, index=True)
    
    # Time rules (NULL = applies to all)
    day_of_week = Column(Integer)  # 0=Monday, 6=Sunday, NULL=all days
    start_time = Column(Time)  # Start of pricing window
    end_time = Column(Time)    # End of pricing window
    
    # Pricing
    price_per_hour_cents = Column(Integer, nullable=False)
    label = Column(String(100))  # "Peak Hours", "Weekend Rate", etc.
    
    # Priority (higher number = higher priority when rules overlap)
    priority = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    
    # Relationships
    court = relationship("PadelCourt", back_populates="pricing_rules")
    
    __table_args__ = (
        Index('ix_court_pricing_court_day', 'court_id', 'day_of_week'),
    )


class PadelEquipment(Base):
    """Equipment available for rent (rackets, balls, etc.)."""
    __tablename__ = "padel_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Equipment details
    name = Column(String(200), nullable=False)  # "Padel Racket", "Balls (3-pack)"
    equipment_type = Column(String(50), nullable=False)  # "racket", "balls", "shoes"
    description = Column(Text)
    
    # Inventory
    quantity_available = Column(Integer, default=1)
    
    # Pricing
    rental_price_cents = Column(Integer, nullable=False, default=0)  # Price per booking
    
    # Status
    active = Column(Boolean, default=True)
    
    __table_args__ = (
        Index('ix_padel_equipment_tenant_type', 'tenant_id', 'equipment_type'),
    )


class CourtBooking(Base):
    """Padel court booking record."""
    __tablename__ = "court_bookings"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Booking details
    court_id = Column(Integer, ForeignKey("padel_courts.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Time slot
    booking_date = Column(Date, nullable=False, index=True)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    duration_minutes = Column(Integer, nullable=False)  # Typically 60, 90, or 120
    
    # Pricing
    court_price_cents = Column(Integer, nullable=False)  # Court rental cost
    equipment_price_cents = Column(Integer, default=0)   # Equipment rental cost
    total_price_cents = Column(Integer, nullable=False)  # Total booking cost
    
    # Participants
    player_count = Column(Integer, default=4)  # Standard padel is 2v2
    player_names = Column(Text)  # JSON array or comma-separated names
    
    # Status
    status = Column(String(20), default="pending", nullable=False)
    # pending, confirmed, in_progress, completed, cancelled, no_show
    
    # Notes
    customer_notes = Column(Text)
    staff_notes = Column(Text)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    confirmed_at = Column(DateTime)
    cancelled_at = Column(DateTime)
    
    # Payment status
    paid = Column(Boolean, default=False)
    payment_method = Column(String(50))
    
    # Reminders
    reminder_sent = Column(Boolean, default=False)
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    court = relationship("PadelCourt", back_populates="bookings")
    equipment_rentals = relationship("BookingEquipment", back_populates="booking")
    
    __table_args__ = (
        Index('ix_court_bookings_date_court', 'booking_date', 'court_id'),
        Index('ix_court_bookings_customer', 'customer_id', 'booking_date'),
        Index('ix_court_bookings_status', 'tenant_id', 'status'),
    )


class BookingEquipment(Base):
    """Equipment rented with a court booking."""
    __tablename__ = "booking_equipment"
    
    id = Column(Integer, primary_key=True, index=True)
    booking_id = Column(Integer, ForeignKey("court_bookings.id"), nullable=False, index=True)
    equipment_id = Column(Integer, ForeignKey("padel_equipment.id"), nullable=False, index=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    price_cents = Column(Integer, nullable=False)  # Price at time of booking
    
    # Relationships
    booking = relationship("CourtBooking", back_populates="equipment_rentals")
    equipment = relationship("PadelEquipment")
    
    __table_args__ = (
        Index('ix_booking_equipment_booking', 'booking_id'),
    )


# ============================================================================
# Flowershop Models (Week 8)
# ============================================================================

class FlowerCategory(Base):
    """Product categories for flower shop."""
    __tablename__ = "flower_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)
    description = Column(Text)
    icon = Column(String(50))  # Emoji or icon identifier
    display_order = Column(Integer, default=0)
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    products = relationship("FlowerProduct", back_populates="category")
    
    __table_args__ = (
        Index('ix_flower_categories_tenant', 'tenant_id'),
        UniqueConstraint('tenant_id', 'name', name='uq_flower_category_name_per_tenant'),
    )


class FlowerOccasion(Base):
    """Occasions for flower orders (birthdays, anniversaries, etc.)."""
    __tablename__ = "flower_occasions"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)  # Birthday, Anniversary, Sympathy, etc.
    description = Column(Text)
    icon = Column(String(50))
    color_scheme = Column(String(50))  # Suggested color palette
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    products = relationship("FlowerProduct", secondary="product_occasions", back_populates="occasions")
    
    __table_args__ = (
        Index('ix_flower_occasions_tenant', 'tenant_id'),
    )


class FlowerProduct(Base):
    """Flower products (bouquets, arrangements, plants)."""
    __tablename__ = "flower_products"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("flower_categories.id"), nullable=False, index=True)
    
    name = Column(String(200), nullable=False)
    description = Column(Text)
    sku = Column(String(50))
    
    # Pricing
    price_cents = Column(Integer, nullable=False)  # Base price in cents
    sale_price_cents = Column(Integer)  # Optional sale price
    
    # Inventory
    stock_quantity = Column(Integer, default=0)
    track_inventory = Column(Boolean, default=True)
    low_stock_threshold = Column(Integer, default=5)
    
    # Product details
    size = Column(String(50))  # Small, Medium, Large, etc.
    color_scheme = Column(String(100))  # Red roses, Mixed colors, etc.
    includes_vase = Column(Boolean, default=False)
    includes_card = Column(Boolean, default=True)
    
    # Images and display
    image_url = Column(String(500))
    featured = Column(Boolean, default=False)
    seasonal = Column(Boolean, default=False)  # Valentine's, Mother's Day, etc.
    display_order = Column(Integer, default=0)
    
    # Status
    active = Column(Boolean, default=True)
    available_for_delivery = Column(Boolean, default=True)
    available_for_pickup = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("FlowerCategory", back_populates="products")
    occasions = relationship("FlowerOccasion", secondary="product_occasions", back_populates="products")
    order_items = relationship("FlowerOrderItem", back_populates="product")
    
    __table_args__ = (
        Index('ix_flower_products_tenant', 'tenant_id'),
        Index('ix_flower_products_category', 'category_id'),
        Index('ix_flower_products_active_featured', 'active', 'featured'),
    )


# Association table for products and occasions (many-to-many)
product_occasions = Table(
    'product_occasions',
    Base.metadata,
    Column('product_id', Integer, ForeignKey('flower_products.id'), primary_key=True),
    Column('occasion_id', Integer, ForeignKey('flower_occasions.id'), primary_key=True),
    Index('ix_product_occasions_product', 'product_id'),
    Index('ix_product_occasions_occasion', 'occasion_id'),
)


class FlowerOrder(Base):
    """Customer flower orders with delivery details."""
    __tablename__ = "flower_orders"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Order details
    order_number = Column(String(50), unique=True, nullable=False)
    order_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Delivery details
    delivery_type = Column(String(20), nullable=False)  # delivery, pickup
    delivery_date = Column(Date, nullable=False)
    delivery_time_slot = Column(String(50))  # "9AM-12PM", "12PM-3PM", "3PM-6PM"
    
    # Recipient information
    recipient_name = Column(String(200), nullable=False)
    recipient_phone = Column(String(20))
    
    # Delivery address (for delivery orders)
    delivery_address_line1 = Column(String(200))
    delivery_address_line2 = Column(String(200))
    delivery_city = Column(String(100))
    delivery_postal_code = Column(String(20))
    delivery_instructions = Column(Text)
    
    # Gift message
    gift_message = Column(Text)  # max 200 chars validated in API
    include_sender_name = Column(Boolean, default=True)
    
    # Pricing
    subtotal_cents = Column(Integer, nullable=False)
    delivery_fee_cents = Column(Integer, default=0)
    discount_cents = Column(Integer, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Payment
    payment_status = Column(String(20), default='pending')  # pending, paid, failed, refunded
    payment_method = Column(String(50))  # card, cash, eft
    payment_reference = Column(String(100))
    
    # Order status
    status = Column(String(20), default='pending')  # pending, confirmed, preparing, out_for_delivery, delivered, cancelled
    
    # Staff notes
    staff_notes = Column(Text)
    
    # Loyalty points
    loyalty_points_awarded = Column(Integer, default=0)
    loyalty_points_awarded_at = Column(DateTime(timezone=True))
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    confirmed_at = Column(DateTime(timezone=True))
    delivered_at = Column(DateTime(timezone=True))
    cancelled_at = Column(DateTime(timezone=True))
    
    # Relationships
    customer = relationship("User")
    items = relationship("FlowerOrderItem", back_populates="order", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_flower_orders_tenant', 'tenant_id'),
        Index('ix_flower_orders_customer', 'customer_id'),
        Index('ix_flower_orders_status', 'status'),
        Index('ix_flower_orders_delivery_date', 'delivery_date'),
        Index('ix_flower_orders_order_number', 'order_number'),
    )


class FlowerOrderItem(Base):
    """Line items in flower orders."""
    __tablename__ = "flower_order_items"
    
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("flower_orders.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("flower_products.id"), nullable=False, index=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_price_cents = Column(Integer, nullable=False)  # Price at time of order
    subtotal_cents = Column(Integer, nullable=False)
    
    # Product snapshot (in case product is deleted/changed)
    product_name = Column(String(200), nullable=False)
    product_description = Column(Text)
    
    # Relationships
    order = relationship("FlowerOrder", back_populates="items")
    product = relationship("FlowerProduct", back_populates="order_items")
    
    __table_args__ = (
        Index('ix_flower_order_items_order', 'order_id'),
    )


class DeliverySlot(Base):
    """Available delivery time slots per day."""
    __tablename__ = "delivery_slots"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    delivery_date = Column(Date, nullable=False, index=True)
    time_slot = Column(String(50), nullable=False)  # "9AM-12PM", "12PM-3PM", "3PM-6PM"
    
    # Capacity
    max_deliveries = Column(Integer, default=10)
    current_bookings = Column(Integer, default=0)
    available = Column(Boolean, default=True)
    
    # Pricing
    fee_cents = Column(Integer, default=0)  # Delivery fee for this slot
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (
        Index('ix_delivery_slots_tenant', 'tenant_id'),
        Index('ix_delivery_slots_date', 'delivery_date'),
        UniqueConstraint('tenant_id', 'delivery_date', 'time_slot', name='uq_delivery_slot_per_tenant'),
    )


# ============================================================================
# Cannabis Dispensary Models (Week 9)
# ============================================================================

class DispensaryProductCategory(Base):
    """Product categories for cannabis dispensary."""
    __tablename__ = "dispensary_categories"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(100), nullable=False)  # Flower, Edibles, Concentrates, Topicals, etc.
    description = Column(Text)
    icon = Column(String(50))
    display_order = Column(Integer, default=0)
    requires_medical_card = Column(Boolean, default=False)  # Some products may require medical card
    active = Column(Boolean, default=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    products = relationship("DispensaryProduct", back_populates="category")
    
    __table_args__ = (
        Index('ix_dispensary_categories_tenant', 'tenant_id'),
        UniqueConstraint('tenant_id', 'name', name='uq_dispensary_category_name_per_tenant'),
    )


class DispensaryProduct(Base):
    """Cannabis products with compliance tracking."""
    __tablename__ = "dispensary_products"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("dispensary_categories.id"), nullable=False, index=True)
    
    # Basic info
    name = Column(String(200), nullable=False)
    strain = Column(String(100))  # Strain name (e.g., "Blue Dream", "OG Kush")
    strain_type = Column(String(20))  # indica, sativa, hybrid
    description = Column(Text)
    sku = Column(String(50))
    
    # Cannabis-specific details
    thc_percentage = Column(Float)  # THC content percentage
    cbd_percentage = Column(Float)  # CBD content percentage
    terpenes = Column(Text)  # Comma-separated terpene profile
    effects = Column(Text)  # Comma-separated effects (relaxed, energetic, creative, etc.)
    medical_uses = Column(Text)  # Comma-separated medical uses
    
    # Pricing
    price_cents = Column(Integer, nullable=False)  # Price per unit in cents
    unit_size = Column(String(50))  # "1g", "3.5g", "7g", "14g", "28g" for flower; "10mg", "100mg" for edibles
    
    # Inventory
    stock_quantity = Column(Integer, default=0)
    batch_number = Column(String(100))  # Batch/lot number for compliance
    harvest_date = Column(Date)  # Harvest date for flower
    package_date = Column(Date)  # Packaging date
    expiry_date = Column(Date)  # Expiration date (important for edibles)
    
    # Product classification
    requires_medical_card = Column(Boolean, default=False)  # True for medical-only products
    potency_level = Column(String(20))  # low, medium, high, very_high
    
    # Images and display
    image_url = Column(String(500))
    featured = Column(Boolean, default=False)
    display_order = Column(Integer, default=0)
    
    # Status
    active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    category = relationship("DispensaryProductCategory", back_populates="products")
    sale_items = relationship("DispensarySaleItem", back_populates="product")
    
    __table_args__ = (
        Index('ix_dispensary_products_tenant', 'tenant_id'),
        Index('ix_dispensary_products_category', 'category_id'),
        Index('ix_dispensary_products_active', 'active'),
        Index('ix_dispensary_products_strain_type', 'strain_type'),
    )


class DispensaryCustomerVerification(Base):
    """Customer age and medical card verification for compliance."""
    __tablename__ = "dispensary_customer_verifications"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Age verification
    age_verified = Column(Boolean, default=False)
    date_of_birth = Column(Date)
    age_verification_date = Column(DateTime(timezone=True))
    age_verification_method = Column(String(50))  # id_card, drivers_license, passport
    
    # Medical card verification (optional, for medical dispensaries)
    has_medical_card = Column(Boolean, default=False)
    medical_card_number = Column(String(100))
    medical_card_expiry = Column(Date)
    medical_card_verified_date = Column(DateTime(timezone=True))
    medical_condition = Column(String(200))  # Optional, for record keeping
    
    # Verification documents
    id_document_type = Column(String(50))
    id_document_number = Column(String(100))
    id_document_expiry = Column(Date)
    
    # Staff verification
    verified_by_staff_id = Column(Integer, ForeignKey("users.id"))
    
    # Status
    verification_status = Column(String(20), default='pending')  # pending, verified, rejected, expired
    notes = Column(Text)  # Staff notes
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    verified_by = relationship("User", foreign_keys=[verified_by_staff_id])
    
    __table_args__ = (
        Index('ix_disp_verifications_tenant', 'tenant_id'),
        Index('ix_disp_verifications_customer', 'customer_id'),
        Index('ix_disp_verifications_status', 'verification_status'),
        UniqueConstraint('tenant_id', 'customer_id', name='uq_dispensary_verification_per_customer'),
    )


class DispensaryPurchaseLimitTracking(Base):
    """Track customer purchase limits for compliance (daily/monthly limits)."""
    __tablename__ = "dispensary_purchase_limits"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    
    # Purchase limits (in grams for flower, mg for edibles)
    daily_limit_grams = Column(Float, default=28.0)  # Default 28g (1 oz) per day
    monthly_limit_grams = Column(Float, default=150.0)  # Default 150g per month
    
    # Current period tracking
    current_day = Column(Date, nullable=False, index=True)
    current_month = Column(String(7), nullable=False, index=True)  # YYYY-MM format
    
    daily_purchased_grams = Column(Float, default=0.0)
    monthly_purchased_grams = Column(Float, default=0.0)
    
    # Transaction counting
    daily_transaction_count = Column(Integer, default=0)
    monthly_transaction_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("User")
    
    __table_args__ = (
        Index('ix_disp_limits_tenant', 'tenant_id'),
        Index('ix_disp_limits_customer', 'customer_id'),
        Index('ix_disp_limits_day', 'current_day'),
        Index('ix_disp_limits_month', 'current_month'),
        UniqueConstraint('tenant_id', 'customer_id', 'current_day', name='uq_dispensary_limit_per_customer_day'),
    )


class DispensarySale(Base):
    """Cannabis sales transactions with compliance tracking."""
    __tablename__ = "dispensary_sales"
    
    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    customer_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    verification_id = Column(Integer, ForeignKey("dispensary_customer_verifications.id"), nullable=False, index=True)
    
    # Sale details
    sale_number = Column(String(50), unique=True, nullable=False, index=True)
    sale_date = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    
    # Compliance tracking
    customer_age_at_sale = Column(Integer, nullable=False)  # Age verification
    medical_card_used = Column(Boolean, default=False)  # Whether medical card was used
    total_grams_sold = Column(Float, default=0.0)  # Total cannabis weight sold (for limits)
    
    # Staff
    staff_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Pricing
    subtotal_cents = Column(Integer, nullable=False)
    tax_cents = Column(Integer, default=0)  # Cannabis may have special tax rates
    discount_cents = Column(Integer, default=0)
    total_cents = Column(Integer, nullable=False)
    
    # Payment
    payment_method = Column(String(50))  # cash, card, debit
    payment_status = Column(String(20), default='completed')  # completed, refunded
    payment_reference = Column(String(100))
    
    # Loyalty points
    loyalty_points_awarded = Column(Integer, default=0)
    loyalty_points_awarded_at = Column(DateTime(timezone=True))
    
    # Compliance notes
    compliance_notes = Column(Text)  # Any compliance-related notes
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())
    
    # Relationships
    customer = relationship("User", foreign_keys=[customer_id])
    staff = relationship("User", foreign_keys=[staff_id])
    verification = relationship("DispensaryCustomerVerification")
    items = relationship("DispensarySaleItem", back_populates="sale", cascade="all, delete-orphan")
    
    __table_args__ = (
        Index('ix_dispensary_sales_tenant', 'tenant_id'),
        Index('ix_dispensary_sales_customer', 'customer_id'),
        Index('ix_dispensary_sales_date', 'sale_date'),
        Index('ix_dispensary_sales_number', 'sale_number'),
    )


class DispensarySaleItem(Base):
    """Line items in dispensary sales."""
    __tablename__ = "dispensary_sale_items"
    
    id = Column(Integer, primary_key=True, index=True)
    sale_id = Column(Integer, ForeignKey("dispensary_sales.id"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("dispensary_products.id"), nullable=False, index=True)
    
    quantity = Column(Integer, default=1, nullable=False)
    unit_price_cents = Column(Integer, nullable=False)  # Price at time of sale
    subtotal_cents = Column(Integer, nullable=False)
    
    # Compliance tracking
    grams_sold = Column(Float, default=0.0)  # Weight in grams (for limit tracking)
    batch_number = Column(String(100))  # Batch number at time of sale (for recalls)
    
    # Product snapshot (in case product is deleted/changed)
    product_name = Column(String(200), nullable=False)
    thc_percentage = Column(Float)
    cbd_percentage = Column(Float)
    strain_type = Column(String(20))
    
    # Relationships
    sale = relationship("DispensarySale", back_populates="items")
    product = relationship("DispensaryProduct", back_populates="sale_items")
    
    __table_args__ = (
        Index('ix_dispensary_sale_items_sale', 'sale_id'),
    )
