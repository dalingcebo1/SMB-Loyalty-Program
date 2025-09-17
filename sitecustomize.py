"""Test harness path adjustments.

Ensures the repository's Backend directory is importable as both a top-level
package path (for imports like `from Backend.main import app`) and that the
`Backend` directory itself is on sys.path so its internal `app` package can be
imported as `app.*` when tests do `from app.main import app` (if that occurs).

Python automatically imports sitecustomize if present on sys.path early.
"""
import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent
backend_dir = repo_root / "Backend"
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Provide a lightweight alias module name 'app' pointing to Backend to satisfy
# older tests importing app.main
try:
    import Backend as _backend  # type: ignore
    import types

    if 'app' not in sys.modules:
        alias = types.ModuleType('app')
        # Mirror selected attributes if needed
        alias.main = _backend.main  # type: ignore[attr-defined]
        sys.modules['app'] = alias
except Exception:
    # Best effort only; tests will fail clearly if alias not available
    pass
