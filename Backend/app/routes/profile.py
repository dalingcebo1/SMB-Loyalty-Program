"""
User profile management API endpoints.
"""
from fastapi import APIRouter, Depends, HTTPException, Body, UploadFile, File, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.plugins.auth.routes import get_current_user
from app.core.database import get_db
from app.models import User, Vehicle, PointBalance, VisitCount, Order, Redemption
from pydantic import BaseModel, EmailStr
import os
import uuid
from datetime import datetime, timedelta
from sqlalchemy import func, desc

router = APIRouter()

class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None

class VehicleCreate(BaseModel):
    plate: str
    make: Optional[str] = None
    model: Optional[str] = None

class VehicleResponse(BaseModel):
    id: int
    plate: str
    make: Optional[str] = None
    model: Optional[str] = None

class ProfileResponse(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    onboarded: bool
    created_at: datetime
    role: str
    loyalty_stats: dict = {}
    vehicles: List[VehicleResponse] = []

@router.get("/me", response_model=ProfileResponse)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user profile details"""
    # Get latest user data
    user = db.query(User).filter(User.id == current_user.id).first()
    
    # Get user vehicles
    vehicles = db.query(Vehicle).filter(Vehicle.user_id == user.id).all()
    vehicle_list = [
        VehicleResponse(id=v.id, plate=v.plate, make=v.make, model=v.model)
        for v in vehicles
    ]
    
    # Get loyalty stats
    loyalty_stats = {}
    
    # Get point balance
    point_balance = db.query(PointBalance).filter(
        PointBalance.user_id == user.id,
        PointBalance.tenant_id == user.tenant_id
    ).first()
    
    # Get visit count
    visit_count = db.query(VisitCount).filter(
        VisitCount.user_id == user.id,
        VisitCount.tenant_id == user.tenant_id
    ).first()
    
    # Get order statistics
    order_stats = db.query(
        func.count(Order.id).label("total_orders"),
        func.sum(Order.amount).label("total_spent"),
        func.max(Order.created_at).label("last_order")
    ).filter(
        Order.user_id == user.id,
        Order.tenant_id == user.tenant_id,
        Order.status == "completed"
    ).first()
    
    # Get redemption count
    redemption_count = db.query(func.count(Redemption.id)).filter(
        Redemption.user_id == user.id,
        Redemption.tenant_id == user.tenant_id,
        Redemption.status == "redeemed"
    ).scalar()
    
    loyalty_stats = {
        "points": point_balance.points if point_balance else 0,
        "visits": visit_count.count if visit_count else 0,
        "total_orders": order_stats.total_orders or 0,
        "total_spent": order_stats.total_spent or 0,
        "last_order": order_stats.last_order,
        "rewards_redeemed": redemption_count or 0
    }
    
    return ProfileResponse(
        id=user.id,
        email=user.email,
        first_name=user.first_name,
        last_name=user.last_name,
        phone=user.phone,
        onboarded=user.onboarded,
        created_at=user.created_at,
        role=user.role,
        loyalty_stats=loyalty_stats,
        vehicles=vehicle_list
    )

@router.put("/me")
async def update_my_profile(
    profile: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user profile"""
    user = db.query(User).filter(User.id == current_user.id).first()
    
    # Update fields if provided
    if profile.first_name is not None:
        user.first_name = profile.first_name
    
    if profile.last_name is not None:
        user.last_name = profile.last_name
    
    if profile.phone is not None:
        # Check if phone is already in use by another user in same tenant
        existing_phone = db.query(User).filter(
            User.phone == profile.phone,
            User.id != user.id,
            User.tenant_id == user.tenant_id
        ).first()
        
        if existing_phone:
            raise HTTPException(
                status_code=400,
                detail="Phone number already in use"
            )
        user.phone = profile.phone
    
    db.commit()
    db.refresh(user)
    
    return {
        "id": user.id,
        "email": user.email,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "phone": user.phone,
        "updated_at": datetime.utcnow()
    }

@router.get("/me/vehicles", response_model=List[VehicleResponse])
async def get_my_vehicles(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's vehicles"""
    vehicles = db.query(Vehicle).filter(
        Vehicle.user_id == current_user.id
    ).all()
    
    return vehicles

@router.post("/me/vehicles", response_model=VehicleResponse, status_code=201)
async def create_vehicle(
    vehicle: VehicleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Add a new vehicle for current user"""
    # Check if plate already exists
    existing = db.query(Vehicle).filter(Vehicle.plate == vehicle.plate).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail="Vehicle with this plate already exists"
        )
    
    # Create new vehicle
    new_vehicle = Vehicle(
        user_id=current_user.id,
        plate=vehicle.plate,
        make=vehicle.make,
        model=vehicle.model
    )
    
    db.add(new_vehicle)
    db.commit()
    db.refresh(new_vehicle)
    
    return new_vehicle

@router.put("/me/vehicles/{vehicle_id}", response_model=VehicleResponse)
async def update_vehicle(
    vehicle_id: int,
    vehicle_update: VehicleCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a specific vehicle"""
    # Verify vehicle belongs to current user
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.user_id == current_user.id
    ).first()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    # Update vehicle
    if vehicle.plate != vehicle_update.plate:
        # Check if new plate is already used
        existing = db.query(Vehicle).filter(
            Vehicle.plate == vehicle_update.plate,
            Vehicle.id != vehicle_id
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail="Vehicle with this plate already exists"
            )
        
        vehicle.plate = vehicle_update.plate
    
    vehicle.make = vehicle_update.make
    vehicle.model = vehicle_update.model
    
    db.commit()
    db.refresh(vehicle)
    
    return vehicle

@router.delete("/me/vehicles/{vehicle_id}")
async def delete_vehicle(
    vehicle_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Delete a specific vehicle"""
    # Verify vehicle belongs to current user
    vehicle = db.query(Vehicle).filter(
        Vehicle.id == vehicle_id,
        Vehicle.user_id == current_user.id
    ).first()
    
    if not vehicle:
        raise HTTPException(status_code=404, detail="Vehicle not found")
    
    db.delete(vehicle)
    db.commit()
    
    return {"status": "success"}

@router.get("/me/orders")
async def get_my_orders(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    status: Optional[str] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's order history"""
    query = db.query(Order).filter(
        Order.user_id == current_user.id,
        Order.tenant_id == current_user.tenant_id
    )
    
    if status:
        query = query.filter(Order.status == status)
    
    orders = query.order_by(desc(Order.created_at)).offset(offset).limit(limit).all()
    
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
        "total_count": query.count()
    }

@router.get("/me/redemptions")
async def get_my_redemptions(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current user's reward redemption history"""
    redemptions = db.query(Redemption).filter(
        Redemption.user_id == current_user.id,
        Redemption.tenant_id == current_user.tenant_id
    ).order_by(desc(Redemption.created_at)).offset(offset).limit(limit).all()
    
    # Format response
    redemption_list = []
    for redemption in redemptions:
        redemption_data = {
            "id": redemption.id,
            "created_at": redemption.created_at,
            "status": redemption.status,
            "pin": redemption.pin,
            "milestone": redemption.milestone,
            "redeemed_at": redemption.redeemed_at,
            "reward": {
                "id": redemption.reward.id,
                "title": redemption.reward.title,
                "description": redemption.reward.description,
                "type": redemption.reward.type
            } if redemption.reward else None,
            "reward_name": redemption.reward_name,
            "qr_code": redemption.qr_code
        }
        redemption_list.append(redemption_data)
    
    return {
        "redemptions": redemption_list
    }

@router.get("/me/loyalty-summary")
async def get_my_loyalty_summary(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed loyalty program summary for current user"""
    # Get point balance and visit count
    point_balance = db.query(PointBalance).filter(
        PointBalance.user_id == current_user.id,
        PointBalance.tenant_id == current_user.tenant_id
    ).first()
    
    visit_count = db.query(VisitCount).filter(
        VisitCount.user_id == current_user.id,
        VisitCount.tenant_id == current_user.tenant_id
    ).first()
    
    # Get order statistics for the last 30 days
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    recent_stats = db.query(
        func.count(Order.id).label("recent_orders"),
        func.sum(Order.amount).label("recent_spent")
    ).filter(
        Order.user_id == current_user.id,
        Order.tenant_id == current_user.tenant_id,
        Order.status == "completed",
        Order.created_at >= thirty_days_ago
    ).first()
    
    # Get pending redemptions
    pending_redemptions = db.query(Redemption).filter(
        Redemption.user_id == current_user.id,
        Redemption.tenant_id == current_user.tenant_id,
        Redemption.status == "pending"
    ).all()
    
    # Get total lifetime stats
    lifetime_stats = db.query(
        func.count(Order.id).label("total_orders"),
        func.sum(Order.amount).label("total_spent")
    ).filter(
        Order.user_id == current_user.id,
        Order.tenant_id == current_user.tenant_id,
        Order.status == "completed"
    ).first()
    
    return {
        "current_points": point_balance.points if point_balance else 0,
        "current_visits": visit_count.count if visit_count else 0,
        "recent_activity": {
            "orders_30d": recent_stats.recent_orders or 0,
            "spent_30d": recent_stats.recent_spent or 0
        },
        "lifetime_stats": {
            "total_orders": lifetime_stats.total_orders or 0,
            "total_spent": lifetime_stats.total_spent or 0
        },
        "pending_redemptions": [
            {
                "id": r.id,
                "reward_name": r.reward_name or (r.reward.title if r.reward else "Unknown"),
                "pin": r.pin,
                "created_at": r.created_at
            }
            for r in pending_redemptions
        ]
    }
