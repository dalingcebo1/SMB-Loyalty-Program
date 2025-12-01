"""
Vertical Module Registry

Central registry for all vertical modules. Provides discovery, registration,
and retrieval of vertical plugins.
"""

from typing import Dict, List, Optional
import logging

from .base import VerticalModule

logger = logging.getLogger(__name__)


class VerticalRegistry:
    """
    Registry for vertical business modules.
    
    This singleton class manages all registered verticals and provides
    methods to register, retrieve, and list them.
    """
    
    def __init__(self):
        self._verticals: Dict[str, VerticalModule] = {}
        self._registered = False
    
    def register(self, vertical: VerticalModule) -> None:
        """
        Register a vertical module.
        
        Args:
            vertical: The vertical module instance to register
            
        Raises:
            ValueError: If a vertical with the same key is already registered
        """
        key = vertical.vertical_key
        
        if key in self._verticals:
            logger.warning(f"Vertical '{key}' is already registered. Overwriting.")
        
        self._verticals[key] = vertical
        logger.info(f"Registered vertical: {key} - {vertical.display_name}")
    
    def get(self, vertical_key: str) -> Optional[VerticalModule]:
        """
        Get a vertical module by its key.
        
        Args:
            vertical_key: The unique vertical identifier
            
        Returns:
            The vertical module or None if not found
        """
        return self._verticals.get(vertical_key)
    
    def list_all(self) -> List[VerticalModule]:
        """
        Get all registered vertical modules.
        
        Returns:
            List of all registered verticals
        """
        return list(self._verticals.values())
    
    def get_by_features(self, feature: str) -> List[VerticalModule]:
        """
        Find all verticals that provide a specific feature.
        
        Args:
            feature: The feature identifier to search for
            
        Returns:
            List of verticals that provide this feature
        """
        return [
            v for v in self._verticals.values()
            if feature in v.get_features()
        ]
    
    def is_registered(self, vertical_key: str) -> bool:
        """
        Check if a vertical is registered.
        
        Args:
            vertical_key: The unique vertical identifier
            
        Returns:
            True if the vertical is registered
        """
        return vertical_key in self._verticals
    
    def get_all_features(self) -> Dict[str, List[str]]:
        """
        Get a mapping of all verticals to their features.
        
        Returns:
            Dict mapping vertical_key -> list of features
        """
        return {
            v.vertical_key: v.get_features()
            for v in self._verticals.values()
        }
    
    def validate_vertical_key(self, vertical_key: str) -> bool:
        """
        Validate that a vertical key is registered.
        
        Args:
            vertical_key: The vertical key to validate
            
        Returns:
            True if valid and registered
        """
        return vertical_key in self._verticals
    
    def get_all_routes(self) -> list:
        """
        Get all routes from all registered verticals.
        
        Returns:
            List of FastAPI APIRouter instances from all verticals
        """
        routes = []
        for vertical in self._verticals.values():
            vertical_routes = vertical.get_routes()
            if vertical_routes:
                routes.extend(vertical_routes)
                logger.debug(f"Added {len(vertical_routes)} route(s) from {vertical.vertical_key}")
        return routes
    
    def auto_register_all(self) -> None:
        """
        Auto-discover and register all vertical modules.
        
        This method imports all vertical modules and registers them.
        Should be called once during application startup.
        """
        if self._registered:
            logger.debug("Verticals already registered, skipping auto-registration")
            return
        
        # Import and register all verticals
        try:
            from .carwash.module import CarwashVertical
            self.register(CarwashVertical())
        except ImportError as e:
            logger.warning(f"Could not register carwash vertical: {e}")
        
        try:
            from .dispensary import DispensaryVertical
            self.register(DispensaryVertical())
        except ImportError as e:
            logger.warning(f"Could not register dispensary vertical: {e}")
        
        try:
            from .padel import PadelVertical
            self.register(PadelVertical())
        except ImportError as e:
            logger.warning(f"Could not register padel vertical: {e}")
        
        try:
            from .flowershop import FlowershopVertical
            self.register(FlowershopVertical())
        except ImportError as e:
            logger.warning(f"Could not register flowershop vertical: {e}")
        
        try:
            from .beauty import BeautyVertical
            self.register(BeautyVertical())
        except ImportError as e:
            logger.warning(f"Could not register beauty vertical: {e}")
        
        self._registered = True
        logger.info(f"Auto-registration complete. {len(self._verticals)} verticals registered.")
    
    def __repr__(self) -> str:
        return f"<VerticalRegistry: {len(self._verticals)} verticals>"
