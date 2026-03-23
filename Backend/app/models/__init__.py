"""Backward-compatible re-exports of all models.

After splitting the monolithic models.py into sub-modules, this package
ensures that every ``from app.models import X`` that previously worked
continues to work without changes.
"""

# Base & mixin
from app.core.database import Base  # noqa: F401
from .base import TenantScopedModel  # noqa: F401

# Enums
from .enums import VerticalType  # noqa: F401

# Core / tenant models
from .core import (  # noqa: F401
    tenant_admins,
    Tenant,
    TenantDomain,
    TenantVerticalConfig,
    Service,
    Extra,
    User,
    TenantBranding,
    TenantIntegration,
    SubscriptionPlan,
    AuditLog,
    StaffPermission,
    BusinessMetrics,
    AggregatedCustomerMetrics,
    Vehicle,
)

# Loyalty
from .loyalty import (  # noqa: F401
    Reward,
    LoyaltyProgram,
    LoyaltyTier,
    LoyaltyTransaction,
    VisitCount,
    PointBalance,
    Redemption,
)

# Orders & payments
from .orders import Order, OrderItem, OrderVehicle, Payment  # noqa: F401

# Notifications & tokens
from .notifications import Notification, InviteToken  # noqa: F401

# Retail / inventory
from .retail import (  # noqa: F401
    Supplier,
    ProductCategory,
    Product,
    InventoryLevel,
    StockMovement,
    LowStockAlert,
)

# POS
from .pos import Sale, SaleItem, SalePayment  # noqa: F401

# Beauty
from .beauty import (  # noqa: F401
    BeautyService,
    Stylist,
    StylistService,
    StylistAvailability,
    Appointment,
)

# Padel
from .padel import (  # noqa: F401
    PadelCourt,
    CourtPricing,
    PadelEquipment,
    CourtBooking,
    BookingEquipment,
)

# Flowershop
from .flowershop import (  # noqa: F401
    FlowerCategory,
    FlowerOccasion,
    FlowerProduct,
    product_occasions,
    FlowerOrder,
    FlowerOrderItem,
    DeliverySlot,
)

# Dispensary
from .dispensary import (  # noqa: F401
    DispensaryProductCategory,
    DispensaryProduct,
    DispensaryCustomerVerification,
    DispensaryPurchaseLimitTracking,
    DispensarySale,
    DispensarySaleItem,
)

# Vertical model extensions (from app/vertical_models/)
from app.vertical_models.beauty_packages import BeautyPackage, PackageBooking, package_services  # noqa: F401
from app.vertical_models.beauty_reviews import ServiceReview, AppointmentReminder  # noqa: F401
from app.vertical_models.campaigns import (  # noqa: F401
    Campaign, CampaignRecipient, CustomerSegment,
    CampaignType, CampaignStatus, SegmentType,
)
from app.vertical_models.financial import (  # noqa: F401
    Invoice, InvoiceLineItem, InvoiceStatus,
    Expense, ExpenseCategory, PaymentMethod, FinancialYear,
)
