from fastapi import APIRouter, Depends, Query, Request, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from typing import Optional
import time
from collections import deque

from app.core.database import get_db
from app.models import AuditLog, User
from app.core.authz import tenant_admin_only
from app.core.tenant_context import tenant_cache_state
from app.core.rate_limit import bucket_snapshot
from app.core import jobs as _jobs
from config import settings
from app.plugins.auth.routes import get_current_user

router = APIRouter(prefix="/api/obs", tags=["observability"], dependencies=[Depends(tenant_admin_only)])

# --- Simple in-memory request metrics & error ring buffer ---
_REQ_METRICS = {"count": 0, "total_ms": 0.0}
_ERRORS = deque(maxlen=50)

def _record_request(dur_ms: float):
    _REQ_METRICS["count"] += 1
    _REQ_METRICS["total_ms"] += dur_ms

def _record_error(path: str, exc: Exception):
    _ERRORS.append({
        'path': path,
        'error': exc.__class__.__name__,
        'message': str(exc)[:200],
        'ts': datetime.utcnow().isoformat()
    })

@router.get("/tenant-cache", include_in_schema=False)
def get_tenant_cache_state():
    return tenant_cache_state()

def _audit_base_query(db: Session, current: User):
    q = db.query(AuditLog)
    # Tenant admins limited to their tenant; developers/superadmin see all
    if current.role == 'admin':
        q = q.filter(AuditLog.tenant_id == current.tenant_id)
    return q

@router.get("/audit", response_model=list[dict], include_in_schema=False)
def list_audit_logs(
    db: Session = Depends(get_db),
    current: User = Depends(get_current_user),
    tenant_id: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    action_prefix: Optional[str] = Query(None),
    since: Optional[datetime] = Query(None),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
):
    q = _audit_base_query(db, current)
    if tenant_id:
        q = q.filter(AuditLog.tenant_id == tenant_id)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if action_prefix:
        like = f"{action_prefix}%"
        q = q.filter(AuditLog.action.like(like))
    if since:
        q = q.filter(AuditLog.created_at >= since)
    q = q.order_by(AuditLog.created_at.desc()).limit(limit).offset(offset)
    rows = q.all()
    return [
        {
            'id': r.id,
            'tenant_id': r.tenant_id,
            'user_id': r.user_id,
            'action': r.action,
            'created_at': r.created_at.isoformat(),
            'details': r.details or {},
        }
        for r in rows
    ]

class Plugin:
    name = "observability"
    def register_models(self, metadata):
        return
    def register_routes(self, app):
        # Timing + error capture middleware (lightweight)
        @app.middleware("http")
        async def _obs_mw(request: Request, call_next):  # pragma: no cover (indirect via tests)
            start = time.time()
            try:
                response = await call_next(request)
            except Exception as e:  # capture then re-raise
                _record_error(request.url.path, e)
                raise
            finally:
                dur_ms = (time.time() - start) * 1000
                _record_request(dur_ms)
            return response
        app.include_router(router)

@router.get("/request-metrics", include_in_schema=False)
def request_metrics():
    avg = (_REQ_METRICS["total_ms"] / _REQ_METRICS["count"]) if _REQ_METRICS["count"] else 0.0
    return {**_REQ_METRICS, 'avg_ms': round(avg, 2)}

@router.get("/errors", include_in_schema=False)
def recent_errors(limit: int = Query(10, ge=1, le=50)):
    return list(_ERRORS)[-limit:]

@router.get("/rate-limits", include_in_schema=False)
def rate_limits():
    return bucket_snapshot()

@router.get("/rate-limits/summary", include_in_schema=False)
def rate_limits_summary():
    """Provide a compact summary of active buckets per scope and top keys.

    Hidden from OpenAPI to keep public surface small; tenant-admin only via router deps.
    """
    snap = bucket_snapshot()
    buckets = snap.get('buckets', [])
    by_scope: dict[str, dict] = {}
    for b in buckets:
        scope = b.get('scope', 'unknown')
        by = by_scope.setdefault(scope, {'count': 0, 'top': []})
        by['count'] += 1
    # Return only high-level counts to avoid leaking IPs/keys
    return {
        'scopes': {s: {'buckets': info['count']} for s, info in by_scope.items()},
        'penalties': len(snap.get('penalties', [])),
        'overrides': list(snap.get('overrides', {}).keys()),
    }

@router.get("/jobs", include_in_schema=False)
def jobs_state():
    # Debug: log snapshot details to help diagnose test expectations
    import logging as _logging
    recent = _jobs.job_snapshot()
    try:
        sample = [{"id": j.get("id"), "status": j.get("status")} for j in recent[-3:]]
        q = _jobs.queue_metrics()
        _logging.getLogger("access").info(
            "OBS_PLUGIN jobs_state recent=%s queue_queued=%s hist_len=%s sample=%s",
            len(recent), q.get("queued"), q.get("history"), sample,
        )
    except Exception:
        pass
    return {"registered": _jobs.registered_jobs(), "recent": recent}

if settings.enable_metrics_endpoint:
    @router.get("/metrics", include_in_schema=False)
    def metrics_text():  # pragma: no cover (format convenience)
        snap = bucket_snapshot()
        jm = _jobs.queue_metrics()
        lines = []
        for b in snap.get('buckets', []):
            lines.append(f"rate_limit_tokens{{scope=\"{b['scope']}\",key=\"{b['key']}\"}} {b['tokens']}")
        for p in snap.get('penalties', []):
            lines.append(f"rate_limit_penalty_strikes{{ip=\"{p['ip']}\"}} {p['strikes']}")
        for s, cfg in snap.get('overrides', {}).items():
            lines.append(f"rate_limit_override_capacity{{scope=\"{s}\"}} {cfg['capacity']}")
        for k, v in jm.items():
            lines.append(f"job_queue_{k} {v}")
        lines.append(f"dead_letter_jobs {len(_jobs.dead_letter_snapshot())}")
        return "\n".join(lines) + "\n"

@router.get("/force-error", include_in_schema=False)
def force_error():  # pragma: no cover (covered indirectly by error test)
    # We want to record a RuntimeError in the ring buffer (mimicking a real
    # unhandled exception) without letting it propagate and fail the test
    # client, so we manually create/capture it, record, then return a 500.
    try:
        raise RuntimeError("forced for testing")
    except RuntimeError as e:  # record synthetic error
        _record_error("/api/obs/force-error", e)
    raise HTTPException(status_code=500, detail="forced for testing")
