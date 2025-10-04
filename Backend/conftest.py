"""Global pytest configuration for Backend tests.

Ensures repository root (parent of Backend) is on sys.path early so that
`import Backend` works even when pytest selected Backend/ as rootdir.

Also forces tests to use the fast in-memory SQLite database even when a
Postgres DATABASE_URL exists in the developer environment or `.env` file.
This guarantees consistency for pytest modules that live outside
``Backend/tests`` and therefore don't pick up that package's own
``conftest`` fixtures.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path

# Force sqlite even if a Postgres DATABASE_URL was already present. This must
# run before config/app modules import settings to ensure the engine binds to
# SQLite for the entire session.
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ.setdefault("SQLALCHEMY_ECHO", "false")

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))

# Re-use fixtures defined under Backend/tests across the entire test suite.
pytest_plugins = ("tests.conftest",)
