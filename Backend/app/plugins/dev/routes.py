from fastapi import APIRouter, Depends, Request, HTTPException, status, Query, Header
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.models import Tenant
from app.core.authz import developer_only, require_roles, UserRole
from app.core.rate_limit import check_rate, set_limit, bucket_snapshot, delete_limit, list_overrides, build_429_payload, compute_retry_after, clear_ban as rl_clear_ban
from config import settings
from app.core import jobs
from pydantic import BaseModel

from app.core.audit_safe import safe_audit

# NOTE: These remain under dev; separate production admin API can import same handlers with different guards.
router = APIRouter(prefix="", tags=["dev"], dependencies=[Depends(developer_only)])

@router.get("/", response_model=dict)
def dev_status(db: Session = Depends(get_db)):
    """Return basic dev console status and list of tenants."""
    tenants = db.query(Tenant).all()
    return {"status": "ok", "tenants": [{"id": t.id, "name": t.name} for t in tenants]}

@router.post("/reset-db", dependencies=[Depends(require_roles(UserRole.superadmin, UserRole.developer))])
def reset_db(
    confirm: bool = Query(False, description="Must be true to allow reset"),
    confirm_header: str | None = Header(None, alias="X-Dev-Confirm"),
    db: Session = Depends(get_db)
):
    """Dangerous: drop and recreate all tables (requires ?confirm=true and header X-Dev-Confirm: RESET).

    Disabled automatically when settings.environment == 'production' or enable_dev_dangerous is False.
    """
    if not settings.dangerous_allowed():
        raise HTTPException(status_code=403, detail={"error": "forbidden", "detail": "Dangerous ops disabled"})
    if not (confirm and confirm_header == "RESET"):
        raise HTTPException(status_code=400, detail={"error": "confirmation_required", "detail": "Pass ?confirm=true and header X-Dev-Confirm: RESET"})
    from app.core.database import Base, engine
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    safe_audit("dev.reset_db", None, None, {"action": "drop_and_recreate"})
    return {"message": "Database reset complete."}


@router.get("/rl-test")
def dev_rate_limited_probe(request: Request):
    # Simple per-IP (process local) limiter: 3 requests / 60s
    ip = request.client.host if request.client else 'unknown'
    scope = 'dev_rl_test'
    allowed = check_rate(scope, ip, capacity=3, per_seconds=60)
    if not allowed:
        ra = compute_retry_after(scope, ip, 3, 60)
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS, detail=build_429_payload(scope, ra))
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
    data = {"registered": jobs.registered_jobs(), "recent": jobs.job_snapshot(), "dead_letter": jobs.dead_letter_snapshot(), "queue": jobs.queue_metrics()}
    try:
        import logging as _logging
        sample = [{"id": j.get("id"), "status": j.get("status")} for j in data["recent"][-3:]]
        _logging.getLogger("access").info(
            "DEV list_jobs recent=%s queue=%s sample=%s",
            len(data["recent"]), data["queue"].get("queued"), sample,
        )
    except Exception:
        pass
    return data

@router.post("/jobs/enqueue")
def enqueue_job(body: EnqueueRequest):
    try:
        rec = jobs.enqueue(body.name, body.payload, max_retries=body.max_retries, interval=body.interval_seconds)
    except RuntimeError as e:
        if str(e) == 'queue_overflow':
            raise HTTPException(status_code=429, detail={"error": "queue_overflow", "message": "Queue is full"})
        raise
    try:
        import logging as _logging
        _logging.getLogger("access").info("DEV enqueue id=%s name=%s status=%s", rec.id, rec.name, rec.status)
    except Exception:
        pass
    return {"enqueued": rec.id, "status": rec.status, "name": rec.name}

@router.post("/jobs/run-next")
def run_next():
    rec = jobs.run_next()
    if not rec:
        return {"ran": None}
    try:
        import logging as _logging
        _logging.getLogger("access").info("DEV run_next ran=%s status=%s", rec.id, rec.status)
    except Exception:
        pass
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

@router.post("/jobs/dead-letter/{job_id}/requeue")
def requeue_dead_letter(job_id: str):
    # use public API if exposed; fallback to controlled internal access
    try:
        from app.core.jobs import requeue_dead_letter as requeue_fn  # type: ignore
        new_rec = requeue_fn(job_id)
        if new_rec is None:
            # Not found in dead-letter; attempt manual clone from job record
            from app.core.jobs import _jobs, enqueue  # type: ignore
            rec = _jobs.get(job_id)
            if not rec:
                raise HTTPException(status_code=404, detail={"error": "not_found"})
            new_rec = enqueue(rec.name, rec.payload, max_retries=rec.max_retries, interval=rec.interval_seconds)
    except Exception:
        from app.core.jobs import _jobs, enqueue  # type: ignore
        rec = _jobs.get(job_id)
        if not rec:
            raise HTTPException(status_code=404, detail={"error": "not_found"})
        new_rec = enqueue(rec.name, rec.payload, max_retries=rec.max_retries, interval=rec.interval_seconds)
    safe_audit("jobs.requeue_dead_letter", None, None, {"job_id": job_id, "new_id": getattr(new_rec, 'id', None)})
    return {"requeued": job_id, "new_id": new_rec.id}

@router.delete("/jobs/dead-letter/purge")
def purge_dead_letter():
    try:
        from app.core.jobs import purge_dead_letter as purge_fn  # type: ignore
        count = purge_fn()
    except Exception:
        from app.core.jobs import _DEAD_LETTER  # type: ignore
        count = len(_DEAD_LETTER)
        _DEAD_LETTER.clear()
    safe_audit("jobs.purge_dead_letter", None, None, {"count": count})
    return {"purged": count}

@router.get("/rate-limits/config")
def current_rate_limits():
    snap = bucket_snapshot()
    snap["overrides"] = list_overrides()
    return snap

@router.post("/rate-limits/config")
def override_rate_limit(body: RateLimitOverride):
    if not settings.enable_rate_limit_overrides:
        # Return flat error, not nested under {"detail": ...}
        return JSONResponse(status_code=403, content={"error": "disabled", "detail": "Overrides disabled in this environment"})
    set_limit(body.scope, body.capacity, body.per_seconds)
    return {"updated": body.scope, "config": bucket_snapshot(include_penalties=False)["overrides"].get(body.scope)}

@router.delete("/rate-limits/config/{scope}")
def delete_override(scope: str):
    if not settings.enable_rate_limit_overrides:
        return JSONResponse(status_code=403, content={"error": "disabled", "detail": "Overrides disabled in this environment"})
    existed = delete_limit(scope)
    return {"deleted": scope, "existed": existed}

@router.get("/rate-limits/bans")
def list_bans():
    snap = bucket_snapshot()
    return {"bans": snap.get("bans", [])}

@router.delete("/rate-limits/bans/{ip}")
def clear_ban(ip: str):
    existed = rl_clear_ban(ip)
    if existed:
        safe_audit("rate_limit.clear_ban", None, None, {"ip": ip})
    return {"ip": ip, "cleared": existed}

"""NOTE: Historical /admin* dev endpoints removed.

Production-ready administrative APIs now live under the dedicated router in
`app.plugins.admin.routes` mounted at `/api/admin/*`. This dev module intentionally
excludes those duplicates to prevent confusion and accidental reliance on the
previous experimental paths.
"""
