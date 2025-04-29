import os
import datetime
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import Base, engine
from routes.loyalty import router as loyalty_router
from routes.catalog import router as catalog_router
from routes.orders import router as orders_router
from routes.payments import router as payments_router

# load .env (SECRET_KEY, FRONTEND_ORIGINS, TENANT_ID, etc.)
load_dotenv()

app = FastAPI(title="SMB Loyalty Program", version="0.1")

# configure CORS
origins = os.getenv("FRONTEND_ORIGINS", "*").split(",")
if origins == [""]:
    origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# create all tables on startup
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

# mount our routers
app.include_router(loyalty_router, prefix="/loyalty", tags=["Loyalty"])
app.include_router(catalog_router, prefix="/catalog", tags=["Catalog"])
app.include_router(orders_router, prefix="/orders", tags=["Orders"])
app.include_router(payments_router, prefix="/payments", tags=["Payments"])

@app.get("/health")
def health_check():
    return {"status": "ok"}
