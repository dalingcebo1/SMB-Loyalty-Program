# Backend/main.py

# Backend/main.py  (or wherever you create your FastAPI app)
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from fastapi import FastAPI
from database import engine, Base  # ensure Base.metadata.create_all is called if needed

# import your existing loyalty router
from routes.loyalty import router as loyalty_router
# import the new catalog router
from routes.catalog import router as catalog_router
from routes.orders import router as orders_router
from routes.payments import router as payments_router

load_dotenv()
app = FastAPI(title="SMB Loyalty Program",
              version="0.1",
              description="A loyalty program for small and medium businesses",)

# include existing loyalty endpoints under /api
app.include_router(loyalty_router, prefix="/api", tags=["Loyalty"])
# include new catalog endpoints under /api
app.include_router(catalog_router, prefix="/api", tags=["Catalog"])
# include new orders endpoints under /api
app.include_router(orders_router,  prefix="/api", tags=["Orders"])
# include new payments endpoints under /api
app.include_router(payments_router,prefix="/api")

# Optionally, you can create the tables on startup (if not using Alembic here)
#@app.on_event("startup")
#def on_startup():
    #Base.metadata.create_all(bind=engine)
#assume init_db.py was already run to create tables

@app.get("/health")
def health_check():
    return {"status": "ok"}



# Parse allowed origins from env (comma-separated)
origins = os.getenv("ALLOWED_ORIGINS", "").split(",") or["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,   # in prod replace "*" with your exact URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# … your existing routers & startup events …