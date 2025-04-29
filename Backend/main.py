import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes import loyalty, catalog, orders, payments

app = FastAPI(
    title="SMB Loyalty Program",
    version="0.1",
    openapi_url="/openapi.json",
)

# allow your front-end host (and port) to talk to us
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.getenv("FRONTEND_URL", "http://localhost:5173"),
        # you can add your Codespaces URL here if you need:
        "https://laughing-space-trout-pgv46w7pw97h7vv-5173.app.github.dev",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# mount each router **without** an extra prefix,
# since each router has its own `prefix="/loyalty"`, `/catalog`, etc.
app.include_router(loyalty.router)
app.include_router(catalog.router)
app.include_router(orders.router)
app.include_router(payments.router)

@app.on_event("startup")
def on_startup():
    # create any missing tables
    from database import Base, engine
    Base.metadata.create_all(bind=engine)
