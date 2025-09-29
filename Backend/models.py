# Backend/models.py compatibility shim
"""Re-export canonical models to avoid duplicate metadata declarations.

Historically, this module defined SQLAlchemy models directly. The canonical
definitions now live in ``app.models``. Importing both modules simultaneously
was causing duplicate ``Table`` registrations (e.g. ``tenant_admins``), which
prevented the application from starting in production.

To maintain backwards compatibility (imports like ``from models import Tenant``)
while ensuring a single metadata source of truth, this module simply re-exports
the symbols from ``app.models``.
"""

from app.core.database import Base  # noqa: F401  (public API expectation)
from app.models import *  # noqa: F401,F403

# Provide a minimal ``__all__`` so introspection remains predictable and avoids
# exposing star-import helpers.
__all__ = [name for name in globals() if not name.startswith("_")]
