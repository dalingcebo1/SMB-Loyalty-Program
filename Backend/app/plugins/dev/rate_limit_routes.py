from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from app.core.authz import developer_only
from app.core.rate_limit import (
    check_rate, compute_retry_after, build_429_payload,
    set_limit, delete_limit, list_overrides, bucket_snapshot, clear_ban as rl_clear_ban
)
from config import settings
from app.core.audit_safe import safe_audit
from app.core.errors import err

rate_router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

class RateLimitOverride(BaseModel):
    scope: str
    capacity: int
    per_seconds: float

@rate_router.get("/rl-test")
def dev_rate_limited_probe(request: Request):
    ip = request.client.host if request.client else 'unknown'
    scope = 'dev_rl_test'
    allowed = check_rate(scope, ip, capacity=3, per_seconds=60)
    if not allowed:
        ra = compute_retry_after(scope, ip, 3, 60)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=build_429_payload(scope, ra))
    return {"ok": True}

@rate_router.get("/rate-limits/config")
def current_rate_limits():
    snap = bucket_snapshot()
    snap["overrides"] = list_overrides()
    return snap

@rate_router.post("/rate-limits/config")
def override_rate_limit(body: RateLimitOverride):
    if not settings.enable_rate_limit_overrides:
        # Provide flat error body (tests expect top-level 'error')
        return JSONResponse(status_code=403, content=err("disabled", "Overrides disabled in this environment"))
    set_limit(body.scope, body.capacity, body.per_seconds)
    return {"updated": body.scope, "config": bucket_snapshot(include_penalties=False)["overrides"].get(body.scope)}

@rate_router.delete("/rate-limits/config/{scope}")
def delete_override(scope: str):
    if not settings.enable_rate_limit_overrides:
        return JSONResponse(status_code=403, content=err("disabled", "Overrides disabled in this environment"))
    existed = delete_limit(scope)
    return {"deleted": scope, "existed": existed}

@rate_router.get("/rate-limits/bans")
def list_bans():
    snap = bucket_snapshot()
    return {"bans": snap.get("bans", [])}

@rate_router.delete("/rate-limits/bans/{ip}")
def clear_ban(ip: str):
    existed = rl_clear_ban(ip)
    if existed:
        safe_audit("rate_limit.clear_ban", None, None, {"ip": ip})
    return {"ip": ip, "cleared": existed}
