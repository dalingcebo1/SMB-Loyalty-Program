"""
POS (Point of Sale) API Routes — **DEPRECATED**

This module is a backward-compatibility shim.  All logic has been moved to
``app.verticals.pos`` (routes, schemas, services).  The ``router`` is
re-exported so that any remaining imports continue to work.
"""

# Re-export router for backward compatibility
from app.verticals.pos.routes import router  # noqa: F401
