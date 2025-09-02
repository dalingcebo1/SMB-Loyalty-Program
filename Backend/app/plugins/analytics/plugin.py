from fastapi import FastAPI
from sqlalchemy import MetaData
from .routes import router as analytics_router
from app.core import jobs
from app.analytics.refresh_customers import refresh_customer_metrics
from app.core.database import SessionLocal

def _job_analytics_refresh(payload):  # payload may include tenant filter later
    with SessionLocal() as session:
        try:
            count = refresh_customer_metrics(session)
            return {"refreshed": count}
        except Exception as e:
            return {"error": str(e)[:200]}


class Plugin:
    name = "analytics"

    def register_models(self, metadata: MetaData):
        return

    def register_routes(self, app: FastAPI):
        app.include_router(analytics_router, prefix="/api")
        try:
            jobs.register_job("analytics_refresh", _job_analytics_refresh)
        except Exception:
            pass
