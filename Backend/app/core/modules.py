from typing import Dict, List, Any

# Module registry and vertical-aware extras
MODULE_REGISTRY: Dict[str, Dict[str, Any]] = {
    # Core Operations
    "core": {"name": "Core", "category": "Core Operations", "description": "Tenant, auth, settings"},
    "team": {"name": "Team & Roles", "category": "Core Operations"},
    "orders": {"name": "Orders / POS", "category": "Core Operations"},
    "inventory": {"name": "Inventory", "category": "Core Operations", "description": "Catalog & stock", "vertical_hint": ["flowershop", "dispensary"]},
    "bookings": {"name": "Bookings", "category": "Core Operations", "description": "Scheduling / courts", "vertical_hint": ["padel", "beauty"]},
    # Customer Growth
    "loyalty": {"name": "Loyalty", "category": "Customer Growth"},
    "messaging": {"name": "Messaging", "category": "Customer Growth", "description": "Email/SMS/WhatsApp"},
    "referrals": {"name": "Referrals", "category": "Customer Growth"},
    "automation": {"name": "Automations", "category": "Customer Growth"},
    "campaigns": {"name": "Campaigns", "category": "Customer Growth"},
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
}

VERTICAL_EXTRA_MODULES: Dict[str, List[str]] = {
    "padel": ["bookings"],
    "beauty": ["bookings"],
    "flowershop": ["inventory"],
    "dispensary": ["inventory"],
    "carwash": [],
}
