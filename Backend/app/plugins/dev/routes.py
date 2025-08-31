from fastapi import APIRouter, Depends, Request, HTTPException, status
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Tenant
from app.core.authz import developer_only
from app.core.rate_limit import check_rate, set_limit, bucket_snapshot
from app.core import jobs
from pydantic import BaseModel

router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

@router.get("/", response_model=dict)
def dev_status(db: Session = Depends(get_db)):
    """Return basic dev console status and list of tenants."""
    tenants = db.query(Tenant).all()
    return {"status": "ok", "tenants": [{"id": t.id, "name": t.name} for t in tenants]}

@router.post("/reset-db")
def reset_db(db: Session = Depends(get_db)):
    """Dangerous: drop and recreate all tables"""
    # Use centralized database definitions
    from app.core.database import Base, engine
    # Drop and recreate all tables
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    return {"message": "Database reset complete."}


@router.get("/rl-test")
def dev_rate_limited_probe(request: Request):
    # Simple per-IP (process local) limiter: 3 requests / 60s
    ip = request.client.host if request.client else 'unknown'
    allowed = check_rate('dev_rl_test', ip, capacity=3, per_seconds=60)
    if not allowed:
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail="Rate limit exceeded")
    return {"ok": True}

# --- Job queue endpoints ----------------------------------------------------
class EnqueueRequest(BaseModel):
    name: str
    payload: dict | None = None
    max_retries: int = 0
    interval_seconds: float | None = None

class RateLimitOverride(BaseModel):
    scope: str
    capacity: int
    per_seconds: float

@router.get("/jobs")
def list_jobs():
    return {"registered": jobs.registered_jobs(), "recent": jobs.job_snapshot()}

@router.post("/jobs/enqueue")
def enqueue_job(body: EnqueueRequest):
    rec = jobs.enqueue(body.name, body.payload, max_retries=body.max_retries, interval=body.interval_seconds)
    return {"enqueued": rec.id, "status": rec.status, "name": rec.name}

@router.post("/jobs/run-next")
def run_next():
    rec = jobs.run_next()
    if not rec:
        return {"ran": None}
    return {"ran": rec.id, "status": rec.status}

@router.post("/jobs/{job_id}/run")
def run_job(job_id: str):
    rec = jobs.run_job_id(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Job not found")
    return {"job": rec.id, "status": rec.status}

@router.post("/jobs/tick")
def jobs_tick():
    jobs.tick()
    return {"tick": True}

@router.get("/rate-limits/config")
def current_rate_limits():
    return bucket_snapshot()

@router.post("/rate-limits/config")
def override_rate_limit(body: RateLimitOverride):
    set_limit(body.scope, body.capacity, body.per_seconds)
    return {"updated": body.scope, "config": bucket_snapshot(include_penalties=False)["overrides"].get(body.scope)}
