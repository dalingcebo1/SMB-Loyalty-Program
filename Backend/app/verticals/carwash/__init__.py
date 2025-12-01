"""
Carwash Vertical Module Package

Exports the vertical module and routes.
"""

from app.verticals.carwash.module import CarwashVertical
from app.verticals.carwash.routes import router

__all__ = ["CarwashVertical", "router"]
