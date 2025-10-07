from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from app.plugins.auth.routes import require_capability
from app.core.database import get_db
from app.core.rate_limit import bucket_snapshot, list_overrides, set_limit, delete_limit
from app.models import User, Order, Payment, Service
from sqlalchemy import func, or_, cast, String
from app.core import jobs
from app.core.audit import log_audit
from app.models import AuditLog
from typing import Optional, Dict, Any
import math

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/metrics", dependencies=[Depends(require_capability("analytics.advanced"))])
def metrics(db: Session = Depends(get_db)):
    orders_total = db.query(func.count(Order.id)).scalar() or 0
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    active_users_30d = db.query(func.count(func.distinct(Order.user_id))) \
        .filter(Order.created_at >= thirty_days_ago).scalar() or 0
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


def _parse_iso_date(value: Optional[str], field: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        normalized = value.strip()
        if normalized.endswith("Z"):
            normalized = normalized[:-1] + "+00:00"
        return datetime.fromisoformat(normalized)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid {field} format. Use ISO 8601.")


@router.get("/transactions")
def list_transactions(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    status: Optional[str] = Query(None, description="Filter by payment status (comma separated)"),
    method: Optional[str] = Query(None, description="Filter by payment method"),
    source: Optional[str] = Query(None, description="Filter by payment source"),
    search: Optional[str] = Query(None, description="Search reference, transaction id, email, phone, or order id"),
    start_date: Optional[str] = Query(None, description="Filter payments created on/after this ISO date"),
    end_date: Optional[str] = Query(None, description="Filter payments created on/before this ISO date"),
    min_amount: Optional[int] = Query(None, description="Minimum payment amount in cents"),
    max_amount: Optional[int] = Query(None, description="Maximum payment amount in cents"),
    order_id: Optional[int] = Query(None, description="Filter by numeric order id"),
    sort_by: str = Query("created_at", description="Sort field: created_at, amount, status, order_created_at"),
    sort_order: str = Query("desc", description="Sort order: asc or desc"),
    tenant_id: Optional[str] = Query(None, description="Tenant scope override (superadmin only)"),
    current_user: User = Depends(require_capability("payments.view")),
    db: Session = Depends(get_db),
):
    sort_by = sort_by.lower()
    sort_order = sort_order.lower()
    if sort_by not in {"created_at", "amount", "status", "order_created_at"}:
        raise HTTPException(status_code=400, detail="Unsupported sort_by value")
    if sort_order not in {"asc", "desc"}:
        raise HTTPException(status_code=400, detail="Unsupported sort_order value")

    tenant_scope = current_user.tenant_id
    if tenant_id and current_user.role in ("superadmin", "developer"):
        tenant_scope = tenant_id

    scope_filters = []
    if tenant_scope:
        scope_filters.append(Order.tenant_id == tenant_scope)

    filters = list(scope_filters)

    if status:
        statuses = [s.strip() for s in status.split(",") if s.strip()]
        if statuses:
            filters.append(Payment.status.in_(statuses))

    if method:
        methods = [m.strip() for m in method.split(",") if m.strip()]
        if methods:
            filters.append(Payment.method.in_(methods))

    if source:
        sources = [s.strip() for s in source.split(",") if s.strip()]
        if sources:
            filters.append(Payment.source.in_(sources))

    if order_id is not None:
        filters.append(Payment.order_id == order_id)

    start_dt = _parse_iso_date(start_date, "start_date")
    end_dt = _parse_iso_date(end_date, "end_date")
    if start_dt and end_dt and start_dt > end_dt:
        raise HTTPException(status_code=400, detail="start_date must be before end_date")

    if start_dt:
        filters.append(Payment.created_at >= start_dt)
    if end_dt:
        filters.append(Payment.created_at <= end_dt)

    if min_amount is not None:
        filters.append(Payment.amount >= min_amount)
    if max_amount is not None:
        filters.append(Payment.amount <= max_amount)

    if search:
        term = f"%{search.lower()}%"
        search_clauses = [
            func.lower(Payment.transaction_id).like(term),
            func.lower(Payment.reference).like(term),
            func.lower(User.email).like(term),
            func.lower(User.phone).like(term),
            cast(Order.id, String).like(f"%{search}%"),
        ]
        filters.append(or_(*search_clauses))

    sort_column = {
        "created_at": Payment.created_at,
        "amount": Payment.amount,
        "status": Payment.status,
        "order_created_at": Order.created_at,
    }[sort_by]

    order_clause = sort_column.desc() if sort_order == "desc" else sort_column.asc()
    secondary_clause = Payment.id.desc() if sort_order == "desc" else Payment.id.asc()

    def _apply_filters(query):
        return query.filter(*filters) if filters else query

    total = _apply_filters(
        db.query(func.count(Payment.id))
        .outerjoin(Order, Payment.order_id == Order.id)
        .outerjoin(User, Order.user_id == User.id)
    ).scalar() or 0

    offset = (page - 1) * page_size

    rows = (
        _apply_filters(
            db.query(Payment, Order, User, Service)
            .outerjoin(Order, Payment.order_id == Order.id)
            .outerjoin(User, Order.user_id == User.id)
            .outerjoin(Service, Order.service_id == Service.id)
        )
        .order_by(order_clause, secondary_clause)
        .offset(offset)
        .limit(page_size)
        .all()
    )

    total_amount = _apply_filters(
        db.query(func.coalesce(func.sum(Payment.amount), 0))
        .outerjoin(Order, Payment.order_id == Order.id)
        .outerjoin(User, Order.user_id == User.id)
    ).scalar() or 0

    status_counts_rows = _apply_filters(
        db.query(Payment.status, func.count(Payment.id))
        .outerjoin(Order, Payment.order_id == Order.id)
        .outerjoin(User, Order.user_id == User.id)
        .group_by(Payment.status)
    ).all()
    status_counts: Dict[str, int] = {
        (row[0] or "unknown"): row[1] for row in status_counts_rows
    }

    method_counts_rows = _apply_filters(
        db.query(Payment.method, func.count(Payment.id))
        .outerjoin(Order, Payment.order_id == Order.id)
        .outerjoin(User, Order.user_id == User.id)
        .group_by(Payment.method)
    ).all()
    method_counts: Dict[str, int] = {
        (row[0] or "unknown"): row[1] for row in method_counts_rows
    }

    scope_statuses = db.query(Payment.status).outerjoin(Order, Payment.order_id == Order.id)
    scope_methods = db.query(Payment.method).outerjoin(Order, Payment.order_id == Order.id)
    scope_sources = db.query(Payment.source).outerjoin(Order, Payment.order_id == Order.id)
    if scope_filters:
        scope_statuses = scope_statuses.filter(*scope_filters)
        scope_methods = scope_methods.filter(*scope_filters)
        scope_sources = scope_sources.filter(*scope_filters)

    available_filters = {
        "statuses": sorted({row[0] for row in scope_statuses.distinct() if row[0]}),
        "methods": sorted({row[0] for row in scope_methods.distinct() if row[0]}),
        "sources": sorted({row[0] for row in scope_sources.distinct() if row[0]}),
    }

    items: list[Dict[str, Any]] = []
    for payment, order, user, service in rows:
        items.append({
            "payment": {
                "id": payment.id,
                "amount_cents": payment.amount,
                "amount": (payment.amount or 0) / 100 if payment.amount is not None else None,
                "status": payment.status,
                "method": payment.method,
                "source": payment.source,
                "card_brand": payment.card_brand,
                "reference": payment.reference,
                "transaction_id": payment.transaction_id,
                "created_at": payment.created_at.isoformat() if payment.created_at else None,
            },
            "order": {
                "id": str(order.id) if order and order.id is not None else None,
                "status": order.status if order else None,
                "amount_cents": order.amount if order and order.amount is not None else None,
                "created_at": order.created_at.isoformat() if order and order.created_at else None,
                "tenant_id": order.tenant_id if order else None,
                "service_id": order.service_id if order else None,
                "quantity": order.quantity if order else None,
                "type": order.type if order else None,
                "payment_pin": order.payment_pin if order else None,
            },
            "customer": {
                "id": user.id if user else None,
                "email": user.email if user else None,
                "first_name": user.first_name if user else None,
                "last_name": user.last_name if user else None,
                "phone": user.phone if user else None,
            },
            "service": {
                "id": service.id if service else None,
                "name": service.name if service else None,
                "category": service.category if service else None,
            },
        })

    total_pages = math.ceil(total / page_size) if total else 0

    return {
        "items": items,
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": total_pages,
        },
        "summary": {
            "count": total,
            "total_amount_cents": int(total_amount) if total_amount is not None else 0,
            "status_counts": status_counts,
            "method_counts": method_counts,
        },
        "available_filters": available_filters,
    }