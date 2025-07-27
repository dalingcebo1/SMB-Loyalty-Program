from fastapi import FastAPI
from sqlalchemy import MetaData

from app.plugins.tenants.routes import router as tenants_router

class Plugin:
    """Tenants subplugin registers tenant and admin-assignment endpoints"""
    name = "tenants"

    def register_models(self, metadata: MetaData):
        # models defined in app.models
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(tenants_router, prefix="/api/tenants")
