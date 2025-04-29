# Backend/routes/orders.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Order, OrderItem, Vehicle, OrderVehicle, Service, Extra, VisitCount
from schemas import (
    OrderCreate,
    OrderResponse,
    OrderDetailResponse,
    AssignVehicleRequest,
)

router = APIRouter(prefix="/orders", tags=["Orders"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("", response_model=OrderResponse)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
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
    db.flush()  # assign order.id

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

@router.get("/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp

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
        vehicle = Vehicle(user_id=order.user_id, plate=req.plate, make=req.make, model=req.model)
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
    # increment visits
    vc = db.query(VisitCount).filter_by(user_id=order.user_id).first()
    if not vc:
        vc = VisitCount(user_id=order.user_id, tenant_id=order.user.tenant_id, count=0)
        db.add(vc)
    vc.count += sum(item.qty for item in order.items)
    db.commit()
    db.refresh(order)

    resp = OrderDetailResponse.from_orm(order).dict()
    resp["vehicles"] = [ov.vehicle_id for ov in order.vehicles]
    return resp
