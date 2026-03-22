"""
Beauty Salon Vertical Module

Provides beauty salon and spa features:
- Appointment booking
- Service menu (hair, nails, spa)
- Stylist management
- Product sales
- Client profiles
"""

from typing import List, Dict, Any

from fastapi import APIRouter
from sqlalchemy.orm import Session
import logging

from app.verticals.base import VerticalModule

logger = logging.getLogger(__name__)


class BeautyVertical(VerticalModule):
    """Beauty salon and spa business vertical."""

    @property
    def vertical_key(self) -> str:
        return "beauty"

    @property
    def display_name(self) -> str:
        return "Beauty Salon & Spa"

    @property
    def description(self) -> str:
        return "Beauty salon management with appointment booking, stylist scheduling, and service menu."

    @property
    def icon(self) -> str:
        return "sparkles"

    def get_features(self) -> List[str]:
        return [
            "appointment_booking",   # Book services
            "service_menu",          # Hair, nails, spa, etc.
            "stylist_management",    # Assign stylists
            "client_profiles",       # Track preferences, history
            "product_sales",         # Retail products
            "package_deals",         # Service bundles
            "recurring_appointments", # Regular customers
            "loyalty_rewards",       # Visit-based rewards
        ]

    def get_default_config(self) -> Dict[str, Any]:
        """Default configuration for new beauty salon tenants."""
        return {
            "features": {
                "appointment_booking": True,
                "service_menu": True,
                "stylist_management": True,
                "client_profiles": True,
                "product_sales": True,
                "package_deals": True,
                "recurring_appointments": True,
                "loyalty_rewards": True,
            },
            "settings": {
                "default_appointment_duration_minutes": 60,
                "advance_booking_days": 30,
                "cancellation_hours_before": 24,
                "loyalty_points_per_visit": 10,
                "enable_stylist_selection": True,
            },
            "branding": {
                "service_icon": "💇",
                "primary_call_to_action": "Book Appointment",
            }
        }

    def on_tenant_created(self, tenant_id: str, db: Session) -> None:
        """Initialize beauty salon tenant."""
        logger.info(f"Initializing beauty vertical for tenant {tenant_id}")

        # TODO: Seed service categories (Hair, Nails, Spa, Makeup)
        # TODO: Create default services (Haircut, Manicure, Massage)
        # TODO: Set up default time slots

        logger.info(f"Beauty vertical initialized for tenant {tenant_id}")

    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        """Add beauty salon-specific metadata."""
        if tenant.vertical_type != self.vertical_key:
            return

        meta["beauty"] = {
            "features_enabled": meta.get("features", {}),
            "appointment_duration_minutes": 60,
            # Could add: "available_stylists": get_stylist_count(tenant.id)
        }

    def get_admin_capabilities(self) -> List[str]:
        """Admin-level capabilities for beauty salon."""
        return [
            "beauty.manage_services",
            "beauty.manage_stylists",
            "beauty.manage_schedule",
            "beauty.view_all_appointments",
            "beauty.manage_packages",
            "beauty.manage_products",
        ]

    def get_staff_capabilities(self) -> List[str]:
        """Staff-level capabilities for beauty salon."""
        return [
            "beauty.view_appointments",
            "beauty.create_appointment",
            "beauty.cancel_appointment",
            "beauty.check_in_clients",
            "beauty.sell_products",
        ]

    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate beauty salon configuration."""
        settings = config.get("settings", {})

        # Validate appointment duration
        duration = settings.get("default_appointment_duration_minutes", 60)
        if not (15 <= duration <= 480):
            raise ValueError("Appointment duration must be between 15 and 480 minutes")

        return config

    def get_routes(self) -> List[APIRouter]:
        from app.verticals.beauty.routes import router
        return [router]

    def get_router_prefix(self) -> str:
        return ""  # prefix is in the router itself

    def get_router_tags(self) -> List[str]:
        return ["Beauty/Salon"]
