"""Backend package marker.

This file makes the Backend directory a proper Python package so tests and
application code can reliably use absolute imports like `import Backend` or
`from Backend import main` regardless of pytest's chosen rootdir.

Also ensures that imports within Backend (like `from app.models`) work correctly
by adding the Backend directory to sys.path (BEFORE any other app package).
"""

import sys
from pathlib import Path

# When Backend is imported as a package, ensure that modules within it can find
# their dependencies. Add Backend to sys.path so `from app.models` works.
_backend_dir = Path(__file__).resolve().parent
_backend_str = str(_backend_dir)

# CRITICAL: Ensure Backend is at position 0 so Backend/app shadows any other app package
# Remove empty string first (it represents current directory and shadows everything)
if '' in sys.path:
    sys.path.remove('')

# Ensure Backend is at the very front
if _backend_str in sys.path:
    sys.path.remove(_backend_str)
sys.path.insert(0, _backend_str)

# Also ensure repo root is in path for config and other top-level modules
# Add it AFTER Backend so that Backend/app takes precedence
_repo_root = _backend_dir.parent
_repo_root_str = str(_repo_root)
if _repo_root_str in sys.path:
    sys.path.remove(_repo_root_str)
if _repo_root_str not in sys.path:
    sys.path.insert(1, _repo_root_str)

from typing import List

__all__: List[str] = []
