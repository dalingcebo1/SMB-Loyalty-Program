from fastapi import FastAPI
from sqlalchemy import MetaData

from app.plugins.dev import router as dev_router

class Plugin:
    """Developer console plugin"""
    name = "dev"

    def register_models(self, metadata: MetaData):
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(dev_router, prefix="/api/dev")
