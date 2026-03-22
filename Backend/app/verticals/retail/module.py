"""
Retail Vertical Module

Provides inventory management, product catalog, supplier tracking,
and stock level monitoring features.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.verticals.base import VerticalModule


class RetailVertical(VerticalModule):
    """Retail business vertical for inventory & product management."""

    @property
    def vertical_key(self) -> str:
        return "retail"

    @property
    def display_name(self) -> str:
        return "Retail"

    @property
    def description(self) -> str:
        return "Retail inventory and product management with stock tracking, supplier management, and low-stock alerts."

    @property
    def icon(self) -> str:
        return "shopping-cart"

    def get_features(self) -> List[str]:
        return [
            "point_of_sale",
            "inventory",
            "customer_loyalty",
            "products",
            "categories",
            "suppliers",
            "stock_management",
        ]

    def get_routes(self) -> List[APIRouter]:
        from app.verticals.retail.routes import router
        return [router]

    def get_router_prefix(self) -> str:
        return "/api/retail"

    def get_router_tags(self) -> List[str]:
        return ["Retail"]

    def get_required_capabilities(self) -> Dict[str, str]:
        return {
            "product.create": "retail.products.write",
            "product.update": "retail.products.write",
            "product.read": "retail.products.read",
            "stock.adjust": "retail.inventory.write",
            "stock.read": "retail.inventory.read",
            "supplier.create": "retail.suppliers.write",
            "supplier.read": "retail.suppliers.read",
            "category.create": "retail.categories.write",
            "category.read": "retail.categories.read",
        }

    def get_admin_capabilities(self) -> List[str]:
        return [
            "retail.products.write",
            "retail.products.read",
            "retail.inventory.write",
            "retail.inventory.read",
            "retail.suppliers.write",
            "retail.suppliers.read",
            "retail.categories.write",
            "retail.categories.read",
        ]

    def get_staff_capabilities(self) -> List[str]:
        return [
            "retail.products.read",
            "retail.inventory.read",
            "retail.suppliers.read",
            "retail.categories.read",
        ]

    def on_redemption_success(self, db: Session, redemption: Any) -> Optional[Dict[str, Any]]:
        return {
            "type": "RETAIL_POST_REDEMPTION",
            "payload": {
                "redemption_id": redemption.id,
                "reward_name": redemption.reward_name,
                "message": "Please verify inventory stock.",
            },
        }
