from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_

from app.core.database import get_db
from app.models import User, Vehicle
from app.plugins.auth.routes import require_staff
from pydantic import BaseModel

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

# Vehicle CRUD
@router.get("/users/{user_id}/vehicles", response_model=list[VehicleOut])
def get_user_vehicles(user_id: int, db: Session = Depends(get_db)):
    return db.query(Vehicle).filter_by(user_id=user_id).all()

@router.post("/users/{user_id}/vehicles", response_model=VehicleOut, status_code=201)
def add_vehicle(user_id: int, vehicle: VehicleIn, db: Session = Depends(get_db)):
    v = Vehicle(user_id=user_id, plate=vehicle.plate, make=vehicle.make, model=vehicle.model)
    db.add(v)
    db.commit()
    db.refresh(v)
    return v

@router.patch("/users/{user_id}/vehicles/{vehicle_id}")
def update_vehicle(user_id: int, vehicle_id: int, vehicle: VehicleIn, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter_by(id=vehicle_id, user_id=user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    v.plate, v.make, v.model = vehicle.plate, vehicle.make, vehicle.model
    db.commit()
    return {"message": "Vehicle updated"}

@router.delete("/users/{user_id}/vehicles/{vehicle_id}")
def delete_vehicle(user_id: int, vehicle_id: int, db: Session = Depends(get_db)):
    v = db.query(Vehicle).filter_by(id=vehicle_id, user_id=user_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    db.delete(v)
    db.commit()
    return {"message": "Vehicle deleted"}

# User search
@router.get("/users/search")
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
