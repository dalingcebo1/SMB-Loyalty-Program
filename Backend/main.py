# backend/main.py

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

# Explicitly import each router
from routes.auth    import router as auth_router
from users   import router as users_router
from routes.catalog import router as catalog_router
from routes.loyalty import router as loyalty_router
from routes.orders  import router as orders_router
from routes.payments import router as payments_router
from routes import auth

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)

# ─── Validation Error Handler ────────────────────────────────────────────────
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content=jsonable_encoder({"validation_errors": exc.errors()}),
    )

# ─── CORS ─────────────────────────────────────────────────────────────────────
origins = os.getenv("ALLOWED_ORIGINS", "")
allowed = [o.strip() for o in origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Mount routers under /api ─────────────────────────────────────────────────
app.include_router(auth_router,     prefix="/api")
app.include_router(users_router,    prefix="/api")
app.include_router(catalog_router,  prefix="/api")
app.include_router(loyalty_router,  prefix="/api")
app.include_router(orders_router,   prefix="/api")
app.include_router(payments_router, prefix="/api")
app.include_router(auth.router, prefix="/api/auth")

# ─── Startup: create missing tables ───────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
