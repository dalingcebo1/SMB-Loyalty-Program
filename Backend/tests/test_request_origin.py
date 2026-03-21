"""Tests for request-origin helpers and origin-aware URL building."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from starlette.testclient import TestClient

from app.models import Tenant
from app.services.tenant_settings import TenantSettingsService
from app.utils.request_origin import get_request_origin, _is_valid_origin


# ---------------------------------------------------------------------------
# Unit tests for get_request_origin
# ---------------------------------------------------------------------------

class _FakeRequest:
    """Minimal stand-in for starlette.requests.Request."""

    def __init__(self, headers: dict[str, str] | None = None):
        self.headers = headers or {}


def test_origin_from_origin_header():
    req = _FakeRequest({"origin": "https://orange-pond-06eea490f.3.azurestaticapps.net"})
    assert get_request_origin(req) == "https://orange-pond-06eea490f.3.azurestaticapps.net"


def test_origin_from_origin_header_strips_trailing_slash():
    req = _FakeRequest({"origin": "https://example.com/"})
    assert get_request_origin(req) == "https://example.com"


def test_origin_from_referer_header():
    req = _FakeRequest({"referer": "https://chaosx.co.za/admin/subscription?tab=billing"})
    assert get_request_origin(req) == "https://chaosx.co.za"


def test_origin_prefers_origin_over_referer():
    req = _FakeRequest({
        "origin": "https://dev.example.com",
        "referer": "https://prod.example.com/some/page",
    })
    assert get_request_origin(req) == "https://dev.example.com"


def test_origin_returns_none_when_no_headers():
    req = _FakeRequest({})
    assert get_request_origin(req) is None


def test_origin_returns_none_for_invalid_origin():
    req = _FakeRequest({"origin": "not-a-url"})
    assert get_request_origin(req) is None


def test_is_valid_origin_basic():
    assert _is_valid_origin("https://example.com") is True
    assert _is_valid_origin("http://localhost:5173") is True
    assert _is_valid_origin("ftp://files.example.com") is True
    assert _is_valid_origin("not-a-url") is False
    assert _is_valid_origin("") is False


# ---------------------------------------------------------------------------
# Unit tests for build_frontend_url with origin override
# ---------------------------------------------------------------------------

@pytest.fixture
def simple_tenant():
    """Tenant with no integrations and a generic config."""
    return Tenant(
        id="test-origin",
        name="Origin Test",
        loyalty_type="visits",
        config={"urls": {"frontend": "https://configured-domain.com"}},
        created_at=datetime.now(timezone.utc),
    )


def test_build_frontend_url_uses_config_when_no_origin(simple_tenant):
    svc = TenantSettingsService(simple_tenant)
    url = svc.build_frontend_url("reset-password?token=abc")
    assert url == "https://configured-domain.com/reset-password?token=abc"


def test_build_frontend_url_origin_overrides_config(simple_tenant):
    svc = TenantSettingsService(simple_tenant)
    url = svc.build_frontend_url(
        "reset-password?token=abc",
        origin="https://orange-pond-06eea490f.3.azurestaticapps.net",
    )
    assert url == "https://orange-pond-06eea490f.3.azurestaticapps.net/reset-password?token=abc"


def test_build_frontend_url_origin_none_falls_back(simple_tenant):
    svc = TenantSettingsService(simple_tenant)
    url = svc.build_frontend_url("admin/subscription", origin=None)
    assert url == "https://configured-domain.com/admin/subscription"


def test_build_frontend_url_empty_path_with_origin(simple_tenant):
    svc = TenantSettingsService(simple_tenant)
    url = svc.build_frontend_url("", origin="https://dev.example.com")
    assert url == "https://dev.example.com"
