from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_, func

from app.core.database import get_db
from app.models import User, Vehicle, Order, OrderVehicle
from app.plugins.auth.routes import require_staff
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from app.plugins.auth.routes import require_admin, get_password_hash
from fastapi import Depends

# Schema for full user info
class UserOut(BaseModel):
    id: int
    first_name: Optional[str]
    last_name: Optional[str]
    email: str
    phone: Optional[str]
    role: str

router = APIRouter(prefix="", tags=["users"], dependencies=[Depends(require_staff)])
 
# Schema for paginated response
class PaginatedUsers(BaseModel):
    items: list[UserOut]
    total: int

# Schemas
class VehicleIn(BaseModel):
    plate: str
    make: str
    model: str

class VehicleOut(BaseModel):
    id: int
    plate: str
    make: str
    model: str

@router.get("/{user_id}/vehicles", response_model=list[VehicleOut])
def get_user_vehicles(user_id: int, db: Session = Depends(get_db)):
    from app.utils.pagination import safe_limit
    return safe_limit(
        db.query(Vehicle).filter_by(user_id=user_id).order_by(Vehicle.id.desc()),
        limit=50
    ).all()

@router.post("/{user_id}/vehicles", response_model=VehicleOut, status_code=201)
def add_vehicle(user_id: int, vehicle: VehicleIn, db: Session = Depends(get_db)):
    v = Vehicle(user_id=user_id, plate=vehicle.plate, make=vehicle.make, model=vehicle.model)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v

@router.patch("/{user_id}/vehicles/{vehicle_id}")
def update_vehicle(user_id: int, vehicle_id: int, vehicle: VehicleIn, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter_by(id=vehicle_id, user_id=user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    v.plate, v.make, v.model = vehicle.plate, vehicle.make, vehicle.model
    db.commit()
    return {"message": "Vehicle updated"}

@router.delete("/{user_id}/vehicles/{vehicle_id}")
def delete_vehicle(user_id: int, vehicle_id: int, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter_by(id=vehicle_id, user_id=user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(v)
    db.commit()
    return {"message": "Vehicle deleted"}

@router.get("/search")
def search_users(query: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    from app.utils.pagination import safe_limit
    norm_q = "+27" + query[1:] if query.startswith("0") and len(query) == 10 else query
    users = safe_limit(
        db.query(User).filter(
            or_(
                User.first_name.ilike(f"%{query}%"),
                User.last_name.ilike(f"%{query}%"),
                User.phone.ilike(f"%{query}%"),
                User.phone.ilike(f"%{norm_q}%"),
            )
        ),
        limit=100
    ).all()
    return [
        {"id": u.id, "first_name": u.first_name, "last_name": u.last_name,
         "phone": u.phone, "email": u.email, "role": u.role}
        for u in users
    ]

@router.get("/vehicles/search")
def search_vehicles(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Search vehicles by plate/make/model or owner name/phone; include total washes & last wash date.
    This supports the staff vehicle manager UI. Optimized to prevent N+1 queries."""
    pattern = f"%{q}%"
    
    # Join user for owner filtering
    vehs = (
        db.query(Vehicle, User)
          .join(User, Vehicle.user_id == User.id)
          .filter(
              or_(
                  Vehicle.plate.ilike(pattern),
                  Vehicle.make.ilike(pattern),
                  Vehicle.model.ilike(pattern),
                  User.first_name.ilike(pattern),
                  User.last_name.ilike(pattern),
                  User.phone.ilike(pattern),
              )
          )
          .limit(50)
          .all()
    )
    
    # Extract vehicle IDs for batch query
    vehicle_ids = [v.id for v, _ in vehs]
    
    if not vehicle_ids:
        return []
    
    # Batch query for wash statistics - single query instead of N queries
    wash_stats = (
        db.query(
            OrderVehicle.vehicle_id,
            func.count(Order.id).label('total_washes'),
            func.max(Order.created_at).label('last_wash')
        )
        .join(Order, OrderVehicle.order_id == Order.id)
        .filter(
            OrderVehicle.vehicle_id.in_(vehicle_ids),
            Order.status.in_(["paid", "completed"])
        )
        .group_by(OrderVehicle.vehicle_id)
        .all()
    )
    
    # Create lookup dict for O(1) access
    stats_map = {
        stat.vehicle_id: {
            'total_washes': stat.total_washes,
            'last_wash': stat.last_wash.isoformat() if stat.last_wash else None
        }
        for stat in wash_stats
    }
    
    # Build results with pre-fetched stats
    results = []
    for v, u in vehs:
        stats = stats_map.get(v.id, {'total_washes': 0, 'last_wash': None})
        results.append({
            "id": v.id,
            "plate": v.plate,
            "make": v.make,
            "model": v.model,
            "user": {
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "phone": u.phone,
            },
            "total_washes": stats['total_washes'],
            "last_wash": stats['last_wash'],
        })
    return results
 
@router.get("", response_model=PaginatedUsers)
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(10, ge=1),
    search: Optional[str] = None,
    sort_by: Optional[str] = Query(None, regex="^(first_name|last_name|email|phone|role)$"),
    sort_order: str = Query('asc', regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """List users (admin only) with pagination, optional search and sorting"""
    query = db.query(User)
    if search:
        q = f"%{search}%"
        query = query.filter(or_(
            User.first_name.ilike(q),
            User.last_name.ilike(q),
            User.email.ilike(q),
            User.phone.ilike(q),
        ))
    total = query.count()
    if sort_by:
        col = getattr(User, sort_by)
        if sort_order == 'desc':
            col = col.desc()
        query = query.order_by(col)
    users = query.offset((page - 1) * per_page).limit(per_page).all()
    items = [UserOut(
        id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        phone=u.phone,
        role=u.role,
    ) for u in users]
    return PaginatedUsers(items=items, total=total)

class UserUpdate(BaseModel):
    first_name: Optional[str]
    last_name: Optional[str]
    email: Optional[EmailStr]
    phone: Optional[str]
    role: Optional[str]

class ManualUserCreate(BaseModel):
    email: EmailStr
    password: str
    first_name: Optional[str]
    last_name: Optional[str]
    phone: Optional[str]
    tenant_id: Optional[str]
    role: Optional[str] = "user"

@router.post("/manual", response_model=UserOut, status_code=201, dependencies=[Depends(require_admin)])
def manual_create_user(payload: ManualUserCreate, db: Session = Depends(get_db), current=Depends(require_admin)):
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    role = payload.role or 'user'
    if role not in ("user","staff","admin","developer"):
        raise HTTPException(status_code=400, detail="Invalid role")
    tenant_id = payload.tenant_id or current.tenant_id or 'default'
    u = User(
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        first_name=payload.first_name,
        last_name=payload.last_name,
        phone=payload.phone,
        onboarded=True,
        created_at=datetime.utcnow(),
        tenant_id=tenant_id,
        role=role,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    return u

@router.get("/{user_id}", response_model=UserOut)
def get_user(user_id: int, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(id=user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    return u

@router.patch("/{user_id}", response_model=UserOut)
def update_user(user_id: int, payload: UserUpdate, db: Session = Depends(get_db)):
    u = db.query(User).filter_by(id=user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    data = payload.dict(exclude_unset=True)
    for key, val in data.items():
        setattr(u, key, val)
    db.commit()
    db.refresh(u)
    return u
