"""
Padel Vertical Module

Provides padel court booking and management features:
- Court booking system
- Time slot management
- Tournament organization
- Equipment rental
- Player profiles
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from sqlalchemy.orm import Session
import logging

from app.verticals.base import VerticalModule

logger = logging.getLogger(__name__)


class PadelVertical(VerticalModule):
    """Padel court booking and management vertical."""
    
    @property
    def vertical_key(self) -> str:
        return "padel"
    
    @property
    def display_name(self) -> str:
        return "Padel Courts"
    
    @property
    def description(self) -> str:
        return "Padel court booking system with time slot management, tournaments, and player tracking."
    
    @property
    def icon(self) -> str:
        return "tennis-ball"
    
    def get_features(self) -> List[str]:
        return [
            "court_booking",
            "time_slot_management",
            "player_profiles",
            "tournament_mode",
            "equipment_rental",
            "recurring_bookings",
            "group_bookings",
            "loyalty_rewards",
        ]

    def get_routes(self) -> List[APIRouter]:
        from app.verticals.padel.routes import router
        return [router]

    def get_router_prefix(self) -> str:
        return "/api/padel"

    def get_router_tags(self) -> List[str]:
        return ["padel"]

    def get_required_capabilities(self) -> Dict[str, str]:
        return {
            "court.create": "padel.manage_courts",
            "court.update": "padel.manage_courts",
            "court.delete": "padel.manage_courts",
            "pricing.create": "padel.manage_pricing",
            "pricing.delete": "padel.manage_pricing",
            "equipment.create": "padel.manage_equipment",
            "equipment.update": "padel.manage_equipment",
            "equipment.delete": "padel.manage_equipment",
            "booking.create": "padel.create_booking",
            "booking.update": "padel.view_all_bookings",
            "booking.delete": "padel.cancel_booking",
        }
    
    def get_default_config(self) -> Dict[str, Any]:
        return {
            "features": {
                "court_booking": True,
                "time_slot_management": True,
                "player_profiles": True,
                "tournament_mode": False,
                "equipment_rental": True,
                "recurring_bookings": True,
                "group_bookings": True,
                "loyalty_rewards": True,
            },
            "settings": {
                "default_slot_duration_minutes": 90,
                "advance_booking_days": 14,
                "cancellation_hours_before": 24,
                "loyalty_points_per_booking": 10,
                "max_players_per_booking": 4,
            },
            "branding": {
                "service_icon": "🎾",
                "primary_call_to_action": "Book a Court",
            }
        }
    
    def on_tenant_created(self, tenant_id: str, db: Session) -> None:
        logger.info(f"Initializing padel vertical for tenant {tenant_id}")
        logger.info(f"Padel vertical initialized for tenant {tenant_id}")
    
    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        if tenant.vertical_type != self.vertical_key:
            return
        meta["padel"] = {
            "features_enabled": meta.get("features", {}),
            "slot_duration_minutes": 90,
        }
    
    def get_admin_capabilities(self) -> List[str]:
        return [
            "padel.manage_courts",
            "padel.manage_time_slots",
            "padel.manage_pricing",
            "padel.view_all_bookings",
            "padel.manage_tournaments",
            "padel.manage_equipment",
        ]
    
    def get_staff_capabilities(self) -> List[str]:
        return [
            "padel.view_bookings",
            "padel.create_booking",
            "padel.cancel_booking",
            "padel.check_in_players",
        ]
    
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        settings = config.get("settings", {})
        slot_duration = settings.get("default_slot_duration_minutes", 90)
        if not (30 <= slot_duration <= 240):
            raise ValueError("Slot duration must be between 30 and 240 minutes")
        advance_days = settings.get("advance_booking_days", 14)
        if advance_days < 1:
            raise ValueError("Advance booking days must be at least 1")
        return config
