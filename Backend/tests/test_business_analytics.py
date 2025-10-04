# Basic tests for /api/payments/business-analytics endpoint
import pytest
from fastapi.testclient import TestClient
from app.models import Service, User, Order, Payment
from datetime import datetime, timedelta
from sqlalchemy.orm import Session

@pytest.fixture(autouse=True)
def seed_minimal(db_session: Session):
    # Ensure a service & user for analytics
    svc = Service(category="wash", name="Test Wash", base_price=1000)
    user = User(email="ba@test.com", phone="0890000000", first_name="BA", last_name="Test", tenant_id="default", role="user", onboarded=True)
    db_session.add_all([svc, user])
    db_session.commit()
    # Create a few orders with payments across days
    now = datetime.utcnow()
    for i in range(3):
        o = Order(service_id=svc.id, user_id=user.id, quantity=1, extras=[], amount=1000, status="completed",
                  created_at=now - timedelta(days=i), started_at=now - timedelta(days=i, minutes=30), ended_at=now - timedelta(days=i, minutes=5))
        db_session.add(o)
        db_session.flush()
        p = Payment(order_id=o.id, amount=1000, method="yoco", status="success", reference=f"ref{i}", created_at=o.created_at)
        db_session.add(p)
    db_session.commit()
    yield
    db_session.query(Payment).delete()
    db_session.query(Order).delete()
    db_session.query(User).delete()
    db_session.query(Service).delete()
    db_session.commit()

def test_business_analytics_basic(client: TestClient, db_session: Session):
    r = client.get('/api/payments/business-analytics')
    assert r.status_code == 200, r.text
    data = r.json()
    # Required top-level keys
    for key in [
        'wash_volume_trend','revenue_trend','avg_ticket','duration_stats','first_vs_returning','loyalty_share',
        'active_customers','top_services','payment_mix','pending_orders_over_10m','churn_risk_count','upsell_rate'
    ]:
        assert key in data
    # Phase 4: ensure deltas block present
    assert 'deltas' in data and isinstance(data['deltas'], dict)
    assert isinstance(data['wash_volume_trend'], list)
    assert data['avg_ticket'] >= 0
    assert 'average_s' in data['duration_stats']
