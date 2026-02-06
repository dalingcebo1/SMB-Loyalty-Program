"""
Beauty/Salon appointment booking endpoints.
Handles services, stylists, availability, and appointments.
"""
from datetime import date, datetime, time, timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import (
    BeautyService,
    Stylist,
    StylistService,
    StylistAvailability,
    Appointment,
    User,
    LoyaltyProgram,
    PointBalance,
    LoyaltyTransaction,
)

router = APIRouter(prefix="/api/beauty", tags=["Beauty/Salon"])


# === Helper Functions ===


def award_loyalty_points_for_appointment(
    db: Session,
    tenant_id: str,
    customer_id: int,
    service: BeautyService,
    appointment_id: int
) -> Optional[int]:
    """Calculate and award loyalty points to customer for completed appointment."""
    # Get loyalty program configuration
    loyalty_program = db.query(LoyaltyProgram).filter(
        LoyaltyProgram.tenant_id == tenant_id
    ).first()
    
    if not loyalty_program or not loyalty_program.active:
        return None
    
    # Calculate points: service_price_cents * accrual_ratio * points_multiplier
    # Example: R100 (10000 cents) * 0.1 * 1.5 = 1500 points
    base_points = int(service.price_cents * loyalty_program.accrual_ratio)
    points_earned = int(base_points * service.points_multiplier)
    
    if points_earned <= 0:
        return None
    
    # Get or create point balance
    point_balance = db.query(PointBalance).filter(
        and_(
            PointBalance.tenant_id == tenant_id,
            PointBalance.user_id == customer_id
        )
    ).first()
    
    if not point_balance:
        point_balance = PointBalance(
            tenant_id=tenant_id,
            user_id=customer_id,
            points=0,
            lifetime_points=0,
            updated_at=datetime.utcnow()
        )
        db.add(point_balance)
        db.flush()
    
    # Add points to balance
    point_balance.points += points_earned
    point_balance.lifetime_points += points_earned
    point_balance.updated_at = datetime.utcnow()
    
    # Create loyalty transaction record
    transaction = LoyaltyTransaction(
        tenant_id=tenant_id,
        user_id=customer_id,
        type="EARN",
        points=points_earned,
        reference_type="appointment",
        reference_id=str(appointment_id),
        description=f"Points earned from appointment #{appointment_id} - {service.name}"
    )
    db.add(transaction)
    
    return points_earned


# === Pydantic Schemas ===


class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    category: str = Field(..., min_length=1, max_length=100)
    price_cents: int = Field(..., ge=0)
    duration_minutes: int = Field(..., gt=0)
    buffer_minutes: int = Field(default=0, ge=0)
    online_booking_enabled: bool = True
    points_multiplier: float = Field(default=1.0, ge=0)
    active: bool = True


class ServiceResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    category: str
    price_cents: int
    duration_minutes: int
    buffer_minutes: int
    online_booking_enabled: bool
    points_multiplier: float
    active: bool

    class Config:
        from_attributes = True


class StylistCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    email: Optional[str] = Field(None, max_length=255)
    phone: Optional[str] = Field(None, max_length=20)
    title: Optional[str] = Field(None, max_length=100)
    bio: Optional[str] = None
    photo_url: Optional[str] = None
    commission_rate: float = Field(default=0.0, ge=0, le=100)
    accepts_walk_ins: bool = True
    active: bool = True


class StylistResponse(BaseModel):
    id: int
    name: str
    email: Optional[str]
    phone: Optional[str]
    title: Optional[str]
    bio: Optional[str]
    photo_url: Optional[str]
    commission_rate: float
    accepts_walk_ins: bool
    active: bool

    class Config:
        from_attributes = True


class StylistServiceCreate(BaseModel):
    service_id: int
    custom_price_cents: Optional[int] = Field(None, ge=0)
    custom_duration_minutes: Optional[int] = Field(None, gt=0)


class AvailabilityCreate(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6)  # 0=Monday, 6=Sunday
    start_time: time
    end_time: time
    specific_date: Optional[date] = None
    is_available: bool = True


class AppointmentCreate(BaseModel):
    customer_id: int
    stylist_id: int
    service_id: int
    appointment_date: date
    start_time: time
    customer_notes: Optional[str] = None


class AppointmentUpdate(BaseModel):
    status: Optional[str] = Field(None, pattern="^(pending|confirmed|in_progress|completed|cancelled|no_show)$")
    staff_notes: Optional[str] = None
    reminder_sent: Optional[bool] = None


class AppointmentResponse(BaseModel):
    id: int
    customer_id: int
    stylist_id: int
    service_id: int
    appointment_date: date
    start_time: time
    end_time: time
    status: str
    customer_notes: Optional[str]
    staff_notes: Optional[str]
    reminder_sent: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class AvailableSlot(BaseModel):
    stylist_id: int
    stylist_name: str
    start_time: time
    end_time: time


# === Service Endpoints ===


@router.get("/services", response_model=List[ServiceResponse])
def list_services(
    category: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all beauty services for the tenant."""
    query = db.query(BeautyService).filter(BeautyService.tenant_id == tenant_ctx.tenant_id)
    
    if category:
        query = query.filter(BeautyService.category == category)
    if active_only:
        query = query.filter(BeautyService.active == True)
    
    return query.all()


@router.post("/services", response_model=ServiceResponse, status_code=201)
def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new beauty service."""
    db_service = BeautyService(tenant_id=tenant_ctx.tenant_id, **service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service


@router.put("/services/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int,
    service: ServiceCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a beauty service."""
    db_service = (
        db.query(BeautyService)
        .filter(BeautyService.id == service_id, BeautyService.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    for key, value in service.model_dump().items():
        setattr(db_service, key, value)
    
    db.commit()
    db.refresh(db_service)
    return db_service


@router.delete("/services/{service_id}", status_code=204)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a beauty service."""
    db_service = (
        db.query(BeautyService)
        .filter(BeautyService.id == service_id, BeautyService.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    db.delete(db_service)
    db.commit()


# === Stylist Endpoints ===


@router.get("/stylists", response_model=List[StylistResponse])
def list_stylists(
    active_only: bool = True,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all stylists for the tenant."""
    query = db.query(Stylist).filter(Stylist.tenant_id == tenant_ctx.tenant_id)
    
    if active_only:
        query = query.filter(Stylist.active == True)
    
    return query.all()


@router.post("/stylists", response_model=StylistResponse, status_code=201)
def create_stylist(
    stylist: StylistCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new stylist."""
    db_stylist = Stylist(tenant_id=tenant_ctx.tenant_id, **stylist.model_dump())
    db.add(db_stylist)
    db.commit()
    db.refresh(db_stylist)
    return db_stylist


@router.put("/stylists/{stylist_id}", response_model=StylistResponse)
def update_stylist(
    stylist_id: int,
    stylist: StylistCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a stylist."""
    db_stylist = (
        db.query(Stylist)
        .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not db_stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    for key, value in stylist.model_dump().items():
        setattr(db_stylist, key, value)
    
    db.commit()
    db.refresh(db_stylist)
    return db_stylist


@router.delete("/stylists/{stylist_id}", status_code=204)
def delete_stylist(
    stylist_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a stylist."""
    db_stylist = (
        db.query(Stylist)
        .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not db_stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    db.delete(db_stylist)
    db.commit()


# === Stylist Services Endpoints ===


@router.post("/stylists/{stylist_id}/services", status_code=201)
def assign_service_to_stylist(
    stylist_id: int,
    stylist_service: StylistServiceCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Assign a service to a stylist with optional custom pricing."""
    # Verify stylist exists
    stylist = (
        db.query(Stylist)
        .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    # Verify service exists
    service = (
        db.query(BeautyService)
        .filter(
            BeautyService.id == stylist_service.service_id,
            BeautyService.tenant_id == tenant_ctx.tenant_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check if already assigned
    existing = (
        db.query(StylistService)
        .filter(
            StylistService.stylist_id == stylist_id,
            StylistService.service_id == stylist_service.service_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(status_code=400, detail="Service already assigned to stylist")
    
    db_stylist_service = StylistService(
        stylist_id=stylist_id, **stylist_service.model_dump()
    )
    db.add(db_stylist_service)
    db.commit()
    return {"message": "Service assigned successfully"}


@router.delete("/stylists/{stylist_id}/services/{service_id}", status_code=204)
def remove_service_from_stylist(
    stylist_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Remove a service from a stylist."""
    # Verify stylist exists
    stylist = (
        db.query(Stylist)
        .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    stylist_service = (
        db.query(StylistService)
        .filter(
            StylistService.stylist_id == stylist_id,
            StylistService.service_id == service_id,
        )
        .first()
    )
    if not stylist_service:
        raise HTTPException(status_code=404, detail="Service assignment not found")
    
    db.delete(stylist_service)
    db.commit()


# === Stylist Availability Endpoints ===


@router.post("/stylists/{stylist_id}/availability", status_code=201)
def set_stylist_availability(
    stylist_id: int,
    availability: AvailabilityCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Set availability for a stylist (recurring or specific date)."""
    # Verify stylist exists
    stylist = (
        db.query(Stylist)
        .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    # Must have either day_of_week or specific_date
    if availability.day_of_week is None and availability.specific_date is None:
        raise HTTPException(
            status_code=400,
            detail="Must provide either day_of_week or specific_date",
        )
    
    db_availability = StylistAvailability(
        stylist_id=stylist_id, **availability.model_dump()
    )
    db.add(db_availability)
    db.commit()
    return {"message": "Availability set successfully"}


@router.get("/stylists/{stylist_id}/availability")
def get_stylist_availability(
    stylist_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get availability schedule for a stylist."""
    # Verify stylist exists
    stylist = (
        db.query(Stylist)
        .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_ctx.tenant_id)
        .first()
    )
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    availability = (
        db.query(StylistAvailability)
        .filter(StylistAvailability.stylist_id == stylist_id)
        .all()
    )
    
    return [
        {
            "id": a.id,
            "day_of_week": a.day_of_week,
            "start_time": str(a.start_time),
            "end_time": str(a.end_time),
            "specific_date": str(a.specific_date) if a.specific_date else None,
            "is_available": a.is_available,
        }
        for a in availability
    ]


# === Appointment Endpoints ===


@router.get("/appointments", response_model=List[AppointmentResponse])
def list_appointments(
    stylist_id: Optional[int] = None,
    customer_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List appointments with optional filters."""
    query = db.query(Appointment).filter(Appointment.tenant_id == tenant_ctx.tenant_id)
    
    if stylist_id:
        query = query.filter(Appointment.stylist_id == stylist_id)
    if customer_id:
        query = query.filter(Appointment.customer_id == customer_id)
    if start_date:
        query = query.filter(Appointment.appointment_date >= start_date)
    if end_date:
        query = query.filter(Appointment.appointment_date <= end_date)
    if status:
        query = query.filter(Appointment.status == status)
    
    return query.order_by(Appointment.appointment_date, Appointment.start_time).all()


@router.post("/appointments", response_model=AppointmentResponse, status_code=201)
def create_appointment(
    appointment: AppointmentCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new appointment."""
    # Verify customer exists
    customer = (
        db.query(User)
        .filter(
            User.id == appointment.customer_id,
            User.tenant_id == tenant_ctx.tenant_id,
        )
        .first()
    )
    if not customer:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify stylist exists
    stylist = (
        db.query(Stylist)
        .filter(
            Stylist.id == appointment.stylist_id,
            Stylist.tenant_id == tenant_ctx.tenant_id,
        )
        .first()
    )
    if not stylist:
        raise HTTPException(status_code=404, detail="Stylist not found")
    
    # Verify service exists
    service = (
        db.query(BeautyService)
        .filter(
            BeautyService.id == appointment.service_id,
            BeautyService.tenant_id == tenant_ctx.tenant_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Calculate end time
    total_minutes = service.duration_minutes + service.buffer_minutes
    end_time = (
        datetime.combine(date.today(), appointment.start_time)
        + timedelta(minutes=total_minutes)
    ).time()
    
    # Check for conflicts
    conflicts = (
        db.query(Appointment)
        .filter(
            Appointment.tenant_id == tenant_ctx.tenant_id,
            Appointment.stylist_id == appointment.stylist_id,
            Appointment.appointment_date == appointment.appointment_date,
            Appointment.status.in_(["pending", "confirmed", "in_progress"]),
            or_(
                and_(
                    Appointment.start_time <= appointment.start_time,
                    Appointment.end_time > appointment.start_time,
                ),
                and_(
                    Appointment.start_time < end_time,
                    Appointment.end_time >= end_time,
                ),
            ),
        )
        .first()
    )
    
    if conflicts:
        raise HTTPException(
            status_code=409,
            detail="Time slot is already booked for this stylist",
        )
    
    db_appointment = Appointment(
        tenant_id=tenant_ctx.tenant_id,
        customer_id=appointment.customer_id,
        stylist_id=appointment.stylist_id,
        service_id=appointment.service_id,
        appointment_date=appointment.appointment_date,
        start_time=appointment.start_time,
        end_time=end_time,
        status="pending",
        customer_notes=appointment.customer_notes,
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    appointment: AppointmentUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update an appointment status or notes."""
    db_appointment = (
        db.query(Appointment)
        .filter(
            Appointment.id == appointment_id,
            Appointment.tenant_id == tenant_ctx.tenant_id,
        )
        .first()
    )
    if not db_appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    # Check if status is changing to "completed" to award loyalty points
    old_status = db_appointment.status
    status_changed_to_completed = False
    
    for key, value in appointment.model_dump(exclude_unset=True).items():
        if key == "status" and value == "completed" and old_status != "completed":
            status_changed_to_completed = True
        setattr(db_appointment, key, value)
    
    # Award loyalty points if appointment just completed
    if status_changed_to_completed:
        # Get the service to access price and multiplier
        service = (
            db.query(BeautyService)
            .filter(BeautyService.id == db_appointment.service_id)
            .first()
        )
        if service:
            points_awarded = award_loyalty_points_for_appointment(
                db=db,
                tenant_id=tenant_ctx.tenant_id,
                customer_id=db_appointment.customer_id,
                service=service,
                appointment_id=appointment_id
            )
            # Note: points_awarded will be None if loyalty program is not active
    
    db.commit()
    db.refresh(db_appointment)
    return db_appointment


@router.get("/availability", response_model=List[AvailableSlot])
def find_available_slots(
    service_id: int,
    appointment_date: date = Query(...),
    stylist_id: Optional[int] = None,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Find available time slots for a service on a specific date."""
    # Get service
    service = (
        db.query(BeautyService)
        .filter(
            BeautyService.id == service_id,
            BeautyService.tenant_id == tenant_ctx.tenant_id,
        )
        .first()
    )
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Build stylist query
    stylist_query = db.query(Stylist).filter(
        Stylist.tenant_id == tenant_ctx.tenant_id,
        Stylist.active == True,
    )
    
    if stylist_id:
        stylist_query = stylist_query.filter(Stylist.id == stylist_id)
    else:
        # Only stylists who offer this service
        stylist_query = stylist_query.join(
            StylistService,
            StylistService.stylist_id == Stylist.id,
        ).filter(StylistService.service_id == service_id)
    
    stylists = stylist_query.all()
    
    if not stylists:
        return []
    
    available_slots = []
    day_of_week = appointment_date.weekday()  # 0=Monday, 6=Sunday
    
    for stylist in stylists:
        # Get availability for this stylist
        availability_entries = (
            db.query(StylistAvailability)
            .filter(
                StylistAvailability.stylist_id == stylist.id,
                StylistAvailability.is_available == True,
                or_(
                    StylistAvailability.day_of_week == day_of_week,
                    StylistAvailability.specific_date == appointment_date,
                ),
            )
            .all()
        )
        
        for avail in availability_entries:
            # Get existing appointments for this slot
            existing_appointments = (
                db.query(Appointment)
                .filter(
                    Appointment.stylist_id == stylist.id,
                    Appointment.appointment_date == appointment_date,
                    Appointment.status.in_(["pending", "confirmed", "in_progress"]),
                )
                .all()
            )
            
            # Simple slot generation (every 30 minutes)
            current_time = avail.start_time
            slot_duration = service.duration_minutes + service.buffer_minutes
            
            while True:
                # Calculate slot end time
                slot_end = (
                    datetime.combine(date.today(), current_time)
                    + timedelta(minutes=slot_duration)
                ).time()
                
                if slot_end > avail.end_time:
                    break
                
                # Check if slot conflicts with existing appointments
                is_available = True
                for appt in existing_appointments:
                    if not (slot_end <= appt.start_time or current_time >= appt.end_time):
                        is_available = False
                        break
                
                if is_available:
                    available_slots.append(
                        AvailableSlot(
                            stylist_id=stylist.id,
                            stylist_name=stylist.name,
                            start_time=current_time,
                            end_time=slot_end,
                        )
                    )
                
                # Move to next slot
                current_time = (
                    datetime.combine(date.today(), current_time)
                    + timedelta(minutes=30)
                ).time()
    
    return available_slots
