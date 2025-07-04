from fastapi import FastAPI
from sqlalchemy import MetaData

from .routes import router as loyalty_router

class Plugin:
    """Loyalty plugin registers loyalty routes"""
    name = "loyalty"

    def register_models(self, metadata: MetaData):
        # No additional models beyond app.models
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(loyalty_router, prefix="/api/loyalty")
