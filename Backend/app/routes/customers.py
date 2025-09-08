"""
Customer management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.plugins.auth.routes import get_current_user
from app.core.database import get_db
from app.models import User, Vehicle, PointBalance, VisitCount, Order, Redemption, Service
from sqlalchemy import func, desc, and_
from pydantic import BaseModel
from datetime import datetime, timedelta

router = APIRouter()

class CustomerOverview(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    joined_date: datetime
    total_visits: int
    total_spent: int
    loyalty_points: int
    last_visit: Optional[datetime] = None

class CustomerDetail(CustomerOverview):
    vehicles: List[dict] = []
    recent_orders: List[dict] = []
    loyalty_history: List[dict] = []

@router.get("/", response_model=List[CustomerOverview])
async def list_customers(
    search: Optional[str] = None,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    sort_by: str = "last_visit",
    sort_dir: str = "desc",
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a list of customers with basic metrics"""
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
        
    # Build query for customers of the user's tenant
    query = db.query(
        User,
        func.count(Order.id).label("total_visits"),
        func.sum(Order.amount).label("total_spent"),
        func.max(Order.created_at).label("last_visit")
    ).outerjoin(
        Order, and_(User.id == Order.user_id, Order.status == "completed")
    ).filter(
        User.tenant_id == current_user.tenant_id,
        User.role == "user"  # Only regular customers
    ).group_by(User.id)
    
    # Apply search if provided
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (User.first_name.ilike(search_term)) |
            (User.last_name.ilike(search_term)) |
            (User.email.ilike(search_term)) |
            (User.phone.ilike(search_term))
        )
    
    # Apply sorting
    if sort_by == "name":
        if sort_dir == "desc":
            query = query.order_by(desc(User.first_name))
        else:
            query = query.order_by(User.first_name)
    elif sort_by == "last_visit":
        if sort_dir == "desc":
            query = query.order_by(desc("last_visit"))
        else:
            query = query.order_by("last_visit")
    elif sort_by == "total_spent":
        if sort_dir == "desc":
            query = query.order_by(desc("total_spent"))
        else:
            query = query.order_by("total_spent")
            
    # Get results
    results = query.limit(limit).offset(offset).all()
    customer_ids = [r[0].id for r in results]
    
    # Batch fetch point balances
    point_balances = {}
    if customer_ids:
        balances = db.query(PointBalance).filter(
            PointBalance.user_id.in_(customer_ids),
            PointBalance.tenant_id == current_user.tenant_id
        ).all()
        point_balances = {b.user_id: b.points for b in balances}
    
    # Format response
    customers = []
    for user, visits, spent, last_visit in results:
        customers.append(CustomerOverview(
            id=user.id,
            first_name=user.first_name or "",
            last_name=user.last_name or "",
            email=user.email,
            phone=user.phone or "",
            joined_date=user.created_at,
            total_visits=visits or 0,
            total_spent=spent or 0,
            loyalty_points=point_balances.get(user.id, 0),
            last_visit=last_visit
        ))
    
    return customers

@router.get("/{customer_id}", response_model=CustomerDetail)
async def get_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific customer"""
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get customer basic info with visit counts
    result = db.query(
        User,
        func.count(Order.id).label("total_visits"),
        func.sum(Order.amount).label("total_spent"),
        func.max(Order.created_at).label("last_visit")
    ).outerjoin(
        Order, and_(User.id == Order.user_id, Order.status == "completed")
    ).filter(
        User.id == customer_id,
        User.tenant_id == current_user.tenant_id
    ).group_by(User.id).first()
    
    if not result:
        raise HTTPException(status_code=404, detail="Customer not found")
        
    user, visits, spent, last_visit = result
    
    # Get point balance
    point_balance = db.query(PointBalance).filter(
        PointBalance.user_id == customer_id,
        PointBalance.tenant_id == current_user.tenant_id
    ).first()
    
    # Get customer vehicles
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == customer_id).all()
    vehicle_list = [{"id": v.id, "plate": v.plate, "make": v.make, "model": v.model} for v in vehicles]
    
    # Get recent orders
    recent_orders = db.query(Order).filter(
        Order.user_id == customer_id,
        Order.tenant_id == current_user.tenant_id
    ).order_by(desc(Order.created_at)).limit(5).all()
    
    order_list = [{
        "id": o.id,
        "created_at": o.created_at,
        "amount": o.amount,
        "status": o.status,
        "service_name": o.service.name if o.service else "Multiple items"
    } for o in recent_orders]
    
    # Get loyalty history (redemptions)
    loyalty_history = db.query(Redemption).filter(
        Redemption.user_id == customer_id,
        Redemption.tenant_id == current_user.tenant_id
    ).order_by(desc(Redemption.created_at)).limit(10).all()
    
    loyalty_list = [{
        "id": r.id,
        "created_at": r.created_at,
        "reward_name": r.reward_name or (r.reward.title if r.reward else "Unknown"),
        "status": r.status,
        "redeemed_at": r.redeemed_at
    } for r in loyalty_history]
    
    # Build response
    customer_detail = CustomerDetail(
        id=user.id,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        email=user.email,
        phone=user.phone or "",
        joined_date=user.created_at,
        total_visits=visits or 0,
        total_spent=spent or 0,
        loyalty_points=point_balance.points if point_balance else 0,
        last_visit=last_visit,
        vehicles=vehicle_list,
        recent_orders=order_list,
        loyalty_history=loyalty_list
    )
    
    return customer_detail

@router.get("/{customer_id}/orders")
async def get_customer_orders(
    customer_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get paginated orders for a specific customer"""
    if current_user.role not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Verify customer belongs to tenant
    customer = db.query(User).filter(
        User.id == customer_id,
        User.tenant_id == current_user.tenant_id
    ).first()
    
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    # Get orders
    orders = db.query(Order).filter(
        Order.user_id == customer_id,
        Order.tenant_id == current_user.tenant_id
    ).order_by(desc(Order.created_at)).offset(offset).limit(limit).all()
    
    # Format response
    order_list = []
    for order in orders:
        order_data = {
            "id": order.id,
            "created_at": order.created_at,
            "amount": order.amount,
            "status": order.status,
            "type": order.type,
            "service": {
                "id": order.service.id,
                "name": order.service.name,
                "category": order.service.category
            } if order.service else None,
            "quantity": order.quantity,
            "extras": order.extras,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at
        }
        order_list.append(order_data)
    
    return {
        "orders": order_list,
        "customer": {
            "id": customer.id,
            "name": f"{customer.first_name} {customer.last_name}".strip(),
            "email": customer.email
        }
    }
