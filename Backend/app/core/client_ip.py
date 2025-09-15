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
    host = request.client.host if request.client else 'unknown'
    request.state.client_ip = host
    return host

__all__ = ["get_client_ip"]
