import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import catalog, loyalty, orders, auth
from routes.payments import router as payments
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)

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

# ─── ROUTERS ──────────────────────────────────────────────────────────────────
# All of these routers have their own prefix (e.g. auth.router prefix="/auth"),
# so mounting them under "/api" yields endpoints like "/api/auth/signup", etc.
app.include_router(auth.router,     prefix="/api")
app.include_router(catalog.router,  prefix="/api")
app.include_router(loyalty.router,  prefix="/api")
app.include_router(orders.router,   prefix="/api")
app.include_router(payments,        prefix="/api")

@app.on_event("startup")
def on_startup():
    # create any missing tables
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
