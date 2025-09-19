"""Tenant context resolution dependency.

Resolves the active tenant for a request based on one of (precedence order):
 1. X-Tenant-ID header (explicit override, useful for internal tools)
 2. Host header full domain match against tenants.primary_domain
 3. Subdomain match (foo.example.com -> foo against tenants.subdomain)

If none are found raises 400/404 accordingly.
"""
from fastapi import Header, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional, Dict, Tuple
import contextvars
import time
from urllib.parse import urlparse

from app.core.database import get_db
from app.models import Tenant, VerticalType
from app.plugins.verticals.vertical_dispatch import dispatch
from config import settings


current_tenant_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_tenant_id", default=None)

# Simple in-process LRU-ish cache for domain-> tenant id resolution to cut DB lookups.
# (key is normalized host). Not multi-process safe; fine for single worker dev / small scale.
_TENANT_CACHE: Dict[str, Tuple[str, float]] = {}
_TENANT_CACHE_TTL = 60  # seconds
_TENANT_CACHE_MAX = 512
_TENANT_CACHE_METRICS = {"hits": 0, "misses": 0, "expired": 0}

def _cache_get(key: str) -> Optional[str]:
    entry = _TENANT_CACHE.get(key)
    if not entry:
        _TENANT_CACHE_METRICS["misses"] += 1
        return None
    tid, ts = entry
    if time.time() - ts > _TENANT_CACHE_TTL:
        _TENANT_CACHE.pop(key, None)
        _TENANT_CACHE_METRICS["expired"] += 1
        return None
    _TENANT_CACHE_METRICS["hits"] += 1
    return tid

def _cache_set(key: str, tenant_id: str):
    if len(_TENANT_CACHE) >= _TENANT_CACHE_MAX:
        # drop oldest (inefficient but small size)
        oldest = min(_TENANT_CACHE.items(), key=lambda kv: kv[1][1])[0]
        _TENANT_CACHE.pop(oldest, None)
    _TENANT_CACHE[key] = (tenant_id, time.time())

def tenant_cache_metrics() -> dict:
    """Return a shallow copy of cache metrics (for diagnostics / tests)."""
    return dict(_TENANT_CACHE_METRICS)

def tenant_cache_state() -> dict:
    """Return combined cache state: size, capacity, metrics."""
    return {
        'size': len(_TENANT_CACHE),
        'capacity': _TENANT_CACHE_MAX,
        'ttl_seconds': _TENANT_CACHE_TTL,
        'metrics': tenant_cache_metrics(),
    }


class TenantContext:
    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.id = tenant.id
        self.vertical = tenant.vertical_type or VerticalType.carwash.value


async def get_tenant_context(
    request: Request,
    db: Session = Depends(get_db),
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"),
    bypass_cache: Optional[str] = Header(default=None, alias="X-Bypass-Tenant-Cache"),
) -> TenantContext:
    """Resolve active tenant from headers.

    Resolution order:
      1) X-Tenant-ID explicit header
      2) Host header (normalized), with a safety normalization to strip leading 'www.' and optional 'api.' prefix
      3) Origin header host (for cross-origin browser calls to api.* domains)
      4) Subdomain match against Tenant.subdomain
      5) Development fallback to default tenant for localhost only
    """

    def _normalize_host(h: str) -> str:
        h = (h or "").split(":")[0].lower()
        if h.startswith("www."):
            h = h[4:]
        return h

    def _strip_api_prefix(h: str) -> str:
        # Treat api.example.com equivalently to example.com for primary_domain matching
        return h[4:] if h.startswith("api.") and len(h) > 4 else h

    # 0) Header explicit override
    if x_tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == x_tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found (header)")
        set_current_tenant_id(tenant.id)
        request.state.tenant_id = tenant.id
        return TenantContext(tenant)

    # Build candidate hostnames to try in order
    candidates: list[str] = []
    # 1. X-Forwarded-Host (first host if present)
    xfwd_host = request.headers.get("x-forwarded-host") or request.headers.get("X-Forwarded-Host")
    if xfwd_host:
        # X-Forwarded-Host may be a comma-separated list; use the first
        xfwd_host = xfwd_host.split(",")[0].strip()
        xfwd_norm = _normalize_host(xfwd_host)
        if xfwd_norm:
            candidates.append(xfwd_norm)
            api_stripped = _strip_api_prefix(xfwd_norm)
            if api_stripped and api_stripped != xfwd_norm:
                candidates.append(api_stripped)

    # 2. Forwarded header (host=...)
    fwd = request.headers.get("forwarded") or request.headers.get("Forwarded")
    if fwd:
        # Forwarded: for=1.2.3.4;host=foo.example.com;proto=https
        for part in fwd.split(";"):
            if part.strip().startswith("host="):
                fwd_host = part.strip()[5:].strip()
                fwd_norm = _normalize_host(fwd_host)
                if fwd_norm:
                    candidates.append(fwd_norm)
                    api_stripped = _strip_api_prefix(fwd_norm)
                    if api_stripped and api_stripped != fwd_norm:
                        candidates.append(api_stripped)

    # 3. Host header
    host_hdr = request.headers.get("host", "")
    host_norm = _normalize_host(host_hdr)
    if host_norm:
        candidates.append(host_norm)
        api_stripped = _strip_api_prefix(host_norm)
        if api_stripped and api_stripped != host_norm:
            candidates.append(api_stripped)

    # 4. Origin header
    origin_hdr = request.headers.get("origin") or request.headers.get("Origin")
    if origin_hdr:
        try:
            parsed = urlparse(origin_hdr)
            origin_host = _normalize_host(parsed.netloc)
            if origin_host:
                candidates.append(origin_host)
                api_stripped = _strip_api_prefix(origin_host)
                if api_stripped and api_stripped != origin_host:
                    candidates.append(api_stripped)
        except Exception:
            pass

    # Deduplicate while preserving order
    seen = set()
    ordered_candidates = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            ordered_candidates.append(c)

    # Try full primary_domain matches first (with cache)
    for hostname in ordered_candidates:
        if not hostname:
            continue
        if not bypass_cache:
            cached_id = _cache_get(hostname)
            if cached_id:
                tenant = db.query(Tenant).filter(Tenant.id == cached_id).first()
                if tenant:
                    set_current_tenant_id(tenant.id)
                    request.state.tenant_id = tenant.id
                    return TenantContext(tenant)
        tenant = db.query(Tenant).filter(Tenant.primary_domain == hostname).first()
        if tenant:
            _cache_set(hostname, tenant.id)
            set_current_tenant_id(tenant.id)
            request.state.tenant_id = tenant.id
            return TenantContext(tenant)

    # Next, try subdomain matches for any multi-label candidate
    for hostname in ordered_candidates:
        parts = hostname.split('.') if hostname else []
        if len(parts) > 2:
            sub = parts[0]
            cache_key = f"sub:{sub}"
            if not bypass_cache:
                cached_id = _cache_get(cache_key)
                if cached_id:
                    tenant = db.query(Tenant).filter(Tenant.id == cached_id).first()
                    if tenant:
                        set_current_tenant_id(tenant.id)
                        request.state.tenant_id = tenant.id
                        return TenantContext(tenant)
            tenant = db.query(Tenant).filter(Tenant.subdomain == sub).first()
            if tenant:
                _cache_set(cache_key, tenant.id)
                set_current_tenant_id(tenant.id)
                request.state.tenant_id = tenant.id
                return TenantContext(tenant)

    # 4) Development convenience fallback for localhost access.
    #    When hitting the API directly via http://127.0.0.1/ (no Host-based tenant mapping),
    #    returning a 400 is inconvenient for manual local testing of public endpoints.
    #    To avoid impacting automated tests (which rely on a 400 for unknown hosts and
    #    use "testserver" as host) we restrict the fallback strictly to development env
    #    AND host in {localhost, 127.0.0.1}. This preserves existing test expectations.
    # Determine a single hostname for dev fallback decision (original host header)
    hostname = host_norm
    if settings.environment == 'development' and hostname in ('localhost', '127.0.0.1') and settings.default_tenant:
        fallback = db.query(Tenant).filter(Tenant.id == settings.default_tenant).first()
        if fallback:
            set_current_tenant_id(fallback.id)
            request.state.tenant_id = fallback.id
            return TenantContext(fallback)

    raise HTTPException(status_code=400, detail="Unable to resolve tenant context")

    # Not reached

    # Set context var (any successful path returns earlier)



def tenant_meta_dict(ctx: TenantContext) -> dict:
    cfg = ctx.tenant.config or {}
    meta = {
        "tenant_id": ctx.id,
        "vertical": ctx.vertical,
        "features": cfg.get("features", {}),
        "branding": cfg.get("branding", {}),
        "name": ctx.tenant.name,
        "loyalty_type": ctx.tenant.loyalty_type,
    }
    # Allow vertical plugins to decorate meta in-place
    try:  # defensive: plugin errors shouldn't break core endpoint
        dispatch('decorate_tenant_meta', meta, ctx.tenant)
    except Exception:  # pragma: no cover - log future
        pass
    return meta

def set_current_tenant_id(tenant_id: str):  # utility used in dependency
    try:
        current_tenant_id.set(tenant_id)
    except LookupError:
        pass
