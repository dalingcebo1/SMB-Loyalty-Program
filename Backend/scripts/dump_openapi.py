"""Utility script to dump the current OpenAPI schema to stdout.

Usage (from repo root):
  python Backend/scripts/dump_openapi.py > Backend/tests/openapi_snapshot.json
"""
from __future__ import annotations
import json
import importlib

mod = importlib.import_module('main')
app = getattr(mod, 'app')

schema = app.openapi()
# Add minimal metadata so we can detect accidental manual edits
schema['_snapshot_meta'] = {
    'note': 'Do not hand-edit. Regenerate with dump_openapi.py',
}
print(json.dumps(schema, indent=2, sort_keys=True))
