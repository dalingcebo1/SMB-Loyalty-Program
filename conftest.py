"""Root test configuration.

Ensures the repository root and Backend directory are importable so tests
under the top-level `tests/` folder can `import Backend` or `from Backend.main`.
Also adds a lightweight alias `app` pointing to Backend for legacy imports.
"""
from __future__ import annotations

import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent
backend_dir = repo_root / "Backend"
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    import Backend as _backend  # type: ignore
    import types
    if 'app' not in sys.modules:
        alias = types.ModuleType('app')
        alias.main = _backend.main  # type: ignore[attr-defined]
        sys.modules['app'] = alias
except Exception:
    pass
