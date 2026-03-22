"""
POS (Point of Sale) Vertical Module

Provides sales transaction processing, payment handling, inventory decrements,
and loyalty point awards for retail transactions.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter
from sqlalchemy.orm import Session

from app.verticals.base import VerticalModule


class POSVertical(VerticalModule):
    """Point of Sale transaction processing vertical."""

    @property
    def vertical_key(self) -> str:
        return "pos"

    @property
    def display_name(self) -> str:
        return "Point of Sale"

    @property
    def description(self) -> str:
        return "POS transaction processing with sales, payments, inventory management, and loyalty integration."

    @property
    def icon(self) -> str:
        return "cash-register"

    def get_features(self) -> List[str]:
        return [
            "sales",
            "payments",
            "receipts",
            "inventory_decrement",
            "loyalty_integration",
        ]

    def get_routes(self) -> List[APIRouter]:
        from app.verticals.pos.routes import router
        return [router]

    def get_router_prefix(self) -> str:
        return "/api/retail/pos"

    def get_router_tags(self) -> List[str]:
        return ["POS"]

    def get_required_capabilities(self) -> Dict[str, str]:
        return {
            "sale.create": "pos.sales.write",
            "sale.read": "pos.sales.read",
            "sale.complete": "pos.sales.write",
            "sale.void": "pos.sales.write",
            "payment.create": "pos.sales.write",
        }

    def get_admin_capabilities(self) -> List[str]:
        return [
            "pos.sales.write",
            "pos.sales.read",
        ]

    def get_staff_capabilities(self) -> List[str]:
        return [
            "pos.sales.write",
            "pos.sales.read",
        ]
