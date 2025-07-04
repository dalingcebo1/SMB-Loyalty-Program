import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Service, Extra


def test_list_services_and_extras(client: TestClient, db_session: Session):
    # Seed services and extras
    s1 = Service(category="wash", name="Basic Wash", base_price=100)
    s2 = Service(category="wash", name="Deluxe Wash", base_price=150)
    e1 = Extra(name="Wax", price_map={"standard": 50})
    db_session.add_all([s1, s2, e1])
    db_session.commit()

    # Test services listing
    resp = client.get("/api/catalog/services")
    assert resp.status_code == 200
    data = resp.json()
    assert "wash" in data
    names = [item["name"] for item in data["wash"]]
    assert "Basic Wash" in names and "Deluxe Wash" in names

    # Test extras listing
    resp = client.get("/api/catalog/extras")
    assert resp.status_code == 200
    extras = resp.json()
    assert any(e["name"] == "Wax" and e["price_map"] for e in extras)
