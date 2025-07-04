from fastapi import FastAPI
from sqlalchemy import MetaData

from .routes import router as payments_router

class Plugin:
    """Payments plugin registers payment and verification routes"""
    name = "payments"

    def register_models(self, metadata: MetaData):
        # models in app.models
        pass

    def register_routes(self, app: FastAPI):
        app.include_router(payments_router, prefix="/api/payments")
