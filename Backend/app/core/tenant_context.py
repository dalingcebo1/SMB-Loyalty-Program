"""Tenant context resolution dependency.

Resolves the active tenant for a request based on one of (precedence order):
 1. X-Tenant-ID header (explicit override, useful for internal tools)
 2. Host header full domain match against tenants.primary_domain
 3. Subdomain match (foo.example.com -> foo against tenants.subdomain)

If none are found raises 400/404 accordingly.
"""
from fastapi import Header, Request, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
import contextvars

from app.core.database import get_db
from app.models import Tenant, VerticalType


current_tenant_id: contextvars.ContextVar[str | None] = contextvars.ContextVar("current_tenant_id", default=None)


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

    tenant = None

    # 1) Header explicit
    if x_tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == x_tenant_id).first()
        if not tenant:
            raise HTTPException(status_code=404, detail="Tenant not found (header)")
        set_current_tenant_id(tenant.id)
        return TenantContext(tenant)

    # 2) Full primary domain match
    if not tenant and hostname:
        tenant = db.query(Tenant).filter(Tenant.primary_domain == hostname).first()
        if tenant:
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
