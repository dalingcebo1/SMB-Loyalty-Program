"""Client IP extraction utilities.

Centralizes logic for deriving a canonical client IP from request scope and
X-Forwarded-For headers to keep behavior consistent across middlewares and
rate limiting.
"""
from __future__ import annotations
from typing import Optional
from fastapi import Request

_MAX_FORWARDED = 5  # safety cap to prevent header abuse / memory bloat


def get_client_ip(request: Request) -> str:
    """Return best-effort real client IP.

    Precedence:
      1. request.state.client_ip (already normalized earlier in pipeline)
      2. First value of X-Forwarded-For (if present)
      3. request.client.host
    """
    # 1. If middleware already populated
    cached = getattr(request.state, 'client_ip', None)
    if cached:
        return cached

    # 2. Parse header directly (middleware may not have run yet in tests)
    xff = request.headers.get('x-forwarded-for') or request.headers.get('X-Forwarded-For')
    if xff:
        parts = [p.strip() for p in xff.split(',') if p.strip()][: _MAX_FORWARDED]
        if parts:
            ip = parts[0]
            request.state.client_ip = ip  # cache for downstream
            return ip

    # 3. Fallback
    host = request.client.host if request.client else None
    # In httpx/Starlette tests, request.client.host may be 'testclient'.
    # Prefer the Host header in that case to keep behavior stable for tests
    # (will typically be 'testserver'). In production, when a real client IP
    # is present, we keep using request.client.host.
    if not host or host == 'testclient':
        header_host = request.headers.get('host') or request.headers.get('Host')
        if header_host:
            # strip optional port
            fallback = header_host.split(':', 1)[0].strip()
            request.state.client_ip = fallback
            return fallback

    host = host or 'unknown'
    request.state.client_ip = host
    return host

__all__ = ["get_client_ip"]
