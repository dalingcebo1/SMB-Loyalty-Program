from fastapi.testclient import TestClient
from app.models import Tenant
from app.core.database import get_db
from main import app
import pytest

client = TestClient(app)

def test_tenant_meta_includes_loyalty_config(db_session):
    # Create a tenant with loyalty config
    tenant = Tenant(
        id="loyalty-test-tenant",
        name="Loyalty Test",
        loyalty_type="points",
        config={
            "loyalty": {
                "points": {
                    "earningRate": 20,
                    "redemptionValue": 5
                }
            }
        }
    )
    db_session.add(tenant)
    db_session.commit()

    # Fetch tenant meta
    response = client.get("/api/public/tenant-meta", headers={"X-Tenant-ID": "loyalty-test-tenant"})
    assert response.status_code == 200
    data = response.json()
    
    assert "loyalty" in data
    assert data["loyalty"]["points"]["earningRate"] == 20
    assert data["loyalty"]["points"]["redemptionValue"] == 5

def test_tenant_meta_empty_loyalty_config(db_session):
    # Create a tenant without loyalty config
    tenant = Tenant(
        id="no-loyalty-test-tenant",
        name="No Loyalty Test",
        loyalty_type="stamps",
        config={}
    )
    db_session.add(tenant)
    db_session.commit()

    # Fetch tenant meta
    response = client.get("/api/public/tenant-meta", headers={"X-Tenant-ID": "no-loyalty-test-tenant"})
    assert response.status_code == 200
    data = response.json()
    
    assert "loyalty" in data
    assert data["loyalty"] == {}
