import pytest
from app.main import app
from app.plugins.auth.routes import require_admin, get_current_user
from app.models import Tenant, User, TenantBranding, LoyaltyProgram, Service
from config import settings
from datetime import datetime


@pytest.fixture(autouse=True)
def admin_client(client, db_session):
    admin = db_session.query(User).first()
    admin.role = 'admin'
    db_session.commit()
    app.dependency_overrides[require_admin] = lambda: admin
    app.dependency_overrides[get_current_user] = lambda: admin
    return client


@pytest.fixture
def onboarding_tenant(db_session):
    """Create a tenant that has not completed onboarding."""
    tenant = db_session.query(Tenant).filter_by(id="onboard_test").first()
    if tenant:
        db_session.delete(tenant)
        db_session.commit()
    tenant = Tenant(
        id="onboard_test",
        name="Test Onboarding",
        loyalty_type="standard",
        vertical_type="carwash",
        config={},
        onboarding_completed=False,
        created_at=datetime.utcnow(),
    )
    db_session.add(tenant)
    db_session.commit()
    db_session.refresh(tenant)
    return tenant


def test_onboarding_endpoint_basic(admin_client, onboarding_tenant, db_session):
    """Test PATCH /{tenant_id}/onboarding with minimal payload."""
    resp = admin_client.patch(
        f"/api/tenants/{onboarding_tenant.id}/onboarding",
        json={"business_name": "My Biz"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True
    assert body["tenant"]["name"] == "My Biz"
    assert body["tenant"]["onboarding_completed"] is True


def test_onboarding_endpoint_full(admin_client, onboarding_tenant, db_session):
    """Test PATCH /{tenant_id}/onboarding with full payload."""
    resp = admin_client.patch(
        f"/api/tenants/{onboarding_tenant.id}/onboarding",
        json={
            "business_name": "Full Setup Co",
            "business_type": "beauty",
            "phone": "0123456789",
            "email": "info@test.com",
            "address": "123 Main St",
            "branding": {
                "logo_url": "https://example.com/logo.png",
                "primary_color": "#ff5500",
                "secondary_color": "#003311",
                "tagline": "Best service ever",
            },
            "verticals": ["beauty", "retail"],
            "loyalty": {
                "points_per_rand": 2.0,
                "visit_milestone": 10,
                "reward_description": "Gold Reward",
            },
            "services": [
                {"name": "Haircut", "price_cents": 15000},
                {"name": "Styling", "price_cents": 25000},
            ],
            "team_invites": [
                {"email": "staff1@test.com"},
                {"email": "staff2@test.com"},
            ],
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["success"] is True

    tenant_data = body["tenant"]
    assert tenant_data["name"] == "Full Setup Co"
    assert tenant_data["vertical_type"] == "beauty"
    assert tenant_data["onboarding_completed"] is True

    # Verify team invites are returned
    assert "staff1@test.com" in body["team_invites"]
    assert "staff2@test.com" in body["team_invites"]

    # Verify branding was created
    branding = db_session.query(TenantBranding).filter_by(tenant_id=onboarding_tenant.id).first()
    assert branding is not None
    assert branding.primary_color == "#ff5500"
    assert branding.secondary_color == "#003311"
    assert branding.extra.get("tagline") == "Best service ever"

    # Verify loyalty program was created
    lp = db_session.query(LoyaltyProgram).filter_by(tenant_id=onboarding_tenant.id).first()
    assert lp is not None
    assert lp.accrual_ratio == 2.0
    assert lp.name == "Gold Reward"

    # Verify config
    tenant = db_session.query(Tenant).filter_by(id=onboarding_tenant.id).first()
    assert tenant.config.get("business_phone") == "0123456789"
    assert tenant.config.get("business_email") == "info@test.com"
    assert tenant.config.get("visit_milestone") == 10
    assert tenant.config["onboarding"]["completed"] is True


def test_onboarding_endpoint_not_found(admin_client):
    """Test PATCH with non-existent tenant returns 404."""
    resp = admin_client.patch(
        "/api/tenants/nonexistent_tenant/onboarding",
        json={"business_name": "Nope"},
    )
    assert resp.status_code == 404


def test_onboarding_sets_flag(admin_client, onboarding_tenant, db_session):
    """Verify the onboarding_completed flag is set after the call."""
    tenant = db_session.query(Tenant).filter_by(id=onboarding_tenant.id).first()
    assert tenant.onboarding_completed is False

    admin_client.patch(
        f"/api/tenants/{onboarding_tenant.id}/onboarding",
        json={},
    )

    db_session.refresh(tenant)
    assert tenant.onboarding_completed is True


def test_tenant_out_includes_onboarding_completed(admin_client):
    """Ensure GET /api/tenants/ returns onboarding_completed field."""
    resp = admin_client.get("/api/tenants/")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert "onboarding_completed" in data[0]
