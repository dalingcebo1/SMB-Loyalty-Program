"""Derive the frontend base URL from an incoming request.

When the same backend serves multiple frontend domains (e.g. a dev Azure
Static Web App and a production custom domain), hard-coding ``FRONTEND_URL``
causes redirect links to land on the wrong host.  The helpers here extract
the *actual* origin the browser sent the request from so that ``build_frontend_url``
can build links that point back to the correct domain.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import urlparse

from starlette.requests import Request


def get_request_origin(request: Request) -> Optional[str]:
    """Return the scheme+host origin of the calling browser, or *None*.

    Resolution order:
    1. ``Origin`` header (set by browsers on POST / CORS pre-flight).
    2. ``Referer`` header (available on most navigations).

    The returned value never has a trailing slash.
    """

    origin = request.headers.get("origin")
    if origin and _is_valid_origin(origin):
        return origin.rstrip("/")

    referer = request.headers.get("referer")
    if referer:
        parsed = urlparse(referer)
        if parsed.scheme and parsed.netloc:
            return f"{parsed.scheme}://{parsed.netloc}".rstrip("/")

    return None


def _is_valid_origin(value: str) -> bool:
    """Basic sanity check that *value* looks like ``https://host``."""
    try:
        parsed = urlparse(value)
        return bool(parsed.scheme and parsed.netloc)
    except Exception:
        return False
