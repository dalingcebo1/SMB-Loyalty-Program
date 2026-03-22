"""
Flower Shop Vertical Module

Provides florist and flower delivery features:
- Product catalog (bouquets, arrangements)
- Seasonal collections
- Delivery scheduling
- Gift messages
- Occasion-based recommendations
"""

from typing import List, Dict, Any, Optional
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
            "product_catalog",
            "seasonal_collections",
            "delivery_scheduling",
            "gift_messages",
            "occasion_reminders",
            "subscription_service",
            "loyalty_rewards",
        ]

    def get_routes(self) -> List[APIRouter]:
        from app.verticals.flowershop.routes import router
        return [router]

    def get_router_prefix(self) -> str:
        return "/api/flowershop"

    def get_router_tags(self) -> List[str]:
        return ["Flowershop"]

    def get_required_capabilities(self) -> Dict[str, str]:
        return {
            "category.create": "flowershop.manage_products",
            "category.update": "flowershop.manage_products",
            "category.delete": "flowershop.manage_products",
            "product.create": "flowershop.manage_products",
            "product.update": "flowershop.manage_products",
            "product.delete": "flowershop.manage_products",
            "occasion.create": "flowershop.manage_collections",
            "order.create": "flowershop.process_orders",
            "order.update": "flowershop.view_all_orders",
            "slot.create": "flowershop.manage_delivery",
        }
    
    def get_default_config(self) -> Dict[str, Any]:
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
                "delivery_cutoff_hour": 15,
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
        logger.info(f"Initializing flowershop vertical for tenant {tenant_id}")
        logger.info(f"Flowershop vertical initialized for tenant {tenant_id}")
    
    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        if tenant.vertical_type != self.vertical_key:
            return
        meta["flowershop"] = {
            "features_enabled": meta.get("features", {}),
            "same_day_delivery_available": True,
            "delivery_cutoff_hour": 15,
        }
    
    def get_admin_capabilities(self) -> List[str]:
        return [
            "flowershop.manage_products",
            "flowershop.manage_collections",
            "flowershop.manage_delivery",
            "flowershop.view_all_orders",
            "flowershop.manage_subscriptions",
        ]
    
    def get_staff_capabilities(self) -> List[str]:
        return [
            "flowershop.process_orders",
            "flowershop.view_orders",
            "flowershop.schedule_delivery",
            "flowershop.view_products",
        ]
    
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        settings = config.get("settings", {})
        cutoff = settings.get("delivery_cutoff_hour", 15)
        if not (0 <= cutoff <= 23):
            raise ValueError("Delivery cutoff hour must be between 0 and 23")
        return config
