# backend/main.py

from config import settings
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from fastapi.encoders import jsonable_encoder
import time, hashlib, json
from starlette.middleware.base import BaseHTTPMiddleware

# Explicitly import each router
from app.plugins.auth.routes    import router as auth_router
from app.plugins.users.routes   import router as users_router
from app.plugins.catalog.routes import router as catalog_router
from app.plugins.loyalty.routes import router as loyalty_router
from app.plugins.orders.routes  import router as orders_router
from app.plugins.payments.routes import router as payments_router
from app.plugins.tenants.routes import router as tenants_router
from app.plugins.subscriptions import router as subscriptions_router
from app.plugins.dev            import router as dev_router
from app.plugins.analytics.routes import router as analytics_router
from app.plugins.admin.routes import router as admin_router
from app.routes.onboarding import router as onboarding_router
from app.routes.health import router as health_router
from app.routes.customers import router as customers_router
from app.routes.reports import router as reports_router
from app.routes.notifications import router as notifications_router
from app.routes.profile import router as profile_router
from app.core.tenant_context import get_tenant_context, tenant_meta_dict, TenantContext
from app.core.rate_limit import check_rate, compute_retry_after, build_429_payload
from app.core.rate_limit import bucket_snapshot  # used elsewhere optionally
from app.core.rate_limit import set_limit  # future use
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from app.core.database import get_db
from app.models import TenantBranding, Tenant as _Tenant
import os

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)  # allow automatic redirects on trailing slash

# Mount static directory (branding assets & SPA build output) early
class BrandingStaticFiles(StaticFiles):
    async def get_response(self, path, scope):  # override to inject cache headers
        resp: Response = await super().get_response(path, scope)
        # Long cache for branding hashed assets
        if path.startswith('branding/'):
            resp.headers.setdefault('Cache-Control', 'public, max-age=31536000, immutable')
        return resp

app.mount("/static", BrandingStaticFiles(directory=settings.static_dir or "static"), name="static")

# Middleware to add request timing header
class TimingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        start = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - start) * 1000
        response.headers['X-Query-Duration-ms'] = f"{elapsed_ms:.1f}"
        return response

app.add_middleware(TimingMiddleware)

# ─── Validation Error Handler ────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"validation_errors": exc.errors()}),
    )

   # ─── CORS ─────────────────────────────────────────────────────────────────────
allowed = [o.strip() for o in settings.allowed_origins.split(",")] if settings.allowed_origins else ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount plugin routers under /api
for prefix, router in [
    ("/api/auth",      auth_router),
    ("/api/users",     users_router),
    ("/api/catalog",   catalog_router),
    ("/api/loyalty",   loyalty_router),
    ("/api/orders",    orders_router),
    ("/api/payments",  payments_router),
    ("/api/tenants",   tenants_router),
    ("/api/subscriptions", subscriptions_router),
    ("/api/billing",   subscriptions_router),  # billing endpoints live in same router
    # NOTE: analytics_router already declares prefix="/analytics" in its APIRouter.
    # To avoid double prefix (/api/analytics/analytics/...), mount at just /api.
    ("/api",           analytics_router),
    ("/api",           admin_router),
    ("/api/dev",       dev_router),
    ("/api",           onboarding_router),
    ("",               health_router),  # Health checks at root level
    ("/api/customers", customers_router),
    ("/api/reports",   reports_router),
    ("/api/notifications", notifications_router),
    ("/api/profile",   profile_router),
]:
    app.include_router(router, prefix=prefix)

# ─── Public Tenant Metadata Endpoint (moved here from legacy app/main.py) ───
# NOTE: The project contains two FastAPI entrypoints (app/main.py and main.py).
# Running `uvicorn main:app` (as done in development) loads THIS file, so routes
# must be defined here. The /api/public/tenant-meta route previously lived only
# in app/main.py causing 404s. We replicate its logic here to restore parity.

def _etag_for(data: dict) -> str:
    dumped = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(dumped).hexdigest()[:16]

def _ip_key(request: Request) -> str:
    return (request.client.host if request.client else 'unknown')

@app.get("/api/public/tenant-meta")
def public_tenant_meta(request: Request, ctx: TenantContext = Depends(get_tenant_context)):
    """Public discovery endpoint for frontend.

    Returns lightweight tenant metadata (vertical, features, branding) resolved
    from Host header or X-Tenant-ID. Includes ETag + 60s public cache and a
    simple IP-based rate limit (capacity/window via settings).
    """
    from config import settings as _settings  # local import to avoid circulars
    ip_key = _ip_key(request)
    scope_name = "ip_public_meta"
    cap = _settings.rate_limit_public_meta_capacity
    win = _settings.rate_limit_public_meta_window_seconds
    if not check_rate(scope=scope_name, key=ip_key, capacity=cap, per_seconds=win):
        retry_after = compute_retry_after(scope_name, ip_key, cap, win)
        payload = build_429_payload(scope_name, retry_after, detail="Rate limit exceeded")
        resp = JSONResponse(status_code=429, content=payload)
        if retry_after:
            resp.headers["Retry-After"] = f"{int(retry_after)}"
        return resp
    # Expose tenant id to logging middleware (if present there)
    request.state.tenant_id = ctx.id
    data = tenant_meta_dict(ctx)
    etag = _etag_for(data)
    inm = request.headers.get('if-none-match')
    if inm == etag:
        from fastapi import Response
        resp = Response(status_code=304)
        resp.headers['ETag'] = etag
        resp.headers['Cache-Control'] = 'public, max-age=60'
        return resp
    resp = JSONResponse(content=data)
    resp.headers['Cache-Control'] = 'public, max-age=60'
    resp.headers['ETag'] = etag
    return resp

@app.get('/api/public/tenant-theme')
def public_tenant_theme(request: Request, ctx: TenantContext = Depends(get_tenant_context), db: Session = Depends(get_db)):
    """Lightweight branding/theme info for white-label bootstrap.

    Returns minimal fields required to paint initial shell (colors + logos).
    Cached similarly to /api/public/tenant-meta.
    """
    branding = db.query(TenantBranding).filter_by(tenant_id=ctx.id).first()
    tenant = db.query(_Tenant).filter_by(id=ctx.id).first()
    data = {
        'tenant_id': ctx.id,
        'public_name': (branding.public_name if branding else None) or (tenant.name if tenant else None),
        'short_name': branding.short_name if branding else None,
        'primary_color': (branding.primary_color if branding else None) or (tenant.theme_color if tenant else None),
        'secondary_color': branding.secondary_color if branding else None,
        'accent_color': branding.accent_color if branding else None,
        'logo_light_url': branding.logo_light_url if branding else None,
        'logo_dark_url': branding.logo_dark_url if branding else None,
        'favicon_url': branding.favicon_url if branding else None,
    }
    return data

@app.get('/api/public/tenant-manifest')
def public_tenant_manifest(request: Request, ctx: TenantContext = Depends(get_tenant_context), db: Session = Depends(get_db)):
    branding = db.query(TenantBranding).filter_by(tenant_id=ctx.id).first()
    icons = []
    base = f"/static/branding/{ctx.id}"
    # Collect common sizes if present
    for size in [64,128,256,512]:
        for field in ['logo_light','app_icon']:
            hashed_prefix = f"{field}-"  # matches generation pattern
            # naive file system scan
            dir_path = os.path.join(settings.static_dir or 'static','branding', ctx.id)
            if os.path.isdir(dir_path):
                for fname in os.listdir(dir_path):
                    if fname.startswith(f"{field}-") and f"-{size}" in fname:
                        icons.append({
                            'src': f"{base}/{fname}",
                            'sizes': f"{size}x{size}",
                            'type': 'image/png'
                        })
                        break
    manifest = {
        'name': (branding.public_name if branding else ctx.id) or ctx.id,
        'short_name': (branding.short_name if branding else ctx.id) or ctx.id,
        'theme_color': (branding.primary_color if branding else None) or '#3366ff',
        'background_color': '#ffffff',
        'display': 'standalone',
        'icons': icons,
        'id': ctx.id,
        'start_url': '/',
    }
    return manifest

# ─── Startup: create missing tables ───────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    # Create tables using shared Base and engine from the app core
    from app.core.database import Base, engine
    Base.metadata.create_all(bind=engine)
    # Ensure default tenant exists so public meta endpoint works in dev without manual seeding
    from sqlalchemy.orm import Session as _Session
    from sqlalchemy import select as _select
    from app.models import Tenant
    from config import settings as _settings
    if _settings.default_tenant:
        with _Session(bind=engine) as _db:
            exists = _db.execute(_select(Tenant).where(Tenant.id == _settings.default_tenant)).scalar_one_or_none()
            if not exists:
                t = Tenant(
                    id=_settings.default_tenant,
                    name="Default Tenant",
                    loyalty_type="basic",
                    vertical_type="carwash",
                    config={"features": {}, "branding": {"primaryColor": "#3366ff"}},
                )
                _db.add(t)
                try:
                    _db.commit()
                except Exception:
                    _db.rollback()
