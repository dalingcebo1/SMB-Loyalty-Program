# backend/main.py

from config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder
import time
from starlette.middleware.base import BaseHTTPMiddleware

# Explicitly import each router
from app.plugins.auth.routes    import router as auth_router
from app.plugins.users.routes   import router as users_router
from app.plugins.catalog.routes import router as catalog_router
from app.plugins.loyalty.routes import router as loyalty_router
from app.plugins.orders.routes  import router as orders_router
from app.plugins.payments.routes import router as payments_router
from app.plugins.tenants.routes import router as tenants_router
from app.plugins.dev.routes     import router as dev_router
from app.plugins.analytics.routes import router as analytics_router

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)  # allow automatic redirects on trailing slash

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
    ("/api/analytics", analytics_router),
    ("/api/dev",       dev_router),
]:
    app.include_router(router, prefix=prefix)

# ─── Startup: create missing tables ───────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    # Create tables using shared Base and engine from the app core
    from app.core.database import Base, engine
    Base.metadata.create_all(bind=engine)
