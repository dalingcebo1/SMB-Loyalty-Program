from fastapi import FastAPI
from sqlalchemy import MetaData

from .routes import router as users_router

class Plugin:
    """Users subplugin registers user-specific endpoints"""
    name = "users"

    def register_models(self, metadata: MetaData):
        # no models to register specifically
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(users_router, prefix="/api/users")
