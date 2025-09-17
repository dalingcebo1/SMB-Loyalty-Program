"""Global pytest configuration for Backend tests.

Ensures repository root (parent of Backend) is on sys.path early so that
`import Backend` works even when pytest selected Backend/ as rootdir.
"""
from __future__ import annotations

import sys
from pathlib import Path

repo_root = Path(__file__).resolve().parent.parent
if str(repo_root) not in sys.path:
    sys.path.insert(0, str(repo_root))
