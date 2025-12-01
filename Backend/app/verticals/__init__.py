"""
Vertical Module System

This package provides a plugin-based architecture for business verticals.
Each vertical (carwash, dispensary, padel, etc.) can register itself with
custom models, routes, services, and lifecycle hooks.

Example usage:
    from app.verticals import registry
    
    # Get all registered verticals
    all_verticals = registry.list_all()
    
    # Get specific vertical
    carwash = registry.get('carwash')
    if carwash:
        routes = carwash.get_routes()
"""

from .base import VerticalModule
from .registry import VerticalRegistry

# Singleton registry instance
registry = VerticalRegistry()

__all__ = ['VerticalModule', 'registry', 'VerticalRegistry']
