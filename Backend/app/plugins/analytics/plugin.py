from fastapi import FastAPI
from sqlalchemy import MetaData
from .routes import router as analytics_router

class Plugin:
    name = "analytics"
    def register_models(self, metadata: MetaData):
        pass
    def register_routes(self, app: FastAPI):
        # Central main.py mounts this router; avoid duplicate mounting here.
        # Leaving empty prevents double registration that created 404 confusion.
        # (Historical note: duplicate mounting caused path mismatch after prefix changes.)
        if False:  # pragma: no cover - placeholder to keep method non-empty
            app.include_router(analytics_router, prefix="/api")
