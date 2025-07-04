from fastapi import FastAPI
from sqlalchemy import MetaData

from .routes import router as catalog_router

class Plugin:
    """Catalog plugin registers service/extras routes"""
    name = "catalog"

    def register_models(self, metadata: MetaData):
        # No extra models beyond app.models
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(catalog_router, prefix="/api/catalog")
