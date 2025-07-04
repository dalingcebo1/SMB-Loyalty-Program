from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models import User, Vehicle
from app.plugins.auth.routes import require_staff
from pydantic import BaseModel, EmailStr
from typing import Optional

# Schema for full user info
class UserOut(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str
    role: str

router = APIRouter(prefix="", tags=["users"], dependencies=[Depends(require_staff)])

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
 
@router.get("/")  # List all users
@router.get("", response_model=list[UserOut])
def list_users(db: Session = Depends(get_db)):
    """List all users (admin only)"""
    all_users = db.query(User).all()
    return [UserOut(
        id=u.id,
        first_name=u.first_name,
        last_name=u.last_name,
        email=u.email,
        phone=u.phone,
        role=u.role,
    ) for u in all_users]

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
