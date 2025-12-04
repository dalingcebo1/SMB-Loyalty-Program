from typing import Dict, List, Any
from app.models import VerticalType

# Module registry and vertical-aware extras
MODULE_REGISTRY: Dict[str, Dict[str, Any]] = {
    # Core Operations
    "core": {"name": "Core", "category": "Core Operations", "description": "Tenant, auth, settings"},
    "team": {"name": "Team & Roles", "category": "Core Operations"},
    "orders": {"name": "Orders / POS", "category": "Core Operations"},
    "inventory": {"name": "Inventory", "category": "Core Operations", "description": "Catalog & stock", "vertical_hint": ["flowershop", "dispensary", "retail", "food"]},
    "bookings": {"name": "Bookings", "category": "Core Operations", "description": "Scheduling / courts", "vertical_hint": ["padel", "beauty", "services"]},
    # Customer Growth
    "loyalty": {"name": "Loyalty", "category": "Customer Growth"},
    "messaging": {"name": "Messaging", "category": "Customer Growth", "description": "Email/SMS/WhatsApp"},
    "referrals": {"name": "Referrals", "category": "Customer Growth"},
    "automation": {"name": "Automations", "category": "Customer Growth"},
    "campaigns": {"name": "Campaigns", "category": "Customer Growth"},
    "crm": {"name": "CRM", "category": "Customer Growth"},
    # Intelligence & Compliance
    "analytics": {"name": "Analytics", "category": "Intelligence"},
    "data_export": {"name": "Data Export", "category": "Intelligence"},
    "audits": {"name": "Audit Logs", "category": "Intelligence"},
    # Platform
    "integrations": {"name": "Integrations", "category": "Platform"},
    "api": {"name": "Public API & Webhooks", "category": "Platform"},
    "branding_plus": {"name": "Branding+", "category": "Platform"},
    "priority_support": {"name": "Priority Support", "category": "Platform"},
    "billing": {"name": "Billing", "category": "Platform"},
    "payments": {"name": "Payments", "category": "Platform"},
    "staff": {"name": "Staff", "category": "Core Operations"},
}

# Default modules included for each vertical type (Standard features)
VERTICAL_EXTRA_MODULES: Dict[str, List[str]] = {
    VerticalType.padel.value: ["bookings", "payments"],
    VerticalType.beauty.value: ["bookings", "crm"],
    VerticalType.flowershop.value: ["inventory", "crm"],
    VerticalType.dispensary.value: ["inventory", "crm"],
    VerticalType.carwash.value: ["loyalty", "crm"],
    # Fallbacks for potential future verticals if added to Enum
    "retail": ["inventory", "payments"],
    "services": ["appointments", "crm"],
    "food": ["inventory", "loyalty"],
}
