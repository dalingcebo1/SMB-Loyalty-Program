"""Beauty vertical service classes."""

from datetime import date, datetime, time, timedelta
from typing import Dict, List, Optional

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session

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
from app.vertical_models.beauty_packages import BeautyPackage, PackageBooking, package_services
from app.vertical_models.beauty_reviews import ServiceReview

from .constants import ACTIVE_STATUSES, SLOT_INCREMENT_MINUTES
from .schemas import (
    ServiceCreate,
    StylistCreate,
    StylistServiceCreate,
    AvailabilityCreate,
    AppointmentCreate,
    AppointmentUpdate,
    AvailableSlot,
    PackageCreate,
    PackageUpdate,
    PackageResponse,
    PackageBookingCreate,
    PackageBookingResponse,
    ReviewCreate,
    ReviewResponse,
)


class ServiceCatalogService:
    """CRUD operations for beauty services."""

    @staticmethod
    def list_services(
        db: Session, tenant_id: str, category: Optional[str] = None, active_only: bool = True
    ) -> list:
        query = db.query(BeautyService).filter(BeautyService.tenant_id == tenant_id)

        if category:
            query = query.filter(BeautyService.category == category)
        if active_only:
            query = query.filter(BeautyService.active == True)  # noqa: E712

        return query.all()

    @staticmethod
    def create_service(db: Session, tenant_id: str, data: ServiceCreate) -> BeautyService:
        db_service = BeautyService(tenant_id=tenant_id, **data.model_dump())
        db.add(db_service)
        db.commit()
        db.refresh(db_service)
        return db_service

    @staticmethod
    def update_service(db: Session, tenant_id: str, service_id: int, data: ServiceCreate) -> BeautyService:
        db_service = (
            db.query(BeautyService)
            .filter(BeautyService.id == service_id, BeautyService.tenant_id == tenant_id)
            .first()
        )
        if not db_service:
            raise HTTPException(status_code=404, detail="Service not found")

        for key, value in data.model_dump().items():
            setattr(db_service, key, value)

        db.commit()
        db.refresh(db_service)
        return db_service

    @staticmethod
    def delete_service(db: Session, tenant_id: str, service_id: int) -> None:
        db_service = (
            db.query(BeautyService)
            .filter(BeautyService.id == service_id, BeautyService.tenant_id == tenant_id)
            .first()
        )
        if not db_service:
            raise HTTPException(status_code=404, detail="Service not found")

        db.delete(db_service)
        db.commit()


class StylistManagementService:
    """CRUD and management for stylists, service assignments, and availability."""

    @staticmethod
    def list_stylists(db: Session, tenant_id: str, active_only: bool = True) -> list:
        query = db.query(Stylist).filter(Stylist.tenant_id == tenant_id)

        if active_only:
            query = query.filter(Stylist.active == True)  # noqa: E712

        return query.all()

    @staticmethod
    def create_stylist(db: Session, tenant_id: str, data: StylistCreate) -> Stylist:
        db_stylist = Stylist(tenant_id=tenant_id, **data.model_dump())
        db.add(db_stylist)
        db.commit()
        db.refresh(db_stylist)
        return db_stylist

    @staticmethod
    def update_stylist(db: Session, tenant_id: str, stylist_id: int, data: StylistCreate) -> Stylist:
        db_stylist = (
            db.query(Stylist)
            .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_id)
            .first()
        )
        if not db_stylist:
            raise HTTPException(status_code=404, detail="Stylist not found")

        for key, value in data.model_dump().items():
            setattr(db_stylist, key, value)

        db.commit()
        db.refresh(db_stylist)
        return db_stylist

    @staticmethod
    def delete_stylist(db: Session, tenant_id: str, stylist_id: int) -> None:
        db_stylist = (
            db.query(Stylist)
            .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_id)
            .first()
        )
        if not db_stylist:
            raise HTTPException(status_code=404, detail="Stylist not found")

        db.delete(db_stylist)
        db.commit()

    @staticmethod
    def assign_service(
        db: Session, tenant_id: str, stylist_id: int, data: StylistServiceCreate
    ) -> Dict[str, str]:
        # Verify stylist exists
        stylist = (
            db.query(Stylist)
            .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_id)
            .first()
        )
        if not stylist:
            raise HTTPException(status_code=404, detail="Stylist not found")

        # Verify service exists
        service = (
            db.query(BeautyService)
            .filter(
                BeautyService.id == data.service_id,
                BeautyService.tenant_id == tenant_id,
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
                StylistService.service_id == data.service_id,
            )
            .first()
        )
        if existing:
            raise HTTPException(status_code=400, detail="Service already assigned to stylist")

        db_stylist_service = StylistService(
            stylist_id=stylist_id, **data.model_dump()
        )
        db.add(db_stylist_service)
        db.commit()
        return {"message": "Service assigned successfully"}

    @staticmethod
    def remove_service(
        db: Session, tenant_id: str, stylist_id: int, service_id: int
    ) -> None:
        # Verify stylist exists
        stylist = (
            db.query(Stylist)
            .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_id)
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

    @staticmethod
    def set_availability(
        db: Session, tenant_id: str, stylist_id: int, data: AvailabilityCreate
    ) -> Dict[str, str]:
        # Verify stylist exists
        stylist = (
            db.query(Stylist)
            .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_id)
            .first()
        )
        if not stylist:
            raise HTTPException(status_code=404, detail="Stylist not found")

        # Must have either day_of_week or specific_date
        if data.day_of_week is None and data.specific_date is None:
            raise HTTPException(
                status_code=400,
                detail="Must provide either day_of_week or specific_date",
            )

        db_availability = StylistAvailability(
            stylist_id=stylist_id, **data.model_dump()
        )
        db.add(db_availability)
        db.commit()
        return {"message": "Availability set successfully"}

    @staticmethod
    def get_availability(db: Session, tenant_id: str, stylist_id: int) -> list:
        # Verify stylist exists
        stylist = (
            db.query(Stylist)
            .filter(Stylist.id == stylist_id, Stylist.tenant_id == tenant_id)
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


class AvailabilityService:
    """Slot generation for appointment booking."""

    @staticmethod
    def find_available_slots(
        db: Session,
        tenant_id: str,
        service_id: int,
        appointment_date: date,
        stylist_id: Optional[int] = None,
    ) -> List[AvailableSlot]:
        # Get service
        service = (
            db.query(BeautyService)
            .filter(
                BeautyService.id == service_id,
                BeautyService.tenant_id == tenant_id,
            )
            .first()
        )
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        # Build stylist query
        stylist_query = db.query(Stylist).filter(
            Stylist.tenant_id == tenant_id,
            Stylist.active == True,  # noqa: E712
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

        available_slots: List[AvailableSlot] = []
        day_of_week = appointment_date.weekday()  # 0=Monday, 6=Sunday

        for stylist_obj in stylists:
            # Get availability for this stylist
            availability_entries = (
                db.query(StylistAvailability)
                .filter(
                    StylistAvailability.stylist_id == stylist_obj.id,
                    StylistAvailability.is_available == True,  # noqa: E712
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
                        Appointment.stylist_id == stylist_obj.id,
                        Appointment.appointment_date == appointment_date,
                        Appointment.status.in_(ACTIVE_STATUSES),
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
                                stylist_id=stylist_obj.id,
                                stylist_name=stylist_obj.name,
                                start_time=current_time,
                                end_time=slot_end,
                            )
                        )

                    # Move to next slot
                    current_time = (
                        datetime.combine(date.today(), current_time)
                        + timedelta(minutes=SLOT_INCREMENT_MINUTES)
                    ).time()

        return available_slots


class AppointmentService:
    """Appointment booking lifecycle."""

    @staticmethod
    def list_appointments(
        db: Session,
        tenant_id: str,
        stylist_id: Optional[int] = None,
        customer_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        status: Optional[str] = None,
    ) -> list:
        query = db.query(Appointment).filter(Appointment.tenant_id == tenant_id)

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

    @staticmethod
    def create_appointment(db: Session, tenant_id: str, data: AppointmentCreate) -> dict:
        """Create appointment and return dict with appointment + related objects for email."""
        # Verify customer exists
        customer = (
            db.query(User)
            .filter(
                User.id == data.customer_id,
                User.tenant_id == tenant_id,
            )
            .first()
        )
        if not customer:
            raise HTTPException(status_code=404, detail="User not found")

        # Verify stylist exists
        stylist = (
            db.query(Stylist)
            .filter(
                Stylist.id == data.stylist_id,
                Stylist.tenant_id == tenant_id,
            )
            .first()
        )
        if not stylist:
            raise HTTPException(status_code=404, detail="Stylist not found")

        # Verify service exists
        service = (
            db.query(BeautyService)
            .filter(
                BeautyService.id == data.service_id,
                BeautyService.tenant_id == tenant_id,
            )
            .first()
        )
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")

        # Calculate end time
        total_minutes = service.duration_minutes + service.buffer_minutes
        end_time = (
            datetime.combine(date.today(), data.start_time)
            + timedelta(minutes=total_minutes)
        ).time()

        # Check for conflicts
        conflicts = (
            db.query(Appointment)
            .filter(
                Appointment.tenant_id == tenant_id,
                Appointment.stylist_id == data.stylist_id,
                Appointment.appointment_date == data.appointment_date,
                Appointment.status.in_(ACTIVE_STATUSES),
                or_(
                    and_(
                        Appointment.start_time <= data.start_time,
                        Appointment.end_time > data.start_time,
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
            tenant_id=tenant_id,
            customer_id=data.customer_id,
            stylist_id=data.stylist_id,
            service_id=data.service_id,
            appointment_date=data.appointment_date,
            start_time=data.start_time,
            end_time=end_time,
            duration_minutes=total_minutes,
            price_cents=service.price_cents,
            status="pending",
            customer_notes=data.customer_notes,
        )
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)

        return {
            "appointment": db_appointment,
            "customer": customer,
            "stylist": stylist,
            "service": service,
        }

    @staticmethod
    def update_appointment(
        db: Session, tenant_id: str, appointment_id: int, data: AppointmentUpdate
    ) -> tuple:
        """Update appointment. Returns (appointment, status_changed_to_completed)."""
        db_appointment = (
            db.query(Appointment)
            .filter(
                Appointment.id == appointment_id,
                Appointment.tenant_id == tenant_id,
            )
            .first()
        )
        if not db_appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")

        # Check if status is changing to "completed" to award loyalty points
        old_status = db_appointment.status
        status_changed_to_completed = False

        for key, value in data.model_dump(exclude_unset=True).items():
            if key == "status" and value == "completed" and old_status != "completed":
                status_changed_to_completed = True
            setattr(db_appointment, key, value)

        # Award loyalty points if appointment just completed
        if status_changed_to_completed:
            service = (
                db.query(BeautyService)
                .filter(BeautyService.id == db_appointment.service_id)
                .first()
            )
            if service:
                AppointmentService.award_loyalty_points(
                    db=db,
                    tenant_id=tenant_id,
                    customer_id=db_appointment.customer_id,
                    service=service,
                    appointment_id=appointment_id,
                )

        db.commit()
        db.refresh(db_appointment)
        return (db_appointment, status_changed_to_completed)

    @staticmethod
    def award_loyalty_points(
        db: Session,
        tenant_id: str,
        customer_id: int,
        service: BeautyService,
        appointment_id: int,
    ) -> Optional[int]:
        """Calculate and award loyalty points to customer for completed appointment."""
        # Get loyalty program configuration
        loyalty_program = db.query(LoyaltyProgram).filter(
            LoyaltyProgram.tenant_id == tenant_id
        ).first()

        if not loyalty_program or not loyalty_program.active:
            return None

        # Calculate points: service_price_cents * accrual_ratio * points_multiplier
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


class PackageService:
    """Package management operations."""

    @staticmethod
    def list_packages(db: Session, tenant_id: str, active_only: bool = True) -> list:
        query = db.query(BeautyPackage).filter(
            BeautyPackage.tenant_id == tenant_id
        )

        if active_only:
            query = query.filter(BeautyPackage.active == True)  # noqa: E712

        packages = query.all()

        result = []
        for pkg in packages:
            services = db.query(BeautyService).join(
                package_services
            ).filter(
                package_services.c.package_id == pkg.id
            ).all()

            result.append(
                PackageResponse(
                    id=pkg.id,
                    tenant_id=pkg.tenant_id,
                    name=pkg.name,
                    description=pkg.description,
                    price=pkg.price,
                    discount_percent=pkg.discount_percent,
                    valid_from=pkg.valid_from,
                    valid_until=pkg.valid_until,
                    max_bookings=pkg.max_bookings,
                    current_bookings=pkg.current_bookings,
                    is_available=pkg.is_available,
                    points_multiplier=pkg.points_multiplier,
                    online_booking_enabled=pkg.online_booking_enabled,
                    requires_deposit=pkg.requires_deposit,
                    active=pkg.active,
                    created_at=pkg.created_at,
                    services=[
                        {
                            "id": s.id,
                            "name": s.name,
                            "price_cents": s.price_cents,
                            "duration_minutes": s.duration_minutes,
                        }
                        for s in services
                    ],
                )
            )

        return result

    @staticmethod
    def create_package(
        db: Session, tenant_id: str, data: PackageCreate
    ) -> PackageResponse:
        # Verify all services exist and belong to this tenant
        services = db.query(BeautyService).filter(
            BeautyService.id.in_(data.service_ids),
            BeautyService.tenant_id == tenant_id,
        ).all()

        if len(services) != len(data.service_ids):
            raise HTTPException(status_code=404, detail="One or more services not found")

        # Create package
        total_duration = sum(s.duration_minutes + s.buffer_minutes for s in services)
        package = BeautyPackage(
            tenant_id=tenant_id,
            name=data.name,
            description=data.description,
            price_cents=data.price_cents,
            discount_percent=data.discount_percent,
            total_duration_minutes=total_duration,
            valid_from=data.valid_from,
            valid_until=data.valid_until,
            max_bookings=data.max_bookings,
            current_bookings=0,
            points_multiplier=data.points_multiplier,
            online_booking_enabled=data.online_booking_enabled,
            requires_deposit=data.requires_deposit,
            active=data.active,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(package)
        db.flush()

        # Associate services
        for service in services:
            db.execute(
                package_services.insert().values(
                    package_id=package.id, service_id=service.id
                )
            )

        db.commit()
        db.refresh(package)

        return PackageResponse(
            id=package.id,
            tenant_id=package.tenant_id,
            name=package.name,
            description=package.description,
            price=package.price,
            discount_percent=package.discount_percent,
            valid_from=package.valid_from,
            valid_until=package.valid_until,
            max_bookings=package.max_bookings,
            current_bookings=package.current_bookings,
            is_available=package.is_available,
            points_multiplier=package.points_multiplier,
            online_booking_enabled=package.online_booking_enabled,
            requires_deposit=package.requires_deposit,
            active=package.active,
            created_at=package.created_at,
            services=[
                {
                    "id": s.id,
                    "name": s.name,
                    "price_cents": s.price_cents,
                    "duration_minutes": s.duration_minutes,
                }
                for s in services
            ],
        )

    @staticmethod
    def update_package(
        db: Session, tenant_id: str, package_id: int, data: PackageUpdate
    ) -> PackageResponse:
        package = db.query(BeautyPackage).filter(
            BeautyPackage.id == package_id,
            BeautyPackage.tenant_id == tenant_id,
        ).first()

        if not package:
            raise HTTPException(status_code=404, detail="Package not found")

        # Update fields
        update_data = data.dict(exclude_unset=True)
        service_ids = update_data.pop("service_ids", None)

        for field, value in update_data.items():
            setattr(package, field, value)

        package.updated_at = datetime.utcnow()

        # Update service associations if provided
        if service_ids is not None:
            services = db.query(BeautyService).filter(
                BeautyService.id.in_(service_ids),
                BeautyService.tenant_id == tenant_id,
            ).all()

            if len(services) != len(service_ids):
                raise HTTPException(status_code=404, detail="One or more services not found")

            # Remove old associations and add new ones
            db.execute(
                package_services.delete().where(
                    package_services.c.package_id == package_id
                )
            )

            for service in services:
                db.execute(
                    package_services.insert().values(
                        package_id=package_id, service_id=service.id
                    )
                )

        db.commit()
        db.refresh(package)

        # Get updated services
        services = db.query(BeautyService).join(
            package_services
        ).filter(
            package_services.c.package_id == package.id
        ).all()

        return PackageResponse(
            id=package.id,
            tenant_id=package.tenant_id,
            name=package.name,
            description=package.description,
            price=package.price,
            discount_percent=package.discount_percent,
            valid_from=package.valid_from,
            valid_until=package.valid_until,
            max_bookings=package.max_bookings,
            current_bookings=package.current_bookings,
            is_available=package.is_available,
            points_multiplier=package.points_multiplier,
            online_booking_enabled=package.online_booking_enabled,
            requires_deposit=package.requires_deposit,
            active=package.active,
            created_at=package.created_at,
            services=[
                {
                    "id": s.id,
                    "name": s.name,
                    "price_cents": s.price_cents,
                    "duration_minutes": s.duration_minutes,
                }
                for s in services
            ],
        )

    @staticmethod
    def book_package(
        db: Session,
        tenant_id: str,
        customer_id: int,
        data: PackageBookingCreate,
    ) -> PackageBookingResponse:
        package = db.query(BeautyPackage).filter(
            BeautyPackage.id == data.package_id,
            BeautyPackage.tenant_id == tenant_id,
        ).first()

        if not package:
            raise HTTPException(status_code=404, detail="Package not found")

        if not package.is_available:
            raise HTTPException(status_code=400, detail="Package is not available")

        # Create booking
        booking = PackageBooking(
            package_id=package.id,
            customer_id=customer_id,
            tenant_id=tenant_id,
            status="active",
            booked_at=datetime.utcnow(),
            expires_at=package.valid_until,
            price_paid_cents=package.price_cents,
            notes=data.notes,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(booking)

        # Increment booking count
        package.current_bookings += 1

        # Award loyalty points (bonus multiplier)
        AppointmentService.award_loyalty_points(
            db=db,
            tenant_id=tenant_id,
            customer_id=customer_id,
            service=None,  # Package booking, not service
            appointment_id=None,
        )

        db.commit()
        db.refresh(booking)

        return PackageBookingResponse(
            id=booking.id,
            package_id=booking.package_id,
            package_name=package.name,
            customer_id=booking.customer_id,
            status=booking.status,
            booked_at=booking.booked_at,
            redeemed_at=booking.redeemed_at,
            expires_at=booking.expires_at,
            price_paid_cents=booking.price_paid_cents,
            notes=booking.notes,
        )

    @staticmethod
    def list_package_bookings(
        db: Session,
        tenant_id: str,
        customer_id: int,
        status: Optional[str] = None,
    ) -> list:
        query = db.query(PackageBooking).filter(
            PackageBooking.customer_id == customer_id,
            PackageBooking.tenant_id == tenant_id,
        )

        if status:
            query = query.filter(PackageBooking.status == status)

        bookings = query.all()

        result = []
        for booking in bookings:
            package = db.query(BeautyPackage).filter(
                BeautyPackage.id == booking.package_id
            ).first()

            result.append(
                PackageBookingResponse(
                    id=booking.id,
                    package_id=booking.package_id,
                    package_name=package.name if package else "Unknown",
                    customer_id=booking.customer_id,
                    status=booking.status,
                    booked_at=booking.booked_at,
                    redeemed_at=booking.redeemed_at,
                    expires_at=booking.expires_at,
                    price_paid_cents=booking.price_paid_cents,
                    notes=booking.notes,
                )
            )

        return result


class ReviewService:
    """Review management operations."""

    @staticmethod
    def create_review(
        db: Session,
        tenant_id: str,
        customer_id: int,
        data: ReviewCreate,
        customer_name: str,
    ) -> ReviewResponse:
        # Verify appointment exists and belongs to user
        appointment = db.query(Appointment).filter(
            Appointment.id == data.appointment_id,
            Appointment.customer_id == customer_id,
            Appointment.tenant_id == tenant_id,
        ).first()

        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")

        if appointment.status != "completed":
            raise HTTPException(
                status_code=400, detail="Can only review completed appointments"
            )

        # Check if review already exists
        existing_review = db.query(ServiceReview).filter(
            ServiceReview.appointment_id == data.appointment_id
        ).first()

        if existing_review:
            raise HTTPException(
                status_code=400, detail="Review already submitted for this appointment"
            )

        # Create review
        review = ServiceReview(
            appointment_id=appointment.id,
            customer_id=customer_id,
            service_id=appointment.service_id,
            stylist_id=appointment.stylist_id,
            tenant_id=tenant_id,
            overall_rating=data.overall_rating,
            service_quality_rating=data.service_quality_rating,
            stylist_rating=data.stylist_rating,
            cleanliness_rating=data.cleanliness_rating,
            value_rating=data.value_rating,
            review_title=data.review_title,
            review_text=data.review_text,
            approved=False,  # Requires moderation
            featured=False,
            flagged=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.add(review)
        db.commit()
        db.refresh(review)

        # Get related data for response
        service = db.query(BeautyService).filter(
            BeautyService.id == appointment.service_id
        ).first()
        stylist = db.query(Stylist).filter(Stylist.id == appointment.stylist_id).first()

        return ReviewResponse(
            id=review.id,
            appointment_id=review.appointment_id,
            customer_id=review.customer_id,
            customer_name=customer_name,
            service_id=review.service_id,
            service_name=service.name if service else "Unknown",
            stylist_id=review.stylist_id,
            stylist_name=stylist.name if stylist else "Unknown",
            overall_rating=review.overall_rating,
            service_quality_rating=review.service_quality_rating,
            stylist_rating=review.stylist_rating,
            cleanliness_rating=review.cleanliness_rating,
            value_rating=review.value_rating,
            average_rating=review.average_rating,
            review_title=review.review_title,
            review_text=review.review_text,
            approved=review.approved,
            featured=review.featured,
            created_at=review.created_at,
        )

    @staticmethod
    def _build_review_response(review: ServiceReview, db: Session) -> ReviewResponse:
        """Build a ReviewResponse with related entity names."""
        customer = db.query(User).filter(User.id == review.customer_id).first()
        service = db.query(BeautyService).filter(
            BeautyService.id == review.service_id
        ).first()
        stylist = db.query(Stylist).filter(Stylist.id == review.stylist_id).first()

        return ReviewResponse(
            id=review.id,
            appointment_id=review.appointment_id,
            customer_id=review.customer_id,
            customer_name=f"{customer.first_name} {customer.last_name}" if customer else "Anonymous",
            service_id=review.service_id,
            service_name=service.name if service else "Unknown",
            stylist_id=review.stylist_id,
            stylist_name=stylist.name if stylist else "Unknown",
            overall_rating=review.overall_rating,
            service_quality_rating=review.service_quality_rating,
            stylist_rating=review.stylist_rating,
            cleanliness_rating=review.cleanliness_rating,
            value_rating=review.value_rating,
            average_rating=review.average_rating,
            review_title=review.review_title,
            review_text=review.review_text,
            approved=review.approved,
            featured=review.featured,
            created_at=review.created_at,
        )

    @staticmethod
    def list_reviews(
        db: Session,
        tenant_id: str,
        service_id: Optional[int] = None,
        stylist_id: Optional[int] = None,
        approved_only: bool = True,
    ) -> list:
        query = db.query(ServiceReview).filter(
            ServiceReview.tenant_id == tenant_id
        )

        if approved_only:
            query = query.filter(ServiceReview.approved == True)  # noqa: E712

        if service_id:
            query = query.filter(ServiceReview.service_id == service_id)

        if stylist_id:
            query = query.filter(ServiceReview.stylist_id == stylist_id)

        reviews = query.order_by(ServiceReview.created_at.desc()).all()

        return [ReviewService._build_review_response(r, db) for r in reviews]

    @staticmethod
    def approve_review(db: Session, tenant_id: str, review_id: int) -> dict:
        review = db.query(ServiceReview).filter(
            ServiceReview.id == review_id,
            ServiceReview.tenant_id == tenant_id,
        ).first()

        if not review:
            raise HTTPException(status_code=404, detail="Review not found")

        review.approved = True
        review.updated_at = datetime.utcnow()

        db.commit()

        return {"message": "Review approved", "review_id": review_id}

    @staticmethod
    def list_pending_reviews(db: Session, tenant_id: str) -> list:
        reviews = db.query(ServiceReview).filter(
            ServiceReview.tenant_id == tenant_id,
            ServiceReview.approved == False,  # noqa: E712
            ServiceReview.flagged == False,  # noqa: E712
        ).order_by(ServiceReview.created_at.desc()).all()

        return [ReviewService._build_review_response(r, db) for r in reviews]
