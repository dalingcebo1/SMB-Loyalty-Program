"""Root test configuration.

Ensures the repository root and Backend directory are importable so tests
under the top-level `tests/` folder can `import Backend` or `from Backend.main`.
Also adds a lightweight alias `app` pointing to Backend for legacy imports.
"""
from __future__ import annotations

import sys
from pathlib import Path

# CRITICAL: Set up sys.path BEFORE any other imports
# This must happen at module import time, before pytest even loads
repo_root = Path(__file__).resolve().parent
backend_dir = repo_root / "Backend"

# Add Backend FIRST so Backend/app takes precedence over repo-root/app
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Add repo root SECOND for config and other modules
if str(repo_root) not in sys.path:
    sys.path.insert(1, str(repo_root))

# Remove empty string from sys.path if it's at position 0 (represents current dir)
# This prevents the repo root from shadowing Backend/app
if sys.path and sys.path[0] == '':
    sys.path.pop(0)
    # Re-add Backend and repo root after removing empty string
    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))
    if str(repo_root) not in sys.path:
        sys.path.insert(1, str(repo_root))

try:
    import Backend as _backend  # type: ignore
    import types
    if 'app' not in sys.modules:
        alias = types.ModuleType('app')
        alias.main = _backend.main  # type: ignore[attr-defined]
        sys.modules['app'] = alias
except Exception:
    pass
