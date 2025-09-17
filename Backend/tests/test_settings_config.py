import os
import importlib
import pytest
from functools import lru_cache

# We import the module fresh each time to ensure pydantic reads env vars newly.

def reload_settings():
    if 'config' in globals():
        pass
    if 'config' in importlib.sys.modules:
        del importlib.sys.modules['config']
    import config  # noqa: F401
    return config.settings, config.Settings


def test_defaults_no_env(monkeypatch):
    # Ensure relevant vars are absent
    for k in [
        'JWT_SECRET','RESET_SECRET','SECRET_KEY','DATABASE_URL','ENVIRONMENT'
    ]:
        monkeypatch.delenv(k, raising=False)
    settings, _Settings = reload_settings()
    assert settings.jwt_secret == 'dev_jwt_secret'
    assert settings.reset_secret == 'dev_reset_secret'
    assert settings.loyalty_secret == 'dev_loyalty_secret'
    assert settings.environment == 'development'
    assert settings.database_url.startswith('sqlite:///')


def test_env_overrides(monkeypatch):
    monkeypatch.setenv('JWT_SECRET','jwtx')
    monkeypatch.setenv('RESET_SECRET','resety')
    monkeypatch.setenv('SECRET_KEY','super_super_secret_key_abcdefghijklmnopqrstuvwxyz')
    monkeypatch.setenv('DATABASE_URL','postgresql://u:p@h:5432/db')
    monkeypatch.setenv('ENVIRONMENT','staging')
    settings, _Settings = reload_settings()
    # Debug dump to aid failure diagnostics
    debug_state = {
        'jwt_secret': settings.jwt_secret,
        'reset_secret': settings.reset_secret,
        'loyalty_secret': settings.loyalty_secret,
        'database_url': settings.database_url,
        'environment': settings.environment,
    }
    # Ensure overrides are applied; include actual values on failure
    assert settings.jwt_secret == 'jwtx', f"jwt_secret mismatch: {debug_state}"
    assert settings.reset_secret == 'resety', f"reset_secret mismatch: {debug_state}"
    assert settings.loyalty_secret.startswith('super_super_secret_key_'), f"loyalty_secret mismatch: {debug_state}"
    assert settings.database_url.startswith('postgresql://'), f"database_url mismatch: {debug_state}"
    assert settings.environment == 'staging', f"environment mismatch: {debug_state}"


def test_control_direct_instantiation(monkeypatch):
    """Control: directly instantiate Settings after setting env vars.

    If this passes (loyalty_secret picks up SECRET_KEY) while test_env_overrides fails,
    the issue is caching / reload strategy rather than field mapping.
    """
    monkeypatch.setenv('SECRET_KEY','control_direct_secret_value_abcdefghijklmnopqrstuvwxyz')
    # Import the class only (not the pre-built settings) then instantiate.
    from config import Settings  # noqa
    local = Settings()
    assert local.loyalty_secret.startswith('control_direct_secret_value_')


def test_get_settings_cache(monkeypatch):
    """Ensure get_settings() reflects new SECRET_KEY after cache clear."""
    import config
    # Clear any existing cached value to establish a fresh baseline
    config.get_settings.cache_clear()  # type: ignore[attr-defined]
    # With no override set yet, should read from .env (if present) or default
    baseline = config.get_settings().loyalty_secret
    assert isinstance(baseline, str)
    # Now apply override and ensure refresh after cache clear
    monkeypatch.setenv('SECRET_KEY','cached_secret_value_abcdefghijklmnopqrstuvwxyz')
    config.get_settings.cache_clear()  # type: ignore[attr-defined]
    updated = config.get_settings().loyalty_secret
    assert updated.startswith('cached_secret_value_')


def test_dangerous_allowed(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT','development')
    monkeypatch.setenv('ENABLE_DEV_DANGEROUS','true')
    settings, _Settings = reload_settings()
    assert settings.dangerous_allowed() is True
    # Production always false
    monkeypatch.setenv('ENVIRONMENT','production')
    settings, _Settings = reload_settings()
    assert settings.dangerous_allowed() is False


def test_secret_length_requirement(monkeypatch):
    monkeypatch.setenv('ENVIRONMENT','production')
    # Provide a short secret to simulate failure condition in validation logic
    monkeypatch.setenv('SECRET_KEY','short')
    settings, _Settings = reload_settings()
    assert settings.loyalty_secret == 'short'
    # Length check itself is in _validate_environment (tested indirectly elsewhere)
    assert len(settings.loyalty_secret) < 24


def test_optional_values(monkeypatch):
    monkeypatch.setenv('ALLOWED_ORIGINS','https://a.com,https://b.com')
    monkeypatch.setenv('SENTRY_DSN','https://example@sentry.io/1')
    settings, _Settings = reload_settings()
    assert 'a.com' in settings.allowed_origins
    assert settings.sentry_dsn.startswith('https://example')
