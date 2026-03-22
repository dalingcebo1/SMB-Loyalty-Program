"""
Padel Court Booking API Routes

Thin endpoint handlers that delegate to the service layer.
URL paths are preserved exactly as they were in ``app/routes/padel.py``.
"""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import User

from .schemas import (
    AvailabilityQuery,
    BookingCreate,
    BookingResponse,
    BookingUpdate,
    CourtCreate,
    CourtResponse,
    CourtUpdate,
    EquipmentCreate,
    EquipmentResponse,
    EquipmentUpdate,
    PricingRuleCreate,
    PricingRuleResponse,
)
from .services import (
    BookingService,
    CourtService,
    EquipmentService,
    PricingService,
    _build_booking_response,
)

router = APIRouter(prefix="/padel", tags=["padel"])


# ── Court Management ────────────────────────────────────────────────────────

@router.post("/courts", response_model=CourtResponse, status_code=201)
def create_court(
    court: CourtCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new padel court."""
    return CourtService.create_court(db, tenant_ctx.id, court)


@router.get("/courts", response_model=List[CourtResponse])
def list_courts(
    active_only: bool = Query(True, description="Filter active courts only"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all padel courts for current tenant."""
    return CourtService.list_courts(db, tenant_ctx.id, active_only)


@router.get("/courts/{court_id}", response_model=CourtResponse)
def get_court(
    court_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get a specific padel court."""
    return CourtService.get_court(db, tenant_ctx.id, court_id)


@router.put("/courts/{court_id}", response_model=CourtResponse)
def update_court(
    court_id: int,
    court_update: CourtUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a padel court."""
    return CourtService.update_court(db, tenant_ctx.id, court_id, court_update)


@router.delete("/courts/{court_id}", status_code=204)
def delete_court(
    court_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete a padel court."""
    CourtService.delete_court(db, tenant_ctx.id, court_id)
    return None


# ── Court Pricing ───────────────────────────────────────────────────────────

@router.post("/courts/{court_id}/pricing", response_model=PricingRuleResponse, status_code=201)
def create_pricing_rule(
    court_id: int,
    pricing: PricingRuleCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a pricing rule for a court."""
    return PricingService.create_rule(db, tenant_ctx.id, court_id, pricing)


@router.get("/courts/{court_id}/pricing", response_model=List[PricingRuleResponse])
def list_pricing_rules(
    court_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all pricing rules for a court."""
    return PricingService.list_rules(db, tenant_ctx.id, court_id)


@router.delete("/courts/{court_id}/pricing/{pricing_id}", status_code=204)
def delete_pricing_rule(
    court_id: int,
    pricing_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a pricing rule."""
    PricingService.delete_rule(db, tenant_ctx.id, court_id, pricing_id)
    return None


# ── Equipment Management ────────────────────────────────────────────────────

@router.post("/equipment", response_model=EquipmentResponse, status_code=201)
def create_equipment(
    equipment: EquipmentCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create new rental equipment."""
    return EquipmentService.create_equipment(db, tenant_ctx.id, equipment)


@router.get("/equipment", response_model=List[EquipmentResponse])
def list_equipment(
    active_only: bool = Query(True, description="Filter active equipment only"),
    equipment_type: Optional[str] = Query(None, description="Filter by equipment type"),
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all rental equipment."""
    return EquipmentService.list_equipment(db, tenant_ctx.id, active_only, equipment_type)


@router.get("/equipment/{equipment_id}", response_model=EquipmentResponse)
def get_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get specific equipment details."""
    return EquipmentService.get_equipment(db, tenant_ctx.id, equipment_id)


@router.put("/equipment/{equipment_id}", response_model=EquipmentResponse)
def update_equipment(
    equipment_id: int,
    equipment_update: EquipmentUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update equipment details."""
    return EquipmentService.update_equipment(db, tenant_ctx.id, equipment_id, equipment_update)


@router.delete("/equipment/{equipment_id}", status_code=204)
def delete_equipment(
    equipment_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Soft delete equipment."""
    EquipmentService.delete_equipment(db, tenant_ctx.id, equipment_id)
    return None


# ── Bookings ────────────────────────────────────────────────────────────────

@router.post("/bookings", response_model=BookingResponse, status_code=201)
def create_booking(
    booking: BookingCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new court booking."""
    tenant_id = tenant_ctx.id
    db_booking, court = BookingService.create_booking(db, tenant_id, booking)

    # Send booking confirmation email
    customer = db.query(User).filter(User.id == booking.customer_id).first()
    if customer and customer.email:
        from app.services.transactional_notifications import send_padel_booking_confirmation
        background_tasks.add_task(
            send_padel_booking_confirmation,
            db,
            to_email=customer.email,
            to_name=customer.first_name or "Customer",
            tenant_id=tenant_id,
            court_number=court.court_number,
            booking_date=booking.booking_date,
            start_time=booking.start_time,
            duration_minutes=booking.duration_minutes,
            total_price_cents=db_booking.total_price_cents,
        )

    return _build_booking_response(db_booking)


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
    bookings = BookingService.list_bookings(
        db, tenant_ctx.id, from_date, to_date, court_id, status
    )
    return [_build_booking_response(b) for b in bookings]


@router.get("/bookings/{booking_id}", response_model=BookingResponse)
def get_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get specific booking details."""
    booking = BookingService.get_booking(db, tenant_ctx.id, booking_id)
    return _build_booking_response(booking)


@router.put("/bookings/{booking_id}", response_model=BookingResponse)
def update_booking(
    booking_id: int,
    booking_update: BookingUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a booking."""
    booking = BookingService.update_booking(
        db, tenant_ctx.id, booking_id, booking_update
    )
    return _build_booking_response(booking)


@router.delete("/bookings/{booking_id}", status_code=204)
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Cancel a booking."""
    BookingService.cancel_booking(db, tenant_ctx.id, booking_id)
    return None


# ── Availability ────────────────────────────────────────────────────────────

@router.post("/availability", response_model=List[dict])
def check_availability(
    query: AvailabilityQuery,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Find available time slots for all courts on a given date."""
    return BookingService.find_available_slots(
        db, tenant_ctx.id, query.date, query.duration_minutes
    )
