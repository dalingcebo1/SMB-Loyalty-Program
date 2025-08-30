from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models import User, Vehicle, Order, OrderVehicle
from app.plugins.auth.routes import require_staff
from pydantic import BaseModel, EmailStr
from typing import Optional

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
    return db.query(Vehicle).filter_by(user_id=user_id).all()

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
    norm_q = "+27" + query[1:] if query.startswith("0") and len(query) == 10 else query
    users = db.query(User).filter(
        or_(
            User.first_name.ilike(f"%{query}%"),
            User.last_name.ilike(f"%{query}%"),
            User.phone.ilike(f"%{query}%"),
            User.phone.ilike(f"%{norm_q}%"),
        )
    ).all()
    return [
        {"id": u.id, "first_name": u.first_name, "last_name": u.last_name,
         "phone": u.phone, "email": u.email, "role": u.role}
        for u in users
    ]

@router.get("/vehicles/search")
def search_vehicles(q: str = Query(..., min_length=1), db: Session = Depends(get_db)):
    """Search vehicles by plate/make/model or owner name/phone; include total washes & last wash date.
    This supports the staff vehicle manager UI."""
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
    results = []
    for v, u in vehs:
        # Compute total washes and last wash timestamp via orders join
        ov_q = (
            db.query(Order)
              .join(OrderVehicle, OrderVehicle.order_id == Order.id)
              .filter(OrderVehicle.vehicle_id == v.id, Order.status.in_(["paid", "completed"]))
              .order_by(Order.created_at.desc())
        )
        orders = ov_q.all()
        total_washes = len(orders)
        last_wash = orders[0].created_at.isoformat() if orders else None
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
            "total_washes": total_washes,
            "last_wash": last_wash,
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
