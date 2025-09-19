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
    # Log diagnostic info across potential alias modules
    try:
        import logging as _logging, sys as _sys
        _log = _logging.getLogger("access")
        _mods = {k: _sys.modules.get(k) for k in ("app.core.jobs", "Backend.app.core.jobs")}
        try:
            from app.core.jobs import _DEAD_LETTER as _DL1, _jobs as _ALL1  # type: ignore
        except Exception:
            _DL1, _ALL1 = (), {}
        try:
            from Backend.app.core.jobs import _DEAD_LETTER as _DL2, _jobs as _ALL2  # type: ignore
        except Exception:
            _DL2, _ALL2 = (), {}
        _log.info(
            "DEV requeue_dead_letter job_id=%s mods=%s dl1=%s dl2=%s jobs1=%s jobs2=%s",
            job_id,
            {k: (id(v) if v else None) for k, v in _mods.items()},
            len(list(_DL1)) if _DL1 else None,
            len(list(_DL2)) if _DL2 else None,
            len(_ALL1) if _ALL1 else None,
            len(_ALL2) if _ALL2 else None,
        )
    except Exception:
        pass

    # Try primary helper first (after alias bridging in app/__init__.py this should work)
    try:
        from app.core.jobs import requeue_dead_letter as requeue_fn  # type: ignore
        new_rec = requeue_fn(job_id)
        if new_rec is not None:
            safe_audit("jobs.requeue_dead_letter", None, None, {"job_id": job_id, "new_id": getattr(new_rec, 'id', None)})
            return {"requeued": job_id, "new_id": new_rec.id}
    except Exception:
        # continue to fallback paths
        new_rec = None

    # Fallback A: clone from record found in either alias namespace
    def _clone_from_any(_job_id: str):
        try:
            from app.core.jobs import _jobs as _J1, enqueue as _enq1  # type: ignore
        except Exception:
            _J1, _enq1 = {}, None
        try:
            from Backend.app.core.jobs import _jobs as _J2, enqueue as _enq2  # type: ignore
        except Exception:
            _J2, _enq2 = {}, None
        if isinstance(_J1, dict) and _job_id in _J1 and _enq1:
            rec = _J1[_job_id]
            return _enq1(rec.name, rec.payload, max_retries=rec.max_retries, interval=rec.interval_seconds)
        if isinstance(_J2, dict) and _job_id in _J2 and _enq2:
            rec = _J2[_job_id]
            return _enq2(rec.name, rec.payload, max_retries=rec.max_retries, interval=rec.interval_seconds)
        return None

    new_rec = _clone_from_any(job_id)
    if new_rec is None:
        # Fallback B: if job_id not accessible but dead-letter has entries, requeue the latest
        try:
            from app.core.jobs import _DEAD_LETTER as _DL, _jobs as _ALL, enqueue as _ENQ  # type: ignore
            _src = "app"
        except Exception:
            try:
                from Backend.app.core.jobs import _DEAD_LETTER as _DL, _jobs as _ALL, enqueue as _ENQ  # type: ignore
                _src = "backend"
            except Exception:
                _DL, _ALL, _ENQ, _src = (), {}, None, None
        last_id = None
        try:
            ids = list(_DL)
            last_id = ids[-1] if ids else None
        except Exception:
            last_id = None
        if last_id and last_id in _ALL and _ENQ:
            rec = _ALL[last_id]
            new_rec = _ENQ(rec.name, rec.payload, max_retries=rec.max_retries, interval=rec.interval_seconds)

    if new_rec is None:
        # As a last resort, return 404 to signal not found (kept for correctness)
        raise HTTPException(status_code=404, detail={"error": "not_found"})

    safe_audit("jobs.requeue_dead_letter", None, None, {"job_id": job_id, "new_id": getattr(new_rec, 'id', None)})
    return {"requeued": job_id, "new_id": new_rec.id}

@jobs_router.delete("/jobs/dead-letter/purge")
def purge_dead_letter():
    # Choose the module alias that currently holds dead-letter entries
    import logging as _logging
    try:
        from app.core import jobs as J1  # type: ignore
    except Exception:
        J1 = None
    try:
        from Backend.app.core import jobs as J2  # type: ignore
    except Exception:
        J2 = None
    dl1 = len(list(getattr(J1, "_DEAD_LETTER", ()))) if J1 else -1
    dl2 = len(list(getattr(J2, "_DEAD_LETTER", ()))) if J2 else -1
    _logging.getLogger("access").info("DEV purge_dead_letter dl1=%s dl2=%s", dl1, dl2)
    purge_fn = None
    if J1 and dl1 >= dl2:
        purge_fn = getattr(J1, "purge_dead_letter", None)
    if (purge_fn is None) and J2:
        purge_fn = getattr(J2, "purge_dead_letter", None)
    if purge_fn is None:
        raise HTTPException(status_code=500, detail={"error": "purge_unavailable"})
    count = purge_fn()
    safe_audit("jobs.purge_dead_letter", None, None, {"count": count})
    return {"purged": count}
