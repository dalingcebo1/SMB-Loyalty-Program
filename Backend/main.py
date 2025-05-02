import os 
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import catalog, loyalty, orders
from routes import auth  
from routes.payments import router as payments

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)

# CORS: allow all origins listed in ALLOWED_ORIGINS
origins = os.getenv("ALLOWED_ORIGINS", "")
allowed = [o.strip() for o in origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
app.include_router(loyalty.router,  prefix="/api")
app.include_router(catalog.router,  prefix="/api")
app.include_router(orders.router,   prefix="/api") 
# app.include_router(orders.payments, prefix="/api")
app.include_router(auth.router,     prefix="/api")   # <-- mount /api/auth
app.include_router(payments,       prefix="/api")

@app.on_event("startup")
def on_startup():
    # create any missing tables
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
