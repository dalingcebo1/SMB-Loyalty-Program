"""Test import path helper.

Pytest sets the rootdir to the Backend folder (see output: rootdir: /.../Backend).
Because of that, Python does not automatically have the repository root on
sys.path, so "import Backend" inside a test fails (the interpreter is already
inside that directory and treats it as top-level, not a package unless the
parent is on the path).

By inserting the parent directory (the repo root) ahead of others we allow
`import Backend` as a proper package as well as any alternative absolute
imports used elsewhere (e.g. scripts executed from the repo root).

This file is automatically imported by the Python interpreter if present on
the import path (see sitecustomize mechanism). Keeping logic minimal avoids
side effects during production runtime (the file ships but only adjusts path).
"""

from __future__ import annotations

import os
import sys
from pathlib import Path


def _ensure_repo_root_on_path() -> None:
    try:
        backend_dir = Path(__file__).resolve().parent
        repo_root = backend_dir.parent
        if str(repo_root) not in sys.path:
            # Prepend so it has priority but keep relative ordering stable.
            sys.path.insert(0, str(repo_root))
    except Exception:
        # Fail silently; path issue will surface as ImportError which tests
        # will make obvious. We avoid introducing new hard failures here.
        pass


_ensure_repo_root_on_path()
