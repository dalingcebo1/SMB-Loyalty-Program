"""Payment provider configuration service.

Handles encryption/decryption of payment provider API keys,
key masking for safe API responses, and connection testing.
"""
from __future__ import annotations

import base64
import hashlib
import logging
from typing import Any, Dict, List, Optional

import requests
from cryptography.fernet import Fernet, InvalidToken

from config import settings

_LOG = logging.getLogger(__name__)


def _derive_fernet_key(secret: str) -> bytes:
    """Derive a Fernet-compatible key from the application secret."""
    digest = hashlib.sha256(secret.encode()).digest()
    return base64.urlsafe_b64encode(digest)


def _get_fernet() -> Fernet:
    key = _derive_fernet_key(settings.loyalty_secret)
    return Fernet(key)


def encrypt_value(plaintext: str) -> str:
    """Encrypt a plaintext string and return a base64-encoded ciphertext."""
    if not plaintext:
        return ""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt_value(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext and return the plaintext."""
    if not ciphertext:
        return ""
    try:
        return _get_fernet().decrypt(ciphertext.encode()).decode()
    except (InvalidToken, Exception) as exc:
        _LOG.warning("Failed to decrypt value: %s", exc)
        return ""


def mask_key(value: Optional[str], visible: int = 4) -> str:
    """Mask a secret key, showing only the last ``visible`` characters."""
    if not value:
        return ""
    if len(value) <= visible:
        return "*" * len(value)
    return "*" * (len(value) - visible) + value[-visible:]


def test_yoco_connection(secret_key: str) -> Dict[str, Any]:
    """Test a Yoco secret key by hitting a lightweight API endpoint.

    Returns a dict with ``success`` boolean and optional ``error`` message.
    """
    if not secret_key:
        return {"success": False, "error": "No secret key provided"}

    try:
        resp = requests.get(
            "https://online.yoco.com/v1/charges/",
            headers={
                "X-Auth-Secret-Key": secret_key,
                "Content-Type": "application/json",
            },
            timeout=10,
        )
        # A 401 means invalid key; 200 or 4xx (e.g., 400 missing params) with
        # a Yoco response body means the key is valid.
        if resp.status_code == 401:
            return {"success": False, "error": "Invalid API key"}
        # Any other non-5xx response indicates the key is accepted
        if resp.status_code < 500:
            return {"success": True, "error": None}
        return {"success": False, "error": f"Yoco returned {resp.status_code}"}
    except requests.RequestException as exc:
        return {"success": False, "error": f"Connection failed: {exc}"}


def build_webhook_url(tenant_id: str) -> str:
    """Generate the auto-generated webhook URL for a tenant."""
    backend_url = getattr(settings, "backend_url", "") or ""
    if not backend_url:
        backend_url = getattr(settings, "frontend_url", "").rstrip("/")
        # Attempt to derive backend URL from frontend URL
        if backend_url:
            backend_url = backend_url.replace("://", "://api.")
    return f"{backend_url}/api/webhooks/yoco/{tenant_id}"


DEFAULT_PAYMENT_METHODS: List[str] = ["card", "cash", "eft"]
