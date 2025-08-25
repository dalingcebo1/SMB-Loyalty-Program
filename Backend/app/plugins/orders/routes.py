# Orders plugin routes (migrated from Backend/routes/orders.py)
import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException  # type: ignore
from sqlalchemy.orm import Session  # type: ignore
from sqlalchemy.exc import IntegrityError  # type: ignore

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
 
def _build_order_response(order, next_action_url: str = None):
    """Serialize Order to OrderDetailResponse-compatible dict."""
    # Provide BOTH legacy snake_case and new camelCase keys for maximum compatibility.
    data = {
        # ID
        "id": str(order.id),
        "orderId": str(order.id),
        # Service
        "service_id": order.service_id,
        "serviceId": order.service_id,
        # Core order fields
        "quantity": order.quantity,
        "extras": order.extras,
        "payment_pin": order.payment_pin,
        "paymentPin": order.payment_pin,
        "status": order.status,
        "user_id": order.user_id,
        "userId": order.user_id,
        "created_at": order.created_at,
        "createdAt": order.created_at,
        "redeemed": order.redeemed,
        "started_at": order.started_at,
        "startedAt": order.started_at,
        "ended_at": order.ended_at,
        "endedAt": order.ended_at,
        # Related vehicles
        "vehicles": [ov.vehicle_id for ov in order.vehicles],
    }
    if next_action_url:
        data["nextActionUrl"] = next_action_url
    return data

router = APIRouter(
    prefix="",
    dependencies=[Depends(get_current_user)],
    tags=["orders"],
)

def generate_payment_pin(db: Session) -> str:
    """Generate a unique 4‑digit payment pin.

    Uses a tight loop with DB existence check; probability of > a few iterations
    is negligible. Kept separate so we can call again on IntegrityError retries.
    """
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
    """Create an order.

    Improvements:
    - Validate service exists (otherwise FK violation produced a 500 before)
    - Validate extras up-front with clear 400s
    - Retry payment pin generation on race-condition unique collisions
    - Return clearer 500 only for unexpected errors
    """
    # 1. Validate service
    svc = db.query(Service).filter(Service.id == req.service_id).first()
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")

    # 2. Validate extras
    for e in req.extras:
        if not db.query(Extra).filter(Extra.id == e.id).first():
            raise HTTPException(status_code=400, detail=f"Invalid extra id {e.id}")

    extras_list = [{"id": e.id, "quantity": e.quantity} for e in req.extras]

    # 3. Attempt create with at most a few retries for rare payment_pin collisions
    last_error: Optional[str] = None
    for attempt in range(5):
        pin = generate_payment_pin(db)
        new_order = Order(
            service_id=req.service_id,
            quantity=req.quantity,
            extras=extras_list,
            payment_pin=pin,
            user_id=user.id,
        )
        db.add(new_order)
        try:
            db.commit()
            db.refresh(new_order)
            # Auto-assign default vehicle if exactly one user vehicle
            default_vehicle_id: Optional[int] = None
            user_vehicles = db.query(Vehicle).filter_by(user_id=user.id).all()
            if len(user_vehicles) == 1:
                default_vehicle_id = user_vehicles[0].id
                db.add(OrderVehicle(order_id=new_order.id, vehicle_id=default_vehicle_id))
                db.commit(); db.refresh(new_order)
            return OrderCreateResponse(
                order_id=str(new_order.id),  # keep response as string for backward compat
                qr_data=str(new_order.id),
                payment_pin=pin,
                default_vehicle_id=default_vehicle_id,
            )
        except IntegrityError as ie:  # likely payment_pin race or FK (should be prevalidated)
            db.rollback()
            last_error = str(ie.orig)
            # retry only for unique constraint on payment_pin
            if "orders_payment_pin_key" in last_error or "duplicate key" in last_error:
                continue
            # other integrity errors are not retryable
            break
        except HTTPException:
            db.rollback(); raise
        except Exception as e:
            db.rollback()
            last_error = str(e)
            break

    # If we reach here, we failed to create
    detail = "Order creation failed"
    if last_error:
        detail += f": {last_error}"
    raise HTTPException(status_code=500, detail=detail)

@router.get("", response_model=List[OrderResponse], summary="List all orders, optional status filter")
def list_orders(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Order)
    if status:
        q = q.filter(Order.status == status)
    orders = q.all()
    serialized = []
    for o in orders:
        serialized.append({
            "orderId": str(o.id),
            "serviceId": o.service_id,
            "quantity": o.quantity,
            "extras": o.extras or [],
            "paymentPin": o.payment_pin,
            "status": o.status,
            "userId": o.user_id,
            "createdAt": o.created_at,
            "redeemed": getattr(o, "redeemed", False),
            "startedAt": getattr(o, "started_at", None),
            "endedAt": getattr(o, "ended_at", None),
        })
    return serialized

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
    # Let DB autogenerate integer PK; still return as string in response model
    order = Order(service_id=svc_id, quantity=qty, extras=extras, user_id=user.id)
    db.add(order)
    db.commit()
    db.refresh(order)
    return {
        "orderId": str(order.id),
        "serviceId": order.service_id,
        "quantity": order.quantity,
        "extras": order.extras or [],
        "paymentPin": order.payment_pin,
        "status": order.status,
        "userId": order.user_id,
        "createdAt": order.created_at,
        "redeemed": getattr(order, "redeemed", False),
        "startedAt": getattr(order, "started_at", None),
        "endedAt": getattr(order, "ended_at", None),
    }

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
        # Normalize id/orderId to string
        if "id" in data:
            data["id"] = str(data["id"])
        if "orderId" in data:
            data["orderId"] = str(data["orderId"])
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
        "id": str(order.id),
        "orderId": str(order.id),
        "serviceId": order.service_id,
        "quantity": order.quantity,
        "extras": extras_names,
        "paymentPin": order.payment_pin,
        "status": order.status,
        "userId": order.user_id,
        "createdAt": order.created_at,
        "redeemed": getattr(order, "redeemed", False),
        "startedAt": order.started_at,
        "endedAt": order.ended_at,
        # Additional fields for detail response
        "serviceName": service_name,
        "loyaltyEligible": loyalty_eligible,
        "category": category,
    "qrData": payment.qr_code_base64 if payment else str(order.id),
        "amount": payment.amount if payment else None,
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
    # return standardized order detail response
    return _build_order_response(order)

@router.post("/{order_id}/start-wash", response_model=OrderDetailResponse, summary="Start wash for an order and return updated details")
def start_wash(order_id: str, db: Session = Depends(get_db)):
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = "in_progress"
    db.commit(); db.refresh(order)
    # return standardized order detail response
    return _build_order_response(order)

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
    # build nextActionUrl and return standardized response
    redeem_path = f"/api/orders/{order.id}/redeem"
    return _build_order_response(order, next_action_url=redeem_path)

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
    # return standardized order detail response
    return _build_order_response(order)
