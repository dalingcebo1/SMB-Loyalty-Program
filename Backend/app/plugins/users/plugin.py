from fastapi import FastAPI, Depends
from sqlalchemy import MetaData

from .routes import router as users_router, add_vehicle, delete_vehicle
from app.plugins.auth.routes import require_staff

class Plugin:
    """Users subplugin registers user-specific endpoints"""
    name = "users"

    def register_models(self, metadata: MetaData):
        # no models to register specifically
        pass

    def register_routes(self, app: FastAPI):
        # Mount users router at /api/users (router itself has no prefix)
        app.include_router(users_router, prefix="/api/users")
        # Legacy mount: support old /api/users/users prefix for backward compatibility
        app.include_router(users_router, prefix="/api/users/users")
