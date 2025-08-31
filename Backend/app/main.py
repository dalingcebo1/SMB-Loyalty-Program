from config import settings
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging, time, uuid
from fastapi.encoders import jsonable_encoder

from app.core.plugin_manager import PluginManager
from app.core.tenant_context import get_tenant_context, tenant_meta_dict, TenantContext
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rate_limit import check_rate, compute_retry_after
from app.core.rate_limit import set_limit
from app.plugins.auth.routes import get_current_user
from app.models import User

# Initialize FastAPI
app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)

# Validation Error Handler
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"validation_errors": exc.errors()}),
    )

    # CORS
origins = settings.allowed_origins.split(",") if settings.allowed_origins else []
allowed = [o.strip() for o in origins if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Plugin registration
plugin_manager = PluginManager(app)
plugin_manager.register_models()
plugin_manager.register_routes()

# --- Structured logging setup ---
logger = logging.getLogger("app")
if not logger.handlers:
    handler = logging.StreamHandler()
    formatter = logging.Formatter('%(asctime)s %(levelname)s %(message)s')
    handler.setFormatter(formatter)
    logger.addHandler(handler)
logger.setLevel(logging.INFO)

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    rid = request.headers.get('X-Request-ID') or uuid.uuid4().hex[:12]
    start = time.time()
    # simple IP key for rate limit (public endpoint handled separately below)
    request.state.request_id = rid
    response = None
    try:
        response = await call_next(request)
        return response
    except Exception as e:
        # Create minimal error response placeholder for logging context only
        class _Err: status_code = 500
        response = _Err()  # type: ignore
        raise
    finally:
        duration_ms = int((time.time() - start) * 1000)
        tenant_id = getattr(request.state, 'tenant_id', '-')
        logger.info(f"rid={rid} method={request.method} path={request.url.path} status={getattr(response,'status_code','?')} dur_ms={duration_ms} tenant={tenant_id}")
        if hasattr(response, 'headers'):
            try:
                response.headers['X-Request-ID'] = rid  # type: ignore[attr-defined]
            except Exception:
                pass
# Legacy user vehicle endpoints for backward compatibility
import hashlib, json

def _etag_for(data: dict) -> str:
    # Stable JSON dump to produce content hash
    dumped = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(dumped).hexdigest()[:16]

def _ip_key(request: Request):
    return (request.client.host if request.client else 'unknown')

@app.get("/api/public/tenant-meta")
def public_tenant_meta(request: Request, ctx: TenantContext = Depends(get_tenant_context)):
    """Public endpoint for frontend to discover vertical + feature flags by domain.

    Adds short-lived caching headers and light rate limiting.
    """
    ip_key = _ip_key(request)
    # Inline rate limiting (capacity 60 per 60s per IP)
    scope_name = "ip_public_meta"
    cap = settings.rate_limit_public_meta_capacity
    win = settings.rate_limit_public_meta_window_seconds
    if not check_rate(scope=scope_name, key=ip_key, capacity=cap, per_seconds=win):
        retry_after = compute_retry_after(scope_name, ip_key, cap, win)
        resp = JSONResponse(status_code=429, content={"detail": "Rate limit exceeded", "scope": scope_name})
        if retry_after:
            resp.headers["Retry-After"] = f"{int(retry_after)}"
        return resp
    request.state.tenant_id = ctx.id
    data = tenant_meta_dict(ctx)
    etag = _etag_for(data)
    inm = request.headers.get('if-none-match')
    if inm == etag:
        # Not modified
        resp = JSONResponse(status_code=304, content=None)
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp
    resp = JSONResponse(content=data)
    resp.headers['Cache-Control'] = 'public, max-age=60'
    resp.headers['ETag'] = etag
    return resp


@app.get("/api/secure/ping")
def secure_ping(
    ctx: TenantContext = Depends(get_tenant_context),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Enforce tenant/user consistency
    if user.tenant_id != ctx.id:
        return JSONResponse(status_code=403, content={"detail": "Cross-tenant access forbidden"})
    # Per-user within tenant rate limit: 30 per 60s (scope user_tenant)
    user_scope = "user_tenant"
    key = f"{user.id}:{ctx.id}"
    u_cap = settings.rate_limit_user_tenant_capacity
    u_win = settings.rate_limit_user_tenant_window_seconds
    if not check_rate(user_scope, key, capacity=u_cap, per_seconds=u_win):
        ra = compute_retry_after(user_scope, key, u_cap, u_win)
        resp = JSONResponse(status_code=429, content={"detail": "User/Tenant rate limit", "scope": user_scope})
        if ra:
            resp.headers["Retry-After"] = f"{int(ra)}"
        return resp
    return {"ok": True, "tenant": ctx.id, "vertical": ctx.vertical}
from app.plugins.users.routes import add_vehicle, delete_vehicle, VehicleOut
from app.plugins.auth.routes import require_staff
# POST /api/users/users/{user_id}/vehicles
app.post(
    "/api/users/users/{user_id}/vehicles",
    response_model=VehicleOut,
    status_code=201,
    dependencies=[Depends(require_staff)]
)(add_vehicle)
# DELETE /api/users/users/{user_id}/vehicles/{vehicle_id}
app.delete(
    "/api/users/users/{user_id}/vehicles/{vehicle_id}",
    dependencies=[Depends(require_staff)]
)(delete_vehicle)

# --- Analytics snapshot refresh (developer only placeholder) ---
from fastapi import BackgroundTasks
from app.plugins.auth.routes import require_admin

def _recompute_metrics(tenant_id: str):  # pragma: no cover (placeholder)
    # TODO: implement actual aggregation logic
    logger.info(f"metrics recompute start tenant={tenant_id}")
    time.sleep(0.1)
    logger.info(f"metrics recompute done tenant={tenant_id}")

@app.post("/api/dev/analytics/{tenant_id}/refresh", dependencies=[Depends(require_admin)])
def refresh_analytics(tenant_id: str, background: BackgroundTasks):
    background.add_task(_recompute_metrics, tenant_id)
    return {"accepted": True, "tenant": tenant_id}
