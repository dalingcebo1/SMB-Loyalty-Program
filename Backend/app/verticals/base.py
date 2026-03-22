"""
Base interface for vertical modules.

Each vertical (carwash, dispensary, padel, etc.) should implement this interface
to provide a consistent plugin architecture with:
- Feature registration
- Route registration
- Model registration
- Lifecycle hooks
- Tenant metadata decoration
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from fastapi import APIRouter
from sqlalchemy.orm import Session


class VerticalModule(ABC):
    """
    Base class for all vertical business modules.
    
    Each vertical should inherit from this class and implement all abstract methods.
    This allows the platform to dynamically load, configure, and manage verticals.
    """
    
    @property
    @abstractmethod
    def vertical_key(self) -> str:
        """
        Unique identifier for this vertical (e.g., 'carwash', 'dispensary').
        Must match the VerticalType enum value.
        
        Returns:
            str: The unique vertical identifier
        """
        pass
    
    @property
    @abstractmethod
    def display_name(self) -> str:
        """
        Human-readable name for this vertical.
        
        Returns:
            str: Display name (e.g., 'Car Wash & Detailing')
        """
        pass
    
    @property
    def description(self) -> str:
        """
        Optional description of this vertical's purpose and features.
        
        Returns:
            str: Description text
        """
        return ""
    
    @property
    def icon(self) -> Optional[str]:
        """
        Optional icon identifier or URL for this vertical.
        
        Returns:
            Optional[str]: Icon identifier (e.g., 'car', 'cannabis-leaf')
        """
        return None
    
    @property
    def requires_compliance(self) -> bool:
        """
        Whether this vertical requires compliance/regulatory features.
        
        Returns:
            bool: True if compliance tracking is needed (e.g., dispensary)
        """
        return False
    
    @abstractmethod
    def get_features(self) -> List[str]:
        """
        List of feature identifiers this vertical provides.
        
        Features can be used for:
        - UI rendering (show/hide features)
        - Capability checks
        - Analytics tracking
        
        Returns:
            List[str]: Feature keys (e.g., ['vehicle_tracking', 'qr_checkin'])
        """
        pass
    
    def get_routes(self) -> List[APIRouter]:
        """
        API routes specific to this vertical.
        
        Returns:
            List[APIRouter]: FastAPI routers to mount
        """
        return []
    
    def get_models(self) -> List[type]:
        """
        SQLAlchemy models specific to this vertical.
        
        These models will be included in migrations and database schema.
        
        Returns:
            List[type]: SQLAlchemy model classes
        """
        return []
    
    def get_default_config(self) -> Dict[str, Any]:
        """
        Default configuration for this vertical when enabled for a tenant.
        
        Returns:
            Dict[str, Any]: Default config dictionary
        """
        return {}
    
    # Lifecycle Hooks
    
    def on_tenant_created(self, tenant_id: str, db: Session) -> None:
        """
        Hook called when a new tenant enables this vertical.
        
        Use this to:
        - Seed default data (products, categories, etc.)
        - Create initial configuration
        - Set up integrations
        
        Args:
            tenant_id: The tenant identifier
            db: Database session
        """
        pass
    
    def on_tenant_activated(self, tenant_id: str, db: Session) -> None:
        """
        Hook called when this vertical is activated for an existing tenant.
        
        Args:
            tenant_id: The tenant identifier
            db: Database session
        """
        pass
    
    def on_tenant_deactivated(self, tenant_id: str, db: Session) -> None:
        """
        Hook called when this vertical is deactivated for a tenant.
        
        Args:
            tenant_id: The tenant identifier
            db: Database session
        """
        pass
    
    def decorate_tenant_meta(self, meta: Dict[str, Any], tenant: Any) -> None:
        """
        Hook to add vertical-specific metadata to tenant response.
        
        This is called when the /api/tenant-meta endpoint is hit.
        Modify the meta dict in-place to add vertical-specific data.
        
        Args:
            meta: Metadata dictionary to modify in-place
            tenant: Tenant model instance
        """
        pass
    
    def validate_config(self, config: Dict[str, Any]) -> Dict[str, Any]:
        """
        Validate and normalize vertical-specific configuration.
        
        Args:
            config: Raw configuration dictionary
            
        Returns:
            Dict[str, Any]: Validated/normalized config
            
        Raises:
            ValueError: If configuration is invalid
        """
        return config
    
    def get_admin_capabilities(self) -> List[str]:
        """
        List of admin capabilities specific to this vertical.
        
        Returns:
            List[str]: Capability keys (e.g., ['carwash.manage_bays'])
        """
        return []
    
    def get_staff_capabilities(self) -> List[str]:
        """
        List of staff capabilities specific to this vertical.
        
        Returns:
            List[str]: Capability keys (e.g., ['carwash.process_orders'])
        """
        return []

    def on_redemption_success(self, db: Session, redemption: Any) -> Optional[Dict[str, Any]]:
        """
        Hook called after a successful point redemption.
        
        Args:
            db: Database session
            redemption: The redemption model instance
            
        Returns:
            Optional[Dict[str, Any]]: Client action to perform (e.g. {type: 'SHOW_PIN', payload: {...}})
        """
        return None

    def get_custom_customer_fields(self) -> List[str]:
        """
        Returns list of extra fields required for this vertical's customers.
        
        Returns:
            List[str]: Field names
        """
        return []

    # ------------------------------------------------------------------
    # Vertical standardization helpers (Issue #4 — Foundation)
    # ------------------------------------------------------------------

    def get_router_prefix(self) -> str:
        """
        URL prefix used when auto-mounting this vertical's routes.

        Override to customise; defaults to ``/api/{vertical_key}``.

        Returns:
            str: Router prefix, e.g. ``"/api/retail"``.
        """
        return f"/api/{self.vertical_key}"

    def get_router_tags(self) -> List[str]:
        """
        OpenAPI tags applied to all routes from this vertical.

        Defaults to ``[display_name]``.

        Returns:
            List[str]: Tag strings for OpenAPI documentation.
        """
        return [self.display_name]

    def get_schemas(self) -> Dict[str, Any]:
        """
        Expose create / update / response Pydantic models for documentation.

        Returns a mapping of logical names to schema classes, e.g.::

            {"ProductCreate": ProductCreate, "ProductUpdate": ProductUpdate}

        Returns:
            Dict[str, Any]: Schema name → Pydantic model class.
        """
        return {}

    def get_required_capabilities(self) -> Dict[str, str]:
        """
        Map operations to capability strings for authorisation.

        Example::

            {"product.create": "retail.products.write",
             "product.delete": "retail.products.delete"}

        Returns:
            Dict[str, str]: operation → capability string.
        """
        return {}

    def __repr__(self) -> str:
        return f"<VerticalModule: {self.vertical_key} - {self.display_name}>"
