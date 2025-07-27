# Payments plugin routes (migrated from Backend/routes/payments.py)
import os
import hmac
import hashlib
import requests
import jwt
from datetime import datetime, timedelta
from config import settings
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Body, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from slowapi import Limiter
from slowapi.util import get_remote_address

from app.core.database import get_db
from app.models import Order, Payment, User, Vehicle, OrderVehicle, Redemption, Reward, Service
from app.utils.qr import generate_qr_code
from app.plugins.loyalty.routes import _create_jwt, SECRET_KEY
from app.plugins.auth.routes import get_current_user

YOCO_SECRET_KEY = settings.yoco_secret_key
YOCO_WEBHOOK_SECRET = settings.yoco_webhook_secret

limiter = Limiter(key_func=get_remote_address)

router = APIRouter(
    prefix="", 
    dependencies=[Depends(get_current_user)],
    tags=["payments"],
)

class YocoChargeRequest(BaseModel):
    token: str
    orderId: str
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
    headers = {"X-Auth-Secret-Key": YOCO_SECRET_KEY, "Content-Type": "application/json"}
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
        source="yoco",
    )
    db.add(payment)
    order.status = "paid"
    db.commit()
    return {"message": "Payment successful", "order_id": orderId, "payment_id": payment.id}

@router.post("/webhook/yoco")
async def yoco_webhook(
    request: Request,
    db: Session = Depends(get_db),
    yoco_signature: str = Header(None, alias="Yoco-Signature"),
):
    raw_body = await request.body()
    computed = hmac.new(
        YOCO_WEBHOOK_SECRET.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(computed, yoco_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")
    payload = await request.json()
    data = payload.get("data", {})
    charge_id = data.get("id")
    status_ = data.get("status")
    payment = db.query(Payment).filter_by(transaction_id=charge_id).first()
    if not payment:
        return {"status": "ignored"}
    if status_ == "successful":
        payment.status = "success"
        if not payment.qr_code_base64:
            payment.qr_code_base64 = generate_qr_code(payment.reference)["qr_code_base64"]
        order = db.query(Order).filter_by(id=payment.order_id).first()
        if order:
            order.status = "paid"
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
        "reference": pay.reference,
        "qr_code_base64": qr,
        "payment_pin": order.payment_pin,
        "amount": pay.amount,
        "category": category,
    }

@router.get("/verify-payment")
def verify_payment(
    pin: str = Query(None, description="Payment PIN"),
    qr: str = Query(None, description="Payment QR code"),
    db: Session = Depends(get_db)
):
    order = None
    if pin:
        # Try matching Order.payment_pin, else fallback to transaction_id or reference
        order = db.query(Order).filter_by(payment_pin=pin).first()
        if not order:
            # lookup Payment by transaction_id or reference
            payment = db.query(Payment).filter_by(transaction_id=pin, status="success").first()
            if not payment:
                payment = db.query(Payment).filter_by(reference=pin, status="success").first()
            if payment:
                order = db.query(Order).filter_by(id=payment.order_id).first()
    elif qr:
        payment = db.query(Payment).filter_by(reference=qr, status="success").first()
        if not payment:
            payment = db.query(Payment).filter_by(transaction_id=qr, status="success").first()
        if payment:
            order = db.query(Order).filter_by(id=payment.order_id).first()
        else:
            order = db.query(Order).filter_by(id=qr).first()
    if not order:
        raise HTTPException(404, "Invalid payment PIN or QR code")
    if order.order_redeemed_at:
        return {"status": "already_redeemed", "type": "payment"}
    order.order_redeemed_at = datetime.utcnow()
    db.commit()
    return {"status": "ok", "type": "payment", "order_id": order.id, "payment_pin": order.payment_pin}

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
    if redemption.status != "pending":
        return {"status": "already_redeemed", "type": "loyalty"}
    redemption.status = "used"
    redemption.redeemed_at = datetime.utcnow()
    if not redemption.order_id:
        # create loyalty order and payment if a loyalty-eligible service exists
        service = db.query(Service).filter_by(loyalty_eligible=True).first()
        if service:
            order = Order(
                service_id=service.id,
                quantity=1,
                extras=[],
                payment_pin=None,
                user_id=redemption.user_id,
                status="paid",
                type="loyalty",
                amount=0
            )
            db.add(order)
            db.commit()
            redemption.order_id = order.id
        else:
            # no loyalty service configured, skip order creation
            redemption.order_id = None
    db.commit()
    return {"status": "ok", "type": "loyalty", "order_id": redemption.order_id}

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
    db.commit()
    return {"status": "ok", "type": "pos", "order_id": order.id}

@router.post("/start-wash/{order_id}")
def start_wash(order_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    vehicle_id = data.get("vehicle_id")
    if not vehicle_id:
        raise HTTPException(400, "vehicle_id required")
    existing = db.query(OrderVehicle).filter_by(order_id=order_id, vehicle_id=vehicle_id).first()
    if not existing:
        db.add(OrderVehicle(order_id=order_id, vehicle_id=vehicle_id))
    order.started_at = datetime.utcnow()
    order.status = "started"
    db.commit()
    return {"status": "started", "order_id": order_id, "started_at": order.started_at}

@router.post("/end-wash/{order_id}")
def end_wash(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.ended_at = datetime.utcnow()
    order.status = "completed"
    db.commit()
    return {"status": "ended", "order_id": order_id, "ended_at": order.ended_at}

@router.post("/start-manual-wash")
def start_manual_wash(data: dict = Body(...), db: Session = Depends(get_db)):
    user_phone = data.get("phone")
    user = db.query(User).filter_by(phone=user_phone).first()
    if not user:
        raise HTTPException(404, "User not found")
    order = Order(user_id=user.id, status="started", started_at=datetime.utcnow(), redeemed=False)
    db.add(order)
    db.commit()
    db.refresh(order)
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
        .filter(
            Order.started_at != None,
            Order.started_at >= today,
            Order.started_at < tomorrow,
        )
        .all()
    )
    result = []
    for order in orders:
        user = db.query(User).filter_by(id=order.user_id).first()
        ov = db.query(OrderVehicle).filter_by(order_id=order.id).first()
        vehicle = db.query(Vehicle).filter_by(id=ov.vehicle_id).first() if ov else None
        result.append({
            "order_id": order.id,
            "user": {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
            } if user else None,
            "vehicle": {
                "make": vehicle.make,
                "model": vehicle.model,
                "reg": vehicle.plate,
            } if vehicle else None,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at,
            "status": "ended" if order.ended_at else "started",
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
        .filter(
            Order.started_at != None,
            Order.started_at >= dt,
            Order.started_at < next_day,
        )
        .all()
    )
    result = []
    for order in orders:
        user = db.query(User).filter_by(id=order.user_id).first()
        ov = db.query(OrderVehicle).filter_by(order_id=order.id).first()
        vehicle = db.query(Vehicle).filter_by(id=ov.vehicle_id).first() if ov else None
        result.append({
            "order_id": order.id,
            "user": {
                "first_name": user.first_name,
                "last_name": user.last_name,
                "phone": user.phone,
            } if user else None,
            "vehicle": {
                "make": vehicle.make,
                "model": vehicle.model,
                "reg": vehicle.plate,
            } if vehicle else None,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at,
            "status": "ended" if order.ended_at else "started",
        })
    return result

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
