# Backend/main.py

from fastapi import FastAPI
from database import engine, Base  # ensure Base.metadata.create_all is called if needed

# import your existing loyalty router
from routes.loyalty import router as loyalty_router
# import the new catalog router
from routes.catalog import router as catalog_router
from routes.catalog import router as catalog_router
from routes.orders import router as orders_router

app = FastAPI(title="SMB Loyalty Program")

# include existing loyalty endpoints under /api
app.include_router(loyalty_router, prefix="/api", tags=["Loyalty"])
# include new catalog endpoints under /api
app.include_router(catalog_router, prefix="/api", tags=["Catalog"])
# include new orders endpoints under /api
app.include_router(orders_router,  prefix="/api", tags=["Orders"])

# Optionally, you can create the tables on startup (if not using Alembic here)
@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

@app.get("/health")
def health_check():
    return {"status": "ok"}


