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

from app.core.database import get_db
from app.models import Tenant, VerticalType
from config import settings


current_tenant_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_tenant_id", default=None)

# Simple in-process LRU-ish cache for domain-> tenant id resolution to cut DB lookups.
# (key is normalized host). Not multi-process safe; fine for single worker dev / small scale.
_TENANT_CACHE: Dict[str, Tuple[str, float]] = {}
_TENANT_CACHE_TTL = 60  # seconds
_TENANT_CACHE_MAX = 512

def _cache_get(host: str) -> Optional[str]:
    entry = _TENANT_CACHE.get(host)
    if not entry:
        return None
    tid, ts = entry
    if time.time() - ts > _TENANT_CACHE_TTL:
        _TENANT_CACHE.pop(host, None)
        return None
    return tid

def _cache_set(host: str, tenant_id: str):
    if len(_TENANT_CACHE) >= _TENANT_CACHE_MAX:
        # drop oldest (inefficient but small size)
        oldest = min(_TENANT_CACHE.items(), key=lambda kv: kv[1][1])[0]
        _TENANT_CACHE.pop(oldest, None)
    _TENANT_CACHE[host] = (tenant_id, time.time())


class TenantContext:
    def __init__(self, tenant: Tenant):
        self.tenant = tenant
        self.id = tenant.id
        self.vertical = tenant.vertical_type or VerticalType.carwash.value


async def get_tenant_context(
    request: Request,
    db: Session = Depends(get_db),
    x_tenant_id: Optional[str] = Header(default=None, alias="X-Tenant-ID"),
) -> TenantContext:
    host = request.headers.get("host", "")
    hostname = host.split(":")[0].lower()
    # Normalize: strip leading www.
    if hostname.startswith("www."):
        hostname = hostname[4:]

    tenant = None

    # 1) Header explicit
    if x_tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == x_tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found (header)")
        set_current_tenant_id(tenant.id)
        return TenantContext(tenant)

    # 2) Full primary domain match (with cache)
    if hostname:
        cached_id = _cache_get(hostname)
        if cached_id:
            tenant = db.query(Tenant).filter(Tenant.id == cached_id).first()
            if tenant:
                set_current_tenant_id(tenant.id)
                return TenantContext(tenant)
        tenant = db.query(Tenant).filter(Tenant.primary_domain == hostname).first()
        if tenant:
            _cache_set(hostname, tenant.id)
            set_current_tenant_id(tenant.id)
            return TenantContext(tenant)

    # 3) Subdomain extraction (foo.example.com) if we keep a configured root domain
    parts = hostname.split('.') if hostname else []
    if len(parts) > 2:
        sub = parts[0]
        tenant = db.query(Tenant).filter(Tenant.subdomain == sub).first()
        if tenant:
            set_current_tenant_id(tenant.id)
            return TenantContext(tenant)

    # 4) Optional fallback default tenant (configurable) for public pages / bootstrap
    if settings.default_tenant:
        fallback = db.query(Tenant).filter(Tenant.id == settings.default_tenant).first()
        if fallback:
            set_current_tenant_id(fallback.id)
            return TenantContext(fallback)

    raise HTTPException(status_code=400, detail="Unable to resolve tenant context")

    # Not reached

    # Set context var (any successful path returns earlier)



def tenant_meta_dict(ctx: TenantContext) -> dict:
    cfg = ctx.tenant.config or {}
    return {
        "tenant_id": ctx.id,
        "vertical": ctx.vertical,
        "features": cfg.get("features", {}),
        "branding": cfg.get("branding", {}),
        "name": ctx.tenant.name,
        "loyalty_type": ctx.tenant.loyalty_type,
    }

def set_current_tenant_id(tenant_id: str):  # utility used in dependency
    try:
        current_tenant_id.set(tenant_id)
    except LookupError:
        pass
