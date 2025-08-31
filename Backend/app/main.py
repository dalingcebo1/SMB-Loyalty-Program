from config import settings
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
import logging, time, uuid
from fastapi.encoders import jsonable_encoder

from app.core.plugin_manager import PluginManager
from app.core.tenant_context import get_tenant_context, tenant_meta_dict, TenantContext
from fastapi import Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
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

RATE_LIMIT_BUCKET = {}
RATE_LIMIT_WINDOW = 60  # seconds
RATE_LIMIT_MAX = 120    # basic protection for public tenant-meta

@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    rid = request.headers.get('X-Request-ID') or uuid.uuid4().hex[:12]
    start = time.time()
    # simple IP key for rate limit (public endpoint handled separately below)
    request.state.request_id = rid
    try:
        response = await call_next(request)
    finally:
        duration_ms = int((time.time() - start) * 1000)
        tenant_id = getattr(request.state, 'tenant_id', '-')
        logger.info(f"rid={rid} method={request.method} path={request.url.path} status={getattr(response,'status_code','?')} dur_ms={duration_ms} tenant={tenant_id}")
    response.headers['X-Request-ID'] = rid
    return response
# Legacy user vehicle endpoints for backward compatibility
import hashlib, json

def _etag_for(data: dict) -> str:
    # Stable JSON dump to produce content hash
    dumped = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(dumped).hexdigest()[:16]

@app.get("/api/public/tenant-meta")
def public_tenant_meta(request: Request, ctx: TenantContext = Depends(get_tenant_context)):
    """Public endpoint for frontend to discover vertical + feature flags by domain.

    Adds short-lived caching headers and light rate limiting.
    """
    # rate limit (IP-based naive bucket)
    ip = request.client.host if request.client else 'unknown'
    now = time.time()
    bucket = RATE_LIMIT_BUCKET.get(ip) or []
    bucket = [t for t in bucket if now - t < RATE_LIMIT_WINDOW]
    if len(bucket) >= RATE_LIMIT_MAX:
        return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded"})
    bucket.append(now)
    RATE_LIMIT_BUCKET[ip] = bucket
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
