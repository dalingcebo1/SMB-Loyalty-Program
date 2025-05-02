# Backend/routes/payments.py

import os
import hmac
import hashlib
import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from routes.auth import get_current_user
from sqlalchemy.orm import Session

from database import SessionLocal
from models import Order, Payment
from schemas import PaymentInitRequest, PaymentInitResponse, QRResponse
from utils.qr import generate_qr_code

# load your Paystack secret key from .env
PAYSTACK_SECRET = os.getenv("PAYSTACK_SECRET_KEY")
if not PAYSTACK_SECRET:
    raise RuntimeError("PAYSTACK_SECRET_KEY is not set in .env")

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
    amt_kobo  = order.total_amount * 100
    reference = f"order_{order.id}_{int(order.created_at.timestamp())}"
    resp = requests.post(
        "https://api.paystack.co/transaction/initialize",
        json={
            "email":     body.email or order.user.email,
            "amount":    amt_kobo,
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


@router.get("/qr/{order_id}", response_model=QRResponse)
def get_payment_qr(order_id: int, db: Session = Depends(get_db)):
    pay = (
        db.query(Payment)
          .filter_by(order_id=order_id, status="success")
          .order_by(Payment.created_at.desc())
          .first()
    )
    if not pay:
        raise HTTPException(404, "No successful payment found for this order")

    qr = generate_qr_code(pay.reference)
    return QRResponse(reference=pay.reference, qr_code_base64=qr)


@router.get("/verify/{reference}", response_model=QRResponse)
def verify_payment(reference: str, db: Session = Depends(get_db)):
    pay = (
        db.query(Payment)
          .filter_by(reference=reference, status="success")
          .first()
    )
    if not pay:
        raise HTTPException(404, "Payment not found or not successful")

    qr = generate_qr_code(pay.reference)
    return QRResponse(reference=pay.reference, qr_code_base64=qr)
