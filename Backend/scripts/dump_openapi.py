"""Utility script to dump the current OpenAPI schema to stdout.

Usage (from Backend directory):
  cd Backend && python scripts/dump_openapi.py > tests/openapi_snapshot.json
"""
from __future__ import annotations
import json
import sys
import os
from pathlib import Path

# Set environment variable to use test registry and avoid Prometheus conflicts
os.environ['PYTEST_CURRENT_TEST'] = 'dump_openapi_script'

# Add Backend directory to path so we can import main
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

import main
app = main.app

schema = app.openapi()
# Add minimal metadata so we can detect accidental manual edits
schema['_snapshot_meta'] = {
    'note': 'Do not hand-edit. Regenerate with dump_openapi.py',
}
print(json.dumps(schema, indent=2, sort_keys=True))
