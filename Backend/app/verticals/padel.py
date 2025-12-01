"""
Padel Vertical Module

Provides padel court booking and management features:
- Court booking system
- Time slot management
- Tournament organization
- Equipment rental
- Player profiles
"""

from typing import List, Dict, Any
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
            "court_booking",         # Reserve courts
            "time_slot_management",  # Configure available slots
            "player_profiles",       # Track player info
            "tournament_mode",       # Organize tournaments
            "equipment_rental",      # Rent rackets, balls
            "recurring_bookings",    # Weekly/monthly bookings
            "group_bookings",        # Book for multiple players
            "loyalty_rewards",       # Booking-based rewards
        ]
    
    def get_default_config(self) -> Dict[str, Any]:
        """Default configuration for new padel tenants."""
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
        """Initialize padel tenant with default setup."""
        logger.info(f"Initializing padel vertical for tenant {tenant_id}")
        
        # TODO: Create default courts (Court 1, Court 2, etc.)
        # TODO: Set up default time slots (8 AM - 10 PM)
        # TODO: Create pricing tiers (peak, off-peak)
        
        logger.info(f"Padel vertical initialized for tenant {tenant_id}")
    
    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        """Add padel-specific metadata."""
        if tenant.vertical_type != self.vertical_key:
            return
        
        meta["padel"] = {
            "features_enabled": meta.get("features", {}),
            "slot_duration_minutes": 90,
            # Could add: "available_courts": get_court_count(tenant.id)
        }
    
    def get_admin_capabilities(self) -> List[str]:
        """Admin-level capabilities for padel."""
        return [
            "padel.manage_courts",
            "padel.manage_time_slots",
            "padel.manage_pricing",
            "padel.view_all_bookings",
            "padel.manage_tournaments",
            "padel.manage_equipment",
        ]
    
    def get_staff_capabilities(self) -> List[str]:
        """Staff-level capabilities for padel."""
        return [
            "padel.view_bookings",
            "padel.create_booking",
            "padel.cancel_booking",
            "padel.check_in_players",
        ]
    
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate padel configuration."""
        settings = config.get("settings", {})
        
        # Validate slot duration
        slot_duration = settings.get("default_slot_duration_minutes", 90)
        if not (30 <= slot_duration <= 240):
            raise ValueError("Slot duration must be between 30 and 240 minutes")
        
        # Validate advance booking days
        advance_days = settings.get("advance_booking_days", 14)
        if advance_days < 1:
            raise ValueError("Advance booking days must be at least 1")
        
        return config
