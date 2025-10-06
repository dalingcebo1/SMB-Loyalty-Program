from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from app.plugins.auth.routes import get_current_user
from app.core.tenant_context import get_tenant_context, TenantContext
from app.core.rate_limit import check_rate, compute_retry_after, build_429_payload
from app.models import User
from config import settings

router = APIRouter(prefix="/secure", tags=["secure"])


@router.get("/ping")
def secure_ping(
    request: Request,
    ctx: TenantContext = Depends(get_tenant_context),
    current: User = Depends(get_current_user),
):
    """Authenticated health probe used by tests and rate-limit validation.

    Enforces a per user+tenant rate limit using the configurable
    RATE_LIMIT_USER_TENANT_* settings (overridable at runtime via dev tools).
    """
    # Expose tenant id for access logs if middleware reads it later
    request.state.tenant_id = ctx.id

    scope = f"user_tenant:{ctx.id}"
    key = str(current.id or current.email)
    rate_limit = ctx.settings.get_rate_limit(
        scope="user_tenant",
        default_capacity=settings.rate_limit_user_tenant_capacity,
        default_window=settings.rate_limit_user_tenant_window_seconds,
    )
    cap = rate_limit.capacity
    win = rate_limit.window_seconds

    if not check_rate(scope=scope, key=key, capacity=cap, per_seconds=win):
        retry_after = compute_retry_after(scope, key, cap, win)
        payload = build_429_payload(scope, retry_after, detail="Per user+tenant limit exceeded")
        resp = JSONResponse(status_code=429, content=payload)
        if retry_after:
            resp.headers["Retry-After"] = f"{int(retry_after)}"
        return resp

    return {"ok": True, "tenant": ctx.id, "user_id": current.id}
