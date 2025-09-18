from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
import time

from app.plugins.auth.routes import get_current_user
from app.core.database import get_db
from app.models import User, Tenant
from app.core.rate_limit import bucket_snapshot
from app.core import jobs as _jobs

_START_TS = time.time()

router = APIRouter(prefix="/ops", tags=["ops"])


@router.get("/status")
def ops_status(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    # Basic platform status; requires any authenticated user
    uptime = time.time() - _START_TS
    tenants_count = db.query(Tenant).count()
    rate = bucket_snapshot(limit=100)
    jobs = _jobs.queue_metrics()
    return {
        "ok": True,
        "uptime_seconds": int(uptime),
        "tenants": tenants_count,
        "rate_limit": rate if isinstance(rate, dict) else {},
        "jobs": jobs if isinstance(jobs, dict) else {},
    }
