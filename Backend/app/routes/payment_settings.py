"""Admin payment settings routes.

Provides endpoints for viewing and updating per-tenant payment provider
configuration (Yoco/Stripe keys, accepted payment methods).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.audit import log_audit
from app.core.database import get_db
from app.models import Tenant, TenantIntegration, User
from app.plugins.auth.routes import require_capability
from app.services.payment_config import (
    build_webhook_url,
    decrypt_value,
    encrypt_value,
    mask_key,
    test_yoco_connection,
)

router = APIRouter(prefix="/admin/settings/payments", tags=["payment-settings"])


# ---------------------------------------------------------------------------
# Pydantic schemas
# ---------------------------------------------------------------------------

class YocoConfigOut(BaseModel):
    public_key: str = ""
    secret_key_masked: str = ""
    webhook_url: str = ""
    status: str = "not_configured"


class StripeConfigOut(BaseModel):
    status: str = "not_connected"
    current_plan: Optional[str] = None


class PaymentMethodsOut(BaseModel):
    accepted: List[str] = Field(default_factory=lambda: ["card", "cash", "eft"])
    default_method: str = "card"


class PaymentSettingsOut(BaseModel):
    yoco: YocoConfigOut = Field(default_factory=YocoConfigOut)
    stripe: StripeConfigOut = Field(default_factory=StripeConfigOut)
    payment_methods: PaymentMethodsOut = Field(default_factory=PaymentMethodsOut)


class PaymentSettingsUpdate(BaseModel):
    yoco_public_key: Optional[str] = None
    yoco_secret_key: Optional[str] = None
    accepted_methods: Optional[List[str]] = None
    default_method: Optional[str] = None


class TestConnectionRequest(BaseModel):
    secret_key: Optional[str] = None


class TestConnectionResponse(BaseModel):
    success: bool
    error: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_tenant_or_404(tenant_id: str, db: Session) -> Tenant:
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    return tenant


def _get_payment_integration(
    tenant_id: str, db: Session
) -> Optional[TenantIntegration]:
    return (
        db.query(TenantIntegration)
        .filter_by(tenant_id=tenant_id, category="payments", provider="yoco")
        .first()
    )


def _build_settings_response(
    tenant: Tenant, integration: Optional[TenantIntegration]
) -> PaymentSettingsOut:
    config: Dict[str, Any] = {}
    secrets: Dict[str, Any] = {}

    if integration:
        config = integration.config or {}
        secrets = integration.secrets or {}

    # Yoco settings
    public_key = config.get("public_key", "")
    encrypted_secret = secrets.get("secret_key_encrypted", "")
    decrypted_secret = decrypt_value(encrypted_secret) if encrypted_secret else ""

    if decrypted_secret:
        status = "connected"
    elif public_key:
        status = "error"
    else:
        status = "not_configured"

    yoco = YocoConfigOut(
        public_key=public_key,
        secret_key_masked=mask_key(decrypted_secret),
        webhook_url=build_webhook_url(tenant.id),
        status=status,
    )

    # Stripe – read from tenant-level fields
    stripe_status = "connected" if tenant.stripe_customer_id else "not_connected"
    stripe = StripeConfigOut(
        status=stripe_status,
        current_plan=tenant.subscription_plan_id,
    )

    # Payment methods
    tenant_config = tenant.config or {}
    payment_cfg = tenant_config.get("payments", {}) or {}
    accepted = payment_cfg.get("accepted_methods", ["card", "cash", "eft"])
    default_method = payment_cfg.get("default_method", "card")

    methods = PaymentMethodsOut(accepted=accepted, default_method=default_method)

    return PaymentSettingsOut(yoco=yoco, stripe=stripe, payment_methods=methods)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get(
    "",
    response_model=PaymentSettingsOut,
    dependencies=[Depends(require_capability("manage-settings"))],
)
def get_payment_settings(
    db: Session = Depends(get_db),
    current: User = Depends(require_capability("manage-settings")),
) -> PaymentSettingsOut:
    """Return the current payment configuration for the caller's tenant."""
    tenant = _get_tenant_or_404(current.tenant_id, db)
    integration = _get_payment_integration(tenant.id, db)
    return _build_settings_response(tenant, integration)


@router.patch(
    "",
    response_model=PaymentSettingsOut,
    dependencies=[Depends(require_capability("manage-settings"))],
)
def update_payment_settings(
    payload: PaymentSettingsUpdate,
    db: Session = Depends(get_db),
    current: User = Depends(require_capability("manage-settings")),
) -> PaymentSettingsOut:
    """Update payment provider configuration for the caller's tenant."""
    tenant = _get_tenant_or_404(current.tenant_id, db)
    integration = _get_payment_integration(tenant.id, db)

    if integration is None:
        integration = TenantIntegration(
            tenant_id=tenant.id,
            category="payments",
            provider="yoco",
            config={},
            secrets={},
        )
        db.add(integration)
        db.flush()

    config = dict(integration.config or {})
    secrets = dict(integration.secrets or {})
    changed_fields: list[str] = []

    if payload.yoco_public_key is not None:
        config["public_key"] = payload.yoco_public_key
        changed_fields.append("yoco_public_key")

    if payload.yoco_secret_key is not None:
        secrets["secret_key_encrypted"] = encrypt_value(payload.yoco_secret_key)
        # Also store as fallback for TenantSettingsService resolution
        secrets["secret_key"] = {"fallback": payload.yoco_secret_key}
        changed_fields.append("yoco_secret_key")

    integration.config = config
    integration.secrets = secrets

    # Update accepted payment methods on tenant config
    tenant_config = dict(tenant.config or {})
    payment_cfg = dict(tenant_config.get("payments", {}) or {})

    if payload.accepted_methods is not None:
        payment_cfg["accepted_methods"] = payload.accepted_methods
        changed_fields.append("accepted_methods")

    if payload.default_method is not None:
        payment_cfg["default_method"] = payload.default_method
        changed_fields.append("default_method")

    if payload.accepted_methods is not None or payload.default_method is not None:
        tenant_config["payments"] = payment_cfg
        tenant.config = tenant_config

    db.commit()

    log_audit(
        db,
        action="payment_settings.update",
        user=current,
        tenant_id=tenant.id,
        details={"changed_fields": changed_fields},
    )

    return _build_settings_response(tenant, integration)


@router.post(
    "/test",
    response_model=TestConnectionResponse,
    dependencies=[Depends(require_capability("manage-settings"))],
)
def test_payment_connection(
    payload: TestConnectionRequest,
    db: Session = Depends(get_db),
    current: User = Depends(require_capability("manage-settings")),
) -> TestConnectionResponse:
    """Test the Yoco connection with the provided (or stored) secret key."""
    secret_key = payload.secret_key

    if not secret_key:
        # Fall back to stored key
        tenant = _get_tenant_or_404(current.tenant_id, db)
        integration = _get_payment_integration(tenant.id, db)
        if integration and integration.secrets:
            encrypted = (integration.secrets or {}).get("secret_key_encrypted", "")
            secret_key = decrypt_value(encrypted) if encrypted else ""

    if not secret_key:
        return TestConnectionResponse(
            success=False, error="No secret key provided or stored"
        )

    result = test_yoco_connection(secret_key)
    return TestConnectionResponse(**result)
