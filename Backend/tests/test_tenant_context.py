from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal
from app.models import Tenant
from datetime import datetime

client = TestClient(app)

def setup_module(module):
    db = SessionLocal()
    # create sample tenants if not existing
    if not db.query(Tenant).filter_by(id="tcar").first():
        db.add(Tenant(id="tcar", name="Car Wash A", loyalty_type="standard", vertical_type="carwash", primary_domain="car.example.test", created_at=datetime.utcnow()))
    if not db.query(Tenant).filter_by(id="tflower").first():
        db.add(Tenant(id="tflower", name="Flower Shop A", loyalty_type="standard", vertical_type="flowershop", primary_domain="flowers.example.test", created_at=datetime.utcnow()))
    db.commit()
    db.close()


def test_tenant_meta_header():
    r = client.get("/api/public/tenant-meta", headers={"X-Tenant-ID": "tcar"})
    assert r.status_code == 200
    data = r.json()
    assert data["tenant_id"] == "tcar"
    assert data["vertical"] == "carwash"


def test_tenant_meta_domain_match():
    # Simulate host header request
    r = client.get("/api/public/tenant-meta", headers={"Host": "flowers.example.test"})
    assert r.status_code == 200
    data = r.json()
    assert data["tenant_id"] == "tflower"
    assert data["vertical"] == "flowershop"


def test_tenant_meta_not_found():
    r = client.get("/api/public/tenant-meta", headers={"Host": "unknown.example.test"})
    assert r.status_code in (400, 404)
