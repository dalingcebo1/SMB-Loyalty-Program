# Backend/routes/orders.py

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Order, OrderItem, Vehicle, OrderVehicle, VisitCount, Service, Extra
from schemas import (
    OrderCreate, 
    OrderResponse, 
    OrderDetailResponse, 
    AssignVehicleRequest,
)

router = APIRouter(tags=["Orders"])

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/orders", response_model=OrderResponse)
def create_order(data: OrderCreate, db: Session = Depends(get_db)):
    """
    Create an order from a cart payload:
    {
      "user_id": 1,
      "items": [
        { "service_id": 3, "category":"car/bike", "qty":1, "extras":[5,6] },
        …
      ]
    }
    """
    # Compute line totals & order total
    total = 0
    items = []
    for it in data.items:
        svc = db.get(Service, it.service_id)
        if not svc:
            raise HTTPException(404, "Service not found")
        base = svc.base_price * it.qty
        extra_sum = sum((db.get(Extra, e).price_map[it.category] or 0) * it.qty for e in (it.extras or []))
        line_total = base + extra_sum
        total += line_total
        items.append(OrderItem(
            service_id=it.service_id,
            category=it.category,
            qty=it.qty,
            extras=it.extras,
            line_total=line_total
        ))

    order = Order(user_id=data.user_id, total_amount=total)
    db.add(order)
    db.flush()  # assign order.id
    for item in items:
        item.order_id = order.id
        db.add(item)
    db.commit()
    db.refresh(order)
    return OrderResponse.from_orm(order)


@router.get("/orders/{order_id}", response_model=OrderDetailResponse)
def get_order(order_id: int, db: Session = Depends(get_db)):
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(404, "Order not found")
    return OrderDetailResponse.from_orm(order)


@router.post("/orders/{order_id}/assign-vehicle", response_model=OrderDetailResponse)
def assign_vehicle(order_id: int, req: AssignVehicleRequest, db: Session = Depends(get_db)):
    """
    Assign an existing vehicle or create & assign new via plate/make/model.
    """
    order = db.query(Order).get(order_id)
    if not order:
        raise HTTPException(404, "Order not found")

    # Create or find vehicle
    if req.vehicle_id:
        vehicle = db.get(Vehicle, req.vehicle_id)
        if not vehicle:
            raise HTTPException(404, "Vehicle not found")
    else:
        vehicle = Vehicle(user_id=order.user_id, plate=req.plate, make=req.make, model=req.model)
        db.add(vehicle)
        db.flush()

    ova = OrderVehicle(order_id=order.id, vehicle_id=vehicle.id)
    db.add(ova)
    db.commit()
    db.refresh(order)
    return OrderDetailResponse.from_orm(order)


@router.post("/orders/{order_id}/start-wash", response_model=OrderDetailResponse)
def start_wash(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = "in_progress"
    db.commit()
    db.refresh(order)
    return OrderDetailResponse.from_orm(order)


@router.post("/orders/{order_id}/complete-wash", response_model=OrderDetailResponse)
def complete_wash(order_id: int, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    order.status = "completed"
    # Log visits: increment VisitCount
    vc = db.query(VisitCount).filter_by(user_id=order.user_id).first()
    if not vc:
        vc = VisitCount(user_id=order.user_id, tenant_id=order.user.tenant_id, count=0)
        db.add(vc)
    vc.count += sum(item.qty for item in order.items)
    db.commit()
    db.refresh(order)
    return OrderDetailResponse.from_orm(order)
