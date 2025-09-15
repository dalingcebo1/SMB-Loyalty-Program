from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

CRITICAL_ENDPOINTS = [
    "/api/public/tenant-meta",
    "/api/auth/login",
    "/api/secure/ping",
    "/api/ops/status",
]

def test_openapi_contains_critical_endpoints():
    resp = client.get("/api/openapi.json")
    assert resp.status_code == 200
    data = resp.json()
    paths = data.get("paths", {})
    missing = [p for p in CRITICAL_ENDPOINTS if p not in paths]
    assert not missing, f"Missing expected API paths in OpenAPI: {missing}"