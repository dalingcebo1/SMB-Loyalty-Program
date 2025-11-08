"""Tests for incremental camelCase aliasing on loyalty endpoint responses."""
from datetime import datetime
from config import settings
from app.models import Reward, VisitCount, User
from app.plugins.loyalty.constants import REWARD_INTERVAL


def test_loyalty_me_has_top_level_aliases(client, db_session):
    """Ensure /api/loyalty/me returns both snake_case and camelCase keys."""
    # No visits yet – simplest response
    resp = client.get("/api/loyalty/me")
    assert resp.status_code == 200
    data = resp.json()
    # Snake case originals
    assert "rewards_ready" in data
    assert "upcoming_rewards" in data
    # Camel case aliases
    assert "rewardsReady" in data
    assert "upcomingRewards" in data
    # Equivalence checks
    assert data["rewards_ready"] == data["rewardsReady"]
    assert data["upcoming_rewards"] == data["upcomingRewards"]
    # Other fields preserved
    assert "visits" in data
    assert isinstance(data["rewardsReady"], list)


def test_loyalty_me_nested_aliases_on_reward(client, db_session):
    """When a reward milestone is reached, nested objects also get camelCase aliases."""
    # Arrange: create a base milestone reward and visit count sufficient to earn it
    user = db_session.query(User).first()
    assert user is not None
    # Base Reward used by loyalty logic (milestone must equal REWARD_INTERVAL)
    reward = Reward(
        tenant_id=user.tenant_id,
        title="Free Wash",
        type="milestone",
        milestone=REWARD_INTERVAL,
        created_at=datetime.utcnow(),
    )
    db_session.add(reward)
    # Add visits equal to the milestone (user has earned one reward)
    vc = VisitCount(user_id=user.id, tenant_id=user.tenant_id, count=REWARD_INTERVAL)
    db_session.add(vc)
    db_session.commit()

    resp = client.get("/api/loyalty/me")
    assert resp.status_code == 200
    data = resp.json()
    # Expect at least one ready reward
    assert data.get("rewards_ready"), "Expected rewards_ready to be non-empty"
    reward_obj = data["rewards_ready"][0]
    # Original snake_case nested keys
    assert "qr_reference" in reward_obj
    assert "expiry_at" in reward_obj
    # CamelCase aliases added with value equality
    if reward_obj.get("qr_reference"):
        assert "qrReference" in reward_obj
        assert reward_obj["qr_reference"] == reward_obj["qrReference"]
    if reward_obj.get("expiry_at"):
        assert "expiryAt" in reward_obj
        assert reward_obj["expiry_at"] == reward_obj["expiryAt"]
    # Milestone alias check
    assert "milestone" in reward_obj  # base key
    # No duplicate alias for 'milestone' (no underscore) – ensure no incorrect variant
    assert "mileStone" not in reward_obj
    # Field without underscore should not produce new alias
    assert "pin" in reward_obj and "Pin" not in reward_obj
