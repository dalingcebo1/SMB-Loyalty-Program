"""
Tests for the Beauty vertical service layer.

Covers: ServiceCatalogService, StylistManagementService,
        AvailabilityService, AppointmentService, PackageService,
        ReviewService, and tenant isolation.
"""

from datetime import date, datetime, time, timedelta

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import (
    Appointment,
    BeautyService,
    LoyaltyProgram,
    LoyaltyTransaction,
    PointBalance,
    Stylist,
    StylistAvailability,
    StylistService,
    Tenant,
    User,
)
from app.vertical_models.beauty_packages import BeautyPackage, package_services
from app.vertical_models.beauty_reviews import ServiceReview
from app.verticals.beauty.schemas import (
    AppointmentCreate,
    AppointmentUpdate,
    AvailabilityCreate,
    PackageCreate,
    PackageUpdate,
    ReviewCreate,
    ServiceCreate,
    StylistCreate,
    StylistServiceCreate,
)
from app.verticals.beauty.services import (
    AppointmentService,
    AvailabilityService,
    PackageService,
    ReviewService,
    ServiceCatalogService,
    StylistManagementService,
)
from config import settings


# ── Helpers ─────────────────────────────────────────────────────────────────


def _ensure_beauty_tenant(db: Session, tenant_id: str | None = None) -> Tenant:
    """Ensure a beauty tenant exists and return it."""
    tid = tenant_id or settings.default_tenant
    tenant = db.query(Tenant).filter_by(id=tid).first()
    if not tenant:
        tenant = Tenant(
            id=tid,
            name="Test Beauty Salon",
            loyalty_type="basic",
            vertical_type="beauty",
            created_at=datetime.utcnow(),
            config={},
        )
        db.add(tenant)
        db.commit()
        db.refresh(tenant)
    return tenant


def _make_user(
    db: Session,
    tenant_id: str,
    email: str = "beauty-test@test.com",
    role: str = "staff",
) -> User:
    """Create and return a user, reusing if the email already exists."""
    user = db.query(User).filter_by(email=email).first()
    if user:
        return user
    user = User(
        email=email,
        tenant_id=tenant_id,
        role=role,
        first_name="Test",
        last_name="Customer",
        phone="0822222222",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_service(
    db: Session,
    tenant_id: str,
    name: str = "Haircut",
    price_cents: int = 15000,
    duration_minutes: int = 30,
    buffer_minutes: int = 10,
    points_multiplier: float = 1.5,
) -> BeautyService:
    """Create a beauty service directly in the DB."""
    service = BeautyService(
        tenant_id=tenant_id,
        name=name,
        category="Hair",
        price_cents=price_cents,
        duration_minutes=duration_minutes,
        buffer_minutes=buffer_minutes,
        points_multiplier=points_multiplier,
        active=True,
        online_booking_enabled=True,
    )
    db.add(service)
    db.commit()
    db.refresh(service)
    return service


def _make_stylist(
    db: Session,
    tenant_id: str,
    name: str = "Jane Smith",
) -> Stylist:
    """Create a stylist directly in the DB."""
    stylist = Stylist(
        tenant_id=tenant_id,
        name=name,
        active=True,
        commission_rate=20.0,
        accepts_walk_ins=True,
    )
    db.add(stylist)
    db.commit()
    db.refresh(stylist)
    return stylist


def _assign_service_to_stylist(
    db: Session,
    stylist_id: int,
    service_id: int,
) -> StylistService:
    """Directly create a stylist-service assignment in the DB."""
    ss = StylistService(stylist_id=stylist_id, service_id=service_id)
    db.add(ss)
    db.commit()
    db.refresh(ss)
    return ss


def _set_stylist_availability(
    db: Session,
    stylist_id: int,
    day_of_week: int | None = None,
    start_time: time = time(9, 0),
    end_time: time = time(17, 0),
    specific_date: date | None = None,
) -> StylistAvailability:
    """Directly create stylist availability in the DB."""
    avail = StylistAvailability(
        stylist_id=stylist_id,
        day_of_week=day_of_week,
        start_time=start_time,
        end_time=end_time,
        specific_date=specific_date,
        is_available=True,
    )
    db.add(avail)
    db.commit()
    db.refresh(avail)
    return avail


def _make_appointment(
    db: Session,
    tenant_id: str,
    customer_id: int,
    stylist_id: int,
    service_id: int,
    appointment_date: date,
    start_time: time,
    end_time: time,
    status: str = "pending",
) -> Appointment:
    """Create an appointment directly in the DB."""
    start_dt = datetime.combine(date.today(), start_time)
    end_dt = datetime.combine(date.today(), end_time)
    duration = int((end_dt - start_dt).total_seconds() / 60)
    appt = Appointment(
        tenant_id=tenant_id,
        customer_id=customer_id,
        stylist_id=stylist_id,
        service_id=service_id,
        appointment_date=appointment_date,
        start_time=start_time,
        end_time=end_time,
        duration_minutes=duration,
        price_cents=0,
        status=status,
    )
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return appt


def _ensure_loyalty_program(
    db: Session,
    tenant_id: str,
    accrual_ratio: float = 1.0,
) -> LoyaltyProgram:
    """Ensure a loyalty program exists for the tenant."""
    program = db.query(LoyaltyProgram).filter_by(tenant_id=tenant_id).first()
    if not program:
        program = LoyaltyProgram(
            tenant_id=tenant_id,
            name="Beauty Rewards",
            accrual_ratio=accrual_ratio,
            active=True,
        )
        db.add(program)
        db.commit()
        db.refresh(program)
    return program


# ── ServiceCatalogService tests ────────────────────────────────────────────


class TestServiceCatalogService:
    """Tests for beauty ServiceCatalogService."""

    def test_create_service(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        data = ServiceCreate(
            name="Blow Dry",
            description="Professional blow dry",
            category="Hair",
            price_cents=12000,
            duration_minutes=45,
            buffer_minutes=5,
            online_booking_enabled=True,
            points_multiplier=1.2,
            active=True,
        )
        result = ServiceCatalogService.create_service(db_session, tenant.id, data)

        assert result.name == "Blow Dry"
        assert result.description == "Professional blow dry"
        assert result.category == "Hair"
        assert result.price_cents == 12000
        assert result.duration_minutes == 45
        assert result.buffer_minutes == 5
        assert result.online_booking_enabled is True
        assert result.points_multiplier == pytest.approx(1.2)
        assert result.active is True
        assert result.tenant_id == tenant.id

    def test_list_services_active_only(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        _make_service(db_session, tenant.id, name="Active Cut")
        inactive = _make_service(db_session, tenant.id, name="Old Style")
        inactive.active = False
        db_session.commit()

        active_list = ServiceCatalogService.list_services(
            db_session, tenant.id, active_only=True
        )
        all_list = ServiceCatalogService.list_services(
            db_session, tenant.id, active_only=False
        )

        active_names = [s.name for s in active_list]
        all_names = [s.name for s in all_list]

        assert "Active Cut" in active_names
        assert "Old Style" not in active_names
        assert "Old Style" in all_names

    def test_list_services_category_filter(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        _make_service(db_session, tenant.id, name="Haircut")
        nails = BeautyService(
            tenant_id=tenant.id,
            name="Manicure",
            category="Nails",
            price_cents=8000,
            duration_minutes=60,
            buffer_minutes=5,
            active=True,
            online_booking_enabled=True,
        )
        db_session.add(nails)
        db_session.commit()

        hair_only = ServiceCatalogService.list_services(
            db_session, tenant.id, category="Hair"
        )
        nails_only = ServiceCatalogService.list_services(
            db_session, tenant.id, category="Nails"
        )

        assert all(s.category == "Hair" for s in hair_only)
        assert all(s.category == "Nails" for s in nails_only)
        assert any(s.name == "Manicure" for s in nails_only)

    def test_update_service(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        svc = _make_service(db_session, tenant.id, name="Basic Cut", price_cents=10000)

        update_data = ServiceCreate(
            name="Premium Cut",
            category="Hair",
            price_cents=20000,
            duration_minutes=45,
            buffer_minutes=15,
            online_booking_enabled=True,
            points_multiplier=2.0,
            active=True,
        )
        updated = ServiceCatalogService.update_service(
            db_session, tenant.id, svc.id, update_data
        )

        assert updated.name == "Premium Cut"
        assert updated.price_cents == 20000
        assert updated.duration_minutes == 45
        assert updated.buffer_minutes == 15
        assert updated.points_multiplier == pytest.approx(2.0)

    def test_delete_service(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        svc = _make_service(db_session, tenant.id, name="Temp Service")

        ServiceCatalogService.delete_service(db_session, tenant.id, svc.id)

        deleted = (
            db_session.query(BeautyService)
            .filter(BeautyService.id == svc.id)
            .first()
        )
        assert deleted is None


# ── StylistManagementService tests ─────────────────────────────────────────


class TestStylistManagementService:
    """Tests for StylistManagementService."""

    def test_create_stylist(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        data = StylistCreate(
            name="Alice Wonder",
            email="alice@salon.com",
            phone="0831112222",
            title="Senior Stylist",
            bio="10 years experience",
            commission_rate=25.0,
            accepts_walk_ins=True,
            active=True,
        )
        result = StylistManagementService.create_stylist(
            db_session, tenant.id, data
        )

        assert result.name == "Alice Wonder"
        assert result.email == "alice@salon.com"
        assert result.phone == "0831112222"
        assert result.title == "Senior Stylist"
        assert result.bio == "10 years experience"
        assert result.commission_rate == pytest.approx(25.0)
        assert result.accepts_walk_ins is True
        assert result.active is True
        assert result.tenant_id == tenant.id

    def test_list_stylists_active_only(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        _make_stylist(db_session, tenant.id, name="Active Stylist")
        inactive = _make_stylist(db_session, tenant.id, name="Retired Stylist")
        inactive.active = False
        db_session.commit()

        active = StylistManagementService.list_stylists(
            db_session, tenant.id, active_only=True
        )
        all_stylists = StylistManagementService.list_stylists(
            db_session, tenant.id, active_only=False
        )

        active_names = [s.name for s in active]
        all_names = [s.name for s in all_stylists]

        assert "Active Stylist" in active_names
        assert "Retired Stylist" not in active_names
        assert "Retired Stylist" in all_names

    def test_assign_service(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        stylist = _make_stylist(db_session, tenant.id, name="Assign Test Stylist")
        service = _make_service(db_session, tenant.id, name="Assign Test Service")

        data = StylistServiceCreate(service_id=service.id)
        result = StylistManagementService.assign_service(
            db_session, tenant.id, stylist.id, data
        )

        assert result["message"] == "Service assigned successfully"

        assignment = (
            db_session.query(StylistService)
            .filter_by(stylist_id=stylist.id, service_id=service.id)
            .first()
        )
        assert assignment is not None

    def test_assign_service_duplicate_detection(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        stylist = _make_stylist(db_session, tenant.id, name="Dup Test Stylist")
        service = _make_service(db_session, tenant.id, name="Dup Test Service")

        data = StylistServiceCreate(service_id=service.id)
        StylistManagementService.assign_service(
            db_session, tenant.id, stylist.id, data
        )

        with pytest.raises(HTTPException) as exc_info:
            StylistManagementService.assign_service(
                db_session, tenant.id, stylist.id, data
            )
        assert exc_info.value.status_code == 400
        assert "already assigned" in exc_info.value.detail

    def test_remove_service(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        stylist = _make_stylist(db_session, tenant.id, name="Remove Test Stylist")
        service = _make_service(db_session, tenant.id, name="Remove Test Service")
        _assign_service_to_stylist(db_session, stylist.id, service.id)

        StylistManagementService.remove_service(
            db_session, tenant.id, stylist.id, service.id
        )

        assignment = (
            db_session.query(StylistService)
            .filter_by(stylist_id=stylist.id, service_id=service.id)
            .first()
        )
        assert assignment is None

    def test_set_availability_requires_day_or_date(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        stylist = _make_stylist(db_session, tenant.id, name="Avail Validation Stylist")

        data = AvailabilityCreate(
            day_of_week=None,
            start_time=time(9, 0),
            end_time=time(17, 0),
            specific_date=None,
        )

        with pytest.raises(HTTPException) as exc_info:
            StylistManagementService.set_availability(
                db_session, tenant.id, stylist.id, data
            )
        assert exc_info.value.status_code == 400
        assert "day_of_week or specific_date" in exc_info.value.detail

    def test_set_availability_with_day_of_week(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        stylist = _make_stylist(db_session, tenant.id, name="Avail Day Stylist")

        data = AvailabilityCreate(
            day_of_week=1,  # Tuesday
            start_time=time(9, 0),
            end_time=time(17, 0),
        )
        result = StylistManagementService.set_availability(
            db_session, tenant.id, stylist.id, data
        )
        assert result["message"] == "Availability set successfully"

    def test_get_availability(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        stylist = _make_stylist(db_session, tenant.id, name="Get Avail Stylist")
        _set_stylist_availability(
            db_session, stylist.id, day_of_week=0, start_time=time(8, 0), end_time=time(16, 0)
        )

        result = StylistManagementService.get_availability(
            db_session, tenant.id, stylist.id
        )

        assert len(result) >= 1
        entry = result[0]
        assert entry["day_of_week"] == 0
        assert entry["start_time"] == "08:00:00"
        assert entry["end_time"] == "16:00:00"
        assert entry["is_available"] is True


# ── AvailabilityService tests ──────────────────────────────────────────────


class TestAvailabilityService:
    """Tests for AvailabilityService slot generation."""

    def test_find_available_slots(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(
            db_session, tenant.id, name="Slot Test Service",
            duration_minutes=30, buffer_minutes=10,
        )
        stylist = _make_stylist(db_session, tenant.id, name="Slot Test Stylist")
        _assign_service_to_stylist(db_session, stylist.id, service.id)

        # Set availability for a known weekday
        target_date = date(2025, 6, 2)  # Monday (weekday=0)
        _set_stylist_availability(
            db_session, stylist.id, day_of_week=0,
            start_time=time(9, 0), end_time=time(12, 0),
        )

        slots = AvailabilityService.find_available_slots(
            db_session, tenant.id, service.id, target_date
        )

        assert len(slots) > 0
        for slot in slots:
            assert slot.stylist_id == stylist.id
            assert slot.stylist_name == "Slot Test Stylist"

    def test_conflict_detection_excludes_booked_slots(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(
            db_session, tenant.id, name="Conflict Test Service",
            duration_minutes=30, buffer_minutes=0,
        )
        stylist = _make_stylist(db_session, tenant.id, name="Conflict Test Stylist")
        _assign_service_to_stylist(db_session, stylist.id, service.id)

        target_date = date(2025, 6, 3)  # Tuesday (weekday=1)
        _set_stylist_availability(
            db_session, stylist.id, day_of_week=1,
            start_time=time(9, 0), end_time=time(11, 0),
        )

        customer = _make_user(
            db_session, tenant.id, email="conflict-customer@test.com", role="customer"
        )
        _make_appointment(
            db_session, tenant.id, customer.id, stylist.id, service.id,
            appointment_date=target_date,
            start_time=time(9, 0), end_time=time(9, 30),
            status="confirmed",
        )

        slots = AvailabilityService.find_available_slots(
            db_session, tenant.id, service.id, target_date, stylist_id=stylist.id
        )

        slot_starts = [s.start_time for s in slots]
        assert time(9, 0) not in slot_starts


# ── AppointmentService tests ──────────────────────────────────────────────


class TestAppointmentService:
    """Tests for AppointmentService booking lifecycle."""

    def test_create_appointment(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(
            db_session, tenant.id, name="Appt Test Service",
            duration_minutes=30, buffer_minutes=10,
        )
        stylist = _make_stylist(db_session, tenant.id, name="Appt Test Stylist")
        customer = _make_user(
            db_session, tenant.id, email="appt-customer@test.com", role="customer"
        )

        data = AppointmentCreate(
            customer_id=customer.id,
            stylist_id=stylist.id,
            service_id=service.id,
            appointment_date=date(2025, 7, 1),
            start_time=time(10, 0),
        )
        result = AppointmentService.create_appointment(db_session, tenant.id, data)

        appt = result["appointment"]
        assert appt.customer_id == customer.id
        assert appt.stylist_id == stylist.id
        assert appt.service_id == service.id
        assert appt.status == "pending"
        assert appt.start_time == time(10, 0)
        # end_time = start_time + duration_minutes + buffer_minutes = 10:00 + 40min = 10:40
        assert appt.end_time == time(10, 40)
        assert result["customer"] == customer
        assert result["stylist"] == stylist
        assert result["service"] == service

    def test_create_appointment_conflict(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(
            db_session, tenant.id, name="Conflict Appt Service",
            duration_minutes=60, buffer_minutes=0,
        )
        stylist = _make_stylist(db_session, tenant.id, name="Conflict Appt Stylist")
        customer1 = _make_user(
            db_session, tenant.id, email="conflict1@test.com", role="customer"
        )
        customer2 = _make_user(
            db_session, tenant.id, email="conflict2@test.com", role="customer"
        )

        data1 = AppointmentCreate(
            customer_id=customer1.id,
            stylist_id=stylist.id,
            service_id=service.id,
            appointment_date=date(2025, 7, 2),
            start_time=time(10, 0),
        )
        AppointmentService.create_appointment(db_session, tenant.id, data1)

        data2 = AppointmentCreate(
            customer_id=customer2.id,
            stylist_id=stylist.id,
            service_id=service.id,
            appointment_date=date(2025, 7, 2),
            start_time=time(10, 30),
        )
        with pytest.raises(HTTPException) as exc_info:
            AppointmentService.create_appointment(db_session, tenant.id, data2)
        assert exc_info.value.status_code == 409
        assert "already booked" in exc_info.value.detail

    def test_update_appointment_status_completed_triggers_loyalty(
        self, db_session: Session
    ):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(
            db_session, tenant.id, name="Complete Svc",
            price_cents=20000, points_multiplier=1.5,
        )
        stylist = _make_stylist(db_session, tenant.id, name="Complete Stylist")
        customer = _make_user(
            db_session, tenant.id, email="complete-customer@test.com", role="customer"
        )
        _ensure_loyalty_program(db_session, tenant.id, accrual_ratio=0.1)

        appt = _make_appointment(
            db_session, tenant.id, customer.id, stylist.id, service.id,
            appointment_date=date(2025, 7, 3),
            start_time=time(14, 0), end_time=time(14, 40),
            status="confirmed",
        )

        update_data = AppointmentUpdate(status="completed")
        result_appt, status_changed = AppointmentService.update_appointment(
            db_session, tenant.id, appt.id, update_data
        )

        assert result_appt.status == "completed"
        assert status_changed is True

        # Verify loyalty points were awarded
        balance = (
            db_session.query(PointBalance)
            .filter_by(tenant_id=tenant.id, user_id=customer.id)
            .first()
        )
        assert balance is not None
        assert balance.points > 0

    def test_award_loyalty_points_calculation(self, db_session: Session):
        """Points = int(price_cents * accrual_ratio) * points_multiplier."""
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(
            db_session, tenant.id, name="Points Calc Svc",
            price_cents=10000, points_multiplier=2.0,
        )
        customer = _make_user(
            db_session, tenant.id, email="points-calc@test.com", role="customer"
        )
        _ensure_loyalty_program(db_session, tenant.id, accrual_ratio=0.1)

        points = AppointmentService.award_loyalty_points(
            db=db_session,
            tenant_id=tenant.id,
            customer_id=customer.id,
            service=service,
            appointment_id=999,
        )

        # base_points = int(10000 * 0.1) = 1000
        # points_earned = int(1000 * 2.0) = 2000
        assert points == 2000

        # Flush session so pending objects are visible to queries
        db_session.flush()

        # Verify balance updated
        balance = (
            db_session.query(PointBalance)
            .filter_by(tenant_id=tenant.id, user_id=customer.id)
            .first()
        )
        assert balance.points == 2000
        assert balance.lifetime_points == 2000

        # Verify transaction recorded
        txn = (
            db_session.query(LoyaltyTransaction)
            .filter_by(tenant_id=tenant.id, user_id=customer.id)
            .first()
        )
        assert txn is not None
        assert txn.type == "EARN"
        assert txn.points == 2000
        assert txn.reference_type == "appointment"

    def test_award_loyalty_points_no_program_returns_none(self, db_session: Session):
        """No loyalty program → returns None without error."""
        tenant = _ensure_beauty_tenant(db_session, tenant_id="no-lp-tenant")
        service = _make_service(
            db_session, tenant.id, name="No LP Svc", price_cents=5000,
        )
        customer = _make_user(
            db_session, tenant.id, email="no-lp@test.com", role="customer"
        )

        result = AppointmentService.award_loyalty_points(
            db=db_session,
            tenant_id=tenant.id,
            customer_id=customer.id,
            service=service,
            appointment_id=888,
        )
        assert result is None


# ── PackageService tests ───────────────────────────────────────────────────


class TestPackageService:
    """Tests for PackageService."""

    def test_create_package(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        svc1 = _make_service(db_session, tenant.id, name="Pkg Svc 1")
        svc2 = _make_service(db_session, tenant.id, name="Pkg Svc 2")

        data = PackageCreate(
            name="Spa Day",
            description="Full spa experience",
            price_cents=50000,
            discount_percent=10.0,
            service_ids=[svc1.id, svc2.id],
            points_multiplier=1.5,
            online_booking_enabled=True,
            requires_deposit=False,
            active=True,
        )
        result = PackageService.create_package(db_session, tenant.id, data)

        assert result.name == "Spa Day"
        assert result.price == pytest.approx(500.0)
        assert result.discount_percent == pytest.approx(10.0)
        assert len(result.services) == 2
        service_names = [s["name"] for s in result.services]
        assert "Pkg Svc 1" in service_names
        assert "Pkg Svc 2" in service_names

    def test_list_packages_active_only(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        svc = _make_service(db_session, tenant.id, name="List Pkg Svc")

        # Create active package
        active_data = PackageCreate(
            name="Active Package",
            price_cents=30000,
            service_ids=[svc.id],
        )
        PackageService.create_package(db_session, tenant.id, active_data)

        # Create inactive package directly in DB
        inactive_pkg = BeautyPackage(
            tenant_id=tenant.id,
            name="Inactive Package",
            price_cents=20000,
            total_duration_minutes=60,
            active=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db_session.add(inactive_pkg)
        db_session.commit()

        active_list = PackageService.list_packages(
            db_session, tenant.id, active_only=True
        )
        all_list = PackageService.list_packages(
            db_session, tenant.id, active_only=False
        )

        active_names = [p.name for p in active_list]
        all_names = [p.name for p in all_list]

        assert "Active Package" in active_names
        assert "Inactive Package" not in active_names
        assert "Inactive Package" in all_names

    def test_update_package(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        svc1 = _make_service(db_session, tenant.id, name="Update Pkg Svc1")
        svc2 = _make_service(db_session, tenant.id, name="Update Pkg Svc2")

        create_data = PackageCreate(
            name="Original Pkg",
            price_cents=40000,
            service_ids=[svc1.id],
        )
        created = PackageService.create_package(db_session, tenant.id, create_data)

        update_data = PackageUpdate(
            name="Updated Pkg",
            price_cents=45000,
            service_ids=[svc1.id, svc2.id],
        )
        updated = PackageService.update_package(
            db_session, tenant.id, created.id, update_data
        )

        assert updated.name == "Updated Pkg"
        assert len(updated.services) == 2


# ── ReviewService tests ────────────────────────────────────────────────────


class TestReviewService:
    """Tests for ReviewService."""

    def test_create_review_validates_completed_appointment(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(db_session, tenant.id, name="Review Svc")
        stylist = _make_stylist(db_session, tenant.id, name="Review Stylist")
        customer = _make_user(
            db_session, tenant.id, email="reviewer@test.com", role="customer"
        )

        # Pending appointment — should be rejected
        pending_appt = _make_appointment(
            db_session, tenant.id, customer.id, stylist.id, service.id,
            appointment_date=date(2025, 7, 5),
            start_time=time(11, 0), end_time=time(11, 40),
            status="pending",
        )

        data = ReviewCreate(
            appointment_id=pending_appt.id,
            overall_rating=5,
            service_quality_rating=5,
            stylist_rating=5,
            cleanliness_rating=5,
            value_rating=5,
            review_title="Great!",
            review_text="Loved it.",
        )
        with pytest.raises(HTTPException) as exc_info:
            ReviewService.create_review(
                db_session, tenant.id, customer.id, data, "Test Customer"
            )
        assert exc_info.value.status_code == 400
        assert "completed" in exc_info.value.detail.lower()

    def test_create_review_success(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(db_session, tenant.id, name="Review OK Svc")
        stylist = _make_stylist(db_session, tenant.id, name="Review OK Stylist")
        customer = _make_user(
            db_session, tenant.id, email="review-ok@test.com", role="customer"
        )

        completed_appt = _make_appointment(
            db_session, tenant.id, customer.id, stylist.id, service.id,
            appointment_date=date(2025, 7, 6),
            start_time=time(10, 0), end_time=time(10, 40),
            status="completed",
        )

        data = ReviewCreate(
            appointment_id=completed_appt.id,
            overall_rating=4,
            service_quality_rating=5,
            stylist_rating=4,
            cleanliness_rating=5,
            value_rating=3,
            review_title="Good experience",
            review_text="Would recommend.",
        )
        result = ReviewService.create_review(
            db_session, tenant.id, customer.id, data, "Test Customer"
        )

        assert result.appointment_id == completed_appt.id
        assert result.overall_rating == 4
        assert result.approved is False  # Requires moderation
        assert result.customer_name == "Test Customer"
        assert result.service_name == "Review OK Svc"
        assert result.stylist_name == "Review OK Stylist"

    def test_list_reviews_approved_only(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(db_session, tenant.id, name="List Review Svc")
        stylist = _make_stylist(db_session, tenant.id, name="List Review Stylist")
        customer = _make_user(
            db_session, tenant.id, email="list-reviewer@test.com", role="customer"
        )

        # Create completed appointment and review
        appt = _make_appointment(
            db_session, tenant.id, customer.id, stylist.id, service.id,
            appointment_date=date(2025, 7, 7),
            start_time=time(9, 0), end_time=time(9, 40),
            status="completed",
        )
        review = ServiceReview(
            tenant_id=tenant.id,
            appointment_id=appt.id,
            customer_id=customer.id,
            stylist_id=stylist.id,
            service_id=service.id,
            overall_rating=5,
            service_quality_rating=4,
            stylist_rating=5,
            cleanliness_rating=4,
            value_rating=4,
            approved=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db_session.add(review)
        db_session.commit()

        approved_list = ReviewService.list_reviews(
            db_session, tenant.id, approved_only=True
        )
        all_list = ReviewService.list_reviews(
            db_session, tenant.id, approved_only=False
        )

        assert all(r.approved for r in approved_list)
        assert any(not r.approved for r in all_list)

    def test_approve_review(self, db_session: Session):
        tenant = _ensure_beauty_tenant(db_session)
        service = _make_service(db_session, tenant.id, name="Approve Review Svc")
        stylist = _make_stylist(db_session, tenant.id, name="Approve Review Stylist")
        customer = _make_user(
            db_session, tenant.id, email="approve-reviewer@test.com", role="customer"
        )

        appt = _make_appointment(
            db_session, tenant.id, customer.id, stylist.id, service.id,
            appointment_date=date(2025, 7, 8),
            start_time=time(13, 0), end_time=time(13, 40),
            status="completed",
        )
        review = ServiceReview(
            tenant_id=tenant.id,
            appointment_id=appt.id,
            customer_id=customer.id,
            stylist_id=stylist.id,
            service_id=service.id,
            overall_rating=4,
            approved=False,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        db_session.add(review)
        db_session.commit()
        db_session.refresh(review)

        result = ReviewService.approve_review(db_session, tenant.id, review.id)
        assert result["message"] == "Review approved"
        assert result["review_id"] == review.id

        db_session.refresh(review)
        assert review.approved is True


# ── Tenant isolation tests ─────────────────────────────────────────────────


class TestTenantIsolation:
    """Verify data is scoped per tenant."""

    def _setup_second_tenant(self, db: Session) -> Tenant:
        return _ensure_beauty_tenant(db, tenant_id="other-beauty-tenant")

    def test_services_scoped_per_tenant(self, db_session: Session):
        t1 = _ensure_beauty_tenant(db_session)
        t2 = self._setup_second_tenant(db_session)

        _make_service(db_session, t1.id, name="T1 Service")
        _make_service(db_session, t2.id, name="T2 Service")

        t1_services = ServiceCatalogService.list_services(db_session, t1.id)
        t2_services = ServiceCatalogService.list_services(db_session, t2.id)

        t1_names = [s.name for s in t1_services]
        t2_names = [s.name for s in t2_services]

        assert "T1 Service" in t1_names
        assert "T2 Service" not in t1_names
        assert "T2 Service" in t2_names
        assert "T1 Service" not in t2_names

    def test_stylists_scoped_per_tenant(self, db_session: Session):
        t1 = _ensure_beauty_tenant(db_session)
        t2 = self._setup_second_tenant(db_session)

        _make_stylist(db_session, t1.id, name="T1 Stylist")
        _make_stylist(db_session, t2.id, name="T2 Stylist")

        t1_stylists = StylistManagementService.list_stylists(db_session, t1.id)
        t2_stylists = StylistManagementService.list_stylists(db_session, t2.id)

        t1_names = [s.name for s in t1_stylists]
        t2_names = [s.name for s in t2_stylists]

        assert "T1 Stylist" in t1_names
        assert "T2 Stylist" not in t1_names

    def test_appointments_scoped_per_tenant(self, db_session: Session):
        t1 = _ensure_beauty_tenant(db_session)
        t2 = self._setup_second_tenant(db_session)

        svc1 = _make_service(db_session, t1.id, name="T1 Appt Svc")
        svc2 = _make_service(db_session, t2.id, name="T2 Appt Svc")
        sty1 = _make_stylist(db_session, t1.id, name="T1 Appt Stylist")
        sty2 = _make_stylist(db_session, t2.id, name="T2 Appt Stylist")
        c1 = _make_user(db_session, t1.id, email="t1-iso@test.com", role="customer")
        c2 = _make_user(db_session, t2.id, email="t2-iso@test.com", role="customer")

        _make_appointment(
            db_session, t1.id, c1.id, sty1.id, svc1.id,
            date(2025, 8, 1), time(10, 0), time(10, 40),
        )
        _make_appointment(
            db_session, t2.id, c2.id, sty2.id, svc2.id,
            date(2025, 8, 1), time(10, 0), time(10, 40),
        )

        t1_appts = AppointmentService.list_appointments(db_session, t1.id)
        t2_appts = AppointmentService.list_appointments(db_session, t2.id)

        t1_customer_ids = [a.customer_id for a in t1_appts]
        t2_customer_ids = [a.customer_id for a in t2_appts]

        assert c1.id in t1_customer_ids
        assert c2.id not in t1_customer_ids
        assert c2.id in t2_customer_ids
        assert c1.id not in t2_customer_ids
