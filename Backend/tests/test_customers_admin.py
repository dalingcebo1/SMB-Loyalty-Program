import datetime

import pytest
from jose import jwt

from config import settings
from app.models import (Order, PointBalance, Redemption, Reward, Service,
                        User, Vehicle)


@pytest.fixture
def admin_user(db_session):
    existing = db_session.query(User).filter_by(email="admin@example.com").first()
    if existing:
        return existing

    admin = User(
        email="admin@example.com",
        first_name="Ada",
        last_name="Admin",
        phone="0123456789",
        tenant_id=settings.default_tenant,
        role="admin",
        onboarded=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


def _auth_headers(user: User) -> dict:
    token = jwt.encode(
        {
            "sub": user.email,
            "exp": datetime.datetime.utcnow() + datetime.timedelta(hours=1),
        },
        settings.jwt_secret,
        algorithm=settings.algorithm,
    )
    return {"Authorization": f"Bearer {token}"}


def _seed_customer_with_activity(db_session, suffix: str = "1") -> User:
    service = Service(category="wash", name="Premium Wash", base_price=4500)
    db_session.add(service)
    db_session.flush()

    customer = User(
        email=f"customer{suffix}@example.com",
        first_name="Casey",
        last_name="Customer",
        phone="0987654321",
        tenant_id=settings.default_tenant,
        role="user",
        onboarded=True,
    )
    db_session.add(customer)
    db_session.flush()

    order = Order(
        user_id=customer.id,
        tenant_id=settings.default_tenant,
        service_id=service.id,
        amount=9900,
        status="completed",
    )
    db_session.add(order)

    vehicle = Vehicle(
        user_id=customer.id,
        plate="CA12345",
        make="Toyota",
        model="Corolla",
    )
    db_session.add(vehicle)

    db_session.add(
        PointBalance(
            user_id=customer.id,
            tenant_id=settings.default_tenant,
            points=240,
            updated_at=datetime.datetime.utcnow(),
        )
    )

    reward = Reward(
        tenant_id=settings.default_tenant,
        title="Free Wash",
        description="Complimentary wash",
        type="loyalty",
        milestone=100,
        cost=0,
        created_at=datetime.datetime.utcnow(),
    )
    db_session.add(reward)
    db_session.flush()

    redemption = Redemption(
        tenant_id=settings.default_tenant,
        user_id=customer.id,
        reward_id=reward.id,
        status="redeemed",
        milestone=40,
        redeemed_at=datetime.datetime.utcnow(),
    )
    db_session.add(redemption)

    db_session.commit()
    db_session.refresh(customer)
    return customer


def test_admin_can_list_customers(client, db_session, admin_user):
    customer = _seed_customer_with_activity(db_session, suffix="list")

    response = client.get(
        "/api/customers?page=1&limit=20",
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] >= 2

    entry = next(
        item for item in payload["customers"] if item["email"] == customer.email
    )
    assert entry["first_name"] == "Casey"
    assert entry["order_count"] == 1
    assert entry["total_spent"] == pytest.approx(99.0)
    assert entry["loyalty_points"] == 240
    assert entry["last_order_date"] is not None


def test_admin_gets_customer_detail_with_loyalty(client, db_session, admin_user):
    customer = _seed_customer_with_activity(db_session, suffix="detail")

    response = client.get(
        f"/api/customers/{customer.id}",
        headers=_auth_headers(admin_user),
    )
    assert response.status_code == 200
    detail = response.json()

    assert detail["email"] == customer.email
    assert detail["order_count"] == 1
    assert detail["loyalty_points"] == 240
    assert detail["loyalty_summary"]["current_points"] == 240
    assert detail["loyalty_summary"]["total_redeemed"] == 40
    assert detail["loyalty_summary"]["total_earned"] == 280
    assert detail["recent_orders"]


def test_admin_can_update_customer_profile(client, db_session, admin_user):
    customer = _seed_customer_with_activity(db_session, suffix="update")

    response = client.patch(
        f"/api/customers/{customer.id}",
        json={"first_name": "Updated", "phone": "0111111111"},
        headers=_auth_headers(admin_user),
    )
    assert response.status_code == 200
    updated = response.json()

    assert updated["first_name"] == "Updated"
    assert updated["phone"] == "0111111111"