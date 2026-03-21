"""Tests for subscription billing endpoints: invoices, payment-method, and webhook events."""

import json
from unittest.mock import patch, MagicMock

import pytest
from fastapi.testclient import TestClient
from app.core.database import get_db, SessionLocal as TestingSessionLocal, Base, engine
from app.models import Tenant
from config import settings


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture(scope="function")
def db_session(initialize_db):
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(scope="function")
def client(db_session, monkeypatch):
    import main
    app_instance = main.app

    def override_get_db():
        yield db_session

    app_instance.dependency_overrides[get_db] = override_get_db
    from app.plugins.auth.routes import require_staff, require_admin, get_current_user
    from app.models import User
    from fastapi import Request

    app_instance.dependency_overrides[require_staff] = lambda: None
    app_instance.dependency_overrides[require_admin] = lambda: None

    def override_get_current_user(request: Request):
        return db_session.query(User).first()

    app_instance.dependency_overrides[get_current_user] = override_get_current_user
    return TestClient(app_instance)


# ---------------------------------------------------------------------------
# /subscriptions/invoices
# ---------------------------------------------------------------------------

class TestInvoicesEndpoint:
    """GET /api/subscriptions/invoices"""

    def test_invoices_returns_empty_in_mock_mode(self, client):
        """In mock Stripe mode (default test config), invoices returns empty list."""
        resp = client.get("/api/subscriptions/invoices", headers={"X-Tenant-ID": "default"})
        assert resp.status_code == 200
        assert resp.json() == []

    def test_invoices_returns_empty_when_no_stripe_customer(self, client, db_session):
        """If tenant has no stripe_customer_id, invoices returns empty list."""
        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        tenant.stripe_customer_id = None
        db_session.commit()

        resp = client.get("/api/subscriptions/invoices", headers={"X-Tenant-ID": "default"})
        assert resp.status_code == 200
        assert resp.json() == []


# ---------------------------------------------------------------------------
# /subscriptions/payment-method
# ---------------------------------------------------------------------------

class TestPaymentMethodEndpoint:
    """GET /api/subscriptions/payment-method"""

    def test_payment_method_returns_null_in_mock_mode(self, client):
        """In mock mode, payment-method returns null."""
        resp = client.get("/api/subscriptions/payment-method", headers={"X-Tenant-ID": "default"})
        assert resp.status_code == 200
        assert resp.json() is None

    def test_payment_method_returns_null_when_no_customer(self, client, db_session):
        """If tenant has no stripe_customer_id, payment-method returns null."""
        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        tenant.stripe_customer_id = None
        db_session.commit()

        resp = client.get("/api/subscriptions/payment-method", headers={"X-Tenant-ID": "default"})
        assert resp.status_code == 200
        assert resp.json() is None


# ---------------------------------------------------------------------------
# /subscriptions/plans
# ---------------------------------------------------------------------------

class TestPlansEndpoint:
    """GET /api/subscriptions/plans"""

    def test_plans_returns_all_plans(self, client):
        resp = client.get("/api/subscriptions/plans", headers={"X-Tenant-ID": "default"})
        assert resp.status_code == 200
        plans = resp.json()
        plan_ids = [p["id"] for p in plans]
        assert "free" in plan_ids
        assert "pro" in plan_ids
        assert "enterprise" in plan_ids


# ---------------------------------------------------------------------------
# /subscriptions/checkout-session (mock mode)
# ---------------------------------------------------------------------------

class TestCheckoutSession:
    """POST /api/subscriptions/checkout-session"""

    def test_checkout_session_mock_mode_upgrades_tenant(self, client, db_session):
        """In mock mode, checkout-session auto-upgrades the tenant and returns redirect URL."""
        resp = client.post(
            "/api/subscriptions/checkout-session?plan_id=pro",
            headers={"X-Tenant-ID": "default"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data
        assert "billing" in data["url"] or "subscription" in data["url"]

        # Verify tenant was upgraded
        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        assert tenant.subscription_plan_id == "pro"
        assert tenant.subscription_status == "active"

    def test_checkout_session_free_plan_no_stripe(self, client, db_session):
        """Selecting free plan should succeed without Stripe interaction."""
        resp = client.post(
            "/api/subscriptions/checkout-session?plan_id=free",
            headers={"X-Tenant-ID": "default"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "url" in data

    def test_checkout_session_invalid_plan_falls_back_to_free(self, client):
        """Unknown plan ID falls back to free plan via get_plan default."""
        resp = client.post(
            "/api/subscriptions/checkout-session?plan_id=nonexistent",
            headers={"X-Tenant-ID": "default"},
        )
        # get_plan falls back to free when plan is not found
        assert resp.status_code == 200


# ---------------------------------------------------------------------------
# Webhook handler unit tests
# ---------------------------------------------------------------------------

class TestWebhookHandlers:
    """Unit tests for internal webhook handler functions."""

    def test_handle_checkout_completed(self, db_session):
        from app.plugins.subscriptions.routes import _handle_checkout_completed

        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        tenant.subscription_plan_id = "free"
        tenant.subscription_status = "active"
        db_session.commit()

        session_data = {
            "metadata": {"tenant_id": settings.default_tenant, "plan_id": "pro"},
            "subscription": "sub_test_123",
        }
        _handle_checkout_completed(session_data, db_session)

        db_session.refresh(tenant)
        assert tenant.subscription_plan_id == "pro"
        assert tenant.stripe_subscription_id == "sub_test_123"
        assert tenant.subscription_status == "active"

    def test_handle_invoice_paid(self, db_session):
        from app.plugins.subscriptions.routes import _handle_invoice_paid

        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        tenant.stripe_customer_id = "cus_test_123"
        tenant.subscription_status = "past_due"
        db_session.commit()

        invoice_data = {
            "customer": "cus_test_123",
            "subscription": "sub_test_456",
        }
        _handle_invoice_paid(invoice_data, db_session)

        db_session.refresh(tenant)
        assert tenant.subscription_status == "active"
        assert tenant.stripe_subscription_id == "sub_test_456"

    def test_handle_subscription_deleted(self, db_session):
        from app.plugins.subscriptions.routes import _handle_subscription_deleted

        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        tenant.stripe_customer_id = "cus_test_del"
        tenant.subscription_plan_id = "pro"
        tenant.subscription_status = "active"
        db_session.commit()

        sub_data = {"customer": "cus_test_del"}
        _handle_subscription_deleted(sub_data, db_session)

        db_session.refresh(tenant)
        assert tenant.subscription_status == "canceled"
        assert tenant.subscription_plan_id == "free"

    def test_handle_subscription_updated(self, db_session):
        from app.plugins.subscriptions.routes import _handle_subscription_updated

        tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
        tenant.stripe_customer_id = "cus_test_upd"
        tenant.subscription_status = "active"
        db_session.commit()

        sub_data = {"customer": "cus_test_upd", "status": "past_due"}
        _handle_subscription_updated(sub_data, db_session)

        db_session.refresh(tenant)
        assert tenant.subscription_status == "past_due"
