"""
Padel Court Booking System Routes.

Provides endpoints for managing courts, pricing rules, equipment rentals,
and customer bookings with loyalty points integration.
"""
from datetime import datetime, time, timedelta, date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from pydantic import BaseModel, Field, validator
import logging

from app.core.database import get_db
from app.models import (
    PadelCourt, CourtPricing, PadelEquipment, CourtBooking, BookingEquipment,
    User, LoyaltyTransaction
)
from app.core.tenant_context import get_tenant_context, TenantContext

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/padel", tags=["padel"])


# ============================================================================
# Pydantic Schemas
# ============================================================================

class CourtBase(BaseModel):
    court_number: str = Field(..., description="Court number (e.g., '1', 'A', 'Center')")
    court_type: str = Field(default="standard", description="Court type: standard, professional, training")
    surface_type: str = Field(default="synthetic_grass", description="Surface: synthetic_grass, concrete, artificial_turf")
    has_lighting: bool = Field(default=False, description="Whether court has lighting for night play")
    base_price_cents: int = Field(..., gt=0, description="Base hourly price in cents")
    notes: Optional[str] = None

class CourtCreate(CourtBase):
    pass

class CourtUpdate(BaseModel):
    court_number: Optional[str] = None
    court_type: Optional[str] = None
    surface_type: Optional[str] = None
    has_lighting: Optional[bool] = None
    base_price_cents: Optional[int] = None
    active: Optional[bool] = None
    maintenance_mode: Optional[bool] = None
    notes: Optional[str] = None

class CourtResponse(CourtBase):
    id: int
    active: bool
    maintenance_mode: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class PricingRuleBase(BaseModel):
    day_of_week: Optional[int] = Field(None, ge=0, le=6, description="0=Monday, 6=Sunday, null=all days")
    start_time: time = Field(..., description="Pricing rule start time")
    end_time: time = Field(..., description="Pricing rule end time")
    price_per_hour_cents: int = Field(..., gt=0, description="Price per hour in cents")
    label: str = Field(..., description="Label like 'Peak Hours', 'Weekend Rate'")
    priority: int = Field(default=0, description="Higher priority rules take precedence")

class PricingRuleCreate(PricingRuleBase):
    pass

class PricingRuleResponse(PricingRuleBase):
    id: int
    court_id: int
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class EquipmentBase(BaseModel):
    name: str = Field(..., description="Equipment name like 'Padel Racket', 'Ball Set'")
    equipment_type: str = Field(..., description="Type: racket, balls, shoes, other")
    description: Optional[str] = None
    quantity_available: int = Field(..., ge=0, description="Available quantity for rental")
    rental_price_cents: int = Field(..., ge=0, description="Rental price in cents")

class EquipmentCreate(EquipmentBase):
    pass

class EquipmentUpdate(BaseModel):
    name: Optional[str] = None
    equipment_type: Optional[str] = None
    description: Optional[str] = None
    quantity_available: Optional[int] = None
    rental_price_cents: Optional[int] = None
    active: Optional[bool] = None

class EquipmentResponse(EquipmentBase):
    id: int
    active: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class EquipmentRental(BaseModel):
    equipment_id: int
    quantity: int = Field(..., gt=0)

class BookingCreate(BaseModel):
    customer_id: int
    court_id: int
    booking_date: date
    start_time: time
    duration_minutes: int = Field(..., description="Duration: 60, 90, or 120 minutes")
    player_count: int = Field(default=4, ge=1, le=4, description="Number of players (1-4)")
    player_names: Optional[str] = Field(None, description="Comma-separated player names")
    equipment_rentals: List[EquipmentRental] = Field(default_factory=list)
    customer_notes: Optional[str] = None
    
    @validator('duration_minutes')
    def validate_duration(cls, v):
        if v not in [60, 90, 120]:
            raise ValueError('Duration must be 60, 90, or 120 minutes')
        return v

class BookingUpdate(BaseModel):
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = None
    player_count: Optional[int] = None
    player_names: Optional[str] = None
    status: Optional[str] = None
    staff_notes: Optional[str] = None
    paid: Optional[bool] = None
    payment_method: Optional[str] = None

class BookingResponse(BaseModel):
    id: int
    court_id: int
    court_number: str
    customer_id: int
    booking_date: date
    start_time: time
    end_time: time
    duration_minutes: int
    court_price_cents: int
    equipment_price_cents: int
    total_price_cents: int
    player_count: int
    player_names: Optional[str]
    status: str
    paid: bool
    payment_method: Optional[str]
    customer_notes: Optional[str]
    staff_notes: Optional[str]
    reminder_sent: bool
    created_at: datetime
    equipment_rentals: List[dict]
    
    class Config:
        from_attributes = True


class AvailabilityQuery(BaseModel):
    date: date
    duration_minutes: int = Field(..., description="Requested duration: 60, 90, or 120 minutes")
    
    @validator('duration_minutes')
    def validate_duration(cls, v):
        if v not in [60, 90, 120]:
            raise ValueError('Duration must be 60, 90, or 120 minutes')
        return v


# ============================================================================
# Court Management Endpoints
# ============================================================================

@router.post("/courts", response_model=CourtResponse, status_code=201)
def create_court(
    court: CourtCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new padel court."""
    tenant_id = tenant_ctx.tenant_id
    
    # Check for duplicate court number
    existing = db.query(PadelCourt).filter(
        PadelCourt.tenant_id == tenant_id,
        PadelCourt.court_number == court.court_number,
        PadelCourt.active == True
    ).first()
    
    if existing:
        raise HTTPException(status_code=400, detail=f"Court {court.court_number} already exists")
    
    db_court = PadelCourt(
        tenant_id=tenant_id,
        **court.model_dump()
    )
    
    db.add(db_court)
    db.commit()
    db.refresh(db_court)
    
    logger.info(f"Created padel court {db_court.court_number} for tenant {tenant_id}")
    return db_court


@router.get("/courts", response_model=List[CourtResponse])
def list_courts(
    active_only: bool = Query(True, description="Filter active courts only"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all padel courts for current tenant."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(PadelCourt).filter(PadelCourt.tenant_id == tenant_id)
    
    if active_only:
        query = query.filter(PadelCourt.active == True)
    
    courts = query.order_by(PadelCourt.court_number).all()
    return courts


@router.get("/courts/{court_id}", response_model=CourtResponse)
def get_court(
    court_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific padel court."""
    tenant_id = tenant_ctx.tenant_id
    
    court = db.query(PadelCourt).filter(
        PadelCourt.id == court_id,
        PadelCourt.tenant_id == tenant_id
    ).first()
    
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    return court


@router.put("/courts/{court_id}", response_model=CourtResponse)
def update_court(
    court_id: int,
    court_update: CourtUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a padel court."""
    tenant_id = tenant_ctx.tenant_id
    
    court = db.query(PadelCourt).filter(
        PadelCourt.id == court_id,
        PadelCourt.tenant_id == tenant_id
    ).first()
    
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    # Update fields
    update_data = court_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(court, field, value)
    
    db.commit()
    db.refresh(court)
    
    logger.info(f"Updated padel court {court.court_number} for tenant {tenant_id}")
    return court


@router.delete("/courts/{court_id}", status_code=204)
def delete_court(
    court_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete a padel court."""
    tenant_id = tenant_ctx.tenant_id
    
    court = db.query(PadelCourt).filter(
        PadelCourt.id == court_id,
        PadelCourt.tenant_id == tenant_id
    ).first()
    
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    court.active = False
    db.commit()
    
    logger.info(f"Deleted padel court {court.court_number} for tenant {tenant_id}")
    return None


# ============================================================================
# Court Pricing Endpoints
# ============================================================================

@router.post("/courts/{court_id}/pricing", response_model=PricingRuleResponse, status_code=201)
def create_pricing_rule(
    court_id: int,
    pricing: PricingRuleCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a pricing rule for a court."""
    tenant_id = tenant_ctx.tenant_id
    
    # Verify court exists
    court = db.query(PadelCourt).filter(
        PadelCourt.id == court_id,
        PadelCourt.tenant_id == tenant_id
    ).first()
    
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    db_pricing = CourtPricing(
        tenant_id=tenant_id,
        court_id=court_id,
        **pricing.model_dump()
    )
    
    db.add(db_pricing)
    db.commit()
    db.refresh(db_pricing)
    
    logger.info(f"Created pricing rule '{db_pricing.label}' for court {court_id}")
    return db_pricing


@router.get("/courts/{court_id}/pricing", response_model=List[PricingRuleResponse])
def list_pricing_rules(
    court_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all pricing rules for a court."""
    tenant_id = tenant_ctx.tenant_id
    
    # Verify court exists
    court = db.query(PadelCourt).filter(
        PadelCourt.id == court_id,
        PadelCourt.tenant_id == tenant_id
    ).first()
    
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    rules = db.query(CourtPricing).filter(
        CourtPricing.court_id == court_id,
        CourtPricing.tenant_id == tenant_id,
        CourtPricing.active == True
    ).order_by(CourtPricing.priority.desc(), CourtPricing.start_time).all()
    
    return rules


@router.delete("/courts/{court_id}/pricing/{pricing_id}", status_code=204)
def delete_pricing_rule(
    court_id: int,
    pricing_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a pricing rule."""
    tenant_id = tenant_ctx.tenant_id
    
    pricing = db.query(CourtPricing).filter(
        CourtPricing.id == pricing_id,
        CourtPricing.court_id == court_id,
        CourtPricing.tenant_id == tenant_id
    ).first()
    
    if not pricing:
        raise HTTPException(status_code=404, detail="Pricing rule not found")
    
    pricing.active = False
    db.commit()
    
    logger.info(f"Deleted pricing rule {pricing_id} for court {court_id}")
    return None


# ============================================================================
# Equipment Management Endpoints
# ============================================================================

@router.post("/equipment", response_model=EquipmentResponse, status_code=201)
def create_equipment(
    equipment: EquipmentCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create new rental equipment."""
    tenant_id = tenant_ctx.tenant_id
    
    db_equipment = PadelEquipment(
        tenant_id=tenant_id,
        **equipment.model_dump()
    )
    
    db.add(db_equipment)
    db.commit()
    db.refresh(db_equipment)
    
    logger.info(f"Created equipment '{db_equipment.name}' for tenant {tenant_id}")
    return db_equipment


@router.get("/equipment", response_model=List[EquipmentResponse])
def list_equipment(
    active_only: bool = Query(True, description="Filter active equipment only"),
    equipment_type: Optional[str] = Query(None, description="Filter by equipment type"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all rental equipment."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(PadelEquipment).filter(PadelEquipment.tenant_id == tenant_id)
    
    if active_only:
        query = query.filter(PadelEquipment.active == True)
    
    if equipment_type:
        query = query.filter(PadelEquipment.equipment_type == equipment_type)
    
    equipment = query.order_by(PadelEquipment.equipment_type, PadelEquipment.name).all()
    return equipment


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get specific equipment details."""
    tenant_id = tenant_ctx.tenant_id
    
    equipment = db.query(PadelEquipment).filter(
        PadelEquipment.id == equipment_id,
        PadelEquipment.tenant_id == tenant_id
    ).first()
    
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    return equipment


@router.put("/equipment/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    equipment_update: EquipmentUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update equipment details."""
    tenant_id = tenant_ctx.tenant_id
    
    equipment = db.query(PadelEquipment).filter(
        PadelEquipment.id == equipment_id,
        PadelEquipment.tenant_id == tenant_id
    ).first()
    
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    update_data = equipment_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(equipment, field, value)
    
    db.commit()
    db.refresh(equipment)
    
    logger.info(f"Updated equipment '{equipment.name}' for tenant {tenant_id}")
    return equipment


@router.delete("/equipment/{equipment_id}", status_code=204)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete equipment."""
    tenant_id = tenant_ctx.tenant_id
    
    equipment = db.query(PadelEquipment).filter(
        PadelEquipment.id == equipment_id,
        PadelEquipment.tenant_id == tenant_id
    ).first()
    
    if not equipment:
        raise HTTPException(status_code=404, detail="Equipment not found")
    
    equipment.active = False
    db.commit()
    
    logger.info(f"Deleted equipment '{equipment.name}' for tenant {tenant_id}")
    return None


# ============================================================================
# Helper Functions
# ============================================================================

def calculate_court_price(
    court: PadelCourt,
    booking_datetime: datetime,
    duration_minutes: int,
    db: Session,
    tenant_ctx: TenantContext
) -> int:
    """Calculate court price based on pricing rules and duration."""
    tenant_id = tenant_ctx.tenant_id
    
    # Get applicable pricing rules
    day_of_week = booking_datetime.weekday()  # 0=Monday
    booking_time = booking_datetime.time()
    
    # Find matching pricing rule with highest priority
    pricing_rule = db.query(CourtPricing).filter(
        CourtPricing.court_id == court.id,
        CourtPricing.tenant_id == tenant_id,
        CourtPricing.active == True,
        or_(
            CourtPricing.day_of_week == day_of_week,
            CourtPricing.day_of_week.is_(None)
        ),
        CourtPricing.start_time <= booking_time,
        CourtPricing.end_time > booking_time
    ).order_by(CourtPricing.priority.desc()).first()
    
    # Use pricing rule or base price
    price_per_hour = pricing_rule.price_per_hour_cents if pricing_rule else court.base_price_cents
    
    # Calculate proportional price
    hours = duration_minutes / 60.0
    total_price = int(price_per_hour * hours)
    
    return total_price


def check_court_availability(
    court_id: int,
    booking_date: date,
    start_time: time,
    duration_minutes: int,
    db: Session,
    tenant_ctx: TenantContext,
    exclude_booking_id: Optional[int] = None
) -> bool:
    """Check if court is available for the requested time slot."""
    tenant_id = tenant_ctx.tenant_id
    
    # Calculate end time
    start_datetime = datetime.combine(booking_date, start_time)
    end_datetime = start_datetime + timedelta(minutes=duration_minutes)
    end_time_value = end_datetime.time()
    
    # Check for overlapping bookings
    query = db.query(CourtBooking).filter(
        CourtBooking.court_id == court_id,
        CourtBooking.tenant_id == tenant_id,
        CourtBooking.booking_date == booking_date,
        CourtBooking.status.in_(['pending', 'confirmed', 'in_progress']),
        or_(
            # New booking starts during existing booking
            and_(
                CourtBooking.start_time <= start_time,
                CourtBooking.end_time > start_time
            ),
            # New booking ends during existing booking
            and_(
                CourtBooking.start_time < end_time_value,
                CourtBooking.end_time >= end_time_value
            ),
            # New booking contains existing booking
            and_(
                CourtBooking.start_time >= start_time,
                CourtBooking.end_time <= end_time_value
            )
        )
    )
    
    if exclude_booking_id:
        query = query.filter(CourtBooking.id != exclude_booking_id)
    
    conflicting = query.first()
    return conflicting is None


def check_equipment_availability(
    equipment_rentals: List[EquipmentRental],
    booking_date: date,
    start_time: time,
    duration_minutes: int,
    db: Session,
    tenant_ctx: TenantContext,
    exclude_booking_id: Optional[int] = None
) -> bool:
    """Check if requested equipment is available for the time slot."""
    tenant_id = tenant_ctx.tenant_id
    
    start_datetime = datetime.combine(booking_date, start_time)
    end_datetime = start_datetime + timedelta(minutes=duration_minutes)
    end_time_value = end_datetime.time()
    
    for rental in equipment_rentals:
        # Get equipment
        equipment = db.query(PadelEquipment).filter(
            PadelEquipment.id == rental.equipment_id,
            PadelEquipment.tenant_id == tenant_id,
            PadelEquipment.active == True
        ).first()
        
        if not equipment:
            return False
        
        # Count equipment in use during this time slot
        overlapping_bookings = db.query(CourtBooking).filter(
            CourtBooking.tenant_id == tenant_id,
            CourtBooking.booking_date == booking_date,
            CourtBooking.status.in_(['pending', 'confirmed', 'in_progress']),
            or_(
                and_(
                    CourtBooking.start_time <= start_time,
                    CourtBooking.end_time > start_time
                ),
                and_(
                    CourtBooking.start_time < end_time_value,
                    CourtBooking.end_time >= end_time_value
                ),
                and_(
                    CourtBooking.start_time >= start_time,
                    CourtBooking.end_time <= end_time_value
                )
            )
        )
        
        if exclude_booking_id:
            overlapping_bookings = overlapping_bookings.filter(CourtBooking.id != exclude_booking_id)
        
        overlapping_bookings = overlapping_bookings.all()
        
        # Sum equipment used in overlapping bookings
        used_quantity = 0
        for booking in overlapping_bookings:
            booking_rental = db.query(BookingEquipment).filter(
                BookingEquipment.booking_id == booking.id,
                BookingEquipment.equipment_id == rental.equipment_id
            ).first()
            
            if booking_rental:
                used_quantity += booking_rental.quantity
        
        # Check if enough equipment available
        available = equipment.quantity_available - used_quantity
        if available < rental.quantity:
            return False
    
    return True


def award_loyalty_points_for_booking(booking: CourtBooking, db: Session, tenant_ctx: TenantContext):
    """Award loyalty points when booking is completed."""
    tenant_id = tenant_ctx.tenant_id
    
    # Calculate points (1 point per R10 spent, similar to other verticals)
    points_to_award = booking.total_price_cents // 1000  # 1000 cents = R10
    
    if points_to_award <= 0:
        return
    
    # Create loyalty transaction
    transaction = LoyaltyTransaction(
        tenant_id=tenant_id,
        customer_id=booking.customer_id,
        points=points_to_award,
        transaction_type="earn",
        reference_type="court_booking",
        reference_id=str(booking.id),
        description=f"Court booking on {booking.booking_date.strftime('%Y-%m-%d')}"
    )
    
    db.add(transaction)
    db.commit()
    
    logger.info(f"Awarded {points_to_award} loyalty points for booking {booking.id}")


# ============================================================================
# Booking Endpoints
# ============================================================================

@router.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(
    booking: BookingCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new court booking."""
    tenant_id = tenant_ctx.tenant_id
    
    # Verify court exists and is active
    court = db.query(PadelCourt).filter(
        PadelCourt.id == booking.court_id,
        PadelCourt.tenant_id == tenant_id,
        PadelCourt.active == True
    ).first()
    
    if not court:
        raise HTTPException(status_code=404, detail="Court not found")
    
    if court.maintenance_mode:
        raise HTTPException(status_code=400, detail="Court is under maintenance")
    
    # Check court availability
    if not check_court_availability(
        booking.court_id,
        booking.booking_date,
        booking.start_time,
        booking.duration_minutes,
        db,
        tenant_ctx
    ):
        raise HTTPException(status_code=409, detail="Court is not available for the requested time slot")
    
    # Check equipment availability
    if booking.equipment_rentals:
        if not check_equipment_availability(
            booking.equipment_rentals,
            booking.booking_date,
            booking.start_time,
            booking.duration_minutes,
            db,
            tenant_ctx
        ):
            raise HTTPException(status_code=409, detail="Requested equipment is not available")
    
    # Calculate pricing
    booking_datetime = datetime.combine(booking.booking_date, booking.start_time)
    court_price = calculate_court_price(court, booking_datetime, booking.duration_minutes, db, tenant_ctx)
    
    # Calculate equipment price
    equipment_price = 0
    for rental in booking.equipment_rentals:
        equipment = db.query(PadelEquipment).filter(
            PadelEquipment.id == rental.equipment_id,
            PadelEquipment.tenant_id == tenant_id
        ).first()
        equipment_price += equipment.rental_price_cents * rental.quantity
    
    total_price = court_price + equipment_price
    
    # Calculate end time
    end_datetime = booking_datetime + timedelta(minutes=booking.duration_minutes)
    end_time = end_datetime.time()
    
    # Create booking
    db_booking = CourtBooking(
        tenant_id=tenant_id,
        court_id=booking.court_id,
        customer_id=booking.customer_id,
        booking_date=booking.booking_date,
        start_time=booking.start_time,
        end_time=end_time,
        duration_minutes=booking.duration_minutes,
        court_price_cents=court_price,
        equipment_price_cents=equipment_price,
        total_price_cents=total_price,
        player_count=booking.player_count,
        player_names=booking.player_names,
        customer_notes=booking.customer_notes,
        status="pending"
    )
    
    db.add(db_booking)
    db.flush()
    
    # Add equipment rentals
    for rental in booking.equipment_rentals:
        equipment = db.query(PadelEquipment).filter(
            PadelEquipment.id == rental.equipment_id
        ).first()
        
        db_rental = BookingEquipment(
            booking_id=db_booking.id,
            equipment_id=rental.equipment_id,
            quantity=rental.quantity,
            price_cents=equipment.rental_price_cents * rental.quantity
        )
        db.add(db_rental)
    
    db.commit()
    db.refresh(db_booking)
    
    logger.info(f"Created booking {db_booking.id} for court {court.court_number}")
    
    # Prepare response
    response_data = {
        **db_booking.__dict__,
        'court_number': court.court_number,
        'equipment_rentals': [
            {
                'equipment_id': r.equipment_id,
                'equipment_name': r.equipment.name,
                'quantity': r.quantity,
                'price_cents': r.price_cents
            }
            for r in db_booking.equipment_rentals
        ]
    }
    
    return BookingResponse(**response_data)


@router.get("/bookings", response_model=List[BookingResponse])
def list_bookings(
    from_date: Optional[date] = Query(None, description="Filter bookings from this date"),
    to_date: Optional[date] = Query(None, description="Filter bookings to this date"),
    court_id: Optional[int] = Query(None, description="Filter by court"),
    status: Optional[str] = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List bookings with optional filters."""
    tenant_id = tenant_ctx.tenant_id
    
    query = db.query(CourtBooking).filter(CourtBooking.tenant_id == tenant_id)
    
    if from_date:
        query = query.filter(CourtBooking.booking_date >= from_date)
    
    if to_date:
        query = query.filter(CourtBooking.booking_date <= to_date)
    
    if court_id:
        query = query.filter(CourtBooking.court_id == court_id)
    
    if status:
        query = query.filter(CourtBooking.status == status)
    
    bookings = query.order_by(
        CourtBooking.booking_date.desc(),
        CourtBooking.start_time.desc()
    ).all()
    
    # Prepare response list
    response_list = []
    for booking in bookings:
        response_data = {
            **booking.__dict__,
            'court_number': booking.court.court_number,
            'equipment_rentals': [
                {
                    'equipment_id': r.equipment_id,
                    'equipment_name': r.equipment.name,
                    'quantity': r.quantity,
                    'price_cents': r.price_cents
                }
                for r in booking.equipment_rentals
            ]
        }
        response_list.append(BookingResponse(**response_data))
    
    return response_list


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get specific booking details."""
    tenant_id = tenant_ctx.tenant_id
    
    booking = db.query(CourtBooking).filter(
        CourtBooking.id == booking_id,
        CourtBooking.tenant_id == tenant_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    response_data = {
        **booking.__dict__,
        'court_number': booking.court.court_number,
        'equipment_rentals': [
            {
                'equipment_id': r.equipment_id,
                'equipment_name': r.equipment.name,
                'quantity': r.quantity,
                'price_cents': r.price_cents
            }
            for r in booking.equipment_rentals
        ]
    }
    
    return BookingResponse(**response_data)


@router.put("/bookings/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    booking_update: BookingUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a booking."""
    tenant_id = tenant_ctx.tenant_id
    
    booking = db.query(CourtBooking).filter(
        CourtBooking.id == booking_id,
        CourtBooking.tenant_id == tenant_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Check if transitioning to completed status
    old_status = booking.status
    update_data = booking_update.model_dump(exclude_unset=True)
    
    # If updating time, check availability
    if 'start_time' in update_data or 'duration_minutes' in update_data:
        new_start = update_data.get('start_time', booking.start_time)
        new_duration = update_data.get('duration_minutes', booking.duration_minutes)
        
        if not check_court_availability(
            booking.court_id,
            booking.booking_date,
            new_start,
            new_duration,
            db,
            tenant_ctx,
            exclude_booking_id=booking_id
        ):
            raise HTTPException(status_code=409, detail="Court is not available for the requested time slot")
        
        # Recalculate end time
        booking_datetime = datetime.combine(booking.booking_date, new_start)
        end_datetime = booking_datetime + timedelta(minutes=new_duration)
        update_data['end_time'] = end_datetime.time()
    
    # Update fields
    for field, value in update_data.items():
        setattr(booking, field, value)
    
    db.commit()
    db.refresh(booking)
    
    # Award loyalty points if transitioning to completed
    if old_status != 'completed' and booking.status == 'completed':
        award_loyalty_points_for_booking(booking, db, tenant_ctx)
    
    logger.info(f"Updated booking {booking_id}")
    
    response_data = {
        **booking.__dict__,
        'court_number': booking.court.court_number,
        'equipment_rentals': [
            {
                'equipment_id': r.equipment_id,
                'equipment_name': r.equipment.name,
                'quantity': r.quantity,
                'price_cents': r.price_cents
            }
            for r in booking.equipment_rentals
        ]
    }
    
    return BookingResponse(**response_data)


@router.delete("/bookings/{booking_id}", status_code=204)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Cancel a booking."""
    tenant_id = tenant_ctx.tenant_id
    
    booking = db.query(CourtBooking).filter(
        CourtBooking.id == booking_id,
        CourtBooking.tenant_id == tenant_id
    ).first()
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    booking.status = 'cancelled'
    db.commit()
    
    logger.info(f"Cancelled booking {booking_id}")
    return None


@router.post("/availability", response_model=List[dict])
def check_availability(
    query: AvailabilityQuery,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Find available time slots for all courts on a given date."""
    tenant_id = tenant_ctx.tenant_id
    
    # Get all active courts
    courts = db.query(PadelCourt).filter(
        PadelCourt.tenant_id == tenant_id,
        PadelCourt.active == True,
        PadelCourt.maintenance_mode == False
    ).all()
    
    # Define time slots (30-minute intervals from 6 AM to 11 PM)
    time_slots = []
    start_hour = 6
    end_hour = 23
    
    for hour in range(start_hour, end_hour):
        for minute in [0, 30]:
            slot_time = time(hour, minute)
            time_slots.append(slot_time)
    
    # Check availability for each court and time slot
    available_slots = []
    
    for court in courts:
        for slot_time in time_slots:
            if check_court_availability(
                court.id,
                query.date,
                slot_time,
                query.duration_minutes,
                db,
                tenant_ctx
            ):
                # Calculate price for this slot
                booking_datetime = datetime.combine(query.date, slot_time)
                price = calculate_court_price(court, booking_datetime, query.duration_minutes, db, tenant_ctx)
                
                available_slots.append({
                    'court_id': court.id,
                    'court_number': court.court_number,
                    'start_time': slot_time.strftime('%H:%M'),
                    'duration_minutes': query.duration_minutes,
                    'price_cents': price
                })
    
    return available_slots
