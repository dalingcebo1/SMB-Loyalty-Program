"""Tenant-scoped configuration helpers.

This module provides a light wrapper around ``Tenant.config`` that exposes
structured accessors with sensible fallbacks to the global ``settings``
instance.  It gives us a central place to evolve configuration without
sprinkling JSON parsing logic throughout the codebase.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, asdict
from functools import cached_property
from typing import Any, Dict, Iterable, Mapping, Optional, Tuple

from app.models import Tenant, TenantIntegration
from config import settings
from app.services.secret_vault import build_descriptor, secret_vault


def _drilldown(mapping: Mapping[str, Any], path: Iterable[str], default: Any = None) -> Any:
    """Return a nested value from ``mapping`` following ``path``.

    ``mapping`` is expected to be a dict-like object.  Missing keys or encountering
    a non-mapping before the end of the path will short-circuit to ``default``.
    """

    cursor: Any = mapping
    for key in path:
        if not isinstance(cursor, Mapping):
            return default
        cursor = cursor.get(key)
        if cursor is None:
            return default
    return cursor


@dataclass(frozen=True)
class EmailSettings:
    provider: str
    sendgrid_api_key: Optional[str]
    from_email: str
    from_name: Optional[str]
    support_email: Optional[str]
    support_name: Optional[str]
    frontend_url: str
    reset_url: str


@dataclass(frozen=True)
class RateLimitValue:
    capacity: int
    window_seconds: int


@dataclass(frozen=True)
class PaymentSettings:
    provider: str
    secret_key: Optional[str]
    webhook_secret: Optional[str]


@dataclass(frozen=True)
class AuthSettings:
    jwt_secret: str
    reset_secret: str
    algorithm: str
    access_token_expire_minutes: int
    reset_token_expire_seconds: int


class TenantSettingsService:
    """Expose typed views of a tenant's configuration."""

    def __init__(self, tenant: Tenant):
        self._tenant = tenant
        self._config: Dict[str, Any] = tenant.config or {}
        # Lightweight per-instance cache to avoid recomputing derived values
        self._memo: Dict[str, Any] = {}
        self._integrations: Dict[Tuple[str, str], TenantIntegration] = {}
        for integration in getattr(tenant, "integrations", []) or []:
            category = (integration.category or "").lower()
            provider = (integration.provider or "").lower()
            if category:
                self._integrations[(category, provider)] = integration

    @property
    def tenant(self) -> Tenant:
        return self._tenant

    def _get(self, path: Iterable[str], default: Any = None) -> Any:
        return _drilldown(self._config, path, default)

    @cached_property
    def email(self) -> EmailSettings:
        provider = self._get(["email", "provider"], default="sendgrid")
        integration = self._integration("email", provider)
        integration_config: Dict[str, Any] = {}
        integration_secrets: Dict[str, Any] = {}
        if integration:
            integration_config = self._coerce_mapping(integration.config)
            integration_secrets = self._coerce_mapping(integration.secrets)
            provider = integration.provider or provider

        sendgrid_key = self._resolve_secret(integration_secrets, "api_key", self._get(["email", "sendgrid_api_key"], default=settings.sendgrid_api_key))
        from_email = (
            integration_config.get("from_email")
            or self._get(["email", "from_email"], default=settings.reset_email_from)
        )
        from_name = integration_config.get("from_name") or self._get(["email", "from_name"], default=None)
        support_email = self._get(["support", "email"], default=None)
        support_name = self._get(["support", "name"], default=None)
        frontend_url = integration_config.get("frontend_url") or self._get(["urls", "frontend"], default=settings.frontend_url)
        reset_url = self._get(
            ["urls", "reset"],
            default=f"{frontend_url.rstrip('/')}/reset-password",
        )
        return EmailSettings(
            provider=str(provider or "sendgrid"),
            sendgrid_api_key=sendgrid_key,
            from_email=str(from_email),
            from_name=from_name,
            support_email=support_email,
            support_name=support_name,
            frontend_url=frontend_url,
            reset_url=reset_url,
        )

    def get_rate_limit(self, scope: str, default_capacity: int, default_window: int) -> RateLimitValue:
        rl = self._get(["rate_limits", scope], default={}) or {}
        capacity = rl.get("capacity", default_capacity)
        window = rl.get("window_seconds", rl.get("per_seconds", default_window))

        module_limits = self._get(["subscription", "module_limits"], default={}) or {}
        if capacity is None and scope.startswith("user_tenant"):
            module_cap = module_limits.get("core")
            if isinstance(module_cap, int) and module_cap > 0:
                capacity = min(module_cap, default_capacity)

        if capacity is None:
            capacity = default_capacity
        if window is None:
            window = default_window
        try:
            cap_int = int(capacity)
        except (TypeError, ValueError):
            cap_int = default_capacity
        try:
            window_int = int(window)
        except (TypeError, ValueError):
            window_int = default_window
        return RateLimitValue(capacity=max(cap_int, 0), window_seconds=max(window_int, 1))

    @cached_property
    def payment(self) -> PaymentSettings:
        provider = self._get(["payments", "provider"], default="yoco")
        integration = self._integration("payments", provider)
        integration_config: Dict[str, Any] = {}
        integration_secrets: Dict[str, Any] = {}
        if integration:
            integration_config = self._coerce_mapping(integration.config)
            integration_secrets = self._coerce_mapping(integration.secrets)
            provider = integration.provider or provider

        secret_key = self._resolve_secret(
            integration_secrets,
            "secret_key",
            self._get(["payments", "secret_key"], default=settings.yoco_secret_key),
        )
        webhook_secret = self._resolve_secret(
            integration_secrets,
            "webhook_secret",
            self._get(["payments", "webhook_secret"], default=settings.yoco_webhook_secret),
        )
        return PaymentSettings(
            provider=str(provider or "yoco"),
            secret_key=secret_key,
            webhook_secret=webhook_secret,
        )

    @cached_property
    def auth(self) -> AuthSettings:
        jwt_secret = self._get(["auth", "jwt_secret"], default=settings.jwt_secret)
        reset_secret = self._get(["auth", "reset_secret"], default=settings.reset_secret)
        algorithm = self._get(["auth", "algorithm"], default=settings.algorithm)
        access_minutes = self._get(
            ["auth", "access_token_expire_minutes"],
            default=settings.access_token_expire_minutes,
        )
        reset_expire = self._get(
            ["auth", "reset_token_expire_seconds"],
            default=settings.reset_token_expire_seconds,
        )
        try:
            access_minutes = int(access_minutes)
        except (TypeError, ValueError):
            access_minutes = settings.access_token_expire_minutes
        try:
            reset_expire = int(reset_expire)
        except (TypeError, ValueError):
            reset_expire = settings.reset_token_expire_seconds
        return AuthSettings(
            jwt_secret=str(jwt_secret),
            reset_secret=str(reset_secret),
            algorithm=str(algorithm),
            access_token_expire_minutes=access_minutes,
            reset_token_expire_seconds=reset_expire,
        )

    def as_dict(self) -> Dict[str, Any]:
        """Return a snapshot of the derived settings for debugging/logging."""
        return {
            "tenant_id": self.tenant.id,
            "email": asdict(self.email),
            "payment": asdict(self.payment),
            "auth": asdict(self.auth),
        }

    def build_frontend_url(self, path: str) -> str:
        """Join the tenant's frontend base URL with the provided ``path``."""

        base = self.email.frontend_url.rstrip("/")
        suffix = path.lstrip("/")
        if not suffix:
            return base or settings.frontend_url
        return f"{base}/{suffix}"

    def _integration(self, category: str, provider: Optional[str] = None) -> Optional[TenantIntegration]:
        if not self._integrations:
            return None
        category_key = (category or "").lower()
        provider_key = (provider or "").lower()
        if (category_key, provider_key) in self._integrations:
            return self._integrations[(category_key, provider_key)]
        if provider_key:
            # Provider-specific lookup failed; fall back to first integration within the category.
            matches = [integ for (cat, _), integ in self._integrations.items() if cat == category_key]
            return matches[0] if matches else None
        return next((integ for (cat, _), integ in self._integrations.items() if cat == category_key), None)

    def _resolve_secret(self, secrets: Mapping[str, Any], key: str, fallback: Optional[str]) -> Optional[str]:
        if not secrets:
            return fallback
        descriptor = build_descriptor(secrets, key)
        if descriptor.fallback is None:
            descriptor.fallback = fallback
        return secret_vault.get_secret(descriptor)

    def _coerce_mapping(self, candidate: Any) -> Dict[str, Any]:
        if isinstance(candidate, Mapping):
            return dict(candidate)
        if isinstance(candidate, str):
            try:
                loaded = json.loads(candidate)
                if isinstance(loaded, Mapping):
                    return dict(loaded)
            except Exception:
                return {}
        return {}


def get_tenant_settings(tenant: Tenant) -> TenantSettingsService:
    return TenantSettingsService(tenant)
