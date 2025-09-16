# backend/main.py

from config import settings
from fastapi import FastAPI, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
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
from app.core.logging_config import configure_logging
from app.core.client_ip import get_client_ip
import logging
from sqlalchemy.orm import Session
from fastapi.responses import JSONResponse
from app.core.database import get_db
from app.models import TenantBranding, Tenant as _Tenant
import os
import tempfile

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)  # allow automatic redirects on trailing slash

# Configure logging (JSON in production, human readable elsewhere)
configure_logging()
logger = logging.getLogger("api")

# Optional Sentry initialization
if settings.sentry_dsn:
    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration
        sentry_logging = LoggingIntegration(level=logging.INFO, event_level=logging.ERROR)
        sentry_sdk.init(
            dsn=settings.sentry_dsn,
            environment=settings.environment,
            release=f"smb-loyalty@{settings.version}" if getattr(settings, 'version', None) else None,
            enable_tracing=True,
            traces_sample_rate=0.1,
            integrations=[FastApiIntegration(), sentry_logging],
        )
        logger.info("Sentry initialized")
    except Exception as _e:  # pragma: no cover
        logger.warning(f"Sentry init failed: {_e}")

# ─── Environment Validation ────────────────────────────────────────────────
def _validate_environment():
    """Perform basic production environment sanity checks.

    Fails fast on clearly unsafe misconfigurations rather than allowing the app
    to start in a degraded / insecure state.
    """
    from config import settings as _s  # local import to avoid circulars during tests
    errors = []
    if _s.environment == 'production':
        # Derive allowed_origins from frontend_url if missing or clearly unsafe
        derived_allowed = None
        invalid_allowed = (not _s.allowed_origins or _s.allowed_origins.strip() == '*' or '*,*' in _s.allowed_origins)
        if invalid_allowed and getattr(_s, 'frontend_url', None):
            # Use the scheme+host of frontend_url as a safe fallback
            import urllib.parse as _up
            try:
                parts = _up.urlparse(_s.frontend_url)
                if parts.scheme and parts.netloc:
                    derived_allowed = f"{parts.scheme}://{parts.netloc}"
            except Exception:  # pragma: no cover
                pass
            if derived_allowed:
                _s.allowed_origins = derived_allowed
                logger.warning("ENV_VALIDATION: ALLOWED_ORIGINS was invalid/missing; derived fallback from FRONTEND_URL=%s", derived_allowed)
                invalid_allowed = False
        if invalid_allowed:
            errors.append("ALLOWED_ORIGINS must be a non-wildcard, comma-separated list in production (no safe fallback possible)")
        # Secret key strength (length + simple entropy heuristic)
        # Correct field name is loyalty_secret (mapped from SECRET_KEY env)
        secret = getattr(_s, 'loyalty_secret', None)
        if not secret or len(secret) < 24:
            errors.append("SECRET_KEY must be set and >=24 chars in production")
        # Database URL required
        if not getattr(_s, 'database_url', None):
            errors.append("DATABASE_URL must be configured in production")
    if errors:
        for e in errors:
            logger.error(f"ENV_VALIDATION: {e}")
        # Raise single aggregated error for visibility
        raise RuntimeError("Environment validation failed: " + "; ".join(errors))
    else:
        logger.info("Environment validation passed")

# ─── Core Security & Performance Middleware (added) ──────────────────────────
# GZip responses for text/JSON to reduce bandwidth; level defaults good for API
app.add_middleware(GZipMiddleware, minimum_size=500)

# Trusted hosts (comma separated) only if configured to avoid blocking local dev
if settings.allowed_origins:
    # Derive hosts from allowed_origins (strip scheme/port) conservatively
    trusted_hosts = []
    for origin in settings.allowed_origins.split(','):
        o = origin.strip()
        if not o:
            continue
        # remove scheme
        o = o.replace('https://', '').replace('http://', '')
        # drop path
        o = o.split('/')[0]
        trusted_hosts.append(o)
    # Always allow localhost & 127.0.0.1 even in production to satisfy platform sidecar/probes using loopback
    # Include wildcard '*' to permit dynamic Azure revision FQDNs without 400 Host header rejections.
    trusted_hosts.extend(['localhost', '127.0.0.1', '*'])
    # starlette requires at least one host; wildcard if list empty
    if trusted_hosts:
        app.add_middleware(TrustedHostMiddleware, allowed_hosts=list(dict.fromkeys(trusted_hosts)))

# Enforce HTTPS in production (behind load balancer) but EXEMPT /health/* so platform probes
# using plain HTTP (common in container platforms) are not redirected with 307.
if settings.environment == 'production':
    class ConditionalHTTPSRedirectMiddleware(HTTPSRedirectMiddleware):
        async def __call__(self, scope, receive, send):  # type: ignore[override]
            if scope.get("type") == "http":
                path = scope.get("path", "")
                # Exempt health & metrics (if enabled) endpoints from redirect to avoid probe failures
                if path.startswith('/health/'):
                    return await self.app(scope, receive, send)
            return await super().__call__(scope, receive, send)

    app.add_middleware(ConditionalHTTPSRedirectMiddleware)

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

# ─── Security Headers Middleware ────────────────────────────────────────────
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        # Basic hardening; CSP kept relaxed for now (frontend served separately)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        response.headers.setdefault("Permissions-Policy", "geolocation=(), microphone=(), camera=()")
        # Only add HSTS when production and using HTTPS redirect to avoid dev issues
        if settings.environment == 'production':
            response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload")
            # Optional CSP if configured (explicit allowlist approach recommended for production)
            if settings.csp_policy:
                response.headers.setdefault("Content-Security-Policy", settings.csp_policy)
        return response

app.add_middleware(SecurityHeadersMiddleware)

# ─── Request ID Injection (if not already from proxy) ───────────────────────
import uuid
class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        rid = request.headers.get('X-Request-ID') or uuid.uuid4().hex[:12]
        request.state.request_id = rid
        response = await call_next(request)
        response.headers.setdefault('X-Request-ID', rid)
        return response

app.add_middleware(RequestIDMiddleware)

# Access log middleware (structured) - placed after RequestID so ID is available
class AccessLogMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start = time.perf_counter()
        try:
            response = await call_next(request)
            return response
        finally:
            duration_ms = (time.perf_counter() - start) * 1000
            rid = getattr(request.state, 'request_id', '-')
            tenant_id = getattr(request.state, 'tenant_id', '-')
            logging.getLogger('access').info(
                f"{request.method} {request.url.path} {getattr(response,'status_code',0)} {duration_ms:.1f}ms",
                extra={"request_id": rid, "tenant_id": tenant_id}
            )

app.add_middleware(AccessLogMiddleware)

# ─── Client IP Normalization (X-Forwarded-For) ─────────────────────────────
class ClientIPMiddleware(BaseHTTPMiddleware):
    """Derive the canonical client IP (best-effort) honoring X-Forwarded-For.

    This should run before rate limiting so buckets key on the real client IP
    when the service is behind one or more trusted reverse proxies / load balancers.
    """
    def __init__(self, app, max_forwarded=5):
        super().__init__(app)
        self.max_forwarded = max_forwarded

    async def dispatch(self, request: Request, call_next):
        xff = request.headers.get('x-forwarded-for') or request.headers.get('X-Forwarded-For')
        real_ip = None
        if xff:
            # Take first IP (client) after trimming list size to prevent abuse
            parts = [p.strip() for p in xff.split(',') if p.strip()][: self.max_forwarded]
            if parts:
                real_ip = parts[0]
        if not real_ip and request.client:
            real_ip = request.client.host
        request.state.client_ip = real_ip or 'unknown'
        return await call_next(request)

app.add_middleware(ClientIPMiddleware)

# Global per-IP rate limiting (coarse) ---------------------------------------
class GlobalAPIRateLimitMiddleware(BaseHTTPMiddleware):
    EXCLUDED_PREFIXES = ("/health", "/health/", "/static/", "/api/public/tenant-meta")

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if any(path == p or path.startswith(p) for p in self.EXCLUDED_PREFIXES):
            return await call_next(request)
        # Only enforce if configured (>0 capacity) and rate limits enabled
        cap = settings.rate_limit_global_capacity
        win = settings.rate_limit_global_window_seconds
        if cap <= 0:
            return await call_next(request)
        # Normalized IP via helper
        key = get_client_ip(request)
        scope = 'global_ip'
        if not check_rate(scope=scope, key=key, capacity=cap, per_seconds=win):
            retry_after = compute_retry_after(scope, key, cap, win)
            payload = build_429_payload(scope, retry_after, detail="Global rate limit exceeded")
            resp = JSONResponse(status_code=429, content=payload)
            if retry_after:
                resp.headers['Retry-After'] = f"{int(retry_after)}"
            return resp
        return await call_next(request)

app.add_middleware(GlobalAPIRateLimitMiddleware)

# ─── Global Generic Rate Limiter (simple per-IP) ───────────────────────────

# Mount plugin routers under /api
router_mounts = [
    ("/api/auth",      auth_router),
    ("/api/users",     users_router),
    ("/api/catalog",   catalog_router),
    ("/api/loyalty",   loyalty_router),
    ("/api/orders",    orders_router),
    ("/api/payments",  payments_router),
    ("/api/tenants",   tenants_router),
    ("/api/subscriptions", subscriptions_router),
    ("/api/billing",   subscriptions_router),  # billing endpoints live in same router
    ("/api",           analytics_router),  # analytics_router already has internal prefix
    ("/api",           admin_router),
    ("/api",           onboarding_router),
    ("",               health_router),  # Health checks at root level
    ("/api/customers", customers_router),
    ("/api/reports",   reports_router),
    ("/api/notifications", notifications_router),
    ("/api/profile",   profile_router),
]
# Conditionally include dev router outside production
if settings.environment != 'production':
    router_mounts.append(("/api/dev", dev_router))

for prefix, router in router_mounts:
    app.include_router(router, prefix=prefix)

# ─── Public Tenant Metadata Endpoint ───

def _etag_for(data: dict) -> str:
    dumped = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(dumped).hexdigest()[:16]

def _ip_key(request: Request) -> str:
    return get_client_ip(request)

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
    # Early environment safety checks (will raise and prevent startup on fatal issues)
    try:
        _validate_environment()
    except Exception:
        # Re-raise after logging so container/platform surfaces failure clearly
        logger.exception("Environment validation failed during startup")
        raise
    from app.core.database import Base, engine
    from config import settings as _settings
    if _settings.environment == 'production' and not _settings.csp_policy:
        logger.warning("Production environment without CSP policy configured; consider setting CSP_POLICY for stronger protection.")
    # In non-production environments allow automatic metadata create for convenience.
    if _settings.environment != 'production':
        Base.metadata.create_all(bind=engine)
    else:  # pragma: no cover - production path
        logger.info("Startup: skipping Base.metadata.create_all in production (use Alembic migrations).")

    # Dev-only default tenant seeding (skip in production)
    if _settings.environment != 'production' and _settings.default_tenant:
        from sqlalchemy.orm import Session as _Session
        from sqlalchemy import select as _select
        from app.models import Tenant
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

    # Firebase credentials materialization logic ---------------------------------
    try:
        if not os.environ.get('GOOGLE_APPLICATION_CREDENTIALS'):
            # If user supplied a direct path in settings, prefer that (legacy behavior)
            if settings.google_application_credentials:
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = settings.google_application_credentials
            # Else if inline JSON secret provided, write to a secure temp file
            elif getattr(settings, 'firebase_credentials_json', None):
                # Write once per process start
                fd, tmp_path = tempfile.mkstemp(prefix='firebase-', suffix='.json')
                with os.fdopen(fd, 'w') as fh:
                    fh.write(settings.firebase_credentials_json)  # raw JSON string
                # Tighten permissions (best-effort on *nix)
                try:
                    os.chmod(tmp_path, 0o600)
                except Exception:  # pragma: no cover
                    pass
                os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = tmp_path
                logger.info('Materialized Firebase credentials JSON to temp file')
    except Exception as e:  # pragma: no cover
        logger.warning(f"Failed to set Firebase credentials: {e}")
