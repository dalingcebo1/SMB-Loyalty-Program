"""Service-layer unit tests for padel and flowershop verticals.

Supplements the integration tests by directly testing service methods
that are not exercised through the endpoint tests, targeting ≥80% coverage.
"""
import uuid
from datetime import date, datetime, time, timedelta
from unittest.mock import patch, MagicMock

import pytest
from fastapi import HTTPException
from sqlalchemy.orm import Session

from config import settings
from app.models import (
    PadelCourt,
    CourtPricing,
    PadelEquipment,
    CourtBooking,
    BookingEquipment,
    FlowerCategory,
    FlowerProduct,
    FlowerOrder,
    FlowerOrderItem,
    DeliverySlot,
    User,
    LoyaltyTransaction,
    PointBalance,
)

from app.verticals.padel.services import BookingService, CourtService, PricingService
from app.verticals.padel.schemas import EquipmentRental
from app.verticals.flowershop.services import (
    OrderService,
    PaymentService,
    DeliverySlotService,
    _build_order_response,
)


TENANT_ID = settings.default_tenant


# ═══════════════════════════════════════════════════════════════════════════
# PADEL SERVICE TESTS
# ═══════════════════════════════════════════════════════════════════════════


class TestBookingServiceCalculatePrice:
    """Tests for BookingService.calculate_court_price."""

    def test_uses_base_price_when_no_rules(self, db_session: Session):
        """Without pricing rules, base_price_cents is used."""
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"PRICE-{uuid.uuid4().hex[:4]}",
            base_price_cents=20000,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.commit()
        db_session.refresh(court)

        dt = datetime(2026, 3, 25, 10, 0)  # Wednesday
        price = BookingService.calculate_court_price(court, dt, 60, db_session, TENANT_ID)
        assert price == 20000  # 1 hour at base rate

    def test_uses_pricing_rule_when_matched(self, db_session: Session):
        """Pricing rule overrides base price for matching day/time."""
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"PRUL-{uuid.uuid4().hex[:4]}",
            base_price_cents=20000,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.flush()

        rule = CourtPricing(
            court_id=court.id,
            day_of_week=2,  # Wednesday
            start_time=time(8, 0),
            end_time=time(12, 0),
            price_per_hour_cents=30000,
            label="Morning Peak",
            priority=1,
            active=True,
        )
        db_session.add(rule)
        db_session.commit()
        db_session.refresh(court)

        dt = datetime(2026, 3, 25, 10, 0)  # Wednesday 10 AM
        price = BookingService.calculate_court_price(court, dt, 90, db_session, TENANT_ID)
        assert price == 45000  # 1.5 hours at 30000/hr

    def test_proportional_pricing(self, db_session: Session):
        """Price is calculated proportionally for partial hours."""
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"PROP-{uuid.uuid4().hex[:4]}",
            base_price_cents=12000,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.commit()
        db_session.refresh(court)

        dt = datetime(2026, 3, 25, 10, 0)
        price_60 = BookingService.calculate_court_price(court, dt, 60, db_session, TENANT_ID)
        price_120 = BookingService.calculate_court_price(court, dt, 120, db_session, TENANT_ID)
        assert price_60 == 12000
        assert price_120 == 24000


class TestBookingServiceAvailability:
    """Tests for availability checking methods."""

    def _make_court_and_booking(self, db_session, booking_date, start_time_val, duration):
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"AV-{uuid.uuid4().hex[:4]}",
            base_price_cents=10000,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.flush()

        start_dt = datetime.combine(booking_date, start_time_val)
        end_dt = start_dt + timedelta(minutes=duration)

        booking = CourtBooking(
            tenant_id=TENANT_ID,
            court_id=court.id,
            customer_id=1,
            booking_date=booking_date,
            start_time=start_time_val,
            end_time=end_dt.time(),
            duration_minutes=duration,
            court_price_cents=10000,
            equipment_price_cents=0,
            total_price_cents=10000,
            status="confirmed",
        )
        db_session.add(booking)
        db_session.commit()
        return court, booking

    def test_available_when_no_overlap(self, db_session: Session):
        bk_date = date.today() + timedelta(days=30)
        court, _ = self._make_court_and_booking(db_session, bk_date, time(10, 0), 60)

        # 11:30 doesn't overlap with 10:00-11:00
        available = BookingService.check_court_availability(
            db_session, TENANT_ID, court.id, bk_date, time(11, 30), 60
        )
        assert available is True

    def test_unavailable_when_overlapping(self, db_session: Session):
        bk_date = date.today() + timedelta(days=31)
        court, _ = self._make_court_and_booking(db_session, bk_date, time(10, 0), 90)

        # 10:30 overlaps with 10:00-11:30
        available = BookingService.check_court_availability(
            db_session, TENANT_ID, court.id, bk_date, time(10, 30), 60
        )
        assert available is False

    def test_available_with_exclude_booking(self, db_session: Session):
        bk_date = date.today() + timedelta(days=32)
        court, booking = self._make_court_and_booking(db_session, bk_date, time(10, 0), 60)

        # Same time but excluding the existing booking
        available = BookingService.check_court_availability(
            db_session, TENANT_ID, court.id, bk_date, time(10, 0), 60,
            exclude_booking_id=booking.id
        )
        assert available is True

    def test_equipment_availability_with_capacity(self, db_session: Session):
        eq = PadelEquipment(
            tenant_id=TENANT_ID,
            name=f"AVE-{uuid.uuid4().hex[:4]}",
            equipment_type="racket",
            quantity_available=2,
            rental_price_cents=5000,
            active=True,
        )
        db_session.add(eq)
        db_session.commit()
        db_session.refresh(eq)

        bk_date = date.today() + timedelta(days=33)
        rentals = [EquipmentRental(equipment_id=eq.id, quantity=1)]

        # Should be available (no competing bookings)
        available = BookingService.check_equipment_availability(
            db_session, TENANT_ID, rentals, bk_date, time(10, 0), 60
        )
        assert available is True

    def test_equipment_unavailable_when_nonexistent(self, db_session: Session):
        bk_date = date.today() + timedelta(days=34)
        rentals = [EquipmentRental(equipment_id=99999, quantity=1)]

        available = BookingService.check_equipment_availability(
            db_session, TENANT_ID, rentals, bk_date, time(10, 0), 60
        )
        assert available is False


class TestBookingServiceLoyalty:
    """Tests for loyalty point awarding."""

    def test_awards_points_for_completed_booking(self, db_session: Session):
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"LY-{uuid.uuid4().hex[:4]}",
            base_price_cents=10000,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.flush()

        user = db_session.query(User).first()
        bk_date = date.today() + timedelta(days=35)

        booking = CourtBooking(
            tenant_id=TENANT_ID,
            court_id=court.id,
            customer_id=user.id,
            booking_date=bk_date,
            start_time=time(10, 0),
            end_time=time(11, 0),
            duration_minutes=60,
            court_price_cents=15000,
            equipment_price_cents=0,
            total_price_cents=15000,  # R150 → 15 points
            status="completed",
        )
        db_session.add(booking)
        db_session.commit()
        db_session.refresh(booking)

        BookingService.award_loyalty_points(booking, db_session, TENANT_ID)

        txn = db_session.query(LoyaltyTransaction).filter_by(
            reference_type="court_booking",
            reference_id=str(booking.id),
        ).first()
        assert txn is not None
        assert txn.points == 15  # 15000 cents // 1000

    def test_no_points_for_zero_total(self, db_session: Session):
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"LY0-{uuid.uuid4().hex[:4]}",
            base_price_cents=0,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.flush()

        user = db_session.query(User).first()
        bk_date = date.today() + timedelta(days=36)

        booking = CourtBooking(
            tenant_id=TENANT_ID,
            court_id=court.id,
            customer_id=user.id,
            booking_date=bk_date,
            start_time=time(10, 0),
            end_time=time(11, 0),
            duration_minutes=60,
            court_price_cents=0,
            equipment_price_cents=0,
            total_price_cents=500,  # R5 → 0 points
            status="completed",
        )
        db_session.add(booking)
        db_session.commit()

        initial_count = db_session.query(LoyaltyTransaction).count()
        BookingService.award_loyalty_points(booking, db_session, TENANT_ID)
        assert db_session.query(LoyaltyTransaction).count() == initial_count


class TestBookingServiceFindSlots:
    """Tests for find_available_slots."""

    def test_returns_available_slots(self, db_session: Session):
        court = PadelCourt(
            tenant_id=TENANT_ID,
            court_number=f"SL-{uuid.uuid4().hex[:4]}",
            base_price_cents=10000,
            active=True,
            maintenance_mode=False,
        )
        db_session.add(court)
        db_session.commit()

        query_date = date.today() + timedelta(days=40)
        slots = BookingService.find_available_slots(db_session, TENANT_ID, query_date, 60)
        assert isinstance(slots, list)
        assert len(slots) > 0
        slot = slots[0]
        assert "court_id" in slot
        assert "start_time" in slot
        assert "price_cents" in slot


# ═══════════════════════════════════════════════════════════════════════════
# FLOWERSHOP SERVICE TESTS
# ═══════════════════════════════════════════════════════════════════════════


class TestOrderServiceLoyalty:
    """Tests for flowershop loyalty awarding."""

    def test_awards_loyalty_points_on_delivery(self, db_session: Session):
        user = db_session.query(User).first()

        cat = FlowerCategory(
            tenant_id=TENANT_ID,
            name=f"LY-CAT-{uuid.uuid4().hex[:4]}",
            display_order=0,
            active=True,
            created_at=datetime.utcnow(),
        )
        db_session.add(cat)
        db_session.flush()

        order = FlowerOrder(
            tenant_id=TENANT_ID,
            customer_id=user.id,
            order_number=f"FLO-LY-{uuid.uuid4().hex[:6]}",
            delivery_type="pickup",
            delivery_date=date.today(),
            recipient_name="Test",
            subtotal_cents=25000,
            delivery_fee_cents=0,
            total_cents=25000,  # R250 → 25 points
            payment_method="cash",
            payment_status="paid",
            status="delivered",
            include_sender_name=True,
            discount_cents=0,
            loyalty_points_awarded=0,
            created_at=datetime.utcnow(),
        )
        db_session.add(order)
        db_session.commit()
        db_session.refresh(order)

        OrderService.award_loyalty_points(order, db_session, TENANT_ID)
        db_session.commit()

        txn = db_session.query(LoyaltyTransaction).filter_by(
            reference_type="flower_order",
            reference_id=str(order.id),
        ).first()
        assert txn is not None
        assert txn.points == 25
        assert order.loyalty_points_awarded == 25

    def test_no_loyalty_points_for_small_order(self, db_session: Session):
        user = db_session.query(User).first()

        order = FlowerOrder(
            tenant_id=TENANT_ID,
            customer_id=user.id,
            order_number=f"FLO-SM-{uuid.uuid4().hex[:6]}",
            delivery_type="pickup",
            delivery_date=date.today(),
            recipient_name="Test",
            subtotal_cents=500,
            delivery_fee_cents=0,
            total_cents=500,  # R5 → 0 points
            payment_method="cash",
            payment_status="paid",
            status="delivered",
            include_sender_name=True,
            discount_cents=0,
            loyalty_points_awarded=0,
            created_at=datetime.utcnow(),
        )
        db_session.add(order)
        db_session.commit()

        initial_count = db_session.query(LoyaltyTransaction).count()
        OrderService.award_loyalty_points(order, db_session, TENANT_ID)
        db_session.commit()
        assert db_session.query(LoyaltyTransaction).count() == initial_count


class TestOrderServiceGenerateNumber:
    """Tests for order number generation."""

    def test_generates_unique_order_number(self, db_session: Session):
        num = OrderService.generate_order_number(TENANT_ID, db_session)
        assert num.startswith("FLO-")
        assert len(num) > 10

    def test_sequential_numbering(self, db_session: Session):
        num1 = OrderService.generate_order_number(TENANT_ID, db_session)
        num2 = OrderService.generate_order_number(TENANT_ID, db_session)
        # Both should start with FLO-YYYYMMDD-
        assert num1[:4] == "FLO-"
        assert num2[:4] == "FLO-"


class TestPaymentServiceValidation:
    """Tests for PaymentService validation logic."""

    def _create_order(self, db_session, payment_method="card", payment_status="pending"):
        user = db_session.query(User).first()
        order = FlowerOrder(
            tenant_id=TENANT_ID,
            customer_id=user.id,
            order_number=f"FLO-PAY-{uuid.uuid4().hex[:6]}",
            delivery_type="pickup",
            delivery_date=date.today(),
            recipient_name="Test",
            subtotal_cents=10000,
            delivery_fee_cents=0,
            total_cents=10000,
            payment_method=payment_method,
            payment_status=payment_status,
            status="pending",
            include_sender_name=True,
            discount_cents=0,
            loyalty_points_awarded=0,
            created_at=datetime.utcnow(),
        )
        db_session.add(order)
        db_session.commit()
        db_session.refresh(order)
        return order

    def test_process_payment_validates_order_exists(self, db_session: Session):
        with pytest.raises(HTTPException) as exc:
            PaymentService.process_payment(db_session, TENANT_ID, 99999)
        assert exc.value.status_code == 404

    def test_process_payment_rejects_already_paid(self, db_session: Session):
        order = self._create_order(db_session, payment_status="paid")
        with pytest.raises(HTTPException) as exc:
            PaymentService.process_payment(db_session, TENANT_ID, order.id)
        assert exc.value.status_code == 400
        assert "already paid" in exc.value.detail

    def test_process_payment_rejects_non_card(self, db_session: Session):
        order = self._create_order(db_session, payment_method="cash")
        with pytest.raises(HTTPException) as exc:
            PaymentService.process_payment(db_session, TENANT_ID, order.id)
        assert exc.value.status_code == 400
        assert "card" in exc.value.detail.lower()

    def test_process_payment_returns_order_for_card(self, db_session: Session):
        order = self._create_order(db_session)
        result = PaymentService.process_payment(db_session, TENANT_ID, order.id)
        assert result.id == order.id

    @patch("app.verticals.flowershop.services.http_requests.post")
    def test_charge_yoco_success(self, mock_post, db_session: Session):
        order = self._create_order(db_session)

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.json.return_value = {
            "id": "ch_unit_test",
            "status": "successful",
        }
        mock_post.return_value = mock_resp

        result = PaymentService.charge_yoco(db_session, TENANT_ID, order, "tok_test")
        assert result.payment_status == "paid"
        assert result.message == "Payment successful"

    @patch("app.verticals.flowershop.services.http_requests.post")
    def test_charge_yoco_failure(self, mock_post, db_session: Session):
        order = self._create_order(db_session)

        mock_resp = MagicMock()
        mock_resp.status_code = 400
        mock_resp.json.return_value = {
            "id": "ch_fail",
            "status": "failed",
            "error": {"message": "Declined"},
        }
        mock_post.return_value = mock_resp

        with pytest.raises(HTTPException) as exc:
            PaymentService.charge_yoco(db_session, TENANT_ID, order, "tok_bad")
        assert exc.value.status_code == 400
        assert "Declined" in exc.value.detail

    @patch("app.verticals.flowershop.services.http_requests.post")
    def test_charge_yoco_network_error(self, mock_post, db_session: Session):
        order = self._create_order(db_session)
        mock_post.side_effect = ConnectionError("Network down")

        with pytest.raises(HTTPException) as exc:
            PaymentService.charge_yoco(db_session, TENANT_ID, order, "tok_err")
        assert exc.value.status_code == 502


class TestDeliverySlotService:
    """Tests for DeliverySlotService methods."""

    def test_create_duplicate_slot_fails(self, db_session: Session):
        slot_date = date.today() + timedelta(days=50)
        slot_name = f"10AM-{uuid.uuid4().hex[:4]}"
        slot = DeliverySlot(
            tenant_id=TENANT_ID,
            delivery_date=slot_date,
            time_slot=slot_name,
            max_deliveries=10,
            fee_cents=5000,
            current_bookings=0,
            available=True,
            created_at=datetime.utcnow(),
        )
        db_session.add(slot)
        db_session.commit()

        from app.verticals.flowershop.schemas import DeliverySlotCreate
        data = DeliverySlotCreate(
            delivery_date=slot_date,
            time_slot=slot_name,
            max_deliveries=10,
            fee_cents=5000,
        )
        with pytest.raises(HTTPException) as exc:
            DeliverySlotService.create_slot(db_session, TENANT_ID, data)
        assert exc.value.status_code == 400
        assert "already exists" in exc.value.detail

    def test_list_slots_available_only(self, db_session: Session):
        slot_date = date.today() + timedelta(days=51)

        available = DeliverySlot(
            tenant_id=TENANT_ID,
            delivery_date=slot_date,
            time_slot=f"AV-{uuid.uuid4().hex[:4]}",
            max_deliveries=10,
            fee_cents=3000,
            current_bookings=0,
            available=True,
            created_at=datetime.utcnow(),
        )
        full = DeliverySlot(
            tenant_id=TENANT_ID,
            delivery_date=slot_date,
            time_slot=f"FULL-{uuid.uuid4().hex[:4]}",
            max_deliveries=2,
            fee_cents=3000,
            current_bookings=2,
            available=True,
            created_at=datetime.utcnow(),
        )
        db_session.add_all([available, full])
        db_session.commit()

        slots = DeliverySlotService.list_slots(
            db_session, TENANT_ID, delivery_date=slot_date, available_only=True
        )
        slot_names = [s.time_slot for s in slots]
        assert available.time_slot in slot_names
        assert full.time_slot not in slot_names  # Full slot excluded
