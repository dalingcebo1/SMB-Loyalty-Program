import datetime

import pytest
from jose import jwt

from config import settings
from app.models import (
    Order,
    Redemption,
    Reward,
    Service,
    Tenant,
    User,
)


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


@pytest.fixture
def admin_user(db_session):
    admin = db_session.query(User).filter_by(email="reports-admin@example.com").first()
    if admin:
        return admin

    admin = User(
        email="reports-admin@example.com",
        first_name="Adele",
        last_name="Admin",
        tenant_id=settings.default_tenant,
        role="admin",
        onboarded=True,
    )
    db_session.add(admin)
    db_session.commit()
    db_session.refresh(admin)
    return admin


@pytest.fixture
def reporting_data(db_session):
    # Ensure a clean slate for deterministic assertions
    db_session.query(Redemption).delete(synchronize_session=False)
    db_session.query(Order).delete(synchronize_session=False)
    db_session.query(Reward).delete(synchronize_session=False)
    db_session.query(Service).delete(synchronize_session=False)
    db_session.query(User).filter(User.role == "user").delete(synchronize_session=False)
    db_session.commit()

    service = Service(category="wash", name="Deluxe Wash", base_price=5500)
    db_session.add(service)
    db_session.flush()

    customer = User(
        email="reports-customer@example.com",
        first_name="Riley",
        last_name="Customer",
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
        amount=12500,
        status="completed",
        created_at=datetime.datetime.utcnow(),
    )
    db_session.add(order)

    reward = Reward(
        tenant_id=settings.default_tenant,
        title="Free Wax",
        description="Complimentary wax",
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
        milestone=30,
        redeemed_at=datetime.datetime.utcnow(),
    )
    db_session.add(redemption)
    db_session.commit()
    return {
        "service": service,
        "customer": customer,
        "order": order,
        "reward": reward,
        "redemption": redemption,
    }


def test_reports_summary_for_admin(client, admin_user, reporting_data):
    response = client.get(
        "/api/reports/summary?days=30",
        headers=_auth_headers(admin_user),
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["total_orders"] >= 1
    assert payload["total_revenue"] >= 0
    assert payload["top_service"] is None or "name" in payload["top_service"]


def test_reports_summary_superadmin_allowed(client, db_session, reporting_data):
    superadmin = db_session.query(User).filter_by(email="reports-superadmin@example.com").first()
    if not superadmin:
        superadmin = User(
            email="reports-superadmin@example.com",
            first_name="Sam",
            last_name="Super",
            tenant_id=settings.default_tenant,
            role="superadmin",
            onboarded=True,
        )
        db_session.add(superadmin)
        db_session.commit()
        db_session.refresh(superadmin)

    response = client.get(
        "/api/reports/summary?days=30",
        headers=_auth_headers(superadmin),
    )

    assert response.status_code == 200
    data = response.json()
    assert data["total_orders"] >= 1
    assert data["loyalty_points_redeemed"] >= 0


def test_customer_segments_tenant_override_for_superadmin(client, db_session):
    # Create a second tenant with activity
    tenant_id = "tenant-b"
    tenant = db_session.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        tenant = Tenant(
            id=tenant_id,
            name="Tenant B",
            loyalty_type="points",
            created_at=datetime.datetime.utcnow(),
        )
        db_session.add(tenant)
        db_session.commit()
        db_session.refresh(tenant)

    service = Service(category="wash", name="Express Wash", base_price=3500)
    db_session.add(service)
    db_session.flush()

    customer = User(
        email="override-customer@example.com",
        first_name="Olive",
        last_name="Override",
        tenant_id=tenant.id,
        role="user",
        onboarded=True,
    )
    db_session.add(customer)
    db_session.flush()

    db_session.add(
        Order(
            user_id=customer.id,
            tenant_id=tenant.id,
            service_id=service.id,
            amount=8900,
            status="completed",
            created_at=datetime.datetime.utcnow(),
        )
    )
    db_session.commit()

    superadmin = db_session.query(User).filter_by(email="override-superadmin@example.com").first()
    if not superadmin:
        superadmin = User(
            email="override-superadmin@example.com",
            first_name="Over",
            last_name="Ride",
            tenant_id=settings.default_tenant,
            role="superadmin",
            onboarded=True,
        )
        db_session.add(superadmin)
        db_session.commit()
        db_session.refresh(superadmin)

    response = client.get(
        f"/api/reports/customer-segmentation?days=60&tenant_id={tenant.id}",
        headers=_auth_headers(superadmin),
    )

    assert response.status_code == 200
    segments = response.json()
    assert isinstance(segments, list)
    assert any(segment["count"] >= 1 for segment in segments)
