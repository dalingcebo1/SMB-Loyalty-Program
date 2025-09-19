"""Top-level application shim.

Bridges imports to the real application package under ``Backend/app``.

Goals:
- Support legacy imports like ``from app.main import app`` by aliasing to
  ``Backend.main``.
- Allow subpackage imports like ``app.plugins``, ``app.core`` to resolve to
  ``Backend.app.plugins`` and so on during tests and local tooling.

This keeps import paths stable across environments (repo root vs Backend/ cwd).
"""
from importlib import import_module as _imp
import sys as _sys

# Bridge common subpackages FIRST: app.<name> -> Backend.app.<name>
try:  # pragma: no cover - defensive best-effort
    _backend_app_pkg = _imp("Backend.app")
    _this_pkg = _sys.modules[__name__]
    for _name in ("core", "plugins", "routes", "services", "utils", "models", "tests", "analytics"):
        try:
            _mod = _imp(f"Backend.app.{_name}")
            # Register in sys.modules under aliased path
            _sys.modules.setdefault(f"app.{_name}", _mod)
            # Expose as attribute for attribute-style access (app.plugins, ...)
            setattr(_this_pkg, _name, _mod)
        except Exception:
            # Skip missing optional subpackages to avoid import-time failures
            continue
except Exception:
    pass

# Now alias app.main -> Backend.main (after bridges so its imports succeed)
try:  # best-effort; failures will surface naturally if Backend.main missing
    _backend_main = _imp("Backend.main")
    _sys.modules.setdefault("app.main", _backend_main)
except Exception:  # pragma: no cover - defensive
    pass

__all__: list[str] = []
