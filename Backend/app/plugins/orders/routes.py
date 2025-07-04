# Orders plugin routes (migrated from Backend/routes/orders.py)
import uuid
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.plugins.auth.routes import get_current_user
from app.models import (
    Order,
    OrderItem,
    Payment,
    Vehicle,
    OrderVehicle,
    Service,
    Extra,
    VisitCount,
    User,
)
from app.plugins.orders.schemas import (
    OrderCreate,
    OrderResponse,
    OrderCreateRequest,
    OrderCreateResponse,
    OrderDetailResponse,
    AssignVehicleRequest,
)

router = APIRouter(
    prefix="",
    dependencies=[Depends(get_current_user)],
    tags=["orders"],
)

def generate_payment_pin(db: Session) -> str:
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
    user=Depends(get_current_user),
):
    try:
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
            user_id=user.id,
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        return OrderCreateResponse(order_id=new_order.id, qr_data=new_order.id, payment_pin=pin)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

@router.get("", response_model=List[OrderResponse])
def list_orders(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
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
            raise HTTPException(status_code=404, detail=f"Service {it.service_id} not found")
        line = svc.base_price * it.qty
        for eid in it.extras or []:
            ext = db.get(Extra, eid)
            if ext:
                line += ext.price_map.get(it.category, 0) * it.qty
        total += line
        items_to_add.append((it, line))
    order = Order(user_id=data.user_id, amount=total)
    db.add(order)
    db.flush()
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

@router.get("/my-past-orders")
def my_past_orders(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    orders = (
        db.query(Order)
          .filter(Order.user_id == user.id, Order.status == "paid")
          .order_by(Order.created_at.desc())
          .all()
    )
    results = []
    for order in orders:
        payment = (
            db.query(Payment)
              .filter_by(order_id=order.id, status="success")
              .order_by(Payment.created_at.desc())
              .first()
        )
        amount = payment.amount if payment else getattr(order, "amount", 0)
        extras = []
        for ex in order.extras or []:
            extra_obj = db.query(Extra).filter_by(id=ex["id"]).first()
            extras.append({
                "id": ex["id"],
                "quantity": ex.get("quantity", 1),
                "name": extra_obj.name if extra_obj else None
            })
        data = OrderResponse.from_orm(order).dict()
        data.update({"amount": amount, "order_redeemed_at": getattr(order, "order_redeemed_at", None), "extras": extras})
        results.append(data)
    return results

@router.get("/{order_id}")
def get_order(order_id: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    order = db.query(Order).filter_by(id=order_id, user_id=user.id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    svc = db.query(Service).filter_by(id=order.service_id).first()
    service_name = svc.name if svc else "Service"
    loyalty_eligible = svc.loyalty_eligible if svc else False
    category = order.items[0].category if order.items else None
    extras_names = []
    if order.extras:
        for e in order.extras:
            extra = db.query(Extra).filter_by(id=e["id"]).first()
            if extra:
                extras_names.append(extra.name)
    payment = (
        db.query(Payment)
          .filter_by(order_id=order.id, status="success")
          .order_by(Payment.created_at.desc())
          .first()
    )
    return {
        "orderId": order.id,
        "serviceId": order.service_id,
        "serviceName": service_name,
        "loyalty_eligible": loyalty_eligible,
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
        raise HTTPException(status_code=404, detail="Order not found")
    if req.vehicle_id:
        vehicle = db.get(Vehicle, req.vehicle_id)
        if not vehicle:
            raise HTTPException(status_code=404, detail="Vehicle not found")
    else:
        vehicle = Vehicle(user_id=order.user_id, plate=req.plate, make=req.make, model=req.model)
        db.add(vehicle); db.flush()
    db.add(OrderVehicle(order_id=order.id, vehicle_id=vehicle.id))
    db.commit(); db.refresh(order)
    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

@router.post("/{order_id}/start-wash", response_model=OrderDetailResponse)
def start_wash(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "in_progress"
    db.commit(); db.refresh(order)
    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

@router.post("/{order_id}/complete-wash", response_model=OrderDetailResponse)
def complete_wash(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "completed"
    vc = db.query(VisitCount).filter_by(user_id=order.user_id).first()
    if not vc:
        vc = VisitCount(user_id=order.user_id, tenant_id=order.user.tenant_id, count=0)
        db.add(vc)
    vc.count += sum(item.qty for item in order.items)
    db.commit(); db.refresh(order)
    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

@router.post("/{order_id}/redeem")
def redeem_order(order_id: str, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.redeemed = True
    order.status = "paid"
    db.commit()
    return {"status": "ok"}
