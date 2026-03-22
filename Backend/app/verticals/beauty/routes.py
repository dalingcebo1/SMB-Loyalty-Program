"""Beauty vertical route handlers."""

from datetime import date
from typing import List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.tenant_context import get_tenant_context, TenantContext
from app.models import User

from .schemas import (
    ServiceCreate,
    ServiceResponse,
    StylistCreate,
    StylistResponse,
    StylistServiceCreate,
    AvailabilityCreate,
    AppointmentCreate,
    AppointmentUpdate,
    AppointmentResponse,
    AvailableSlot,
    PackageCreate,
    PackageUpdate,
    PackageResponse,
    PackageBookingCreate,
    PackageBookingResponse,
    ReviewCreate,
    ReviewResponse,
)
from .services import (
    ServiceCatalogService,
    StylistManagementService,
    AvailabilityService,
    AppointmentService,
    PackageService,
    ReviewService,
)

router = APIRouter(prefix="/api/beauty", tags=["Beauty/Salon"])


# === Service Endpoints ===


@router.get("/services", response_model=List[ServiceResponse])
def list_services(
    category: Optional[str] = None,
    active_only: bool = True,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all beauty services for the tenant."""
    return ServiceCatalogService.list_services(
        db, tenant_ctx.id, category=category, active_only=active_only
    )


@router.post("/services", response_model=ServiceResponse, status_code=201)
def create_service(
    service: ServiceCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new beauty service."""
    return ServiceCatalogService.create_service(db, tenant_ctx.id, service)


@router.put("/services/{service_id}", response_model=ServiceResponse)
def update_service(
    service_id: int,
    service: ServiceCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a beauty service."""
    return ServiceCatalogService.update_service(db, tenant_ctx.id, service_id, service)


@router.delete("/services/{service_id}", status_code=204)
def delete_service(
    service_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a beauty service."""
    ServiceCatalogService.delete_service(db, tenant_ctx.id, service_id)


# === Stylist Endpoints ===


@router.get("/stylists", response_model=List[StylistResponse])
def list_stylists(
    active_only: bool = True,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """List all stylists for the tenant."""
    return StylistManagementService.list_stylists(
        db, tenant_ctx.id, active_only=active_only
    )


@router.post("/stylists", response_model=StylistResponse, status_code=201)
def create_stylist(
    stylist: StylistCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new stylist."""
    return StylistManagementService.create_stylist(db, tenant_ctx.id, stylist)


@router.put("/stylists/{stylist_id}", response_model=StylistResponse)
def update_stylist(
    stylist_id: int,
    stylist: StylistCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update a stylist."""
    return StylistManagementService.update_stylist(
        db, tenant_ctx.id, stylist_id, stylist
    )


@router.delete("/stylists/{stylist_id}", status_code=204)
def delete_stylist(
    stylist_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Delete a stylist."""
    StylistManagementService.delete_stylist(db, tenant_ctx.id, stylist_id)


# === Stylist Services Endpoints ===


@router.post("/stylists/{stylist_id}/services", status_code=201)
def assign_service_to_stylist(
    stylist_id: int,
    stylist_service: StylistServiceCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Assign a service to a stylist with optional custom pricing."""
    return StylistManagementService.assign_service(
        db, tenant_ctx.id, stylist_id, stylist_service
    )


@router.delete("/stylists/{stylist_id}/services/{service_id}", status_code=204)
def remove_service_from_stylist(
    stylist_id: int,
    service_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Remove a service from a stylist."""
    StylistManagementService.remove_service(
        db, tenant_ctx.id, stylist_id, service_id
    )


# === Stylist Availability Endpoints ===


@router.post("/stylists/{stylist_id}/availability", status_code=201)
def set_stylist_availability(
    stylist_id: int,
    availability: AvailabilityCreate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Set availability for a stylist (recurring or specific date)."""
    return StylistManagementService.set_availability(
        db, tenant_ctx.id, stylist_id, availability
    )


@router.get("/stylists/{stylist_id}/availability")
def get_stylist_availability(
    stylist_id: int,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Get availability schedule for a stylist."""
    return StylistManagementService.get_availability(
        db, tenant_ctx.id, stylist_id
    )


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
    return AppointmentService.list_appointments(
        db,
        tenant_ctx.id,
        stylist_id=stylist_id,
        customer_id=customer_id,
        start_date=start_date,
        end_date=end_date,
        status=status,
    )


@router.post("/appointments", response_model=AppointmentResponse, status_code=201)
def create_appointment(
    appointment: AppointmentCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Create a new appointment."""
    result = AppointmentService.create_appointment(
        db, tenant_ctx.id, appointment
    )
    db_appointment = result["appointment"]
    customer = result["customer"]
    stylist = result["stylist"]
    service = result["service"]

    # Send appointment confirmation email
    if customer.email:
        from app.services.transactional_notifications import send_beauty_appointment_confirmation
        background_tasks.add_task(
            send_beauty_appointment_confirmation,
            db,
            to_email=customer.email,
            to_name=customer.first_name or "Customer",
            tenant_id=tenant_ctx.id,
            stylist_name=stylist.name,
            service_name=service.name,
            appointment_date=appointment.appointment_date,
            start_time=appointment.start_time,
        )

    return db_appointment


@router.put("/appointments/{appointment_id}", response_model=AppointmentResponse)
def update_appointment(
    appointment_id: int,
    appointment: AppointmentUpdate,
    db: Session = Depends(get_db),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
):
    """Update an appointment status or notes."""
    db_appointment, _status_changed = AppointmentService.update_appointment(
        db, tenant_ctx.id, appointment_id, appointment
    )
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
    return AvailabilityService.find_available_slots(
        db,
        tenant_ctx.id,
        service_id,
        appointment_date,
        stylist_id=stylist_id,
    )


# === Package Management Endpoints ===


@router.get("/packages", response_model=List[PackageResponse])
def list_packages(
    active_only: bool = Query(True),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List all beauty packages for the tenant."""
    return PackageService.list_packages(db, tenant_ctx.id, active_only=active_only)


@router.post("/packages", response_model=PackageResponse)
def create_package(
    package_data: PackageCreate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Create a new beauty package (admin only)."""
    return PackageService.create_package(db, tenant_ctx.id, package_data)


@router.patch("/packages/{package_id}", response_model=PackageResponse)
def update_package(
    package_id: int,
    package_data: PackageUpdate,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Update an existing package."""
    return PackageService.update_package(
        db, tenant_ctx.id, package_id, package_data
    )


@router.post("/package-bookings", response_model=PackageBookingResponse)
def book_package(
    booking_data: PackageBookingCreate,
    current_user: User = Depends(),  # Requires authenticated user
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Customer books a beauty package."""
    return PackageService.book_package(
        db, tenant_ctx.id, current_user.id, booking_data
    )


@router.get("/package-bookings", response_model=List[PackageBookingResponse])
def list_package_bookings(
    status: Optional[str] = Query(None),
    current_user: User = Depends(),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List customer's package bookings."""
    return PackageService.list_package_bookings(
        db, tenant_ctx.id, current_user.id, status=status
    )


# === Review Management Endpoints ===


@router.post("/reviews", response_model=ReviewResponse)
def create_review(
    review_data: ReviewCreate,
    current_user: User = Depends(),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Submit a review for a completed appointment."""
    return ReviewService.create_review(
        db,
        tenant_ctx.id,
        current_user.id,
        review_data,
        customer_name=f"{current_user.first_name} {current_user.last_name}",
    )


@router.get("/reviews", response_model=List[ReviewResponse])
def list_reviews(
    service_id: Optional[int] = Query(None),
    stylist_id: Optional[int] = Query(None),
    approved_only: bool = Query(True),
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List approved reviews (public endpoint)."""
    return ReviewService.list_reviews(
        db,
        tenant_ctx.id,
        service_id=service_id,
        stylist_id=stylist_id,
        approved_only=approved_only,
    )


@router.patch("/reviews/{review_id}/approve")
def approve_review(
    review_id: int,
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """Approve a pending review (admin only)."""
    return ReviewService.approve_review(db, tenant_ctx.id, review_id)


@router.get("/reviews/pending", response_model=List[ReviewResponse])
def list_pending_reviews(
    tenant_ctx: TenantContext = Depends(get_tenant_context),
    db: Session = Depends(get_db),
):
    """List pending reviews for moderation (admin only)."""
    return ReviewService.list_pending_reviews(db, tenant_ctx.id)
