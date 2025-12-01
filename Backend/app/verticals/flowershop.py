"""
Flower Shop Vertical Module

Provides florist and flower delivery features:
- Product catalog (bouquets, arrangements)
- Seasonal collections
- Delivery scheduling
- Gift messages
- Occasion-based recommendations
"""

from typing import List, Dict, Any
from fastapi import APIRouter
from sqlalchemy.orm import Session
import logging

from app.verticals.base import VerticalModule

logger = logging.getLogger(__name__)


class FlowershopVertical(VerticalModule):
    """Flower shop and florist business vertical."""
    
    @property
    def vertical_key(self) -> str:
        return "flowershop"
    
    @property
    def display_name(self) -> str:
        return "Flower Shop"
    
    @property
    def description(self) -> str:
        return "Florist management with product catalog, delivery scheduling, and occasion-based recommendations."
    
    @property
    def icon(self) -> str:
        return "flower"
    
    def get_features(self) -> List[str]:
        return [
            "product_catalog",       # Bouquets, arrangements
            "seasonal_collections",  # Valentine's, Mother's Day
            "delivery_scheduling",   # Same-day, scheduled delivery
            "gift_messages",         # Personalized cards
            "occasion_reminders",    # Birthdays, anniversaries
            "subscription_service",  # Weekly/monthly flowers
            "loyalty_rewards",       # Purchase-based rewards
        ]
    
    def get_default_config(self) -> Dict[str, Any]:
        """Default configuration for new flower shop tenants."""
        return {
            "features": {
                "product_catalog": True,
                "seasonal_collections": True,
                "delivery_scheduling": True,
                "gift_messages": True,
                "occasion_reminders": True,
                "subscription_service": False,
                "loyalty_rewards": True,
            },
            "settings": {
                "enable_same_day_delivery": True,
                "delivery_cutoff_hour": 15,  # 3 PM
                "loyalty_points_per_rand": 1,
                "enable_gift_wrapping": True,
                "max_message_length": 200,
            },
            "branding": {
                "service_icon": "🌸",
                "primary_call_to_action": "Shop Flowers",
            }
        }
    
    def on_tenant_created(self, tenant_id: str, db: Session) -> None:
        """Initialize flower shop tenant."""
        logger.info(f"Initializing flowershop vertical for tenant {tenant_id}")
        
        # TODO: Seed product categories (Bouquets, Plants, Arrangements)
        # TODO: Create default occasions (Birthday, Anniversary, Sympathy)
        # TODO: Set up delivery zones
        
        logger.info(f"Flowershop vertical initialized for tenant {tenant_id}")
    
    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        """Add flower shop-specific metadata."""
        if tenant.vertical_type != self.vertical_key:
            return
        
        meta["flowershop"] = {
            "features_enabled": meta.get("features", {}),
            "same_day_delivery_available": True,
            "delivery_cutoff_hour": 15,
        }
    
    def get_admin_capabilities(self) -> List[str]:
        """Admin-level capabilities for flower shop."""
        return [
            "flowershop.manage_products",
            "flowershop.manage_collections",
            "flowershop.manage_delivery",
            "flowershop.view_all_orders",
            "flowershop.manage_subscriptions",
        ]
    
    def get_staff_capabilities(self) -> List[str]:
        """Staff-level capabilities for flower shop."""
        return [
            "flowershop.process_orders",
            "flowershop.view_orders",
            "flowershop.schedule_delivery",
            "flowershop.view_products",
        ]
    
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate flower shop configuration."""
        settings = config.get("settings", {})
        
        # Validate delivery cutoff hour
        cutoff = settings.get("delivery_cutoff_hour", 15)
        if not (0 <= cutoff <= 23):
            raise ValueError("Delivery cutoff hour must be between 0 and 23")
        
        return config
