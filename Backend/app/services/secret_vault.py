"""Helpers for resolving secrets from Azure Key Vault with safe fallbacks.

The implementation is intentionally defensive: Azure SDK imports are optional so
that local development (and CI) can run without cloud credentials. Secrets may
also be provided via environment variables prefixed with ``TENANT_SECRET_``.
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from typing import Optional

try:  # pragma: no cover - optional dependency
    from azure.keyvault.secrets import SecretClient  # type: ignore
    from azure.identity import DefaultAzureCredential  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    SecretClient = None  # type: ignore
    DefaultAzureCredential = None  # type: ignore

_LOG = logging.getLogger("secret_vault")


@dataclass
class SecretDescriptor:
    """Represents a single secret entry for a tenant integration."""

    vault_name: Optional[str]
    version: Optional[str] = None
    fallback: Optional[str] = None


class SecretVaultClient:
    """Resolve secrets from Azure Key Vault with environment fallbacks."""

    def __init__(self, vault_url: Optional[str] = None) -> None:
        self._vault_url = vault_url or os.getenv("AZURE_KEY_VAULT_URL") or os.getenv("KEY_VAULT_URL")
        self._client: Optional[SecretClient] = None
        if self._vault_url and SecretClient and DefaultAzureCredential:  # pragma: no branch - depends on SDK
            try:
                credential = DefaultAzureCredential()
                self._client = SecretClient(vault_url=self._vault_url, credential=credential)
            except Exception as exc:  # pragma: no cover - network / azure unavailable in tests
                _LOG.warning("Key Vault client initialisation failed: %s", exc)
                self._client = None

    def _env_override(self, descriptor: SecretDescriptor) -> Optional[str]:
        if not descriptor.vault_name:
            return None
        env_key = f"TENANT_SECRET_{descriptor.vault_name.upper().replace('-', '_')}"
        return os.getenv(env_key)

    def get_secret(self, descriptor: SecretDescriptor) -> Optional[str]:
        """Return the secret value, consulting overrides, Key Vault, then fallback."""

        if not descriptor.vault_name and descriptor.fallback:
            return descriptor.fallback

        env_override = self._env_override(descriptor)
        if env_override:
            return env_override

        if descriptor.vault_name and self._client:
            try:
                secret = self._client.get_secret(descriptor.vault_name, version=descriptor.version)
                if secret and secret.value:
                    return secret.value
            except Exception as exc:  # pragma: no cover - azure not available in CI
                _LOG.warning("Key Vault get_secret failed for %s: %s", descriptor.vault_name, exc)

        return descriptor.fallback

    def set_secret(self, descriptor: SecretDescriptor, value: str) -> None:
        """Persist a new secret value when Key Vault is available.

        In non-cloud environments the method logs and returns without failing.
        """

        if descriptor.vault_name and self._client:
            try:  # pragma: no cover - not executed in CI
                self._client.set_secret(descriptor.vault_name, value)
                return
            except Exception as exc:
                _LOG.warning("Key Vault set_secret failed for %s: %s", descriptor.vault_name, exc)
        _LOG.info("Secret rotation (no Key Vault client) for %s handled locally.", descriptor.vault_name or "<unset>")


def build_descriptor(entry: dict, key: str) -> SecretDescriptor:
    data = entry.get(key, {}) if isinstance(entry, dict) else {}
    return SecretDescriptor(
        vault_name=data.get("vault_name"),
        version=data.get("version"),
        fallback=data.get("fallback"),
    )


def build_vault_client() -> SecretVaultClient:
    return SecretVaultClient()


secret_vault = build_vault_client()
