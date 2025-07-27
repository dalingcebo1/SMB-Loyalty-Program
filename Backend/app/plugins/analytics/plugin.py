from fastapi import FastAPI
from sqlalchemy import MetaData
from .routes import router as analytics_router

class Plugin:
    name = "analytics"
    def register_models(self, metadata: MetaData):
        pass
    def register_routes(self, app: FastAPI):
        app.include_router(analytics_router, prefix="/api")
