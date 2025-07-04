from fastapi import FastAPI
from sqlalchemy import MetaData

from .routes import router as orders_router

class Plugin:
    """Orders plugin registers routes for orders management"""
    name = "orders"

    def register_models(self, metadata: MetaData):
        # models are registered via Base metadata
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(orders_router, prefix="/api/orders")
