"""
Dispensary Vertical Module

Provides cannabis dispensary specific features:
- Product catalog with strain types
- Age verification
- Compliance tracking
- Batch/lot tracking
- Lab test results
"""

from typing import Any, Dict, List
import logging

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.verticals.base import VerticalModule

logger = logging.getLogger(__name__)


class DispensaryVertical(VerticalModule):
    """Cannabis dispensary business vertical."""

    @property
    def vertical_key(self) -> str:
        return "dispensary"

    @property
    def display_name(self) -> str:
        return "Cannabis Dispensary"

    @property
    def description(self) -> str:
        return "Cannabis dispensary management with compliance tracking, age verification, and product catalog."

    @property
    def icon(self) -> str:
        return "cannabis"

    @property
    def requires_compliance(self) -> bool:
        return True

    def get_features(self) -> List[str]:
        return [
            "product_catalog",       # Cannabis products
            "age_verification",      # Mandatory age check
            "compliance_tracking",   # Regulatory compliance
            "batch_tracking",        # Lot/batch numbers
            "lab_results",          # COA (Certificate of Analysis)
            "strain_info",          # Indica/Sativa/Hybrid details
            "thc_cbd_tracking",     # Cannabinoid percentages
            "loyalty_rewards",      # Purchase-based rewards
        ]

    def get_routes(self) -> List[APIRouter]:
        from app.verticals.dispensary.routes import router
        return [router]

    def get_router_prefix(self) -> str:
        return ""  # prefix is in the router itself

    def get_router_tags(self) -> List[str]:
        return ["Dispensary"]

    def get_default_config(self) -> Dict[str, Any]:
        """Default configuration for new dispensary tenants."""
        return {
            "features": {
                "product_catalog": True,
                "age_verification": True,  # Mandatory
                "compliance_tracking": True,  # Mandatory
                "batch_tracking": True,
                "lab_results": True,
                "strain_info": True,
                "thc_cbd_tracking": True,
                "loyalty_rewards": True,
            },
            "settings": {
                "minimum_age": 21,  # or 18 depending on jurisdiction
                "require_id_upload": True,
                "require_manual_verification": True,
                "loyalty_points_per_rand": 1,
                "enable_medical_cards": False,
            },
            "compliance": {
                "license_required": True,
                "batch_tracking_required": True,
                "lab_testing_required": True,
            },
            "branding": {
                "service_icon": "🌿",
                "primary_call_to_action": "Shop Products",
            }
        }

    def on_tenant_created(self, tenant_id: str, db: Session) -> None:
        """Initialize dispensary tenant with compliance setup."""
        logger.info(f"Initializing dispensary vertical for tenant {tenant_id}")

        # TODO: Create compliance tracking records
        # TODO: Set up age verification workflow
        # TODO: Seed product categories (Flower, Edibles, Concentrates, etc.)

        logger.info(f"Dispensary vertical initialized for tenant {tenant_id}")

    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        """Add dispensary-specific metadata."""
        if tenant.vertical_type != self.vertical_key:
            return

        meta["dispensary"] = {
            "features_enabled": meta.get("features", {}),
            "compliance_status": "active",  # Would be dynamic
            "age_verification_required": True,
        }

    def get_admin_capabilities(self) -> List[str]:
        """Admin-level capabilities for dispensary."""
        return [
            "dispensary.manage_products",
            "dispensary.manage_compliance",
            "dispensary.view_lab_results",
            "dispensary.manage_age_verification",
            "dispensary.view_batch_tracking",
        ]

    def get_staff_capabilities(self) -> List[str]:
        """Staff-level capabilities for dispensary."""
        return [
            "dispensary.process_orders",
            "dispensary.verify_age",
            "dispensary.view_products",
            "dispensary.view_lab_results",
        ]

    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate dispensary configuration."""
        settings = config.get("settings", {})

        # Enforce mandatory features
        features = config.get("features", {})
        if not features.get("age_verification"):
            raise ValueError("Age verification must be enabled for dispensary")
        if not features.get("compliance_tracking"):
            raise ValueError("Compliance tracking must be enabled for dispensary")

        # Validate minimum age
        min_age = settings.get("minimum_age", 21)
        if min_age < 18:
            raise ValueError("Minimum age must be at least 18")

        return config
