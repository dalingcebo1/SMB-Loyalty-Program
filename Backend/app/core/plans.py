from typing import Dict, List, Any
from pydantic import BaseModel

class PlanFeature(BaseModel):
    name: str
    description: str
    enabled: bool = True
    limit: int | None = None  # None means unlimited

class PlanConfig(BaseModel):
    id: str
    name: str
    description: str
    price_cents: int
    currency: str = "zar"
    features: Dict[str, Any]  # Map of feature_key -> config (bool or dict)
    stripe_price_id: str | None = None # To be filled with actual Stripe Price IDs

# Feature Keys
FEATURE_LOYALTY = "loyalty"
FEATURE_CAMPAIGNS = "campaigns"
FEATURE_ANALYTICS = "analytics"
FEATURE_CUSTOM_DOMAIN = "custom_domain"
FEATURE_WHITE_LABEL = "white_label"
FEATURE_API_ACCESS = "api_access"
FEATURE_MULTI_USER = "multi_user"

PLAN_REGISTRY: Dict[str, PlanConfig] = {
    "free": PlanConfig(
        id="free",
        name="Starter",
        description="Perfect for small businesses just getting started.",
        price_cents=0,
        features={
            FEATURE_LOYALTY: {"limit_customers": 100, "limit_orders_per_month": 50},
            FEATURE_CAMPAIGNS: False,
            FEATURE_ANALYTICS: {"retention_days": 7},
            FEATURE_CUSTOM_DOMAIN: False,
            FEATURE_WHITE_LABEL: False,
            FEATURE_API_ACCESS: False,
            FEATURE_MULTI_USER: {"limit_users": 1},
        }
    ),
    "pro": PlanConfig(
        id="pro",
        name="Growth",
        description="For growing businesses that need more power.",
        price_cents=49900, # R499.00
        features={
            FEATURE_LOYALTY: {"limit_customers": 1000, "limit_orders_per_month": 500},
            FEATURE_CAMPAIGNS: True,
            FEATURE_ANALYTICS: {"retention_days": 90},
            FEATURE_CUSTOM_DOMAIN: True,
            FEATURE_WHITE_LABEL: False,
            FEATURE_API_ACCESS: True,
            FEATURE_MULTI_USER: {"limit_users": 5},
        }
    ),
    "enterprise": PlanConfig(
        id="enterprise",
        name="Scale",
        description="Unlimited power for established brands.",
        price_cents=149900, # R1499.00
        features={
            FEATURE_LOYALTY: {"limit_customers": None, "limit_orders_per_month": None},
            FEATURE_CAMPAIGNS: True,
            FEATURE_ANALYTICS: {"retention_days": 365},
            FEATURE_CUSTOM_DOMAIN: True,
            FEATURE_WHITE_LABEL: True,
            FEATURE_API_ACCESS: True,
            FEATURE_MULTI_USER: {"limit_users": None},
        }
    ),
}

def get_plan(plan_id: str) -> PlanConfig:
    return PLAN_REGISTRY.get(plan_id, PLAN_REGISTRY["free"])
