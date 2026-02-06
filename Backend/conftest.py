"""Global pytest configuration for Backend tests.

Ensures repository root and Backend/ are on sys.path early so that
`import app.models` and `import config` work correctly.

Also forces tests to use the fast in-memory SQLite database even when a
Postgres DATABASE_URL exists in the developer environment or `.env` file.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Add Backend directory FIRST (before pytest_plugins loads tests.conftest)
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

# Then add repo root so `import config` works
repo_root = backend_dir.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

# Force sqlite even if a Postgres DATABASE_URL was already present. This must
# run before config/app modules import settings to ensure the engine binds to
# SQLite for the entire session.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SQLALCHEMY_ECHO", "false")

# Re-use fixtures defined under Backend/tests across the entire test suite.
pytest_plugins = ("tests.conftest",)
