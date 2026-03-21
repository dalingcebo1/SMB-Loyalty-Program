"""Tests for payment settings admin endpoints."""
import pytest
from unittest.mock import patch
from fastapi.testclient import TestClient
from app.core.database import get_db, SessionLocal as TestingSessionLocal
from app.models import Tenant, TenantIntegration, User
from app.services.payment_config import encrypt_value, decrypt_value, mask_key
from config import settings
from datetime import datetime


# ---------------------------------------------------------------------------
# Unit tests for encryption / masking helpers
# ---------------------------------------------------------------------------

class TestEncryptionHelpers:
    def test_encrypt_decrypt_roundtrip(self):
        plaintext = "sk_live_abc123xyz"
        encrypted = encrypt_value(plaintext)
        assert encrypted != plaintext
        assert decrypt_value(encrypted) == plaintext

    def test_encrypt_empty_string(self):
        assert encrypt_value("") == ""

    def test_decrypt_empty_string(self):
        assert decrypt_value("") == ""

    def test_decrypt_invalid_ciphertext(self):
        assert decrypt_value("not-valid-ciphertext") == ""

    def test_mask_key_normal(self):
        assert mask_key("sk_live_abc123xyz") == "*************3xyz"

    def test_mask_key_short(self):
        assert mask_key("abc") == "***"

    def test_mask_key_none(self):
        assert mask_key(None) == ""

    def test_mask_key_empty(self):
        assert mask_key("") == ""

    def test_mask_key_exact_visible(self):
        assert mask_key("abcd") == "****"


# ---------------------------------------------------------------------------
# Integration tests for payment settings routes
# ---------------------------------------------------------------------------

@pytest.fixture
def admin_user(db_session):
    """Ensure an admin user exists for payment settings tests."""
    user = db_session.query(User).filter_by(email="testuser@example.com").first()
    if user:
        user.role = "admin"
        db_session.commit()
        return user
    user = User(
        email="testuser@example.com",
        hashed_password=None,
        role="admin",
        tenant_id=settings.default_tenant,
        created_at=datetime.utcnow(),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def admin_client(admin_user, db_session):
    """TestClient where current_user is the admin user."""
    from main import app
    from app.plugins.auth.routes import get_current_user

    def override_get_db():
        yield db_session

    def override_get_current_user():
        return admin_user

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield TestClient(app)
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)


class TestGetPaymentSettings:
    def test_get_default_settings(self, admin_client):
        resp = admin_client.get("/api/admin/settings/payments")
        assert resp.status_code == 200
        data = resp.json()
        assert "yoco" in data
        assert "stripe" in data
        assert "payment_methods" in data
        assert data["yoco"]["status"] in ("connected", "not_configured", "error")

    def test_get_settings_with_integration(self, admin_client, db_session, admin_user):
        # Create a payment integration
        encrypted_secret = encrypt_value("sk_test_secret123")
        integration = TenantIntegration(
            tenant_id=admin_user.tenant_id,
            category="payments",
            provider="yoco",
            config={"public_key": "pk_test_public123"},
            secrets={"secret_key_encrypted": encrypted_secret},
        )
        db_session.add(integration)
        db_session.commit()

        resp = admin_client.get("/api/admin/settings/payments")
        assert resp.status_code == 200
        data = resp.json()
        assert data["yoco"]["public_key"] == "pk_test_public123"
        assert data["yoco"]["secret_key_masked"].endswith("t123")
        assert data["yoco"]["status"] == "connected"

        # Cleanup
        db_session.delete(integration)
        db_session.commit()


class TestUpdatePaymentSettings:
    def test_update_public_key(self, admin_client, db_session, admin_user):
        resp = admin_client.patch(
            "/api/admin/settings/payments",
            json={"yoco_public_key": "pk_live_newkey"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["yoco"]["public_key"] == "pk_live_newkey"

        # Cleanup
        integration = (
            db_session.query(TenantIntegration)
            .filter_by(tenant_id=admin_user.tenant_id, category="payments")
            .first()
        )
        if integration:
            db_session.delete(integration)
            db_session.commit()

    def test_update_secret_key_is_encrypted(self, admin_client, db_session, admin_user):
        resp = admin_client.patch(
            "/api/admin/settings/payments",
            json={"yoco_secret_key": "sk_live_secretvalue"},
        )
        assert resp.status_code == 200
        data = resp.json()
        # Secret should be masked in response
        assert "secretvalue" not in data["yoco"]["secret_key_masked"]
        assert data["yoco"]["secret_key_masked"].endswith("alue")

        # Verify encryption in DB
        integration = (
            db_session.query(TenantIntegration)
            .filter_by(tenant_id=admin_user.tenant_id, category="payments")
            .first()
        )
        assert integration is not None
        encrypted = integration.secrets.get("secret_key_encrypted", "")
        assert encrypted != "sk_live_secretvalue"  # Must not be plaintext
        assert decrypt_value(encrypted) == "sk_live_secretvalue"

        # Cleanup
        db_session.delete(integration)
        db_session.commit()

    def test_update_payment_methods(self, admin_client, db_session, admin_user):
        resp = admin_client.patch(
            "/api/admin/settings/payments",
            json={"accepted_methods": ["card", "eft"], "default_method": "eft"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "card" in data["payment_methods"]["accepted"]
        assert "eft" in data["payment_methods"]["accepted"]
        assert data["payment_methods"]["default_method"] == "eft"

        # Cleanup: reset tenant config
        tenant = db_session.query(Tenant).filter_by(id=admin_user.tenant_id).first()
        if tenant and tenant.config:
            cfg = dict(tenant.config)
            cfg.pop("payments", None)
            tenant.config = cfg
            db_session.commit()

        integration = (
            db_session.query(TenantIntegration)
            .filter_by(tenant_id=admin_user.tenant_id, category="payments")
            .first()
        )
        if integration:
            db_session.delete(integration)
            db_session.commit()


class TestTestConnection:
    @patch("app.routes.payment_settings.test_yoco_connection")
    def test_connection_with_provided_key(self, mock_test, admin_client):
        mock_test.return_value = {"success": True, "error": None}
        resp = admin_client.post(
            "/api/admin/settings/payments/test",
            json={"secret_key": "sk_test_key"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        mock_test.assert_called_once_with("sk_test_key")

    def test_connection_no_key(self, admin_client):
        resp = admin_client.post(
            "/api/admin/settings/payments/test",
            json={},
        )
        assert resp.status_code == 200
        data = resp.json()
        # No key stored or provided → should fail gracefully
        assert data["success"] is False


class TestAccessControl:
    def test_regular_user_cannot_access(self, db_session):
        """A regular user without manage-settings capability should get 403."""
        from main import app
        from app.plugins.auth.routes import get_current_user

        user = db_session.query(User).filter_by(email="testuser@example.com").first()
        if user:
            user.role = "user"
            db_session.commit()

        def override_get_db():
            yield db_session

        def override_get_current_user():
            return user

        app.dependency_overrides[get_db] = override_get_db
        app.dependency_overrides[get_current_user] = override_get_current_user
        client = TestClient(app)

        resp = client.get("/api/admin/settings/payments")
        assert resp.status_code == 403

        # Restore role
        if user:
            user.role = "admin"
            db_session.commit()
        app.dependency_overrides.pop(get_db, None)
        app.dependency_overrides.pop(get_current_user, None)
