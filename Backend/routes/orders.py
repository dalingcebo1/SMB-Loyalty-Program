# Backend/routes/orders.py

import uuid
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from routes.auth import get_current_user
from sqlalchemy.orm import Session
from database import SessionLocal

from models import (
    Order,
    OrderItem,
    Payment,
    Vehicle,
    OrderVehicle,
    Service,
    Extra,
    VisitCount,
)
from schemas import (
    OrderCreate,
    OrderResponse,
    OrderCreateRequest,
    OrderCreateResponse,
    OrderDetailResponse,
    AssignVehicleRequest,
)

router = APIRouter(
    prefix="/orders",
    dependencies=[Depends(get_current_user)],
    tags=["orders"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def generate_payment_pin(db):
    # Ensure uniqueness
    while True:
        pin = f"{random.randint(1000, 9999)}"
        if not db.query(Order).filter_by(payment_pin=pin).first():
            return pin

@router.post(
    "/create",
    response_model=OrderCreateResponse,
    status_code=201
)
def create_order(
    req: OrderCreateRequest,
    db: Session = Depends(get_db),
    user=Depends(get_current_user),  # <-- add this
):
    print(">>> create_order payload:", req.dict())
    try:
        from models import Extra
        for e in req.extras:
            if not db.query(Extra).filter(Extra.id == e.id).first():
                raise HTTPException(status_code=400, detail=f"Invalid extra id {e.id}")

        pin = generate_payment_pin(db)
        new_order = Order(
            id=str(uuid.uuid4()),
            service_id=req.service_id,
            quantity=req.quantity,
            extras=[{"id": e.id, "quantity": e.quantity} for e in req.extras],
            payment_pin=pin,
            user_id=user.id,  # <-- set user_id from authenticated user
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        return OrderCreateResponse(order_id=new_order.id, qr_data=new_order.id, payment_pin=pin)
    except HTTPException:
        raise
    except Exception as e:
        import traceback; traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

@router.get("", response_model=List[OrderResponse])
def list_orders(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    """
    List all orders, optionally filtered by their status:
    ?status=pending|paid|in_progress|completed
    """
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    return q.all()

@router.post("", response_model=OrderResponse)
def create_order_legacy(data: OrderCreate, db: Session = Depends(get_db)):
    total = 0
    items_to_add = []
    for it in data.items:
        svc = db.get(Service, it.service_id)
        if not svc:
            raise HTTPException(404, f"Service {it.service_id} not found")
        line = svc.base_price * it.qty
        for eid in it.extras or []:
            ext = db.get(Extra, eid)
            if ext:
                line += ext.price_map.get(it.category, 0) * it.qty
        total += line
        items_to_add.append((it, line))

    order = Order(user_id=data.user_id, total_amount=total)
    db.add(order)
    db.flush()  # populate order.id

    for it, line in items_to_add:
        db.add(
            OrderItem(
                order_id=order.id,
                service_id=it.service_id,
                category=it.category,
                qty=it.qty,
                extras=it.extras,
                line_total=line,
            )
        )

    db.commit()
    db.refresh(order)
    return order

# --- IMPORTANT: Place this route BEFORE /{order_id} ---
@router.get("/my-past-orders")
def my_past_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    orders = (
        db.query(Order)
        .filter_by(user_id=user.id)
        .order_by(Order.created_at.desc())
        .all()
    )
    result = []
    for order in orders:
        payment = (
            db.query(Payment)
            .filter_by(order_id=order.id, status="success")
            .order_by(Payment.created_at.desc())
            .first()
        )
        service_name = order.service.name if order.service else "Service"
        # If you store extras as IDs, resolve their names:
        extras_names = []
        if order.extras:
            for e in order.extras:
                extra = db.query(Extra).filter_by(id=e["id"]).first()
                if extra:
                    extras_names.append(extra.name)
        result.append({
            "orderId": order.id,
            "serviceName": service_name,
            "extras": extras_names,
            "qrData": payment.qr_code_base64 if payment else order.id,
            "amount": payment.amount if payment else None,
            "paymentPin": order.payment_pin,
            "createdAt": order.created_at,
            "status": order.status,
            "redeemed": getattr(order, "redeemed", False),
        })
    return result

@router.get("/{order_id}")
def get_order(order_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.query(Order).filter_by(id=order_id, user_id=user.id).first()
    if not order:
        raise HTTPException(404, "Order not found")

    payment = (
        db.query(Payment)
        .filter_by(order_id=order.id, status="success")
        .order_by(Payment.created_at.desc())
        .first()
    )
    service_name = order.service.name if order.service else "Service"
    # Get category from first order item (adjust as needed)
    category = None
    if hasattr(order, "items") and order.items:
        category = order.items[0].category

    extras_names = []
    if order.extras:
        for e in order.extras or []:
            extra = db.query(Extra).filter_by(id=e["id"]).first()
            if extra:
                extras_names.append(extra.name)

    return {
        "orderId": order.id,
        "serviceName": service_name,
        "category": category,
        "extras": extras_names,
        "qrData": payment.qr_code_base64 if payment else order.id,
        "amount": payment.amount if payment else None,
        "paymentPin": order.payment_pin,
        "createdAt": order.created_at,
        "status": order.status,
        "redeemed": getattr(order, "redeemed", False),
    }

@router.post("/{order_id}/assign-vehicle", response_model=OrderDetailResponse)
def assign_vehicle(order_id: int, req: AssignVehicleRequest, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    if req.vehicle_id:
        vehicle = db.get(Vehicle, req.vehicle_id)
        if not vehicle:
            raise HTTPException(404, "Vehicle not found")
    else:
        vehicle = Vehicle(
            user_id=order.user_id,
            plate=req.plate,
            make=req.make,
            model=req.model,
        )
        db.add(vehicle)
        db.flush()

    db.add(OrderVehicle(order_id=order.id, vehicle_id=vehicle.id))
    db.commit()
    db.refresh(order)

    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

@router.post("/{order_id}/start-wash", response_model=OrderDetailResponse)
def start_wash(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = "in_progress"
    db.commit()
    db.refresh(order)

    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

@router.post("/{order_id}/complete-wash", response_model=OrderDetailResponse)
def complete_wash(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    order.status = "completed"

    # increment visit counts
    vc = db.query(VisitCount).filter_by(user_id=order.user_id).first()
    if not vc:
        vc = VisitCount(
            user_id=order.user_id,
            tenant_id=order.user.tenant_id,
            count=0,
        )
        db.add(vc)
    vc.count += sum(item.qty for item in order.items)

    db.commit()
    db.refresh(order)

    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

@router.post("/{order_id}/redeem")
def redeem_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    order.redeemed = True
    db.commit()
    return {"status": "ok"}
