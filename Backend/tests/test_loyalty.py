import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from datetime import datetime

from app.models import Reward, VisitCount
from config import settings

REWARD_INTERVAL = 5  # same as in plugin


def test_loyalty_me_empty(client: TestClient):
    resp = client.get("/api/loyalty/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["visits"] == 0
    assert data["rewards_ready"] == []
    assert data["upcoming_rewards"] == []


def test_loyalty_me_with_rewards(client: TestClient, db_session: Session):
    # Ensure reward exists
    reward = Reward(
        tenant_id=settings.default_tenant,
        title="Free Wash",
        description="",
        type="milestone",
        milestone=REWARD_INTERVAL,
        cost=0,
        created_at=datetime.utcnow(),
        service_id=None
    )
    db_session.add(reward)
    db_session.commit()

    # Seed visit count equal to one interval
    current_user_id = client.app.dependency_overrides.get("get_current_user")
    # Instead retrieve actual user from DB
    from app.models import User
    user = db_session.query(User).first()
    vc = VisitCount(
        tenant_id=settings.default_tenant,
        user_id=user.id,
        count=REWARD_INTERVAL,
        updated_at=datetime.utcnow()
    )
    db_session.add(vc)
    db_session.commit()

    # Call endpoint
    resp = client.get("/api/loyalty/me")
    assert resp.status_code == 200
    data = resp.json()
    assert data["visits"] == REWARD_INTERVAL
    # Should have one ready reward
    assert len(data["rewards_ready"]) == 1
    ready = data["rewards_ready"][0]
    assert ready["milestone"] == REWARD_INTERVAL
    # Upcoming rewards list should include next interval
    assert data["upcoming_rewards"][0]["milestone"] == REWARD_INTERVAL * 2
