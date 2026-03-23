"""Shared enumerations used across model modules."""
from enum import Enum


class VerticalType(str, Enum):
        """Business verticals supported by the unified multi-tenant platform.

        NOTE: When adding a new vertical update:
            - This enum
            - Any validation lists (e.g. in create/update tenant schemas)
            - Frontend vertical mapping (TenantConfigProvider)
        """
        retail = "retail"
        carwash = "carwash"
        dispensary = "dispensary"
        padel = "padel"
        flowershop = "flowershop"
        beauty = "beauty"
