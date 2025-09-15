import json
from pathlib import Path
from fastapi.testclient import TestClient
import importlib

# Import the FastAPI app
app_module = importlib.import_module('main')
app = app_module.app
client = TestClient(app)

SNAPSHOT_PATH = Path(__file__).parent / 'openapi_snapshot.json'


def test_openapi_snapshot_structure():
    resp = client.get('/api/openapi.json')
    assert resp.status_code == 200
    current = resp.json()

    with SNAPSHOT_PATH.open() as f:
        snapshot = json.load(f)

    if snapshot.get('_requires_init'):
        raise AssertionError('OpenAPI snapshot not initialized. Generate it with dump_openapi.py before merging.')

    # Compare path keys
    cur_paths = set(current.get('paths', {}).keys())
    snap_paths = set(snapshot.get('paths', {}).keys())

    missing = snap_paths - cur_paths
    added = cur_paths - snap_paths

    assert not missing, f"Paths missing from current spec: {sorted(missing)}"
    if added:
        import os
        if os.getenv('ALLOW_NEW_ENDPOINTS') == '1':
            print(f"NOTICE: New endpoints allowed by ALLOW_NEW_ENDPOINTS=1: {sorted(added)}")
        else:
            raise AssertionError(
                "New endpoints detected ({}). Intentionally update snapshot via `make snapshot-openapi` and set ALLOW_NEW_ENDPOINTS=1 in CI for the approving PR if expected.".format(sorted(added))
            )
