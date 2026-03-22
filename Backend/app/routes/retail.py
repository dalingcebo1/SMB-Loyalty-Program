"""
Retail Inventory API Routes — **DEPRECATED**

This module is a backward-compatibility shim.  All logic has been moved to
``app.verticals.retail`` (routes, schemas, services).  The ``router`` is
re-exported so that any remaining imports continue to work.
"""

# Re-export router for backward compatibility
from app.verticals.retail.routes import router  # noqa: F401
