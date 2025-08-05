# Orders plugin routes (migrated from Backend/routes/orders.py)
import uuid
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore

from datetime import datetime
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
    OrderCreateRequest,
    OrderCreateResponse,
    OrderResponse,
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
    status_code=201,
    summary="Create a new order with optional default vehicle assignment"
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
        # Store extras as Python list for JSON column
        extras_list = [{"id": e.id, "quantity": e.quantity} for e in req.extras]
        # Store extras list for JSON column
        new_order = Order(
            id=str(uuid.uuid4()),
            service_id=req.service_id,
            quantity=req.quantity,
            extras=extras_list,
            payment_pin=pin,
            user_id=user.id,
        )
        db.add(new_order)
        db.commit()
        db.refresh(new_order)
        # auto-assign default vehicle if user has exactly one vehicle
        default_vehicle_id: Optional[int] = None
        user_vehicles = db.query(Vehicle).filter_by(user_id=user.id).all()
        if len(user_vehicles) == 1:
            default_vehicle_id = user_vehicles[0].id
            db.add(OrderVehicle(order_id=new_order.id, vehicle_id=default_vehicle_id))
            db.commit()
            db.refresh(new_order)
        return OrderCreateResponse(
            order_id=new_order.id,
            qr_data=new_order.id,
            payment_pin=pin,
            default_vehicle_id=default_vehicle_id,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Order creation failed: {str(e)}")

@router.get("", response_model=List[OrderResponse], summary="List all orders, optional status filter")
def list_orders(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    return q.all()

@router.post("", response_model=OrderResponse, summary="Legacy order creation endpoint (deprecated)")
def create_order_legacy(payload: dict, db: Session = Depends(get_db), user=Depends(get_current_user)):
    # Backward-compatible order creation using service_id, quantity, extras
    svc_id = payload.get("service_id")
    qty = payload.get("quantity", 1)
    extras = payload.get("extras", [])
    if svc_id is None:
        raise HTTPException(status_code=400, detail="service_id is required")
    svc = db.query(Service).filter_by(id=svc_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail=f"Service {svc_id} not found")
    # generate unique order ID for legacy compatibility
    order = Order(id=str(uuid.uuid4()), service_id=svc_id, quantity=qty, extras=extras, user_id=user.id)
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@router.get("/my-past-orders", summary="Get user's past paid orders with amount and extras details")
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

@router.get("/{order_id}", response_model=OrderDetailResponse, summary="Get detailed order info with loyalty and next steps")
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
    # base response
    ret = {
        "orderId": order.id,
        "serviceId": order.service_id,
        "serviceName": service_name,
        "loyaltyEligible": loyalty_eligible,
        "category": category,
        "extras": extras_names,
        "qrData": payment.qr_code_base64 if payment else order.id,
        "amount": payment.amount if payment else None,
        "paymentPin": order.payment_pin,
        "createdAt": order.created_at,
        "status": order.status,
        "redeemed": getattr(order, "redeemed", False),
    }
    # include loyalty status
    from app.plugins.loyalty.routes import REWARD_INTERVAL, get_base_reward
    vc = db.query(VisitCount).filter_by(user_id=user.id, tenant_id=user.tenant_id).first()
    visits = vc.count if vc else 0
    progress = visits % REWARD_INTERVAL
    next_ms = ((visits // REWARD_INTERVAL) + 1) * REWARD_INTERVAL
    upcoming = []
    base = get_base_reward(db, user.tenant_id)
    if base and next_ms > visits:
        upcoming.append({
            "milestone": next_ms,
            "visits_needed": next_ms - visits,
            "reward": base.title,
        })
    # assign wash bay and estimated time
    # static estimate or based on service
    estimated_time = 15  # default estimated wash time in minutes
    bay = random.randint(1, 5)
    notification = f"Head to bay #{bay}."
    ret.update({
        "visits": visits,
        "progress": progress,
        "nextMilestone": next_ms,
        "upcomingRewards": upcoming,
        # Next steps info
        "estimatedWashTime": estimated_time,
        "bayNumber": bay,
        "notificationMessage": notification,
    })
    return ret

@router.post("/{order_id}/assign-vehicle", response_model=OrderDetailResponse, summary="Assign a vehicle to an order and get updated details")
def assign_vehicle(order_id: str, req: AssignVehicleRequest, db: Session = Depends(get_db)):
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
    # build response model via ORM validation, then inject vehicle IDs
    # build response dict manually
    return {
        "id": order.id,
        "service_id": order.service_id,
        "quantity": order.quantity,
        "extras": order.extras,
        "payment_pin": order.payment_pin,
        "status": order.status,
        "user_id": order.user_id,
        "created_at": order.created_at,
        "redeemed": order.redeemed,
        "started_at": order.started_at,
        "ended_at": order.ended_at,
        "vehicles": [ov.vehicle_id for ov in order.vehicles],
    }

@router.post("/{order_id}/start-wash", response_model=OrderDetailResponse, summary="Start wash for an order and return updated details")
def start_wash(order_id: str, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "in_progress"
    db.commit(); db.refresh(order)
    # return updated order payload
    return {
        "id": order.id,
        "service_id": order.service_id,
        "quantity": order.quantity,
        "extras": order.extras,
        "payment_pin": order.payment_pin,
        "status": order.status,
        "user_id": order.user_id,
        "created_at": order.created_at,
        "redeemed": order.redeemed,
        "started_at": order.started_at,
        "ended_at": order.ended_at,
        "vehicles": [ov.vehicle_id for ov in order.vehicles],
    }

@router.post("/{order_id}/complete-wash", response_model=OrderDetailResponse, summary="Complete wash for an order, update visit counts, and return updated details")
def complete_wash(order_id: str, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    # complete wash and update visit counts
    order.status = "completed"
    # include tenant filter for visit count
    vc = db.query(VisitCount).filter_by(user_id=order.user_id, tenant_id=order.user.tenant_id).first()
    if not vc:
        vc = VisitCount(user_id=order.user_id, tenant_id=order.user.tenant_id, count=0,
                        updated_at=datetime.utcnow())
        db.add(vc)
    vc.count += sum(item.qty for item in order.items)
    vc.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(order)
    # build nextActionUrl for front-end to redeem wash for loyalty points
    redeem_path = f"/api/orders/{order.id}/redeem"
    # return updated order payload
    return {
        "id": order.id,
        "service_id": order.service_id,
        "quantity": order.quantity,
        "extras": order.extras,
        "payment_pin": order.payment_pin,
        "status": order.status,
        "user_id": order.user_id,
        "created_at": order.created_at,
        "redeemed": order.redeemed,
        "started_at": order.started_at,
        "ended_at": order.ended_at,
        "vehicles": [ov.vehicle_id for ov in order.vehicles],
        # link or QR path for next action: redeem loyalty points
        "nextActionUrl": redeem_path,
    }

@router.post("/{order_id}/redeem", response_model=OrderDetailResponse, summary="Mark order as redeemed and return updated details")
def redeem_order(order_id: str, db: Session = Depends(get_db)):
    """Mark order as redeemed and return updated order details"""
    order = db.query(Order).filter_by(id=order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.redeemed = True
    order.status = "paid"
    db.commit()
    db.refresh(order)
    # return redeemed order payload
    return {
        "id": order.id,
        "service_id": order.service_id,
        "quantity": order.quantity,
        "extras": order.extras,
        "payment_pin": order.payment_pin,
        "status": order.status,
        "user_id": order.user_id,
        "created_at": order.created_at,
        "redeemed": order.redeemed,
        "started_at": order.started_at,
        "ended_at": order.ended_at,
        "vehicles": [ov.vehicle_id for ov in order.vehicles],
    }
