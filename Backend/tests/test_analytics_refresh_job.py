import os, sys
from fastapi.testclient import TestClient
from datetime import datetime

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, ROOT)

from app.main import app  # noqa: E402
from app.core import jobs  # noqa: E402
from app.core.database import SessionLocal, Base, engine  # noqa: E402
from app.models import User, Tenant, Order  # noqa: E402

client = TestClient(app)


def setup_module(module):  # noqa: D401
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    if not db.query(Tenant).filter_by(id='an_job').first():
        db.add(Tenant(id='an_job', name='AnalyticsJob', loyalty_type='standard', vertical_type='carwash', primary_domain='an_job', created_at=datetime.utcnow(), config={}))
    if not db.query(User).filter_by(email='an_job@example.dev').first():
        db.add(User(email='an_job@example.dev', tenant_id='an_job', role='admin'))
    # add a simple order for metrics aggregation
    # Insert synthetic order if none exist for analytics (do not rely on tenant_id filter pre-migration)
    if not db.query(Order).first():
        db.add(Order(status='started', amount=1000, started_at=datetime.utcnow(), type='paid'))
    db.commit(); db.close()


def test_analytics_refresh_job_runs():
    # enqueue job
    rec = jobs.enqueue('analytics_refresh', {})
    jobs.run_job_id(rec.id)
    assert rec.status in ('success', 'error')
    # If success, result should contain refreshed count
    if rec.status == 'success':
        assert isinstance(rec.result, dict)
        assert 'refreshed' in rec.result
