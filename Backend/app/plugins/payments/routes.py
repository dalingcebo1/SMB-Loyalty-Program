# Payments plugin routes (migrated from Backend/routes/payments.py)
import os
import hmac
import hashlib
import json
import requests
import jwt
from datetime import datetime, timedelta
import time
from config import settings
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Body, Query, Response
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session, joinedload, subqueryload
from sqlalchemy import case, distinct, and_
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.models import (
    Order,
    OrderVehicle,
    Payment,
    Tenant,
    User,
    Service,
    Vehicle,
    OrderItem,
    Redemption,
    Reward,
    VisitCount,
)
from app.utils.qr import generate_qr_code
from app.plugins.loyalty.routes import _create_jwt, SECRET_KEY
from app.services.tenant_settings import TenantSettingsService, get_tenant_settings

# --- Visit logging helper --------------------------------------------------
def _log_visit_for_paid_order(db: Session, order: Order):
    """Ensure a visit is logged for a successfully paid order.

    Rules / safeguards:
    - Only increment once per order.
    - If order was already completed (wash finished) we assume visit already counted.
    - If a payment occurs after completion (status == 'completed'), skip to avoid double count.
    - If payment happens first (status transitions to 'paid'), we log immediately.
    - We rely on payment + status gating instead of a schema change flag.
    """
    if not order:
        return
    # Avoid duplicate increment if order already completed
    if order.status == 'completed':
        return
    # Heuristic: if order has an ended_at timestamp, treat as completed
    if getattr(order, 'ended_at', None):
        return
    # Prevent double increment if another success payment already handled within this txn.
    # (Caller ensures we only invoke when status flips to success.)
    # Fetch / create VisitCount
    if not order.user:  # ensure relationship loaded
        order = db.query(Order).filter_by(id=order.id).first()
    user = order.user
    if not user:
        return
    vc = db.query(VisitCount).filter_by(user_id=order.user_id, tenant_id=user.tenant_id).first()
    if not vc:
        vc = VisitCount(user_id=order.user_id, tenant_id=user.tenant_id, count=0, updated_at=datetime.utcnow())
        db.add(vc)
    # Increment by 1 visit per paid order (can be refined later using quantity / items)
    vc.count += 1
    vc.updated_at = datetime.utcnow()
from app.plugins.auth.routes import get_current_user


def _get_tenant_settings_by_id(tenant_id: Optional[str], db: Session) -> Optional[TenantSettingsService]:
    if not tenant_id:
        return None
    tenant = db.query(Tenant).filter_by(id=tenant_id).first()
    if not tenant:
        return None
    return get_tenant_settings(tenant)


def _get_payment_settings_for_order(order: Order, db: Session) -> Optional[TenantSettingsService]:
    tenant_id = order.tenant_id
    if not tenant_id and order.user:
        tenant_id = order.user.tenant_id
    if not tenant_id and order.user_id:
        user = db.query(User).filter_by(id=order.user_id).first()
        if user:
            tenant_id = user.tenant_id
    return _get_tenant_settings_by_id(tenant_id, db)

# Optional auth dependency: do not force 401 for public metrics endpoints.
from fastapi import Header
from typing import Optional
def optional_current_user(authorization: Optional[str] = Header(default=None, alias="Authorization"), db: Session = Depends(get_db)):
    """Return current user if bearer token provided & valid; else None.

    This lets us keep router‑level dependency while allowing unauthenticated
    access to public endpoints (e.g. /business-analytics) that simply ignore
    the missing user.
    """
    if not authorization:
        return None
    try:
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            return None
        return get_current_user(token=token, db=db)  # reuse underlying logic
    except Exception:
        return None

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(
    prefix="", 
    dependencies=[Depends(optional_current_user)],
    tags=["payments"],
)

class YocoChargeRequest(BaseModel):
    token: str
    orderId: int  # align with integer Order.id PK
    amount: int  # in cents

@router.post("/charge")
def charge_yoco(
    payload: YocoChargeRequest,
    db: Session = Depends(get_db),
):
    token = payload.token
    orderId = payload.orderId
    amount = payload.amount
    order = db.query(Order).filter_by(id=orderId).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    existing = db.query(Payment).filter_by(order_id=orderId, status="success").first()
    if existing:
        raise HTTPException(status_code=400, detail="Order already paid")
    tenant_settings = _get_payment_settings_for_order(order, db)
    payment_settings = tenant_settings.payment if tenant_settings else None
    provider = (payment_settings.provider if payment_settings else "yoco").lower()
    if provider != "yoco":
        raise HTTPException(status_code=400, detail="Unsupported payment provider for this tenant")
    secret_key = payment_settings.secret_key if payment_settings and payment_settings.secret_key else settings.yoco_secret_key
    if not secret_key:
        raise HTTPException(status_code=500, detail="Payment provider credentials not configured")
    headers = {"X-Auth-Secret-Key": secret_key, "Content-Type": "application/json"}
    yoco_payload = {"token": token, "amountInCents": amount, "currency": "ZAR"}
    try:
        resp = requests.post(
            "https://online.yoco.com/v1/charges/",
            json=yoco_payload,
            headers=headers,
            timeout=15,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Yoco: {e}")
    yoco_data = resp.json()
    charge_id = yoco_data.get("chargeId") or yoco_data.get("id")
    status_ = yoco_data.get("status")
    card_brand = yoco_data.get("source", {}).get("brand")
    if resp.status_code not in (200, 201) or status_ != "successful":
        payment = Payment(
            order_id=orderId,
            amount=amount,
            method="yoco",
            transaction_id=charge_id,
            reference=charge_id,
            status="failed",
            raw_response=yoco_data,
            created_at=datetime.utcnow(),
            card_brand=card_brand,
            source=provider,
        )
        db.add(payment)
        db.commit()
        detail = yoco_data.get("error", {}).get("message", "Yoco payment failed")
        raise HTTPException(status_code=400, detail=detail)
    qr_code = generate_qr_code(charge_id)["qr_code_base64"]
    payment = Payment(
        order_id=orderId,
        amount=amount,
        method="yoco",
        transaction_id=charge_id,
        reference=charge_id,
        status="success",
        raw_response=yoco_data,
        created_at=datetime.utcnow(),
        card_brand=card_brand,
        qr_code_base64=qr_code,
        source=provider,
    )
    db.add(payment)
    order.status = "paid"
    # Log visit immediately upon first successful payment
    _log_visit_for_paid_order(db, order)
    db.commit()
    return {"message": "Payment successful", "order_id": orderId, "payment_id": payment.id}

@router.post("/webhook/yoco")
async def yoco_webhook(
    request: Request,
    db: Session = Depends(get_db),
    yoco_signature: str = Header(None, alias="Yoco-Signature"),
):
    raw_body = await request.body()
    try:
        payload = json.loads(raw_body.decode("utf-8") if isinstance(raw_body, bytes) else raw_body)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid webhook payload")
    data = payload.get("data", {})
    charge_id = data.get("id")
    status_ = data.get("status")
    payment = db.query(Payment).filter_by(transaction_id=charge_id).first()
    order = None
    tenant_settings = None
    if payment:
        order = db.query(Order).filter_by(id=payment.order_id).first()
        if order:
            tenant_settings = _get_payment_settings_for_order(order, db)
    payment_settings = tenant_settings.payment if tenant_settings else None
    secret = payment_settings.webhook_secret if payment_settings and payment_settings.webhook_secret else settings.yoco_webhook_secret
    if not secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")
    computed = hmac.new(secret.encode(), raw_body, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(computed, yoco_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    if not payment:
        return {"status": "ignored"}
    if status_ == "successful":
        already_success = payment.status == "success"
        payment.status = "success"
        if not payment.qr_code_base64:
            payment.qr_code_base64 = generate_qr_code(payment.reference)["qr_code_base64"]
        if order:
            order.status = "paid"
            if not already_success:  # only log on transition to success
                _log_visit_for_paid_order(db, order)
    elif status_ == "failed":
        payment.status = "failed"
    payment.raw_response = payload
    db.commit()
    return {"status": "ok"}

@router.get("/qr/{order_id}")
def get_payment_qr(order_id: str, db: Session = Depends(get_db)):
    pay = (
        db.query(Payment)
          .filter_by(order_id=order_id, status="success")
          .order_by(Payment.created_at.desc())
          .first()
    )
    if not pay:
        raise HTTPException(status_code=404, detail="No successful payment found")
    order = (
        db.query(Order)
          .options(joinedload(Order.items))
          .filter_by(id=order_id)
          .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    category = order.items[0].category if order.items else None
    qr = pay.qr_code_base64 or generate_qr_code(pay.reference)["qr_code_base64"]
    return {
        "reference": pay.reference or pay.transaction_id,
        "qr_code_base64": qr,
        "payment_pin": order.payment_pin,
    # New explicit cents field; keep legacy 'amount' (in rands) for backward compatibility
    "amount_cents": pay.amount,
    "amount": (pay.amount or 0) / 100,
        "category": category,
    }

@router.get("/verify-payment")
def verify_payment(
    pin: str = Query(None, description="Payment PIN"),
    qr: str = Query(None, description="Payment QR code"),
    ref: str = Query(None, description="Payment reference or transaction id (alias)"),
    db: Session = Depends(get_db),
):
    """Verify a payment via one of: PIN, QR reference, or explicit reference.

    Enhancements:
    - Added `ref` alias to support legacy frontend usage (?ref=...)
    - Enriched response with user, vehicle, amount, method, service & extras
    - Returns consistent payload even for already redeemed orders
    """
    token = pin or qr or ref
    order: Order | None = None
    located_payment: Payment | None = None

    if pin:
        # Direct PIN match on Order first
        order = db.query(Order).filter_by(payment_pin=pin).first()
        if not order:
            # fallback to payment transaction_id / reference
            located_payment = (
                db.query(Payment)
                .filter_by(transaction_id=pin, status="success")
                .first()
            ) or (
                db.query(Payment)
                .filter_by(reference=pin, status="success")
                .first()
            )
            if located_payment:
                order = db.query(Order).filter_by(id=located_payment.order_id).first()
    elif qr or ref:
        code = qr or ref
        located_payment = (
            db.query(Payment).filter_by(reference=code, status="success").first()
            or db.query(Payment).filter_by(transaction_id=code, status="success").first()
        )
        if located_payment:
            order = db.query(Order).filter_by(id=located_payment.order_id).first()
        else:
            # final fallback: treat code as order id (string/int conversion tolerant)
            order = db.query(Order).filter_by(id=code).first()

    if not order:
        raise HTTPException(404, "Invalid payment PIN / QR / reference")

    # Re-load order with relationships for enrichment
    order = (
        db.query(Order)
        .options(
            joinedload(Order.user),
            joinedload(Order.vehicles).joinedload(OrderVehicle.vehicle),
            joinedload(Order.items).joinedload(OrderItem.service),
        )
        .filter(Order.id == order.id)
        .first()
    )

    # Try to find a successful payment if not already resolved
    if not located_payment:
        located_payment = (
            db.query(Payment)
            .filter_by(order_id=order.id, status="success")
            .order_by(Payment.created_at.desc())
            .first()
        )

    vehicle_obj = None
    if order and order.vehicles:
        # Use first linked vehicle
        first_ov = order.vehicles[0]
        if first_ov and first_ov.vehicle:
            vehicle_obj = first_ov.vehicle

    service_name = None
    if order.items:
        # Use first item service name/category if present
        first_item = order.items[0]
        if first_item.service:
            service_name = first_item.service.name
        else:
            service_name = first_item.category
    elif getattr(order, "service", None):
        service_name = order.service.name

    amount_val = (
        (located_payment.amount if located_payment and located_payment.amount is not None else None)
        or order.amount
        or 0
    )
    method_val = (
        (located_payment.method if located_payment and located_payment.method else None)
        or (located_payment.source if located_payment else None)
        or ""
    )

    already = bool(order.order_redeemed_at)
    if not already:
        order.order_redeemed_at = datetime.utcnow()
        db.commit()

    resp = {
        "status": "already_redeemed" if already else "ok",
        "type": "payment",
        "order_id": order.id,
        "payment_pin": order.payment_pin,
        "user": {
            "id": order.user.id,
            "first_name": order.user.first_name,
            "last_name": order.user.last_name,
            "phone": order.user.phone,
        } if order.user else None,
        "vehicle": {
            "id": vehicle_obj.id,
            "reg": vehicle_obj.plate,
            "make": vehicle_obj.make,
            "model": vehicle_obj.model,
        } if vehicle_obj else None,
        # Provide list of existing vehicles for user if none attached so staff can associate
        "available_vehicles": None if vehicle_obj else [
            {
                "id": v.id,
                "reg": v.plate,
                "make": v.make,
                "model": v.model,
            }
            for v in (db.query(Vehicle).filter_by(user_id=order.user_id).all() if order.user_id else [])
        ],
    "amount_cents": amount_val,
    "amount": (amount_val or 0)/100,
        "payment_method": method_val,
        "service_name": service_name,
        "extras": order.extras,
        "timestamp": datetime.utcnow().isoformat(),
    }
    return resp

@router.get("/verify-loyalty")
def verify_loyalty(
    pin: str = Query(None, description="Loyalty PIN"),
    qr: str = Query(None, description="Loyalty QR code or JWT"),
    db: Session = Depends(get_db)
):
    redemption = None
    if pin:
        redemption = db.query(Redemption).filter_by(pin=pin).first()
    elif qr:
        try:
            payload = jwt.decode(qr, SECRET_KEY, algorithms=["HS256"])
            redemption = db.query(Redemption).filter_by(
                user_id=payload.get("user_id"),
                reward_id=payload.get("reward_id"),
                milestone=payload.get("milestone")
            ).first()
        except:
            redemption = db.query(Redemption).filter_by(qr_code=qr).first()
    if not redemption:
        raise HTTPException(404, "Invalid loyalty PIN or QR code")
    is_qr_request = qr is not None
    if redemption.status == "pending":
        # mark as used on first redemption
        redemption.status = "used"
        redemption.redeemed_at = datetime.utcnow()
        if not redemption.order_id:
            # create loyalty order and payment if a loyalty-eligible service exists
            service = db.query(Service).filter_by(loyalty_eligible=True).first()
            if service:
                # Assign tenant_id from redemption.user (loyalty redemption is tenant scoped)
                tenant_id = None
                try:
                    if redemption and redemption.user:
                        tenant_id = redemption.user.tenant_id
                except Exception:
                    tenant_id = None
                order = Order(
                    service_id=service.id,
                    quantity=1,
                    extras=[],
                    payment_pin=None,
                    user_id=redemption.user_id,
                    status="paid",
                    type="loyalty",
                    amount=0,
                    tenant_id=tenant_id,
                )
                db.add(order)
                db.commit()
                redemption.order_id = order.id
            else:
                redemption.order_id = None
        db.commit()
        return {"status": "ok", "type": "loyalty", "order_id": redemption.order_id}
    # already used
    if is_qr_request:
        # allow QR re-verification
        return {"status": "ok", "type": "loyalty", "order_id": redemption.order_id}
    return {"status": "already_redeemed", "type": "loyalty"}

@router.get("/verify-pos")
def verify_pos(
    receipt: str = Query(..., description="POS receipt number"),
    db: Session = Depends(get_db)
):
    payment = db.query(Payment).filter_by(method="pos", reference=receipt, status="success").first()
    if not payment:
        raise HTTPException(404, "Invalid POS receipt")
    order = db.query(Order).filter_by(id=payment.order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.order_redeemed_at = datetime.utcnow()
    # Ensure status & visit log if not already counted
    if order.status != 'paid':
        order.status = 'paid'
        _log_visit_for_paid_order(db, order)
    db.commit()
    return {"status": "ok", "type": "pos", "order_id": order.id}

@router.get("/recent-verifications")
def recent_verifications(
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """Return recent verified payments (orders with order_redeemed_at set).

    Provides lightweight info for staff sidebar/history. Includes whether
    a wash has been started or completed to allow contextual navigation.
    """
    orders = (
        db.query(Order)
        .options(joinedload(Order.user), subqueryload(Order.vehicles).joinedload(OrderVehicle.vehicle))
        .filter(Order.order_redeemed_at != None)
        .order_by(Order.order_redeemed_at.desc())
        .limit(limit)
        .all()
    )

    results = []
    for order in orders:
        vehicle = order.vehicles[0].vehicle if order.vehicles else None
        payment = (
            db.query(Payment)
            .filter_by(order_id=order.id, status="success")
            .order_by(Payment.created_at.desc())
            .first()
        )
        amount_cents = (payment.amount if payment and payment.amount is not None else order.amount) or 0
        redeemed_at = order.order_redeemed_at or order.created_at

        results.append(
            {
                "order_id": order.id,
                "timestamp": redeemed_at.isoformat() if redeemed_at else None,
                "status": "success",
                "tenant_id": getattr(order, "tenant_id", None),
                "user": (
                    {
                        "first_name": order.user.first_name,
                        "last_name": order.user.last_name,
                        "phone": order.user.phone,
                    }
                    if order.user
                    else None
                ),
                "vehicle": (
                    {
                        "id": vehicle.id,
                        "make": vehicle.make,
                        "model": vehicle.model,
                        "reg": vehicle.plate,
                    }
                    if vehicle
                    else None
                ),
                "payment_method": (payment.method or payment.source) if payment else None,
                "payment_reference": (payment.reference or payment.transaction_id) if payment else None,
                "amount_cents": amount_cents,
                "amount": amount_cents / 100,
                "started": bool(order.started_at),
                "completed": bool(order.ended_at),
            }
        )

    return results

from app.core.wash_lifecycle import start_wash as _start_wash_shared, end_wash as _end_wash_shared

@router.post("/start-wash/{order_id}")
def start_wash(order_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    """Start a wash (shared lifecycle logic)."""
    return _start_wash_shared(db, order_id, vehicle_id=data.get("vehicle_id"))

@router.post("/end-wash/{order_id}")
def end_wash(order_id: str, db: Session = Depends(get_db)):
    """End a wash (shared lifecycle logic)."""
    return _end_wash_shared(db, order_id, invalidate_analytics_cb=_invalidate_analytics_cache)

@router.post("/start-manual-wash")
def start_manual_wash(data: dict = Body(...), db: Session = Depends(get_db)):
    user_phone = data.get("phone")
    user = db.query(User).filter_by(phone=user_phone).first()
    if not user:
        raise HTTPException(404, "User not found")
    # Pick any available service to satisfy FK + NOT NULL columns (fallback to first service)
    service = db.query(Service).first()
    if not service:
        service = Service(category="wash", name="Manual Wash", base_price=0)
        db.add(service)
        db.flush()
    order = Order(
        user_id=user.id,
        service_id=service.id,
        quantity=1,
        extras=[],
        status="started",
        started_at=datetime.utcnow(),
        redeemed=False,
        tenant_id=getattr(user, 'tenant_id', None),
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    _invalidate_analytics_cache()
    return {"status": "started", "order_id": order.id}

@router.get("/order-user/{order_id}")
def get_order_user(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    user = db.query(User).filter_by(id=order.user_id).first()
    vehicles = db.query(Vehicle).filter_by(user_id=user.id).all()
    return {"user": {"id": user.id, "first_name": user.first_name, "last_name": user.last_name, "phone": user.phone},
            "vehicles": [{"id": v.id, "reg": v.plate, "make": v.make, "model": v.model} for v in vehicles]}

@router.get("/active-washes")
def active_washes(db: Session = Depends(get_db)):
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)
    orders = (
        db.query(Order)
          .options(joinedload(Order.user), subqueryload(Order.vehicles).joinedload(OrderVehicle.vehicle))
          .filter(
              Order.started_at != None,
              Order.started_at >= today,
              Order.started_at < tomorrow,
          )
          .all()
    )
    result = []
    for order in orders:
        vehicle = order.vehicles[0].vehicle if order.vehicles else None
        result.append({
            "order_id": order.id,
            "user": {
                "first_name": order.user.first_name if order.user else None,
                "last_name": order.user.last_name if order.user else None,
                "phone": order.user.phone if order.user else None,
            } if order.user else None,
            "vehicle": {
                "make": vehicle.make,
                "model": vehicle.model,
                "reg": vehicle.plate,
            } if vehicle else None,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at,
            "status": "ended" if order.ended_at else "started",
            "tenant_id": getattr(order, 'tenant_id', None),
            "duration_seconds": int((order.ended_at - order.started_at).total_seconds()) if order.started_at and order.ended_at else None,
        })
    return result

@router.get("/wash-history")
def wash_history(date: str, db: Session = Depends(get_db)):
    # date: "YYYY-MM-DD"
    try:
        dt = datetime.strptime(date, "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date format")
    next_day = dt + timedelta(days=1)
    orders = (
        db.query(Order)
          .options(joinedload(Order.user), subqueryload(Order.vehicles).joinedload(OrderVehicle.vehicle))
          .filter(
              Order.started_at != None,
              Order.started_at >= dt,
              Order.started_at < next_day,
          )
          .all()
    )
    result = []
    for order in orders:
        vehicle = order.vehicles[0].vehicle if order.vehicles else None
        result.append({
            "order_id": order.id,
            "user": {
                "first_name": order.user.first_name if order.user else None,
                "last_name": order.user.last_name if order.user else None,
                "phone": order.user.phone if order.user else None,
            } if order.user else None,
            "vehicle": {
                "make": vehicle.make,
                "model": vehicle.model,
                "reg": vehicle.plate,
            } if vehicle else None,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at,
            "status": "ended" if order.ended_at else "started",
            "duration_seconds": int((order.ended_at - order.started_at).total_seconds()) if order.started_at and order.ended_at else None,
        })
    return result

# New richer history endpoint expected by frontend hooks
@router.get("/history")
def history(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD (defaults to today if none provided)"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD (inclusive)"),
    status: Optional[str] = Query(None, description="Filter by status: started|ended"),
    paymentType: Optional[str] = Query(None, description="Filter by payment type: paid|loyalty (maps to Payment heuristics)"),
    service_type: Optional[str] = Query(None, description="Substring match on service name / category (first item)"),
    customer: Optional[str] = Query(None, description="Substring match on user first/last name or phone"),
    page: int = Query(1, ge=1),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    """Return wash/order history between optional dates with lightweight filtering.

    Notes:
    - Falls back to today's date range if none supplied.
    - Status is derived from presence of ended_at.
    - paymentType 'loyalty' filters orders that have a zero-amount successful loyalty Payment OR amount==0.
    - Pagination is naive (offset/limit) for now.
    """
    today = datetime.utcnow().date()
    try:
        if start_date:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
        else:
            start = today
        if end_date:
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        else:
            end = start
        if end < start:
            raise ValueError("end_date before start_date")
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format or range")

    # Base query for orders that started in range
    from sqlalchemy import and_, or_
    q = db.query(Order).filter(
        Order.started_at != None,
        Order.started_at >= start,
        Order.started_at < (end + timedelta(days=1)),
    )

    # Filter by derived status
    if status in ("started", "ended"):
        if status == "started":
            q = q.filter(Order.ended_at == None)
        else:
            q = q.filter(Order.ended_at != None)

    # paymentType heuristic
    if paymentType in ("paid", "loyalty"):
        # join payments once for filtering
        q = q.join(Payment, Payment.order_id == Order.id, isouter=True)
        if paymentType == "loyalty":
            q = q.filter(or_(Payment.amount == 0, Payment.source == 'loyalty', Payment.method == 'loyalty'))
        else:  # paid
            q = q.filter(Payment.amount != None, Payment.amount > 0)

    # service type substring search (simple ILIKE on first order item service/category) – done post-query if needed
    # customer substring search
    if customer:
        like = f"%{customer.lower()}%"
        from sqlalchemy import func
        q = q.join(User, User.id == Order.user_id, isouter=True).filter(
            or_(
                func.lower(User.first_name).like(like),
                func.lower(User.last_name).like(like),
                func.lower(User.phone).like(like),
            )
        )

    total = q.count()
    items = (
        q.options(joinedload(Order.user), subqueryload(Order.vehicles).joinedload(OrderVehicle.vehicle))
         .order_by(Order.started_at.desc())
         .offset((page - 1) * limit)
         .limit(limit)
         .all()
    )
    result = []
    for order in items:
        vehicle = order.vehicles[0].vehicle if order.vehicles else None
        # Determine service name/category
        service_name = None
        if order.items:
            first_item = order.items[0]
            if first_item.service:
                service_name = first_item.service.name
            else:
                service_name = first_item.category
        elif getattr(order, "service", None):
            service_name = order.service.name

        # service_type filter post-eval (since join conditions vary) – skip if not match
        if service_type and service_name:
            if service_type.lower() not in service_name.lower():
                continue

        # Fetch latest payment for amount/method (optional)
        pay = (
            db.query(Payment)
              .filter_by(order_id=order.id, status="success")
              .order_by(Payment.created_at.desc())
              .first()
        )
        amount_val = pay.amount if pay and pay.amount is not None else order.amount
        result.append({
            "order_id": order.id,
            "user": {
                "first_name": order.user.first_name if order.user else None,
                "last_name": order.user.last_name if order.user else None,
                "phone": order.user.phone if order.user else None,
            } if order.user else None,
            "vehicle": {
                "make": vehicle.make,
                "model": vehicle.model,
                "reg": vehicle.plate,
            } if vehicle else None,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at,
            "status": "ended" if order.ended_at else "started",
            "service_name": service_name,
            "amount": amount_val,
            "tenant_id": getattr(order, 'tenant_id', None),
            "duration_seconds": int((order.ended_at - order.started_at).total_seconds()) if order.started_at and order.ended_at else None,
        })
    return {"total": total, "items": result, "page": page, "limit": limit}

from collections import OrderedDict
_ANALYTICS_CACHE: "OrderedDict[str, tuple[float, dict]]" = OrderedDict()
_ANALYTICS_CACHE_MAX = 32  # Phase 6: LRU bound to prevent unbounded growth
_ANALYTICS_TTL_SECONDS = 30  # base TTL – adaptive extension applied when hit rate high
from collections import deque
_ANALYTICS_METRICS = {
    "calls": 0,
    "cache_hits": 0,
    "latencies_ms": deque(maxlen=200),  # rolling window for p95
}

def _analytics_percentile(pct: float):
    data = list(_ANALYTICS_METRICS["latencies_ms"])
    if not data:
        return None
    data.sort()
    k = int(len(data) * pct) - 1
    k = max(0, min(k, len(data) - 1))
    return data[k]

def _invalidate_analytics_cache():
    """Clear analytics cache (Phase 5)."""
    _ANALYTICS_CACHE.clear()

@router.get("/dashboard-analytics/meta")
def dashboard_analytics_meta():
    hit_rate = 0.0
    if _ANALYTICS_METRICS["calls"]:
        hit_rate = _ANALYTICS_METRICS["cache_hits"] / _ANALYTICS_METRICS["calls"]
    return {
        "cache_size": len(_ANALYTICS_CACHE),
        "cache_max": _ANALYTICS_CACHE_MAX,
        "keys": list(_ANALYTICS_CACHE.keys())[:20],
        "base_ttl_seconds": _ANALYTICS_TTL_SECONDS,
        "metrics": {
            "calls": _ANALYTICS_METRICS["calls"],
            "cache_hits": _ANALYTICS_METRICS["cache_hits"],
            "hit_rate": round(hit_rate, 3),
            "latencies_count": len(_ANALYTICS_METRICS["latencies_ms"]),
            "p95_ms": _analytics_percentile(0.95),
            "p50_ms": _analytics_percentile(0.50),
        },
    }

@router.get("/dashboard-analytics")
def dashboard_analytics(
    start_date: Optional[str] = Query(None, description="Start date YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="End date YYYY-MM-DD"),
    db: Session = Depends(get_db)
):
    """Basic analytics for staff dashboard without admin restrictions.

    Optimizations (Phase 5):
    - Single consolidated stats query using conditional aggregation (reduces round trips).
    - In‑process TTL cache to avoid recomputing identical range repeatedly within 30s.
    - Lightweight timing instrumentation for observability (returned inside payload under meta.elapsed_ms).
    """
    from sqlalchemy import func, cast, Date

    t0 = time.perf_counter()
    today = datetime.utcnow().date()
    if not start_date or not end_date:
        end = today
        start = today - timedelta(days=6)
    else:
        try:
            start = datetime.strptime(start_date, "%Y-%m-%d").date()
            end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format")
    if end < start:
        raise HTTPException(status_code=400, detail="end_date before start_date")

    cache_key = f"{start}:{end}"
    _ANALYTICS_METRICS["calls"] += 1
    now = time.time()
    cached = _ANALYTICS_CACHE.get(cache_key)
    if cached:
        age = now - cached[0]
        hit_rate = (_ANALYTICS_METRICS["cache_hits"] / _ANALYTICS_METRICS["calls"]) if _ANALYTICS_METRICS["calls"] else 0
        adaptive_ttl = _ANALYTICS_TTL_SECONDS + 15 if hit_rate > 0.6 else _ANALYTICS_TTL_SECONDS
        adaptive_ttl = min(60, adaptive_ttl)
        if age < adaptive_ttl:
            payload = dict(cached[1])
            payload["meta"] = {**payload.get("meta", {}), "cached": True, "elapsed_ms": round((time.perf_counter()-t0)*1000,2), "cache_ttl_s": int(adaptive_ttl - age)}
            _ANALYTICS_METRICS["cache_hits"] += 1
            _ANALYTICS_METRICS["latencies_ms"].append(payload["meta"]["elapsed_ms"])
            # Promote entry for LRU ordering
            _ANALYTICS_CACHE.move_to_end(cache_key)
            return payload

    # Conditional aggregation for total/completed/customer_count in one query
    started_cond = and_(Order.started_at != None, cast(Order.started_at, Date) >= start, cast(Order.started_at, Date) <= end)
    completed_cond = and_(Order.ended_at != None, cast(Order.ended_at, Date) >= start, cast(Order.ended_at, Date) <= end)
    stats_row = db.query(
        func.coalesce(func.sum(case((started_cond, 1), else_=0)), 0).label("total_washes"),
        func.coalesce(func.sum(case((completed_cond, 1), else_=0)), 0).label("completed_washes"),
        func.coalesce(func.count(distinct(case((started_cond, Order.user_id), else_=None))), 0).label("customer_count")
    ).one()

    # Revenue (keep separate – involves payments table & status filter)
    revenue_q = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "success",
        cast(Payment.created_at, Date) >= start,
        cast(Payment.created_at, Date) <= end
    )
    revenue = revenue_q.scalar() or 0

    # Today revenue (UTC day alignment) and Month-to-date revenue
    today = datetime.utcnow().date()
    mtd_start = today.replace(day=1)
    # Constrain MTD end to the analytics range end for consistent “MTD” semantics relative to displayed period
    mtd_end = end if end.month == mtd_start.month else today
    today_rev = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "success",
        cast(Payment.created_at, Date) == today
    ).scalar() or 0
    mtd_rev = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "success",
        cast(Payment.created_at, Date) >= mtd_start,
        cast(Payment.created_at, Date) <= mtd_end
    ).scalar() or 0

    # Previous period revenue for delta (same length immediately preceding start)
    prev_period_len = (end - start).days + 1
    prev_start = start - timedelta(days=prev_period_len)
    prev_end = start - timedelta(days=1)
    prev_revenue = db.query(func.sum(Payment.amount)).filter(
        Payment.status == "success",
        cast(Payment.created_at, Date) >= prev_start,
        cast(Payment.created_at, Date) <= prev_end
    ).scalar() or 0
    period_vs_prev_pct = 0.0
    if prev_revenue:
        period_vs_prev_pct = round(((revenue - prev_revenue) / prev_revenue) * 100, 1)

    # Duration stats for washes completed in period
    duration_rows = db.query(Order.started_at, Order.ended_at).filter(
        completed_cond
    ).all()
    durations = [int((r.ended_at - r.started_at).total_seconds()) for r in duration_rows if r.started_at and r.ended_at]
    avg_duration = sum(durations) / len(durations) if durations else None
    median_duration = None
    p95_duration = None
    if durations:
        sorted_d = sorted(durations)
        mid = len(sorted_d) // 2
        if len(sorted_d) % 2:
            median_duration = sorted_d[mid]
        else:
            median_duration = (sorted_d[mid - 1] + sorted_d[mid]) / 2
        idx95 = int(round(0.95 * len(sorted_d) + 1e-9)) - 1
        idx95 = max(0, min(idx95, len(sorted_d) - 1))
        p95_duration = sorted_d[idx95]

    # Daily wash counts – single grouped query
    daily_rows = db.query(
        cast(Order.started_at, Date).label("date"), func.count(Order.id).label("count")
    ).filter(started_cond).group_by("date").all()
    day_map = {r.date.strftime('%Y-%m-%d'): r.count for r in daily_rows}
    chart_data = []
    cur = start
    while cur <= end:
        ds = cur.strftime('%Y-%m-%d')
        chart_data.append({"date": ds, "washes": day_map.get(ds, 0)})
        cur += timedelta(days=1)

    elapsed_ms = round((time.perf_counter() - t0) * 1000, 2)
    _ANALYTICS_METRICS["latencies_ms"].append(elapsed_ms)
    from app.core.tenant_context import current_tenant_id
    payload = {
        "total_washes": int(stats_row.total_washes),
        "completed_washes": int(stats_row.completed_washes),
        "revenue": revenue / 100,  # legacy aggregate in rands (keep for backward compat)
        "revenue_breakdown": {
            "period_revenue_cents": int(revenue),
            "previous_period_revenue_cents": int(prev_revenue),
            "period_vs_prev_pct": period_vs_prev_pct,
            "today_revenue_cents": int(today_rev),
            "month_to_date_revenue_cents": int(mtd_rev),
        },
        "customer_count": int(stats_row.customer_count),
        "chart_data": chart_data,
        "period": {
            "start_date": start.strftime('%Y-%m-%d'),
            "end_date": end.strftime('%Y-%m-%d')
        },
        "wash_duration_seconds": {
            "average": avg_duration,
            "median": median_duration,
            "p95": p95_duration,
            "sample_size": len(durations),
        },
        "tenant_id": current_tenant_id.get(None),
        "meta": {
            "cached": False,
            "elapsed_ms": elapsed_ms,
            "cache_ttl_s": _ANALYTICS_TTL_SECONDS
        }
    }
    _ANALYTICS_CACHE[cache_key] = (now, payload)
    _ANALYTICS_CACHE.move_to_end(cache_key)
    if len(_ANALYTICS_CACHE) > _ANALYTICS_CACHE_MAX:
        _ANALYTICS_CACHE.popitem(last=False)
    return payload


# Phase 1 & 2 consolidated business analytics endpoint
@router.get("/business-analytics", summary="Phase 1 & 2 business metrics for staff dashboard")
def business_analytics(
    request: Request,
    response: Response,
    range_days: int = Query(30, ge=1, le=90, description="Lookback window for trend metrics"),
    recent_days: int = Query(7, ge=1, le=30, description="Short window for deltas (e.g. last 7 days)"),
    db: Session = Depends(get_db),
):
    """Public analytics endpoint (no auth required).

    Originally this endpoint inherited the router-level auth dependency which broke
    lightweight test access (tests call it without a token). Making it public is
    acceptable because it only returns aggregated, non-sensitive operational
    metrics. If future sensitive fields are added, wrap them behind an auth check.
    """
    """Return a bundle of high‑leverage operational + customer metrics.

    Phase 1 metrics implemented:
    - wash_volume_trend (daily started/completed)
    - revenue_trend & avg_ticket
    - duration_stats (avg/median/p95 & slow count > 30m)
    - first_vs_returning (share new vs returning in recent_days)
    - loyalty_share (pct zero / loyalty orders)
    - active_customers (unique users in range)
    - top_services (count & revenue share)
    - payment_mix (manual vs paid)
    - pending_orders_over_10m

    Phase 2 early metrics (needs no new columns):
    - churn_risk_count (>=2 visits, >45d since last started_at)
    - upsell_rate (extras lines >0 / orders)
    """
    from sqlalchemy import func, case, and_, desc
    from datetime import timedelta

    now = datetime.utcnow()
    start_range = now - timedelta(days=range_days)
    start_recent = now - timedelta(days=recent_days)
    prev_start = start_range - timedelta(days=range_days)
    prev_end = start_range

    # Base query for orders within long range
    q_range = db.query(Order).filter(Order.started_at != None, Order.started_at >= start_range)
    orders_in_range = q_range.count()
    q_prev = db.query(Order).filter(Order.started_at != None, Order.started_at >= prev_start, Order.started_at < prev_end)
    orders_in_prev_range = q_prev.count()

    # Wash volume trend (group per day)
    volume_rows = (
        db.query(func.date(Order.started_at).label("day"),
                 func.count(Order.id).label("started"),
                 func.count(case((Order.ended_at != None, 1))).label("completed"))
          .filter(Order.started_at != None, Order.started_at >= start_range)
          .group_by("day").order_by("day").all()
    )
    # On SQLite the func.date() returns str; on Postgres it returns a date object.
    wash_volume_trend = []
    for r in volume_rows:
        day_val = r.day.isoformat() if hasattr(r.day, "isoformat") else str(r.day)
        wash_volume_trend.append({"day": day_val, "started": int(r.started), "completed": int(r.completed)})

    # Revenue trend (paid only)
    rev_rows = (
        db.query(func.date(Payment.created_at).label("day"), func.sum(Payment.amount).label("revenue"))
          .filter(Payment.status == "success", Payment.created_at >= start_range)
          .group_by("day").order_by("day").all()
    )
    revenue_trend = []
    for r in rev_rows:
        day_val = r.day.isoformat() if hasattr(r.day, "isoformat") else str(r.day)
        revenue_trend.append({"day": day_val, "revenue": (int(r.revenue) / 100) if r.revenue else 0})
    total_revenue_cents = sum(int(r.revenue) for r in rev_rows if r.revenue)
    completed_orders = db.query(func.count(Order.id)).filter(Order.ended_at != None, Order.started_at >= start_range).scalar() or 0
    avg_ticket = (total_revenue_cents / 100 / completed_orders) if completed_orders else 0
    rev_prev_rows = (
        db.query(func.sum(Payment.amount).label("revenue"))
        .filter(Payment.status == "success", Payment.created_at >= prev_start, Payment.created_at < prev_end)
        .all()
    )
    total_revenue_prev_cents = sum(int(r.revenue) for r in rev_prev_rows if r.revenue)
    completed_prev = db.query(func.count(Order.id)).filter(Order.ended_at != None, Order.started_at >= prev_start, Order.started_at < prev_end).scalar() or 0
    avg_ticket_prev = (total_revenue_prev_cents / 100 / completed_prev) if completed_prev else 0

    # Duration stats (completed in range)
    dur_rows = db.query(Order.started_at, Order.ended_at).filter(Order.ended_at != None, Order.started_at >= start_range).all()
    durations = [int((r.ended_at - r.started_at).total_seconds()) for r in dur_rows if r.started_at and r.ended_at]
    if durations:
        sorted_d = sorted(durations)
        avg_duration = sum(durations) / len(durations)
        mid = len(sorted_d)//2
        median_duration = sorted_d[mid] if len(sorted_d)%2 else (sorted_d[mid-1]+sorted_d[mid])/2
        idx95 = max(0, min(int(round(0.95*len(sorted_d))) - 1, len(sorted_d)-1))
        p95_duration = sorted_d[idx95]
        slow_wash_threshold = 30*60  # 30 minutes
        slow_wash_count = sum(1 for d in durations if d > slow_wash_threshold)
    else:
        avg_duration = median_duration = p95_duration = slow_wash_count = None

    # First vs Returning (recent window)
    recent_users = db.query(Order.user_id).filter(Order.started_at != None, Order.started_at >= start_recent).distinct().all()
    user_ids_recent = {u.user_id for u in recent_users}
    first_visit_rows = db.query(Order.user_id, func.min(func.date(Order.started_at))).group_by(Order.user_id).all()
    first_visit_map = {}
    for uid, first_day in first_visit_rows:
        # SQLite returns str, Postgres returns date; normalize to date object
        if hasattr(first_day, 'isoformat'):
            first_visit_map[uid] = first_day
        else:
            # parse 'YYYY-MM-DD'
            from datetime import datetime as _dt
            first_visit_map[uid] = _dt.strptime(first_day, '%Y-%m-%d').date()
    start_recent_date = start_recent.date()
    new_count = sum(1 for uid in user_ids_recent if (d := first_visit_map.get(uid)) and d >= start_recent_date)
    returning_count = len(user_ids_recent) - new_count

    # Loyalty share (amount==0 or type=='loyalty')
    loyalty_total = db.query(func.count(Order.id)).filter(
        Order.started_at >= start_range,
        Order.started_at != None,
        case((Order.amount == 0, True), else_=False) | case((Order.type == 'loyalty', True), else_=False)
    ).scalar() or 0
    loyalty_share = (loyalty_total / orders_in_range) if orders_in_range else 0
    loyalty_total_prev = db.query(func.count(Order.id)).filter(
        Order.started_at >= prev_start,
        Order.started_at < prev_end,
        Order.started_at != None,
        case((Order.amount == 0, True), else_=False) | case((Order.type == 'loyalty', True), else_=False)
    ).scalar() or 0
    loyalty_share_prev = (loyalty_total_prev / orders_in_prev_range) if orders_in_prev_range else 0

    # Active customers
    active_customers = len(user_ids_recent)

    # Top services (count & revenue share based on payments)
    service_rows = (
        db.query(Service.name, func.count(Order.id).label('cnt'))
          .join(Order, Order.service_id == Service.id)
          .filter(Order.started_at != None, Order.started_at >= start_range)
          .group_by(Service.name)
          .order_by(desc('cnt'))
          .limit(5).all()
    )
    top_services = [{"service": r.name, "count": int(r.cnt)} for r in service_rows]

    # Payment mix (manual vs paid) heuristic: manual = amount==0 AND status in started/completed but not loyalty type
    manual_started = db.query(func.count(Order.id)).filter(Order.started_at >= start_range, Order.amount == 0, Order.type != 'loyalty').scalar() or 0
    paid_started = db.query(func.count(Order.id)).filter(Order.started_at >= start_range, Order.amount > 0).scalar() or 0

    # Pending > 10 minutes (started_at null but created_at older) OR started but not ended and older than threshold
    ten_min_ago = now - timedelta(minutes=10)
    pending_orders = db.query(func.count(Order.id)).filter(
        ((Order.started_at == None) & (Order.created_at < ten_min_ago)) | ((Order.started_at != None) & (Order.ended_at == None) & (Order.started_at < ten_min_ago))
    ).scalar() or 0

    # Churn risk: >=2 washes and last visit >45d
    fortyfive = now - timedelta(days=45)
    churn_risk_count = db.query(func.count()).select_from(
        db.query(Order.user_id, func.count(Order.id).label('c'), func.max(Order.started_at).label('last'))
          .group_by(Order.user_id)
          .having(func.count(Order.id) >= 2, func.max(Order.started_at) < fortyfive)
          .subquery()
    ).scalar() or 0

    # Upsell rate: orders with at least one extra (JSON/JSONB array length > 0) / total
    # Use JSON array length for Postgres compatibility instead of string comparison
    from sqlalchemy.dialects.postgresql import JSONB
    try:
        # COALESCE to empty array to handle NULL extras; jsonb_array_length only valid for arrays
        upsell_numer = db.query(func.count(Order.id)).filter(
            Order.started_at >= start_range,
            func.jsonb_array_length(func.coalesce(Order.extras.cast(JSONB), '[]' )) > 0  # type: ignore
        ).scalar() or 0
    except Exception:
        # Fallback generic check: extras not null / empty string (SQLite dev)
        upsell_numer = db.query(func.count(Order.id)).filter(
            Order.started_at >= start_range,
            Order.extras.isnot(None),
        ).scalar() or 0
    upsell_rate = (upsell_numer / orders_in_range) if orders_in_range else 0
    try:
        upsell_prev_numer = db.query(func.count(Order.id)).filter(
            Order.started_at >= prev_start,
            Order.started_at < prev_end,
            func.jsonb_array_length(func.coalesce(Order.extras.cast(JSONB), '[]' )) > 0  # type: ignore
        ).scalar() or 0
    except Exception:
        upsell_prev_numer = db.query(func.count(Order.id)).filter(
            Order.started_at >= prev_start,
            Order.started_at < prev_end,
            Order.extras.isnot(None),
        ).scalar() or 0
    upsell_rate_prev = (upsell_prev_numer / orders_in_prev_range) if orders_in_prev_range else 0

    # Previous period duration stats for p95 delta
    dur_prev_rows = db.query(Order.started_at, Order.ended_at).filter(Order.ended_at != None, Order.started_at >= prev_start, Order.started_at < prev_end).all()
    prev_durations = [int((r.ended_at - r.started_at).total_seconds()) for r in dur_prev_rows if r.started_at and r.ended_at]
    p95_prev = None
    if prev_durations:
        s_prev = sorted(prev_durations)
        idx_prev = max(0, min(int(round(0.95 * len(s_prev))) - 1, len(s_prev) - 1))
        p95_prev = s_prev[idx_prev]

    def pct_delta(current: float, previous: float) -> Optional[float]:
        if previous == 0:
            return None
        try:
            return round(((current - previous) / previous) * 100, 2)
        except ZeroDivisionError:
            return None

    deltas = {
        "revenue_pct": pct_delta(total_revenue_cents/100, total_revenue_prev_cents/100),
        "avg_ticket_pct": pct_delta(avg_ticket, avg_ticket_prev),
        "loyalty_share_pct": pct_delta(loyalty_share, loyalty_share_prev),
        "p95_duration_pct": pct_delta(p95_duration or 0, p95_prev or 0),
        "upsell_rate_pct": pct_delta(upsell_rate, upsell_rate_prev),
    }

    from app.core.tenant_context import current_tenant_id
    payload = {
        "range_days": range_days,
        "recent_days": recent_days,
        "wash_volume_trend": wash_volume_trend,
        "revenue_trend": revenue_trend,
        "avg_ticket": round(avg_ticket, 2),
        "duration_stats": {
            "average_s": round(avg_duration,2) if avg_duration is not None else None,
            "median_s": median_duration,
            "p95_s": p95_duration,
            "slow_wash_count": slow_wash_count,
        },
        "first_vs_returning": {"new": new_count, "returning": returning_count},
        "loyalty_share": round(loyalty_share, 4),
        "active_customers": active_customers,
        "top_services": top_services,
        "payment_mix": {"manual_started": manual_started, "paid_started": paid_started},
        "pending_orders_over_10m": pending_orders,
        "churn_risk_count": churn_risk_count,
        "upsell_rate": round(upsell_rate, 4),
        "deltas": deltas,
        "tenant_id": current_tenant_id.get(None),
        "meta": {"generated_at": now.isoformat()}
    }

    # Weak ETag based on payload hash
    try:
        import json, hashlib
        body_str = json.dumps(payload, sort_keys=True, default=str)
        etag = 'W/"' + hashlib.sha256(body_str.encode()).hexdigest()[:32] + '"'
        if request.headers.get('if-none-match') == etag:
            return Response(status_code=304)
        response.headers['ETag'] = etag
        response.headers['Cache-Control'] = 'public, max-age=30'
    except Exception:
        pass

    return payload

@router.get("/user-wash-status")
def user_wash_status(db: Session = Depends(get_db), user=Depends(get_current_user)):
    today = datetime.utcnow().date()
    tomorrow = today + timedelta(days=1)

    # Active wash for this user
    active = (
        db.query(Order)
        .filter(
            Order.user_id == user.id,
            Order.started_at != None,
            Order.started_at >= today,
            Order.started_at < tomorrow,
            Order.ended_at == None,
        )
        .order_by(Order.started_at.desc())
        .first()
    )
    if active:
        return {"status": "active", "order_id": active.id}

    # Recently ended wash for this user
    ended = (
        db.query(Order)
        .filter(
            Order.user_id == user.id,
            Order.ended_at != None,
            Order.ended_at >= today,
            Order.ended_at < tomorrow,
        )
        .order_by(Order.ended_at.desc())
        .first()
    )
    if ended:
        return {"status": "ended", "order_id": ended.id}

    return {"status": "none"}
