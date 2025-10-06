import json
from datetime import datetime

import pytest

from app.models import Tenant, TenantIntegration
from app.services.tenant_settings import TenantSettingsService


# Use a unique tenant id per test module to avoid collisions when tests rerun
@pytest.fixture
def tenant_with_integrations(db_session):
    tenant = Tenant(
        id="tenant-integrations-test",
        name="Tenant Integrations",
        loyalty_type="premium",
        config={
            "email": {
                "from_email": "legacy@example.com",
                "sendgrid_api_key": "legacy-key",
            },
            "payments": {
                "provider": "yoco",
                "secret_key": "legacy-yoco",
                "webhook_secret": "legacy-webhook",
            },
        },
        created_at=datetime.utcnow(),
    )
    db_session.add(tenant)
    db_session.flush()

    email_integration = TenantIntegration(
        tenant_id=tenant.id,
        category="email",
        provider="sendgrid",
        config={"from_email": "integrations@example.com", "from_name": "Tenant Integrations"},
        secrets={"api_key": {"fallback": "integration-key"}},
    )
    payment_integration = TenantIntegration(
        tenant_id=tenant.id,
        category="payments",
        provider="yoco",
        config={"provider": "yoco"},
        secrets={
            "secret_key": {"fallback": "integration-yoco"},
            "webhook_secret": {"fallback": "integration-hook"},
        },
    )
    db_session.add_all([email_integration, payment_integration])
    db_session.commit()
    db_session.refresh(tenant)
    yield tenant
    db_session.query(TenantIntegration).filter_by(tenant_id=tenant.id).delete()
    db_session.query(Tenant).filter_by(id=tenant.id).delete()
    db_session.commit()


def test_email_settings_prefer_integration(db_session, tenant_with_integrations, monkeypatch):
    calls = {}

    def fake_get_secret(descriptor):
        calls.setdefault(descriptor.vault_name or "fallback", []).append(descriptor.fallback)
        return descriptor.fallback

    monkeypatch.setattr("app.services.tenant_settings.secret_vault.get_secret", fake_get_secret)

    service = TenantSettingsService(tenant_with_integrations)
    email = service.email

    assert email.from_email == "integrations@example.com"
    assert email.from_name == "Tenant Integrations"
    assert email.sendgrid_api_key == "integration-key"
    assert "fallback" in calls


def test_payment_settings_prefer_integration(db_session, tenant_with_integrations, monkeypatch):
    monkeypatch.setattr(
        "app.services.tenant_settings.secret_vault.get_secret",
        lambda descriptor: descriptor.fallback,
    )

    service = TenantSettingsService(tenant_with_integrations)
    payment = service.payment

    assert payment.provider == "yoco"
    assert payment.secret_key == "integration-yoco"
    assert payment.webhook_secret == "integration-hook"
