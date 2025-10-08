"""Customer management API for admin/staff dashboards."""

from datetime import datetime
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models import (Order, PointBalance, Redemption, Service, User,
                        Vehicle)
from app.plugins.auth.routes import get_current_user

router = APIRouter()


class CustomerListItem(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    phone: Optional[str]
    role: str
    created_at: datetime
    order_count: int = Field(0, ge=0)
    total_spent: float = Field(0, description="Total spent in account currency")
    loyalty_points: int = Field(0, ge=0)
    last_order_date: Optional[datetime] = None


class CustomerListResponse(BaseModel):
    customers: List[CustomerListItem]
    total: int
    page: int
    limit: int
    total_pages: int


class CustomerVehicle(BaseModel):
    id: int
    make: Optional[str]
    model: Optional[str]
    year: Optional[int] = None
    license_plate: Optional[str] = None
    color: Optional[str] = None


class CustomerOrder(BaseModel):
    id: int
    service_name: Optional[str]
    total_amount: float
    status: Optional[str]
    created_at: datetime
    vehicle_info: Optional[str] = None


class LoyaltySummary(BaseModel):
    current_points: int
    total_earned: int
    total_redeemed: int
    tier_name: str
    next_tier_points: Optional[int]


class CustomerDetailResponse(CustomerListItem):
    vehicles: List[CustomerVehicle] = []
    recent_orders: List[CustomerOrder] = []
    loyalty_summary: LoyaltySummary


class CustomerUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


def _require_admin_or_staff(user: User) -> None:
    if user.role not in {"admin", "staff"}:
        raise HTTPException(status_code=403, detail="Not authorized")


@router.get("/", response_model=CustomerListResponse)
async def list_customers(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None, description="Search by name, email, or phone"),
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc", regex="^(asc|desc)$"),
    role: Optional[str] = Query(None, description="Filter by role (user/staff/admin)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomerListResponse:
    """Return paginated customer records with aggregate metrics."""

    _require_admin_or_staff(current_user)

    orders_subq = (
        db.query(
            Order.user_id.label("user_id"),
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.amount), 0).label("total_spent_cents"),
            func.max(Order.created_at).label("last_order_date"),
        )
        .filter(Order.tenant_id == current_user.tenant_id)
        .group_by(Order.user_id)
        .subquery()
    )

    balances_subq = (
        db.query(
            PointBalance.user_id.label("user_id"),
            func.coalesce(PointBalance.points, 0).label("points"),
        )
        .filter(PointBalance.tenant_id == current_user.tenant_id)
        .subquery()
    )

    query = (
        db.query(
            User.id,
            User.email,
            User.first_name,
            User.last_name,
            User.phone,
            User.role,
            User.created_at,
            func.coalesce(orders_subq.c.order_count, 0).label("order_count"),
            func.coalesce(orders_subq.c.total_spent_cents, 0).label("total_spent_cents"),
            orders_subq.c.last_order_date.label("last_order_date"),
            func.coalesce(balances_subq.c.points, 0).label("loyalty_points"),
        )
        .outerjoin(orders_subq, orders_subq.c.user_id == User.id)
        .outerjoin(balances_subq, balances_subq.c.user_id == User.id)
        .filter(User.tenant_id == current_user.tenant_id)
    )

    if role:
        query = query.filter(User.role == role)

    if search:
        term = f"%{search.strip()}%"
        query = query.filter(
            or_(
                User.first_name.ilike(term),
                User.last_name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
            )
        )

    sort_map: Dict[str, object] = {
        "created_at": User.created_at,
        "first_name": User.first_name,
        "last_name": User.last_name,
        "email": User.email,
        "order_count": orders_subq.c.order_count,
        "total_spent": orders_subq.c.total_spent_cents,
        "loyalty_points": balances_subq.c.points,
        "last_order_date": orders_subq.c.last_order_date,
    }

    sort_column = sort_map.get(sort_by, User.created_at)
    ordered_query = (
        query.order_by(sort_column.desc().nullslast())
        if sort_order == "desc"
        else query.order_by(sort_column.asc().nullsfirst())
    )

    total_query = query.order_by(None).with_entities(func.count(func.distinct(User.id)))
    total = int(total_query.scalar() or 0)
    offset = (page - 1) * limit
    rows = ordered_query.offset(offset).limit(limit).all()

    customers = [
        CustomerListItem(
            id=row.id,
            email=row.email,
            first_name=row.first_name or "",
            last_name=row.last_name or "",
            phone=row.phone or None,
            role=row.role,
            created_at=row.created_at,
            order_count=int(row.order_count or 0),
            total_spent=float(row.total_spent_cents or 0) / 100.0,
            loyalty_points=int(row.loyalty_points or 0),
            last_order_date=row.last_order_date,
        )
        for row in rows
    ]

    total_pages = (total + limit - 1) // limit if total else 0

    return CustomerListResponse(
        customers=customers,
        total=total,
        page=page,
        limit=limit,
        total_pages=total_pages,
    )


# Provide a non-trailing-slash alias to avoid 307 redirects that can drop auth headers
router.add_api_route(
    "",
    list_customers,
    response_model=CustomerListResponse,
    methods=["GET"],
)


@router.get("/{customer_id}", response_model=CustomerDetailResponse)
async def get_customer(
    customer_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomerDetailResponse:
    """Return a single customer's profile, loyalty, and recent activity."""

    _require_admin_or_staff(current_user)

    user = (
        db.query(User)
        .filter(User.id == customer_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")

    orders_agg = (
        db.query(
            func.count(Order.id).label("order_count"),
            func.coalesce(func.sum(Order.amount), 0).label("total_spent_cents"),
            func.max(Order.created_at).label("last_order_date"),
        )
        .filter(Order.user_id == customer_id, Order.tenant_id == current_user.tenant_id)
        .one()
    )

    balance = (
        db.query(PointBalance)
        .filter(
            PointBalance.user_id == customer_id,
            PointBalance.tenant_id == current_user.tenant_id,
        )
        .first()
    )

    redeemed_points = (
        db.query(func.coalesce(func.sum(Redemption.milestone), 0))
        .filter(
            Redemption.user_id == customer_id,
            Redemption.tenant_id == current_user.tenant_id,
            Redemption.status == "redeemed",
        )
        .scalar()
    )

    vehicles = (
        db.query(Vehicle)
        .filter(Vehicle.user_id == customer_id)
        .all()
    )

    recent_orders = (
        db.query(Order, Service)
        .outerjoin(Service, Service.id == Order.service_id)
        .filter(Order.user_id == customer_id, Order.tenant_id == current_user.tenant_id)
        .order_by(Order.created_at.desc())
        .limit(5)
        .all()
    )

    loyalty_points = int(balance.points) if balance else 0
    total_redeemed = int(redeemed_points or 0)
    total_earned = loyalty_points + total_redeemed

    tier_thresholds = [(1000, "Gold"), (500, "Silver")]
    tier_name = "Member"
    next_tier_points: Optional[int] = None
    for threshold, name in tier_thresholds:
        if loyalty_points >= threshold:
            tier_name = name
            continue
        next_tier_points = max(threshold - loyalty_points, 0)
        break

    loyalty_summary = LoyaltySummary(
        current_points=loyalty_points,
        total_earned=total_earned,
        total_redeemed=total_redeemed,
        tier_name=tier_name,
        next_tier_points=next_tier_points,
    )

    vehicles_payload = [
        CustomerVehicle(
            id=v.id,
            make=v.make,
            model=v.model,
            license_plate=v.plate,
        )
        for v in vehicles
    ]

    recent_orders_payload = [
        CustomerOrder(
            id=order.id,
            service_name=service.name if service else None,
            total_amount=float(order.amount or 0) / 100.0,
            status=order.status,
            created_at=order.created_at,
            vehicle_info=None,
        )
        for order, service in recent_orders
    ]

    return CustomerDetailResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name or "",
        last_name=user.last_name or "",
        phone=user.phone or None,
        role=user.role,
        created_at=user.created_at,
        order_count=int(orders_agg.order_count or 0),
        total_spent=float(orders_agg.total_spent_cents or 0) / 100.0,
        loyalty_points=loyalty_points,
        last_order_date=orders_agg.last_order_date,
        vehicles=vehicles_payload,
        recent_orders=recent_orders_payload,
        loyalty_summary=loyalty_summary,
    )


@router.patch("/{customer_id}", response_model=CustomerDetailResponse)
async def update_customer(
    customer_id: int,
    payload: CustomerUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CustomerDetailResponse:
    """Update customer profile fields (admin/staff only)."""

    _require_admin_or_staff(current_user)

    user = (
        db.query(User)
        .filter(User.id == customer_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not user:
        raise HTTPException(status_code=404, detail="Customer not found")

    if payload.first_name is not None:
        user.first_name = payload.first_name.strip()
    if payload.last_name is not None:
        user.last_name = payload.last_name.strip()
    if payload.phone is not None:
        user.phone = payload.phone.strip()

    db.add(user)
    db.commit()
    db.refresh(user)

    return await get_customer(customer_id=customer_id, current_user=current_user, db=db)


@router.get("/{customer_id}/orders")
async def get_customer_orders(
    customer_id: int,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return paginated orders for a single customer."""

    _require_admin_or_staff(current_user)

    customer = (
        db.query(User)
        .filter(User.id == customer_id, User.tenant_id == current_user.tenant_id)
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    orders = (
        db.query(Order, Service)
        .outerjoin(Service, Service.id == Order.service_id)
        .filter(Order.user_id == customer_id, Order.tenant_id == current_user.tenant_id)
        .order_by(Order.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    order_payload = [
        {
            "id": order.id,
            "created_at": order.created_at,
            "amount": float(order.amount or 0) / 100.0,
            "status": order.status,
            "type": order.type,
            "service": {
                "id": service.id,
                "name": service.name,
                "category": service.category,
            }
            if service
            else None,
            "quantity": order.quantity,
            "extras": order.extras,
            "payment_pin": order.payment_pin,
            "started_at": order.started_at,
            "ended_at": order.ended_at,
        }
        for order, service in orders
    ]

    return {
        "orders": order_payload,
        "customer": {
            "id": customer.id,
            "first_name": customer.first_name,
            "last_name": customer.last_name,
            "email": customer.email,
        },
    }
