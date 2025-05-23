# Backend/routes/payments.py

import os
import hmac
import hashlib
import requests
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Header, Body, Query
from routes.auth import get_current_user
from sqlalchemy.orm import Session, joinedload
from datetime import datetime, timedelta
from pydantic import BaseModel

from database import SessionLocal, get_db
from models import Order, Payment, User, Vehicle, OrderVehicle, Redemption, Reward, Service
from utils.qr import generate_qr_code  # Make sure this returns dict with qr_code_base64
from routes.loyalty import _create_jwt, SECRET_KEY  # Import for loyalty reward verification
from slowapi import Limiter
from slowapi.util import get_remote_address

YOCO_SECRET_KEY = os.getenv("YOCO_SECRET_KEY")
YOCO_WEBHOOK_SECRET = os.getenv("YOCO_WEBHOOK_SECRET")  # Set this in your backend .env

limiter = Limiter(key_func=get_remote_address)

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
        source="yoco",  # <-- Mark payment source
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

# --- Payment Verification (PIN or QR) ---
@router.get("/verify-payment")
def verify_payment(
    pin: str = Query(None, description="Payment PIN"),
    qr: str = Query(None, description="Payment QR code"),
    db: Session = Depends(get_db)
):
    order = None
    # By PIN
    if pin:
        order = db.query(Order).filter_by(payment_pin=pin).first()
    # By QR (payment reference, transaction_id, or order id)
    elif qr:
        payment = db.query(Payment).filter_by(reference=qr, status="success").first()
        if not payment:
            payment = db.query(Payment).filter_by(transaction_id=qr, status="success").first()
        if payment:
            order = db.query(Order).filter_by(id=payment.order_id).first()
        else:
            # PATCH: Try order ID directly
            order = db.query(Order).filter_by(id=qr).first()
    if not order:
        raise HTTPException(404, "Invalid payment PIN or QR code")
    if order.order_redeemed_at:
        return {"status": "already_redeemed", "type": "payment"}
    order.order_redeemed_at = datetime.utcnow()
    db.commit()
    return {
        "status": "ok",
        "type": "payment",
        "order_id": order.id,
        "created_at": order.created_at,
        "order_redeemed_at": order.order_redeemed_at,
        "payment_pin": order.payment_pin,
    }

def create_loyalty_order_and_payment(db, redemption, reward):
    # Use the reward's service_id if it is loyalty-eligible, else pick any eligible service
    service_id = None
    if reward and reward.service_id:
        service = db.query(Service).filter_by(id=reward.service_id, loyalty_eligible=True).first()
        if service:
            service_id = service.id
    if not service_id:
        # fallback: pick any loyalty-eligible service
        service = db.query(Service).filter_by(loyalty_eligible=True).first()
        if not service:
            raise HTTPException(500, "No loyalty-eligible service configured")
        service_id = service.id
    order = Order(
        service_id=service_id,
        quantity=1,
        extras=[],
        payment_pin=None,
        status="pending",
        user_id=redemption.user_id,
        created_at=datetime.utcnow(),
        redeemed=True,
        type="loyalty",
        amount=0,
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    redemption.order_id = order.id

    # Create a Payment record for loyalty orders
    payment = Payment(
        order_id=order.id,
        amount=0,
        method="loyalty",
        status="success",
        created_at=datetime.utcnow(),
        reference=f"LOYALTY-{order.id}",
        transaction_id=f"LOYALTY-{order.id}",
        source="loyalty"
    )
    db.add(payment)
    db.commit()
    return order

# --- Loyalty Verification (PIN or QR/JWT) ---
@router.get("/verify-loyalty")
def verify_loyalty(
    pin: str = Query(None, description="Loyalty PIN"),
    qr: str = Query(None, description="Loyalty QR code or JWT"),
    db: Session = Depends(get_db)
):
    redemption = None
    reward = None

    # By PIN
    if pin:
        redemption = db.query(Redemption).filter_by(pin=pin).first()
    # By QR/JWT
    elif qr:
        try:
            import jwt
            payload = jwt.decode(qr, SECRET_KEY, algorithms=["HS256"])
            user_id = payload.get("user_id")
            reward_id = payload.get("reward_id")
            milestone = payload.get("milestone")
            reward_name = payload.get("reward")
            redemption = db.query(Redemption).filter_by(
                user_id=user_id, reward_id=reward_id, milestone=milestone
            ).first()
        except Exception:
            redemption = db.query(Redemption).filter_by(qr_code=qr).first()

    if not redemption:
        raise HTTPException(404, "Invalid loyalty PIN or QR code")

    if redemption.status in ("used", "redeemed"):
        return {"status": "already_redeemed", "type": "loyalty"}

    redemption.status = "used"
    redemption.redeemed_at = datetime.utcnow()

    # Ensure order_id exists and all required fields are set
    if not redemption.order_id:
        reward = db.query(Reward).filter_by(id=redemption.reward_id).first()
        order = create_loyalty_order_and_payment(db, redemption, reward)
    else:
        order = db.query(Order).filter_by(id=redemption.order_id).first()
        # --- PATCH: Ensure a Payment row exists for this loyalty order ---
        payment = db.query(Payment).filter_by(order_id=order.id, method="loyalty").first()
        if not payment:
            payment = Payment(
                order_id=order.id,
                amount=0,
                method="loyalty",
                status="success",
                created_at=datetime.utcnow(),
                reference=f"LOYALTY-{order.id}",
                transaction_id=f"LOYALTY-{order.id}",
                source="loyalty"
            )
            db.add(payment)
            db.commit()

    if not order:
        raise HTTPException(404, "Order not found for this reward")
    if order.order_redeemed_at:
        return {"status": "already_redeemed", "type": "loyalty"}
    order.order_redeemed_at = datetime.utcnow()
    db.commit()

    reward = reward or db.query(Reward).filter_by(id=redemption.reward_id).first()
    return {
        "status": "ok",
        "type": "loyalty",
        "order_id": redemption.order_id,
        "reward_name": redemption.reward_name or (reward.title if reward else None),
        "created_at": redemption.created_at,
        "redeemed": True,
        "qr_reference": qr,
        "pin": redemption.pin,
        "order_redeemed_at": order.order_redeemed_at,
    }

# --- POS/Manual Verification (Receipt Number) ---
@router.get("/verify-pos")
def verify_pos(
    receipt: str = Query(..., description="Receipt number from POS"),
    db: Session = Depends(get_db)
):
    # For POS, assume receipt number is stored as Payment.reference with method="pos"
    payment = db.query(Payment).filter_by(reference=receipt, method="pos", status="success").first()
    if not payment:
        raise HTTPException(404, "Invalid or unpaid POS receipt")
    order = db.query(Order).filter_by(id=payment.order_id).first()
    if not order:
        raise HTTPException(404, "Order not found for this receipt")
    if order.redeemed:
        return {"status": "already_redeemed", "type": "pos"}
    order.redeemed = True
    db.commit()
    return {
        "status": "ok",
        "type": "pos",
        "order_id": order.id,
        "created_at": order.created_at,
        "redeemed": order.redeemed,
        "receipt": receipt,
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
