import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routes import loyalty, catalog, orders  # removed payments

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/api/openapi.json",
)

# CORS: allow your front-end origin
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
        # add Codespaces URL if needed
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all routers under /api
app.include_router(loyalty.router, prefix="/api")
app.include_router(catalog.router, prefix="/api")
app.include_router(orders.router, prefix="/api")

@app.on_event("startup")
def on_startup():
    # create any missing tables
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
