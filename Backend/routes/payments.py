# Backend/routes/payments.py

import os
import hmac
import hashlib
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Body
from routes.auth import get_current_user
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from pydantic import BaseModel

from database import SessionLocal, get_db
from models import Order, Payment, User, Vehicle, OrderVehicle, Redemption, Reward
from utils.qr import generate_qr_code  # Make sure this returns dict with qr_code_base64

YOCO_SECRET_KEY = os.getenv("YOCO_SECRET_KEY")
YOCO_WEBHOOK_SECRET = os.getenv("YOCO_WEBHOOK_SECRET")  # Set this in your backend .env

router = APIRouter(
    prefix="/payments",
    dependencies=[Depends(get_current_user)],
    tags=["Payments"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

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
    # 1. Validate order exists and not already paid
    order = db.query(Order).filter_by(id=orderId).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    existing_payment = (
        db.query(Payment)
        .filter_by(order_id=orderId, status="success")
        .first()
    )
    if existing_payment:
        raise HTTPException(status_code=400, detail="Order already paid")

    # 2. Prepare Yoco charge
    headers = {
        "X-Auth-Secret-Key": YOCO_SECRET_KEY,
        "Content-Type": "application/json",
    }
    yoco_payload = {
        "token": token,
        "amountInCents": amount,
        "currency": "ZAR",
    }

    # 3. Call Yoco API
    try:
        resp = requests.post(
            "https://online.yoco.com/v1/charges/",
            json=yoco_payload,
            headers=headers,
            timeout=15,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Could not reach Yoco: {e}")

    # 4. Handle Yoco response
    yoco_data = resp.json()
    charge_id = yoco_data.get("chargeId") or yoco_data.get("id")
    status = yoco_data.get("status")
    card_brand = None
    if "source" in yoco_data:
        card_brand = yoco_data["source"].get("brand")

    # Accept 200 or 201 as success, and status == "successful"
    if resp.status_code not in (200, 201) or status != "successful":
        print("Yoco error response:", resp.status_code, resp.text)
        detail = yoco_data.get("error", {}).get("message", "Yoco payment failed")
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
        raise HTTPException(status_code=400, detail=detail or "Payment not successful")

    # 5. Write successful payment to DB
    qr_code_base64 = generate_qr_code(charge_id)["qr_code_base64"]
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
        qr_code_base64=qr_code_base64,  # <-- Store QR code
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
    computed_signature = hmac.new(
        YOCO_WEBHOOK_SECRET.encode(),
        raw_body,
        hashlib.sha256
    ).hexdigest()

    if not hmac.compare_digest(computed_signature, yoco_signature or ""):
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    payload = await request.json()
    event_type = payload.get("eventType")
    data = payload.get("data", {})
    charge_id = data.get("id")
    status = data.get("status")

    payment = db.query(Payment).filter_by(transaction_id=charge_id).first()
    if not payment:
        return {"status": "ignored"}

    if status == "successful":
        payment.status = "success"
        # Ensure QR code is present
        if not payment.qr_code_base64:
            payment.qr_code_base64 = generate_qr_code(payment.reference)["qr_code_base64"]
        order = db.query(Order).filter_by(id=payment.order_id).first()
        if order:
            order.status = "paid"
    elif status == "failed":
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
        raise HTTPException(404, "No successful payment found for this order")

    order = db.query(Order).options(joinedload(Order.items)).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    category = None
    if order.items and len(order.items) > 0:
        category = order.items[0].category

    qr = pay.qr_code_base64 or generate_qr_code(pay.reference)["qr_code_base64"]
    return {
        "reference": pay.reference,
        "qr_code_base64": qr,
        "payment_pin": order.payment_pin,
        "amount": pay.amount,
        "category": category,
    }

@router.get("/verify/{reference_or_pin}")
def verify_payment(reference_or_pin: str, db: Session = Depends(get_db)):
    order = None
    redemption = None
    reward = None

    # 1. If it's a 4-digit PIN, search by payment_pin (payment) or Redemption.pin (loyalty)
    if reference_or_pin.isdigit() and len(reference_or_pin) == 4:
        order = db.query(Order).filter_by(payment_pin=reference_or_pin).first()
        if not order:
            redemption = db.query(Redemption).filter_by(pin=reference_or_pin, status="used").first()
    else:
        # 2. Try by order ID (payment)
        order = db.query(Order).filter_by(id=reference_or_pin).first()
        # 3. Try by Payment reference or transaction_id (payment)
        if not order:
            payment = db.query(Payment).filter_by(reference=reference_or_pin, status="success").first()
            if not payment:
                payment = db.query(Payment).filter_by(transaction_id=reference_or_pin, status="success").first()
            if payment:
                order = db.query(Order).filter_by(id=payment.order_id).first()
        # 4. Try by Redemption QR code (loyalty)
        if not order:
            redemption = db.query(Redemption).filter(
                (Redemption.qr_code == reference_or_pin) | (Redemption.order_id == reference_or_pin)
            ).filter(Redemption.status == "used").first()

    # Loyalty reward verification
    if redemption:
        if redemption.status == "redeemed":
            return {"status": "already_redeemed", "type": "loyalty"}
        redemption.status = "redeemed"
        db.commit()
        reward = db.query(Reward).filter_by(id=redemption.reward_id).first()
        return {
            "status": "ok",
            "type": "loyalty",
            "order_id": redemption.order_id,
            "reward_name": redemption.reward_name or (reward.title if reward else None),
            "created_at": redemption.created_at,
            "redeemed": True,
        }

    # Payment verification
    if not order:
        raise HTTPException(404, "Invalid PIN or QR code")

    if order.redeemed:
        return {"status": "already_redeemed", "type": "payment"}

    # Mark as redeemed
    order.redeemed = True
    db.commit()
    return {
        "status": "ok",
        "type": "payment",
        "order_id": order.id,
        "created_at": order.created_at,
        "redeemed": order.redeemed
    }

@router.post("/start-wash/{order_id}")
def start_wash(order_id: str, data: dict = Body(...), db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    vehicle_id = data.get("vehicle_id")
    if not vehicle_id:
        raise HTTPException(400, "vehicle_id required")
    # Link vehicle to order if not already linked
    existing = db.query(OrderVehicle).filter_by(order_id=order_id, vehicle_id=vehicle_id).first()
    if not existing:
        order_vehicle = OrderVehicle(order_id=order_id, vehicle_id=vehicle_id)
        db.add(order_vehicle)
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
    order.status = "ended"
    db.commit()
    return {"status": "ended", "order_id": order_id, "ended_at": order.ended_at}

@router.post("/start-manual-wash")
def start_manual_wash(
    data: dict = Body(...),
    db: Session = Depends(get_db)
):
    """
    Start a wash for a client who paid at the POS (manual visit logging).
    Expects: { "phone": "0731234567" }
    """
    phone = data.get("phone")
    if not phone:
        raise HTTPException(400, "Phone number required")
    # Normalize phone (handle +27, 27, 0)
    if phone.startswith("+27"):
        phone = "0" + phone[3:]
    elif phone.startswith("27"):
        phone = "0" + phone[2:]
    # Find user
    user = db.query(User).filter(
        (User.phone == phone) | (User.phone == "+27" + phone[1:]) | (User.phone == "27" + phone[1:])
    ).first()
    if not user:
        raise HTTPException(404, "User not found for this phone number")
    # Create a new Order for this user (status = started, no payment)
    order = Order(
        user_id=user.id,
        status="started",
        started_at=datetime.utcnow(),
        redeemed=False,
        payment_pin=None,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return {
        "status": "started",
        "order_id": order.id,
        "user_id": user.id,
        "started_at": order.started_at,
    }

@router.get("/order-user/{order_id}")
def get_order_user(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    user = db.query(User).filter_by(id=order.user_id).first()
    vehicles = db.query(Vehicle).filter_by(user_id=user.id).all()
    return {
        "user": {
            "id": user.id,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "phone": user.phone,
        },
        "vehicles": [
            {
                "id": v.id,
                "reg": v.plate,
                "make": v.make,
                "model": v.model,
            } for v in vehicles
        ]
    }

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
        # Get vehicle for this order
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
        raise HTTPException(400, "Invalid date format")
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
