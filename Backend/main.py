# Backend/main.py

import os
from dotenv import load_dotenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, Base
from routes.loyalty import router as loyalty_router
from routes.catalog import router as catalog_router
from routes.orders import router as orders_router
from routes.payments import router as payments_router

# 1) Load .env before we pull ALLOWED_ORIGINS
load_dotenv()

# 2) Create the FastAPI app
app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    description="A loyalty program for small and medium businesses",
)

# 3) Global CORS middleware
origins = os.getenv("ALLOWED_ORIGINS", "").split(",") or ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 4) (Optional) create tables if you're not strictly using Alembic
Base.metadata.create_all(bind=engine)

# 5) Mount routers at exactly the paths your frontend expects:
#    Frontend is POST-ing to /loyalty/register, so we mount at /loyalty
app.include_router(loyalty_router) #,  prefix="/loyalty",  tags=["Loyalty"])
app.include_router(catalog_router)#,  prefix="/catalog",  tags=["Catalog"])
app.include_router(orders_router)#,   prefix="/orders",   tags=["Orders"])
app.include_router(payments_router)#, prefix="/payments", tags=["Payments"])

# 6) A simple health-check
@app.get("/health", tags=["Health"])
def health_check():
    return {"status": "ok"}
