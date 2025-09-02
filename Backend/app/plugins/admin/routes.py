from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.plugins.auth.routes import require_capability
from app.core.database import get_db
from app.core.rate_limit import bucket_snapshot, list_overrides, set_limit, delete_limit
from app.models import User, Order
from sqlalchemy import func
from app.core import jobs
from app.core.audit import log_audit
from app.models import AuditLog

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/metrics", dependencies=[Depends(require_capability("analytics.advanced"))])
def metrics(db: Session = Depends(get_db)):
    orders_total = db.query(func.count(Order.id)).scalar() or 0
    active_users_30d = db.query(func.count(func.distinct(Order.user_id))) \
        .filter(Order.created_at >= func.datetime('now', '-30 days')).scalar() or 0
    snap = bucket_snapshot(include_penalties=False)
    return {
        "orders_total": orders_total,
        "active_users_30d": active_users_30d,
        "rate_limit_overrides": len(snap.get('overrides', {})),
        "active_bans": len(snap.get('bans', [])),
        "queue": jobs.queue_metrics(),
    }

@router.get("/jobs", dependencies=[Depends(require_capability("jobs.view"))])
def jobs_snapshot():
    return {"queue": jobs.queue_metrics(), "recent": jobs.job_snapshot(), "dead": jobs.dead_letter_snapshot()}

@router.post("/jobs/{job_id}/retry", dependencies=[Depends(require_capability("jobs.retry"))])
def retry_job(job_id: str):
    try:
        from app.core.jobs import requeue_dead_letter as requeue_fn  # type: ignore
        new_rec = requeue_fn(job_id)
    except Exception:
        raise HTTPException(status_code=404, detail="Job not found or cannot retry")
    return {"requeued": job_id, "new_id": getattr(new_rec, 'id', None)}

@router.get("/rate-limits", dependencies=[Depends(require_capability("rate_limit.edit"))])
def admin_rate_limits():
    snap = bucket_snapshot()
    snap["overrides"] = list_overrides()
    return snap

@router.post("/rate-limits", dependencies=[Depends(require_capability("rate_limit.edit"))])
def upsert_rate_limit(scope: str, capacity: int, per_seconds: float, db: Session = Depends(get_db), user: User = Depends(require_capability("rate_limit.edit"))):
    set_limit(scope, capacity, per_seconds)
    log_audit(db, 'rate_limit.upsert', user=user, details={"scope": scope, "capacity": capacity, "per_seconds": per_seconds})
    snap = bucket_snapshot(include_penalties=False)
    return {"updated": scope, "config": snap.get("overrides", {}).get(scope)}

@router.delete("/rate-limits/{scope}", dependencies=[Depends(require_capability("rate_limit.edit"))])
def remove_rate_limit(scope: str, db: Session = Depends(get_db), user: User = Depends(require_capability("rate_limit.edit"))):
    existed = delete_limit(scope)
    log_audit(db, 'rate_limit.delete', user=user, details={"scope": scope, "existed": existed})
    return {"deleted": scope, "existed": existed}

@router.get("/audit", dependencies=[Depends(require_capability("audit.view"))])
def audit_recent(
    limit: int = Query(50, ge=1, le=500),
    before_id: int | None = Query(None, description="Pagination: fetch entries with id < before_id"),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog).order_by(AuditLog.id.desc())
    if before_id is not None:
        q = q.filter(AuditLog.id < before_id)
    rows = q.limit(limit).all()
    return {
        "events": [
            {
                "id": r.id,
                "tenant_id": r.tenant_id,
                "user_id": r.user_id,
                "action": r.action,
                "created_at": r.created_at.isoformat() + 'Z',
                "details": r.details or {},
            }
            for r in rows
        ],
        "next_before_id": rows[-1].id if rows else None,
    }