from fastapi import FastAPI
from sqlalchemy import MetaData

from .routes import router as auth_router

class Plugin:
    """Auth plugin registers models and auth routes"""
    name = "auth"

    def register_models(self, metadata: MetaData):
        # models already bound via Base metadata in app/core/database
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(auth_router, prefix="/api/auth")
