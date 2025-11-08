import pytest
from fastapi.testclient import TestClient
from config import settings

ENDPOINT_BASE = f"/api/tenants/{settings.default_tenant}/branding"

@pytest.mark.parametrize("initial_put", [
	{"public_name": "Acme Wash", "primary_color": "#3366FF", "accent_color": "#FF9900"},
	None,
])
def test_patch_partial_update_non_destructive(client: TestClient, initial_put):
	if initial_put is not None:
		r = client.put(ENDPOINT_BASE, json=initial_put)
		assert r.status_code == 200
		data = r.json()
		assert data["primary_color"] == initial_put["primary_color"]
		assert data["accent_color"] == initial_put["accent_color"]
	patch_payload = {"accent_color": "#123456"}
	r2 = client.patch(ENDPOINT_BASE, json=patch_payload)
	assert r2.status_code == 200
	patched = r2.json()
	assert patched["accent_color"] == patch_payload["accent_color"]
	# Primary either preserved (if previously set) or remains None/unchanged
	if initial_put is not None:
		assert patched["primary_color"] == initial_put["primary_color"]

def test_patch_multiple_fields(client: TestClient):
	base = {"public_name": "BrandCo", "primary_color": "#224466"}
	r = client.put(ENDPOINT_BASE, json=base)
	assert r.status_code == 200
	patch_payload = {"primary_color": "#111111", "secondary_color": "#eeeeee"}
	r2 = client.patch(ENDPOINT_BASE, json=patch_payload)
	assert r2.status_code == 200
	data2 = r2.json()
	assert data2["primary_color"] == "#111111"
	assert data2["secondary_color"] == "#eeeeee"
	assert data2["public_name"] == base["public_name"]

def test_patch_unknown_tenant_404(client: TestClient):
	r = client.patch("/api/tenants/__nope__/branding", json={"primary_color": "#abcdef"})
	assert r.status_code == 404
