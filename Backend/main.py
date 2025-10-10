# backend/main.py

from config import settings
from fastapi import FastAPI, Request, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from starlette.middleware.trustedhost import TrustedHostMiddleware
from starlette.middleware.httpsredirect import HTTPSRedirectMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.responses import Response
from fastapi.encoders import jsonable_encoder
from typing import Optional
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
from app.plugins.inventory.routes import router as inventory_router
from app.routes.onboarding import router as onboarding_router
from app.routes.health import router as health_router
from app.routes.customers import router as customers_router
from app.routes.reports import router as reports_router
from app.routes.notifications import router as notifications_router
from app.routes.profile import router as profile_router
from app.routes.secure import router as secure_router
from app.routes.ops import router as ops_router
from app.core.tenant_context import get_tenant_context, tenant_meta_dict, TenantContext
from app.core.rate_limit import check_rate, compute_retry_after, build_429_payload
from app.core.rate_limit import bucket_snapshot  # used elsewhere optionally
from app.core.rate_limit import set_limit  # future use
from app.core.logging_config import configure_logging
from app.core.client_ip import get_client_ip
import logging
from sqlalchemy.orm import Session
from sqlalchemy.exc import ProgrammingError, OperationalError, DatabaseError
from fastapi.responses import JSONResponse
from app.core.database import get_db
from models import Tenant as _Tenant
from app.models import TenantBranding
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

# Register vertical hooks early (no routes) so meta decoration is available in tests/runtime
try:
    from app.plugins.verticals.plugin import Plugin as _VerticalsPlugin
    _vp = _VerticalsPlugin()
    # This plugin only registers hooks (no routes), so it's safe to call directly
    _vp.register_routes(app)
    del _vp
except Exception:
    # Non-fatal: vertical hooks missing would only affect optional decorations
    pass

# Register observability plugin (routes + lightweight middleware)
try:
    from app.plugins.observability.plugin import Plugin as _ObsPlugin
    _op = _ObsPlugin()
    _op.register_routes(app)
    del _op
except Exception:
    # Optional – not critical for core API
    pass

# Register analytics jobs early without re-including routers to satisfy tests using jobs.enqueue
try:
    from app.plugins.analytics.plugin import _job_analytics_refresh
    from app.core import jobs as _jobs
    # Best-effort idempotent registration
    _jobs.register_job("analytics_refresh", _job_analytics_refresh)
except Exception:
    pass

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
        # If a regex is provided, we can accept that as configuration too
        if invalid_allowed and getattr(_s, 'allowed_origin_regex', None):
            invalid_allowed = False
        if invalid_allowed:
            errors.append("ALLOWED_ORIGINS must be a non-wildcard, comma-separated list in production (no safe fallback possible)")
        # Secret key strength (length + simple entropy heuristic)
        # Correct field name is loyalty_secret (mapped from SECRET_KEY env)
        secret = getattr(_s, 'loyalty_secret', None)
        if not secret or len(secret) < 24:
            errors.append("SECRET_KEY must be set and >=24 chars in production")
        # Database URL required and must be a real Postgres URL (no placeholders)
        dbu = getattr(_s, 'database_url', None)
        if not dbu:
            errors.append("DATABASE_URL must be configured in production")
        else:
            dbu_low = dbu.strip().lower()
            if dbu_low.startswith('sqlite:'):
                errors.append("DATABASE_URL points to sqlite; not allowed in production")
            # Very common placeholder tokens from templates
            if any(tok in dbu for tok in ("HOST", "USERNAME", "PASSWORD", "DBNAME", "<", ">")):
                errors.append("DATABASE_URL contains placeholder values (HOST/USERNAME/DBNAME/etc)")
            # Must be postgres or postgresql (optionally +psycopg2)
            import re as _re
            if not _re.match(r'^postgres(ql)?(\+psycopg2)?:\/\/', dbu_low):
                errors.append("DATABASE_URL must use postgres:// or postgresql:// scheme")
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

# Honor X-Forwarded-Proto / Forwarded headers from Azure front-end to prevent
# spurious self 307 redirects (redirect loop) when request already arrived via HTTPS.
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

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
                # Exempt health & metrics endpoints from redirect to avoid probe failures
                if path.startswith('/health/'):
                    return await self.app(scope, receive, send)

                # Extract host from ASGI headers
                host = None
                try:
                    headers = scope.get("headers") or []
                    for k, v in headers:
                        if k == b"host":
                            host = v.decode("latin-1").lower()
                            break
                except Exception:
                    host = None

                # Bypass HTTPS redirect for Azure Container Apps FQDN to avoid self-redirect loops
                # Some front-ends may terminate TLS and forward as HTTP without X-Forwarded-Proto,
                # causing a 307 back to the same URL repeatedly. The platform ingress already
                # enforces HTTPS (allowInsecure=false), so skipping here is safe.
                if host and host.endswith('.azurecontainerapps.io'):
                    return await self.app(scope, receive, send)

                # Use effective scheme (set by ProxyHeadersMiddleware) to avoid redirect loops.
                # Additionally, only force redirect when we are certain the original request
                # was over plain HTTP (X-Forwarded-Proto=http). If the header is missing,
                # assume the platform has already enforced HTTPS and do not redirect.
                if scope.get('scheme') == 'https':
                    return await self.app(scope, receive, send)

                # Check X-Forwarded-Proto header
                xf_proto = None
                try:
                    headers = scope.get("headers") or []
                    for k, v in headers:
                        if k == b"x-forwarded-proto":
                            xf_proto = v.decode("latin-1").lower()
                            break
                except Exception:
                    xf_proto = None

                # Regardless of header value, avoid server-side redirect to prevent loops.
                # TLS is enforced by the ingress (allowInsecure=false) and HSTS is set by app.
                return await self.app(scope, receive, send)


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
def _load_db_cors_patterns_if_enabled():
    """Optional dynamic CORS allowlist (disabled by default).

    If ENABLE_DB_CORS_ALLOWLIST=true and neither ALLOWED_ORIGINS nor ALLOWED_ORIGIN_REGEX
    are set, attempt to load patterns from DB. Keeps scope minimal and safe.
    """
    try:
        if not getattr(settings, 'enable_db_cors_allowlist', False):
            return None, None
        if settings.allowed_origins or getattr(settings, 'allowed_origin_regex', None):
            return None, None
        # Lazy import to avoid circular deps
        from app.core.database import get_db
        from sqlalchemy import text
        # We read within a short-lived session
        db = next(get_db())
        rows = db.execute(text("""
            SELECT pattern, is_regex
            FROM allowed_origins
            WHERE enabled = TRUE
            ORDER BY created_at ASC
        """)).fetchall()
        if not rows:
            return None, None
        # Separate regex and static patterns
        regexes = [r[0] for r in rows if r[1]]
        statics = [r[0] for r in rows if not r[1]]
        # Combine regexes into a single alternation if any
        regex = "|".join(regexes) if regexes else None
        return (statics or None), regex
    except Exception:
        # Fail closed to env-configured behavior if anything goes wrong
        return None, None

allowed = [o.strip() for o in settings.allowed_origins.split(",")] if settings.allowed_origins else []
origin_regex = getattr(settings, 'allowed_origin_regex', None)
# Optional DB-driven fallback if env is not set
if not allowed and not origin_regex:
    statics, regex = _load_db_cors_patterns_if_enabled()
    if statics:
        allowed = statics
    if regex:
        origin_regex = regex
if not allowed and settings.frontend_url:
    # Derive from FRONTEND_URL if not explicitly set
    import urllib.parse as _up
    try:
        parts = _up.urlparse(settings.frontend_url)
        if parts.scheme and parts.netloc:
            allowed = [f"{parts.scheme}://{parts.netloc}"]
    except Exception:
        pass
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed if allowed else [],
    allow_origin_regex=origin_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Security Headers Middleware ────────────────────────────────────────────

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
        response: Response | None = None
        try:
            response = await call_next(request)
            return response
        except HTTPException as exc:
            # Preserve HTTPException status codes; don't mask as 500
            duration_ms = (time.perf_counter() - start) * 1000
            rid = getattr(request.state, 'request_id', '-')
            tenant_id = getattr(request.state, 'tenant_id', '-')
            logging.getLogger('access').info(
                f"{request.method} {request.url.path} {exc.status_code} {duration_ms:.1f}ms",
                extra={"request_id": rid, "tenant_id": tenant_id}
            )
            # Re-raise to let FastAPI produce the proper response body
            raise
        except Exception:
            # Ensure we still emit an access log line even on exceptions
            # Response not yet available; synthesize status 500 for logging
            duration_ms = (time.perf_counter() - start) * 1000
            rid = getattr(request.state, 'request_id', '-')
            tenant_id = getattr(request.state, 'tenant_id', '-')
            logging.getLogger('access').info(
                f"{request.method} {request.url.path} 500 {duration_ms:.1f}ms",
                extra={"request_id": rid, "tenant_id": tenant_id}
            )
            # Let FastAPI handle generating a 500 response
            raise
        finally:
            if response is not None:
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
    EXCLUDED_PREFIXES = (
        "/health", "/health/", "/static/",
        "/api/public/tenant-meta", "/api/public/tenant-theme", "/api/public/tenant-manifest",
        "/tenant-theme",  # legacy alias if present
        "/docs", "/api/openapi.json", "/favicon.ico", "/robots.txt"
    )

    async def dispatch(self, request: Request, call_next):
        # Exclude OPTIONS and HEAD (preflight, health, etc.)
        if request.method in ("OPTIONS", "HEAD"):
            return await call_next(request)
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
    ("/api/inventory", inventory_router),
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
    ("/api",           secure_router),
    ("/api",           ops_router),
]
# Conditionally include dev router outside production
if settings.environment != 'production':
    router_mounts.append(("/api/dev", dev_router))

for prefix, router in router_mounts:
    app.include_router(router, prefix=prefix)

# ─── Root Landing Page (simple HTML) ────────────────────────────────────────
# Provides a human-friendly page instead of a generic 400/404 when visiting
# the base domain. Keeps it lightweight (no template engine).
LANDING_HTML = """<!DOCTYPE html><html lang=\"en\"><head><meta charset=\"UTF-8\" />
<title>SMB Loyalty API</title><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
<style>body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;margin:2rem;line-height:1.45;color:#222;}h1{margin-top:0;font-size:1.8rem;}code{background:#f4f4f6;padding:2px 4px;border-radius:4px;font-size:.9em;}a{color:#3366ff;text-decoration:none;}a:hover{text-decoration:underline;}footer{margin-top:3rem;font-size:.75rem;color:#666;} .grid{display:grid;gap:1rem;max-width:720px;} .card{padding:1rem;border:1px solid #e1e4e8;border-radius:8px;background:#fff;} .ok{color:#2e7d32;font-weight:600;} pre{background:#f7f7f9;padding:.75rem;border-radius:6px;overflow:auto;} </style>
</head><body>
<h1>SMB Loyalty Program API</h1>
<p>This service powers the SMB Loyalty / ChaosX platform.</p>
<div class=\"grid\">
    <div class=\"card\"><strong>Status:</strong> <span class=\"ok\">Healthy</span> (see <a href=\"/health/ready-lite\">/health/ready-lite</a>)</div>
    <div class=\"card\"><strong>OpenAPI:</strong> <a href=\"/api/openapi.json\">/api/openapi.json</a> &middot; <a href=\"/docs\">Swagger UI</a></div>
    <div class=\"card\"><strong>Public Tenant Meta:</strong> <a href=\"/api/public/tenant-meta\">/api/public/tenant-meta</a></div>
    <div class=\"card\"><strong>Version:</strong> v0.1</div>
</div>
<h2>Quick Checks</h2>
<pre>curl -sf $HOST/health/ready-lite
curl -s $HOST/api/openapi.json | jq '.info.version'</pre>
<footer>Generated at runtime – minimal static landing (no auth). &copy; SMB Loyalty</footer>
</body></html>"""

@app.get("/", include_in_schema=False)
async def root_landing():
        return Response(content=LANDING_HTML, media_type="text/html")

# ─── Public Tenant Metadata Endpoint ───

def _etag_for(data: dict) -> str:
    dumped = json.dumps(data, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(dumped).hexdigest()[:16]

def _ip_key(request: Request) -> str:
    return get_client_ip(request)

def _normalize_host(h: str | None) -> str:
    if not h:
        return ""
    h = h.split(":")[0].strip().lower()
    if h.startswith("www."):
        h = h[4:]
    return h

def _strip_api_prefix(h: str) -> str:
    return h[4:] if h.startswith("api.") and len(h) > 4 else h

def _resolve_public_tenant(request: Request, db: Session) -> Optional[TenantContext]:
    """Public-safe tenant resolver with production default fallback.

    Attempts:
      1) X-Tenant-ID explicit header
      2) X-Forwarded-Host / Forwarded host= / Host / Origin host
         - tries exact primary_domain, then subdomain (first label) match
      3) In production, if still unresolved and default_tenant is set, use it
    
    Returns None if no tenant found, allowing endpoints to handle gracefully.
    """
    # 1) Explicit header
    x_tid = request.headers.get("x-tenant-id") or request.headers.get("X-Tenant-ID")
    if x_tid:
        t = db.query(_Tenant).filter_by(id=x_tid).first()
        if not t:
            return None  # Let caller handle missing tenant gracefully
        request.state.tenant_id = t.id
        return TenantContext(t)

    # Build candidate hosts
    candidates: list[str] = []
    xfwd = request.headers.get("x-forwarded-host") or request.headers.get("X-Forwarded-Host")
    if xfwd:
        xfwd = xfwd.split(",")[0].strip()
        h = _normalize_host(xfwd)
        if h:
            candidates.append(h)
            s = _strip_api_prefix(h)
            if s and s != h:
                candidates.append(s)
    fwd = request.headers.get("forwarded") or request.headers.get("Forwarded")
    if fwd:
        for part in fwd.split(";"):
            p = part.strip()
            if p.startswith("host="):
                h = _normalize_host(p[5:].strip())
                if h:
                    candidates.append(h)
                    s = _strip_api_prefix(h)
                    if s and s != h:
                        candidates.append(s)
    host_hdr = request.headers.get("host", "")
    host_norm = _normalize_host(host_hdr)
    if host_norm:
        candidates.append(host_norm)
        s = _strip_api_prefix(host_norm)
        if s and s != host_norm:
            candidates.append(s)
    origin_hdr = request.headers.get("origin") or request.headers.get("Origin")
    if origin_hdr:
        try:
            from urllib.parse import urlparse
            oh = _normalize_host(urlparse(origin_hdr).netloc)
            if oh:
                candidates.append(oh)
                s = _strip_api_prefix(oh)
                if s and s != oh:
                    candidates.append(s)
        except Exception:
            pass

    # Deduplicate
    seen = set()
    ordered = []
    for c in candidates:
        if c and c not in seen:
            seen.add(c)
            ordered.append(c)

    # Try primary_domain lookup
    for h in ordered:
        try:
            t = db.query(_Tenant).filter_by(primary_domain=h).first()
        except (ProgrammingError, OperationalError, DatabaseError) as exc:
            logger.warning(
                "tenant lookup failed; returning no-tenant",
                extra={"host": h},
                exc_info=exc,
            )
            try:
                db.rollback()
            except Exception:
                pass
            return None
        if t:
            request.state.tenant_id = t.id
            return TenantContext(t)

    # Production fallback to default tenant
    if settings.environment == 'production' and settings.default_tenant:
        try:
            t = db.query(_Tenant).filter_by(id=settings.default_tenant).first()
        except (ProgrammingError, OperationalError, DatabaseError) as exc:
            logger.warning(
                "default tenant lookup failed; returning no-tenant",
                extra={"default_tenant": settings.default_tenant},
                exc_info=exc,
            )
            try:
                db.rollback()
            except Exception:
                pass
            return None
        if t:
            request.state.tenant_id = t.id
            return TenantContext(t)

    return None  # No tenant found, let caller handle gracefully

@app.get("/api/public/tenant-meta")
def public_tenant_meta(request: Request, db: Session = Depends(get_db)):
    """Public discovery endpoint for frontend.

    Returns lightweight tenant metadata (vertical, features, branding) resolved
    from Host header or X-Tenant-ID. Includes ETag + 60s public cache and a
    simple IP-based rate limit (capacity/window via settings).
    """
    from config import settings as _settings  # local import to avoid circulars
    # Resolve tenant context with production fallback to avoid 500s
    ctx = _resolve_public_tenant(request, db)
    
    # Handle missing tenant gracefully instead of causing 500 error
    if ctx is None:
        return JSONResponse(
            status_code=404,
            content={"error": "tenant_not_found", "detail": "No tenant available for this request"}
        )
    
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
def public_tenant_theme(request: Request, db: Session = Depends(get_db)):
    """Lightweight branding/theme info for white-label bootstrap.

    Returns minimal fields required to paint initial shell (colors + logos).
    Cached similarly to /api/public/tenant-meta.
    """
    # Resolve tenant context with production fallback to avoid 500s
    ctx = _resolve_public_tenant(request, db)
    if ctx is None:
        return JSONResponse(
            status_code=404,
            content={"error": "tenant_not_found", "detail": "No tenant available for this request"},
        )
    try:
        branding = db.query(TenantBranding).filter_by(tenant_id=ctx.id).first()
    except (ProgrammingError, OperationalError, DatabaseError) as exc:
        logger.warning("tenant branding lookup failed", extra={"tenant_id": ctx.id}, exc_info=exc)
        try:
            db.rollback()
        except Exception:
            pass
        branding = None
    try:
        tenant = db.query(_Tenant).filter_by(id=ctx.id).first()
    except (ProgrammingError, OperationalError, DatabaseError) as exc:
        logger.warning("tenant lookup failed", extra={"tenant_id": ctx.id}, exc_info=exc)
        try:
            db.rollback()
        except Exception:
            pass
        tenant = None
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
def public_tenant_manifest(request: Request, db: Session = Depends(get_db)):
    """Return a lightweight web manifest for the active tenant."""
    ctx = _resolve_public_tenant(request, db)
    if ctx is None:
        return JSONResponse(
            status_code=404,
            content={"error": "tenant_not_found", "detail": "No tenant available for this request"},
        )
    try:
        branding = db.query(TenantBranding).filter_by(tenant_id=ctx.id).first()
    except (ProgrammingError, OperationalError, DatabaseError) as exc:
        logger.warning("tenant branding lookup failed", extra={"tenant_id": ctx.id}, exc_info=exc)
        try:
            db.rollback()
        except Exception:
            pass
        branding = None

    icons: list[dict[str, str]] = []
    branding_base = f"/static/branding/{ctx.id}"
    dir_path = os.path.join(settings.static_dir or 'static', 'branding', ctx.id)

    if os.path.isdir(dir_path):
        available_files = set(os.listdir(dir_path))
        for size in [64, 128, 256, 512]:
            for field in ['logo_light', 'app_icon']:
                prefix = f"{field}-"
                match = next(
                    (
                        fname
                        for fname in available_files
                        if fname.startswith(prefix) and f"-{size}" in fname
                    ),
                    None,
                )
                if match:
                    icons.append(
                        {
                            'src': f"{branding_base}/{match}",
                            'sizes': f"{size}x{size}",
                            'type': 'image/png',
                        }
                    )
                    break  # prefer the first matching asset per size

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

@app.get('/api/debug/seed-default-tenant')
def debug_seed_default_tenant():
    """Emergency endpoint to seed default tenant. Remove after fix."""
    try:
        # Import and run the raw SQL seeding script
        import sys
        from pathlib import Path
        
        # Add scripts path
        scripts_path = Path(__file__).parent / "scripts"
        sys.path.insert(0, str(scripts_path))
        
        # Import and run the raw seeding function
        from seed_default_tenant_raw import seed_default_tenant_raw
        seed_default_tenant_raw()
        
        return {"success": True, "message": "Default tenant seeding completed"}
    except Exception as e:
        return {"success": False, "error": str(e), "traceback": str(e.__traceback__)}

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

    # Default tenant seeding (idempotent) – now runs in ALL environments for reliability.
    if _settings.default_tenant:
        try:
            _ensure_default_tenant(_settings.default_tenant)
        except Exception:  # pragma: no cover - defensive guard
            logger.warning("Failed to ensure default tenant exists", exc_info=True)

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


# --- Helper: ensure default tenant exists -------------------------------------
def _ensure_default_tenant(tenant_id: str):
    """Create the default tenant row if missing (safe/idempotent).

    Runs at startup so public endpoints like /api/public/tenant-meta
    don't 500 on completely fresh production databases.
    """
    from sqlalchemy.orm import Session as _Session
    from sqlalchemy import select as _select
    from app.core.database import engine
    from models import Tenant
    with _Session(bind=engine) as _db:
        exists = _db.execute(_select(Tenant).where(Tenant.id == tenant_id)).scalar_one_or_none()
        if exists:
            return
        t = Tenant(
            id=tenant_id,
            name="Default Tenant",
            loyalty_type="basic",
            vertical_type="carwash",
            config={"features": {}, "branding": {"primaryColor": "#3366ff"}},
        )
        _db.add(t)
        try:
            _db.commit()
            logger.info("Startup: created missing default tenant '%s'", tenant_id)
        except Exception:
            _db.rollback()
            raise
