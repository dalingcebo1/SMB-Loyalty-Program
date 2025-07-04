import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_openapi_endpoint():
    response = client.get("/api/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "openapi" in data
    assert data["info"]["title"] == "SMB Loyalty Program"
    assert data["info"]["version"] == "0.1"
