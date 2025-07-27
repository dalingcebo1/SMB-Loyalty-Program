# backend/main.py

from config import settings
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

# Explicitly import each router
from app.plugins.auth.routes    import router as auth_router
from app.plugins.users.routes   import router as users_router
from app.plugins.catalog.routes import router as catalog_router
from app.plugins.loyalty.routes import router as loyalty_router
from app.plugins.orders.routes  import router as orders_router
from app.plugins.payments.routes import router as payments_router
from app.plugins.tenants.routes import router as tenants_router
from app.plugins.dev.routes     import router as dev_router

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)  # allow automatic redirects on trailing slash

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

# ─── Mount plugin routers under /api ────────────────────────────────────────────
for prefix, router in [
    ("/api/auth",     auth_router),
    ("/api/users",    users_router),
    ("/api/catalog",  catalog_router),
    ("/api/loyalty",  loyalty_router),
    ("/api/orders",   orders_router),
    ("/api/payments", payments_router),
    ("/api/tenants",  tenants_router),
    ("/api/dev",      dev_router),
]:
    app.include_router(router, prefix=prefix)
# Legacy mount: support old /api/users/users prefix for backward compatibility
app.include_router(users_router, prefix="/api/users/users")
# Explicit legacy endpoints for backwards compatibility
from app.plugins.users.routes import add_vehicle, delete_vehicle, VehicleIn, VehicleOut
from app.core.database import get_db
from app.plugins.auth.routes import require_staff
from sqlalchemy.orm import Session
from fastapi import Depends

@app.post(
    "/api/users/users/{user_id}/vehicles",
    dependencies=[Depends(require_staff)],
    response_model=VehicleOut,
    status_code=201
)
def add_vehicle_legacy(user_id: int, vehicle: VehicleIn, db: Session = Depends(get_db)):
    return add_vehicle(user_id, vehicle, db)

@app.delete(
    "/api/users/users/{user_id}/vehicles/{vehicle_id}",
    dependencies=[Depends(require_staff)]
)
def delete_vehicle_legacy(user_id: int, vehicle_id: int, db: Session = Depends(get_db)):
    return delete_vehicle(user_id, vehicle_id, db)

# ─── Startup: create missing tables ───────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
