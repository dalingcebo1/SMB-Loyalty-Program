"""Shared wash lifecycle logic.

Centralizes start/end wash behavior so multiple plugins (payments, orders)
can stay consistent. Logic is side‑effect free except for DB state
mutations and optional analytics cache invalidation callback.

Functions raise HTTPException on validation errors.
"""
from __future__ import annotations

from datetime import datetime
from fastapi import HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore

from app.models import Order, OrderVehicle


def start_wash(db: Session, order_id: str, *, vehicle_id: str | None) -> dict:
    """Idempotently start a wash.

    Ensures:
    - Order exists
    - vehicle_id provided & (if not yet linked) attaches vehicle
    - Cannot start after completion
    - Sets started_at only on first invocation
    - Normalizes status to in_progress (unless already completed)
    """
    # Defensive casting: order_id path param arrives as str; ensure int PK lookup
    try:
        oid = int(order_id)
    except (TypeError, ValueError):
        raise HTTPException(404, "Order not found")
    order = db.query(Order).filter_by(id=oid).first()
    if not order:
        raise HTTPException(404, "Order not found")
    if not vehicle_id:
        raise HTTPException(400, "vehicle_id required")

    # Attach vehicle if missing
    # vehicle_id may be int or str; normalize
    try:
        vid = int(vehicle_id) if vehicle_id is not None else None
    except (TypeError, ValueError):
        raise HTTPException(400, "Invalid vehicle_id")
    existing = db.query(OrderVehicle).filter_by(order_id=oid, vehicle_id=vid).first()
    if not existing:
        db.add(OrderVehicle(order_id=oid, vehicle_id=vid))

    if order.ended_at:
        raise HTTPException(400, "Wash already completed")

    newly_started = False
    if not order.started_at:
        order.started_at = datetime.utcnow()
        newly_started = True

    if order.status not in ("in_progress", "completed"):
        order.status = "in_progress"
    db.commit()
    return {
        "status": "started" if newly_started else "already_started",
        "order_status": order.status,
    "order_id": oid,
        "started_at": order.started_at,
    }


def end_wash(db: Session, order_id: str, *, invalidate_analytics_cb=None) -> dict:
    """Idempotently end a wash and compute duration.

    Returns existing timestamps if already completed. Invokes optional
    invalidate_analytics_cb after successful completion (errors ignored).
    """
    try:
        oid = int(order_id)
    except (TypeError, ValueError):
        raise HTTPException(404, "Order not found")
    order = db.query(Order).filter_by(id=oid).first()
    if not order:
        raise HTTPException(404, "Order not found")

    if order.ended_at:
        duration_seconds = None
        if order.started_at and order.ended_at:
            duration_seconds = int((order.ended_at - order.started_at).total_seconds())
        return {
            "status": "already_completed",
            "order_id": oid,
            "ended_at": order.ended_at,
            "duration_seconds": duration_seconds,
        }

    if not order.started_at:
        raise HTTPException(400, "Cannot complete wash that has not started")

    order.ended_at = datetime.utcnow()
    order.status = "completed"
    db.commit()

    if invalidate_analytics_cb:
        try:
            invalidate_analytics_cb()
        except Exception:
            # Non‑critical; swallow to avoid failing user request
            pass

    duration_seconds = int((order.ended_at - order.started_at).total_seconds()) if order.started_at else None
    return {
        "status": "ended",
        "order_status": order.status,
        "order_id": oid,
        "ended_at": order.ended_at,
        "duration_seconds": duration_seconds,
    }
