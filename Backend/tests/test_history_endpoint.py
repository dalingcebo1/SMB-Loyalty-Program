from datetime import datetime, timedelta
from app.models import Order, User, Payment
from config import settings

def test_history_endpoint_basic(client, db_session):
    # Seed two orders today with different payment types
    user = db_session.query(User).first()
    today = datetime.utcnow()
    o1 = Order(id="ord1", user_id=user.id, status="paid", started_at=today - timedelta(minutes=30))
    o2 = Order(id="ord2", user_id=user.id, status="completed", started_at=today - timedelta(minutes=90), ended_at=today - timedelta(minutes=10))
    db_session.add_all([o1, o2])
    # payments
    p1 = Payment(order_id="ord1", amount=1000, method="yoco", status="success", created_at=today, source="yoco")
    p2 = Payment(order_id="ord2", amount=0, method="loyalty", status="success", created_at=today, source="loyalty")
    db_session.add_all([p1, p2])
    db_session.commit()

    date_str = today.strftime('%Y-%m-%d')
    resp = client.get(f"/api/payments/history?start_date={date_str}&end_date={date_str}")
    assert resp.status_code == 200
    data = resp.json()
    assert data['total'] == 2
    # Filter by paymentType=paid
    resp_paid = client.get(f"/api/payments/history?start_date={date_str}&end_date={date_str}&paymentType=paid")
    assert resp_paid.status_code == 200
    data_paid = resp_paid.json()
    assert data_paid['total'] == 1
    # Filter by paymentType=loyalty
    resp_loy = client.get(f"/api/payments/history?start_date={date_str}&end_date={date_str}&paymentType=loyalty")
    assert resp_loy.status_code == 200
    data_loy = resp_loy.json()
    assert data_loy['total'] == 1
