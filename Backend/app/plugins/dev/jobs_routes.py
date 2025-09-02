from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from app.core.authz import developer_only
from app.core import jobs
from app.core.audit_safe import safe_audit

jobs_router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

class EnqueueRequest(BaseModel):
    name: str
    payload: dict | None = None
    max_retries: int = 0
    interval_seconds: float | None = None

@jobs_router.get("/jobs")
def list_jobs():
    return {"registered": jobs.registered_jobs(), "recent": jobs.job_snapshot(), "dead_letter": jobs.dead_letter_snapshot(), "queue": jobs.queue_metrics()}

@jobs_router.post("/jobs/enqueue")
def enqueue_job(body: EnqueueRequest):
    try:
        rec = jobs.enqueue(body.name, body.payload, max_retries=body.max_retries, interval=body.interval_seconds)
    except RuntimeError as e:
        if str(e) == 'queue_overflow':
            raise HTTPException(status_code=429, detail={"error": "queue_overflow", "detail": "Queue is full"})
        raise
    return {"enqueued": rec.id, "status": rec.status, "name": rec.name}

@jobs_router.post("/jobs/run-next")
def run_next():
    rec = jobs.run_next()
    if not rec:
        return {"ran": None}
    return {"ran": rec.id, "status": rec.status}

@jobs_router.post("/jobs/{job_id}/run")
def run_job(job_id: str):
    rec = jobs.run_job_id(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    return {"job": rec.id, "status": rec.status}

@jobs_router.post("/jobs/tick")
def jobs_tick():
    jobs.tick()
    return {"tick": True}

@jobs_router.post("/jobs/dead-letter/{job_id}/requeue")
def requeue_dead_letter(job_id: str):
    from app.core.jobs import requeue_dead_letter as requeue_fn
    new_rec = requeue_fn(job_id)
    if not new_rec:
        raise HTTPException(status_code=404, detail={"error": "not_found"})
    safe_audit("jobs.requeue_dead_letter", None, None, {"job_id": job_id, "new_id": getattr(new_rec, 'id', None)})
    return {"requeued": job_id, "new_id": new_rec.id}

@jobs_router.delete("/jobs/dead-letter/purge")
def purge_dead_letter():
    from app.core.jobs import purge_dead_letter as purge_fn
    count = purge_fn()
    safe_audit("jobs.purge_dead_letter", None, None, {"count": count})
    return {"purged": count}
