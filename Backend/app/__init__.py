"""Application package.

Contains core application subpackages (core, plugins, routes, services, etc.).

Legacy imports in some tests expect ``from app.main import app`` to work even
when only the ``Backend`` directory has been added to ``sys.path`` (so this
package is resolved instead of the top-level shim). We bridge that expectation
by aliasing ``app.main`` to ``Backend.main`` at import time here.
"""
from importlib import import_module as _imp
import sys as _sys

try:  # best-effort; failures will surface naturally if Backend.main missing
	_backend_main = _imp('Backend.main')
	# Register alias only if not already provided (e.g. by top-level shim)
	_sys.modules.setdefault('app.main', _backend_main)
except Exception:  # pragma: no cover - defensive
	pass

# Normal package exports can follow (none required presently)
__all__: list[str] = []
