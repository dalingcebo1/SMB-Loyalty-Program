"""Application package.

Contains core application subpackages (core, plugins, routes, services, etc.).

Legacy imports in some tests expect ``from app.main import app`` to work even
when only the ``Backend`` directory has been added to ``sys.path`` (so this
package is resolved instead of the top-level shim). We bridge that expectation
by aliasing ``app.main`` to ``Backend.main`` at import time here.

Additionally, we expose common subpackages (``app.core``, ``app.plugins``, …)
as aliases to their ``Backend.app`` counterparts to ensure a single canonical
module instance across different import paths. This avoids subtle duplication
of module state (e.g., in-memory job queues) when test harnesses manipulate
``sys.path`` differently.
"""
from importlib import import_module as _imp
import sys as _sys

try:  # best-effort; failures will surface naturally if Backend.main missing
	_backend_main = _imp('Backend.main')
	# Register alias only if not already provided (e.g. by top-level shim)
	_sys.modules.setdefault('app.main', _backend_main)
except Exception:  # pragma: no cover - defensive
	pass

# Bridge common subpackages so ``import app.core`` refers to the single
# Backend.app.core module even if the top-level shim was imported earlier.
try:  # pragma: no cover - defensive best-effort
	_this_pkg = _sys.modules[__name__]
	for _name in ("core", "plugins", "routes", "services", "utils", "models", "tests", "analytics"):
		try:
			_mod = _imp(f"Backend.app.{_name}")
			_sys.modules.setdefault(f"app.{_name}", _mod)
			setattr(_this_pkg, _name, _mod)
		except Exception:
			continue
except Exception:
	pass

# Bridge frequently used submodules to avoid duplicate module instances
try:  # pragma: no cover - defensive best-effort
	# Ensure app.core.jobs points to the canonical Backend.app.core.jobs
	_core_mod = _sys.modules.get("app.core") or _imp("Backend.app.core")
	_sys.modules.setdefault("app.core", _core_mod)
	_jobs_mod = _imp("Backend.app.core.jobs")
	_sys.modules.setdefault("app.core.jobs", _jobs_mod)
	try:
		# Attach as attribute on app.core for from app.core import jobs
		setattr(_core_mod, "jobs", _jobs_mod)
	except Exception:
		pass
except Exception:
	pass

# Normal package exports can follow (none required presently)
__all__: list[str] = []
