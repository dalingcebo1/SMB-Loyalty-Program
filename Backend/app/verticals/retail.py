"""
Backward-compatibility shim — the full RetailVertical lives in the
``app.verticals.retail`` package (``retail/module.py``).
"""

from app.verticals.retail.module import RetailVertical  # noqa: F401
