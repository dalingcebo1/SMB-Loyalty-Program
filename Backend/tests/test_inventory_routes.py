import pytest

from app.models import Service, Extra, User


@pytest.fixture
def admin_user(db_session):
    user = db_session.query(User).first()
    user.role = "admin"
    db_session.commit()
    return user


def test_list_inventory_services_and_extras(client, db_session, admin_user):
    service = Service(category="wash", name="Deluxe Wash", base_price=1500, loyalty_eligible=True)
    extra = Extra(name="Wax", price_map={"default": 500})

    db_session.add(service)
    db_session.add(extra)
    db_session.commit()

    resp_services = client.get("/api/inventory/services")
    assert resp_services.status_code == 200
    payload_services = resp_services.json()
    assert payload_services["services"]
    assert payload_services["services"][0]["name"] == "Deluxe Wash"

    resp_extras = client.get("/api/inventory/extras")
    assert resp_extras.status_code == 200
    payload_extras = resp_extras.json()
    assert payload_extras["extras"]
    assert payload_extras["extras"][0]["name"] == "Wax"
