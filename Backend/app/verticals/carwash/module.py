"""
Car Wash Vertical Module

Provides car wash and detailing specific features:
- Vehicle tracking
- Wash packages
- Bay management
- Queue system
- QR code check-in
"""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from sqlalchemy.orm import Session
import logging

from app.verticals.base import VerticalModule

logger = logging.getLogger(__name__)


class CarwashVertical(VerticalModule):
    """Car wash and auto detailing business vertical."""
    
    @property
    def vertical_key(self) -> str:
        return "carwash"
    
    @property
    def display_name(self) -> str:
        return "Car Wash & Detailing"
    
    @property
    def description(self) -> str:
        return "Complete car wash and auto detailing management system with bay tracking, packages, and customer vehicles."
    
    @property
    def icon(self) -> str:
        return "car-wash"
    
    def get_features(self) -> List[str]:
        return [
            "vehicle_tracking",      # Track customer vehicles
            "wash_packages",         # Service packages (basic, premium, etc.)
            "bay_management",        # Physical bay tracking
            "queue_system",          # Customer queue management
            "qr_checkin",           # QR code-based check-in
            "membership_tiers",     # Subscription memberships
            "loyalty_multiplier",   # Enhanced loyalty point earning
        ]
    
    def get_routes(self) -> List[APIRouter]:
        """Return carwash-specific routes."""
        from app.verticals.carwash.routes import router
        return [router]
    
    def get_models(self) -> List[type]:
        """Return carwash-specific models."""
        from app.verticals.carwash.models import (
            Vehicle,
            WashPackage,
            CarwashMembership,
            WashHistory
        )
        return [Vehicle, WashPackage, CarwashMembership, WashHistory]
    
    def get_default_config(self) -> Dict[str, Any]:
        """Default configuration for new carwash tenants."""
        return {
            "features": {
                "vehicle_tracking": True,
                "wash_packages": True,
                "bay_management": False,  # Opt-in for physical locations
                "queue_system": False,    # Opt-in
                "qr_checkin": True,
                "membership_tiers": True,
                "loyalty_multiplier": True,
            },
            "settings": {
                "default_loyalty_multiplier": 1.5,  # 1.5x points
                "enable_vehicle_photos": True,
                "require_vehicle_registration": False,
                "max_queue_size": 50,
            },
            "branding": {
                "service_icon": "🚗",
                "primary_call_to_action": "Book a Wash",
            }
        }
    
    def on_tenant_created(self, tenant_id: str, db: Session) -> None:
        """
        Initialize carwash tenant with default data.
        
        Seeds:
        - Default wash packages (Basic, Premium, Deluxe)
        - Default categories
        - Sample inventory items
        """
        logger.info(f"Initializing carwash vertical for tenant {tenant_id}")
        
        # Seed default wash packages
        from app.verticals.carwash.services import WashPackageService
        
        try:
            packages = WashPackageService.create_default_packages(db, tenant_id)
            logger.info(
                f"Created {len(packages)} default wash packages for tenant {tenant_id}"
            )
        except Exception as exc:
            logger.error(
                f"Failed to seed default packages for tenant {tenant_id}: {exc}",
                exc_info=True
            )
        
        logger.info(f"Carwash vertical initialized for tenant {tenant_id}")
    
    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        """
        Add carwash-specific metadata to tenant response.
        
        Adds information about:
        - Available wash packages
        - Bay status (if enabled)
        - Queue length (if enabled)
        """
        if tenant.vertical_type != self.vertical_key:
            return
        
        # Add carwash-specific metadata
        meta["carwash"] = {
            "features_enabled": meta.get("features", {}),
            "loyalty_multiplier": 1.5,
            # Could add dynamic data like:
            # "active_bays": get_active_bay_count(tenant.id),
            # "queue_length": get_current_queue_length(tenant.id),
        }
    
    def get_admin_capabilities(self) -> List[str]:
        """Admin-level capabilities for carwash."""
        return [
            "carwash.manage_bays",
            "carwash.manage_packages",
            "carwash.view_queue",
            "carwash.manage_queue",
            "carwash.view_vehicles",
            "carwash.edit_vehicles",
        ]
    
    def get_staff_capabilities(self) -> List[str]:
        """Staff-level capabilities for carwash."""
        return [
            "carwash.view_queue",
            "carwash.process_orders",
            "carwash.checkin_customers",
            "carwash.view_vehicles",
        ]
    
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate carwash-specific configuration.
        
        Ensures:
        - Loyalty multiplier is reasonable (1.0 - 5.0)
        - Queue size is positive
        - Required features are enabled together
        """
        settings = config.get("settings", {})
        
        # Validate loyalty multiplier
        multiplier = settings.get("default_loyalty_multiplier", 1.5)
        if not (1.0 <= multiplier <= 5.0):
            raise ValueError("Loyalty multiplier must be between 1.0 and 5.0")
        
        # Validate queue settings
        if config.get("features", {}).get("queue_system"):
            max_queue = settings.get("max_queue_size", 50)
            if max_queue < 1:
                raise ValueError("Max queue size must be positive")
        
        return config

    def on_redemption_success(self, db: Session, redemption: Any) -> Optional[Dict[str, Any]]:
        """
        After redemption, show the PIN to the staff member so they can verify it 
        against the customer's app or POS.
        """
        return {
            "type": "CARWASH_SHOW_PIN",
            "payload": {
                "pin": redemption.pin,
                "reward_name": redemption.reward_name,
                "instructions": "Verify this PIN in the POS or write it on the job card."
            }
        }
