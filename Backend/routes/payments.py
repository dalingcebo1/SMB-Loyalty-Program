# Backend/routes/payments.py

import os
import hmac
import hashlib
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from routes.auth import get_current_user
from sqlalchemy.orm import Session
from datetime import datetime
from pydantic import BaseModel

from database import SessionLocal, get_db
from models import Order, Payment
from schemas import PaymentInitRequest, PaymentInitResponse
from utils.qr import generate_qr_code

# load your Paystack secret key from .env
PAYSTACK_SECRET = os.getenv("PAYSTACK_SECRET_KEY")
if not PAYSTACK_SECRET:
    raise RuntimeError("PAYSTACK_SECRET_KEY is not set in .env")

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


@router.post("/initiate", response_model=PaymentInitResponse)
def initiate_payment(body: PaymentInitRequest, db: Session = Depends(get_db)):
    # 1) ensure the order exists
    order = db.get(Order, body.order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    # 2) prevent double‐pay
    already = (
        db.query(Payment)
          .filter_by(order_id=order.id, status="success")
          .first()
    )
    if already:
        raise HTTPException(400, "Order already paid")

    # 3) initialize on Paystack
    amt_cents  = order.total_amount * 100
    reference = f"order_{order.id}_{int(order.created_at.timestamp())}"
    resp = requests.post(
        "https://api.paystack.co/transaction/initialize",
        json={
            "email":     body.email or order.user.email,
            "amount":    amt_cents,
            "reference": reference,
        },
        headers={
            "Authorization": f"Bearer {PAYSTACK_SECRET}",
            "Content-Type":  "application/json",
        },
    ).json()

    if not resp.get("status"):
        raise HTTPException(502, "Paystack initialization failed")

    data = resp["data"]
    pay = Payment(
        order_id          = order.id,
        reference         = data["reference"],
        access_code       = data["access_code"],
        authorization_url = data["authorization_url"],
        amount            = data["amount"],
        status            = "initialized",
        raw_response      = resp,
    )
    db.add(pay)
    db.commit()

    return PaymentInitResponse(
        reference         = data["reference"],
        access_code       = data["access_code"],
        authorization_url = data["authorization_url"],
    )


@router.post("/webhook")
async def paystack_webhook(
    request: Request,
    x_paystack_sig: str = Header(...),
    db:             Session  = Depends(get_db),
):
    # verify HMAC signature
    body     = await request.body()
    computed = hmac.new(PAYSTACK_SECRET.encode(), body, hashlib.sha512).hexdigest()
    if not hmac.compare_digest(computed, x_paystack_sig):
        raise HTTPException(400, "Invalid signature")

    payload = await request.json()
    event   = payload.get("event")
    data    = payload.get("data", {})

    if event == "charge.success":
        ref = data["reference"]
        pay = db.query(Payment).filter_by(reference=ref).first()
        if not pay:
            raise HTTPException(404, "Payment record not found")

        # mark payment + order as paid
        pay.status       = "success"
        pay.raw_response = payload
        db.commit()

        order = db.get(Order, pay.order_id)
        order.status = "paid"
        db.commit()

    return {"status": "ok"}


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

    qr = generate_qr_code(pay.reference)
    return {"reference": pay.reference, "qr_code_base64": qr}


@router.get("/verify/{reference}")
def verify_payment(reference: str, db: Session = Depends(get_db)):
    try:
        # 1. Try PIN verification (4-digit)
        if reference.isdigit() and len(reference) == 4:
            order = db.query(Order).filter_by(payment_pin=reference).first()
            if not order:
                raise HTTPException(404, "Invalid PIN")
            pay = db.query(Payment).filter_by(order_id=order.id, status="success").first()
            if not pay:
                raise HTTPException(404, "Payment not found or not successful")
            return {"message": "Payment verified via PIN", "order_id": order.id}

        # 2. Try QR/Reference verification (Yoco/custom)
        pay = db.query(Payment).filter_by(reference=reference, status="success").first()
        if not pay:
            raise HTTPException(404, "Payment not found or not successful")
        return {"message": "Payment verified via QR", "order_id": pay.order_id}
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Payment verification failed: {str(e)}")


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
    )
    db.add(payment)
    order.status = "paid"
    db.commit()

    return {"message": "Payment successful", "order_id": orderId, "payment_id": payment.id}
