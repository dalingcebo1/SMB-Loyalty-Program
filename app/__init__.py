"""Compatibility shim package.

This package exists to preserve older import paths used across tests or
external scripts, e.g.::

	from app.main import app
	from app.core.database import SessionLocal

Internally the codebase was reorganized under the :mod:`Backend` namespace. To
avoid touching many legacy imports we *alias* the old module names to the new
ones at import time. We purposefully register the aliased modules inside
``sys.modules`` so normal submodule imports (``app.core.database``) continue to
work with the standard import machinery.

NOTE: Keep this file lean; it should be safe to import very early (before
logging configuration, DB connections, etc.). If the internal layout changes,
update the mapping below accordingly.
"""
from importlib import import_module as _imp
import sys as _sys

# Import target modules/packages
_backend_main = _imp('Backend.main')
_backend_core = _imp('Backend.app.core')
_backend_models = _imp('Backend.app.models')

# Register aliased module names for submodule resolution
_sys.modules.setdefault('app.main', _backend_main)
_sys.modules.setdefault('app.core', _backend_core)
_sys.modules.setdefault('app.models', _backend_models)

# Re-export selected public symbols for convenience
app = getattr(_backend_main, 'app', None)
AccessLogMiddleware = getattr(_backend_main, 'AccessLogMiddleware', None)

core = _backend_core  # exposed for star imports / direct attribute access
models = _backend_models

__all__ = ['app', 'AccessLogMiddleware', 'core', 'models']
