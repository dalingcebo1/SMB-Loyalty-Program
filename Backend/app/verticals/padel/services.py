"""
Padel vertical service layer.

Encapsulates business logic previously inline in route handlers.
"""

from datetime import date, datetime, time, timedelta
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
import logging

from app.models import (
    PadelCourt, CourtPricing, PadelEquipment,
    CourtBooking, BookingEquipment,
    User, LoyaltyTransaction,
)
from .schemas import EquipmentRental, BookingResponse, BookingCreate

logger = logging.getLogger(__name__)


# ── Helper: build booking response ──────────────────────────────────────────

def _build_booking_response(booking: CourtBooking) -> BookingResponse:
    """Build a BookingResponse from a CourtBooking ORM instance."""
    return BookingResponse(
        **{
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
    )


# ── Court Service ───────────────────────────────────────────────────────────

class CourtService:
    """Court CRUD operations."""

    @staticmethod
    def create_court(db: Session, tenant_id: str, data) -> PadelCourt:
        existing = db.query(PadelCourt).filter(
            PadelCourt.tenant_id == tenant_id,
            PadelCourt.court_number == data.court_number,
            PadelCourt.active == True
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Court {data.court_number} already exists")

        db_court = PadelCourt(tenant_id=tenant_id, **data.model_dump())
        db.add(db_court)
        db.commit()
        db.refresh(db_court)
        logger.info(f"Created padel court {db_court.court_number} for tenant {tenant_id}")
        return db_court

    @staticmethod
    def list_courts(db: Session, tenant_id: str, active_only: bool = True) -> List[PadelCourt]:
        query = db.query(PadelCourt).filter(PadelCourt.tenant_id == tenant_id)
        if active_only:
            query = query.filter(PadelCourt.active == True)
        return query.order_by(PadelCourt.court_number).all()

    @staticmethod
    def get_court(db: Session, tenant_id: str, court_id: int) -> PadelCourt:
        court = db.query(PadelCourt).filter(
            PadelCourt.id == court_id,
            PadelCourt.tenant_id == tenant_id
        ).first()
        if not court:
            raise HTTPException(status_code=404, detail="Court not found")
        return court

    @staticmethod
    def update_court(db: Session, tenant_id: str, court_id: int, data) -> PadelCourt:
        court = db.query(PadelCourt).filter(
            PadelCourt.id == court_id,
            PadelCourt.tenant_id == tenant_id
        ).first()
        if not court:
            raise HTTPException(status_code=404, detail="Court not found")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(court, field, value)
        db.commit()
        db.refresh(court)
        logger.info(f"Updated padel court {court.court_number} for tenant {tenant_id}")
        return court

    @staticmethod
    def delete_court(db: Session, tenant_id: str, court_id: int) -> None:
        court = db.query(PadelCourt).filter(
            PadelCourt.id == court_id,
            PadelCourt.tenant_id == tenant_id
        ).first()
        if not court:
            raise HTTPException(status_code=404, detail="Court not found")
        court.active = False
        db.commit()
        logger.info(f"Deleted padel court {court.court_number} for tenant {tenant_id}")


# ── Pricing Service ─────────────────────────────────────────────────────────

class PricingService:
    """Court pricing rule operations."""

    @staticmethod
    def create_rule(db: Session, tenant_id: str, court_id: int, data) -> CourtPricing:
        court = db.query(PadelCourt).filter(
            PadelCourt.id == court_id,
            PadelCourt.tenant_id == tenant_id
        ).first()
        if not court:
            raise HTTPException(status_code=404, detail="Court not found")

        db_pricing = CourtPricing(tenant_id=tenant_id, court_id=court_id, **data.model_dump())
        db.add(db_pricing)
        db.commit()
        db.refresh(db_pricing)
        logger.info(f"Created pricing rule '{db_pricing.label}' for court {court_id}")
        return db_pricing

    @staticmethod
    def list_rules(db: Session, tenant_id: str, court_id: int) -> List[CourtPricing]:
        court = db.query(PadelCourt).filter(
            PadelCourt.id == court_id,
            PadelCourt.tenant_id == tenant_id
        ).first()
        if not court:
            raise HTTPException(status_code=404, detail="Court not found")

        return db.query(CourtPricing).filter(
            CourtPricing.court_id == court_id,
            CourtPricing.tenant_id == tenant_id,
            CourtPricing.active == True
        ).order_by(CourtPricing.priority.desc(), CourtPricing.start_time).all()

    @staticmethod
    def delete_rule(db: Session, tenant_id: str, court_id: int, pricing_id: int) -> None:
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


# ── Equipment Service ───────────────────────────────────────────────────────

class EquipmentService:
    """Equipment CRUD operations."""

    @staticmethod
    def create_equipment(db: Session, tenant_id: str, data) -> PadelEquipment:
        db_equipment = PadelEquipment(tenant_id=tenant_id, **data.model_dump())
        db.add(db_equipment)
        db.commit()
        db.refresh(db_equipment)
        logger.info(f"Created equipment '{db_equipment.name}' for tenant {tenant_id}")
        return db_equipment

    @staticmethod
    def list_equipment(
        db: Session, tenant_id: str, active_only: bool = True, equipment_type: Optional[str] = None
    ) -> List[PadelEquipment]:
        query = db.query(PadelEquipment).filter(PadelEquipment.tenant_id == tenant_id)
        if active_only:
            query = query.filter(PadelEquipment.active == True)
        if equipment_type:
            query = query.filter(PadelEquipment.equipment_type == equipment_type)
        return query.order_by(PadelEquipment.equipment_type, PadelEquipment.name).all()

    @staticmethod
    def get_equipment(db: Session, tenant_id: str, equipment_id: int) -> PadelEquipment:
        equipment = db.query(PadelEquipment).filter(
            PadelEquipment.id == equipment_id,
            PadelEquipment.tenant_id == tenant_id
        ).first()
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")
        return equipment

    @staticmethod
    def update_equipment(db: Session, tenant_id: str, equipment_id: int, data) -> PadelEquipment:
        equipment = db.query(PadelEquipment).filter(
            PadelEquipment.id == equipment_id,
            PadelEquipment.tenant_id == tenant_id
        ).first()
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(equipment, field, value)
        db.commit()
        db.refresh(equipment)
        logger.info(f"Updated equipment '{equipment.name}' for tenant {tenant_id}")
        return equipment

    @staticmethod
    def delete_equipment(db: Session, tenant_id: str, equipment_id: int) -> None:
        equipment = db.query(PadelEquipment).filter(
            PadelEquipment.id == equipment_id,
            PadelEquipment.tenant_id == tenant_id
        ).first()
        if not equipment:
            raise HTTPException(status_code=404, detail="Equipment not found")
        equipment.active = False
        db.commit()
        logger.info(f"Deleted equipment '{equipment.name}' for tenant {tenant_id}")


# ── Booking Service ─────────────────────────────────────────────────────────

class BookingService:
    """Booking business logic including availability checks and pricing."""

    @staticmethod
    def calculate_court_price(
        court: PadelCourt,
        booking_datetime: datetime,
        duration_minutes: int,
        db: Session,
        tenant_id: str,
    ) -> int:
        """Calculate court price based on pricing rules and duration."""
        day_of_week = booking_datetime.weekday()
        booking_time = booking_datetime.time()

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

        price_per_hour = pricing_rule.price_per_hour_cents if pricing_rule else court.base_price_cents
        hours = duration_minutes / 60.0
        return int(price_per_hour * hours)

    @staticmethod
    def check_court_availability(
        db: Session,
        tenant_id: str,
        court_id: int,
        booking_date: date,
        start_time: time,
        duration_minutes: int,
        exclude_booking_id: Optional[int] = None,
    ) -> bool:
        """Check if court is available for the requested time slot."""
        start_datetime = datetime.combine(booking_date, start_time)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        end_time_value = end_datetime.time()

        query = db.query(CourtBooking).filter(
            CourtBooking.court_id == court_id,
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
            query = query.filter(CourtBooking.id != exclude_booking_id)

        return query.first() is None

    @staticmethod
    def check_equipment_availability(
        db: Session,
        tenant_id: str,
        equipment_rentals: List[EquipmentRental],
        booking_date: date,
        start_time: time,
        duration_minutes: int,
        exclude_booking_id: Optional[int] = None,
    ) -> bool:
        """Check if requested equipment is available for the time slot."""
        start_datetime = datetime.combine(booking_date, start_time)
        end_datetime = start_datetime + timedelta(minutes=duration_minutes)
        end_time_value = end_datetime.time()

        for rental in equipment_rentals:
            equipment = db.query(PadelEquipment).filter(
                PadelEquipment.id == rental.equipment_id,
                PadelEquipment.tenant_id == tenant_id,
                PadelEquipment.active == True
            ).first()
            if not equipment:
                return False

            overlapping_query = db.query(CourtBooking).filter(
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
                overlapping_query = overlapping_query.filter(CourtBooking.id != exclude_booking_id)

            overlapping_bookings = overlapping_query.all()

            used_quantity = 0
            for booking in overlapping_bookings:
                booking_rental = db.query(BookingEquipment).filter(
                    BookingEquipment.booking_id == booking.id,
                    BookingEquipment.equipment_id == rental.equipment_id
                ).first()
                if booking_rental:
                    used_quantity += booking_rental.quantity

            available = equipment.quantity_available - used_quantity
            if available < rental.quantity:
                return False

        return True

    @staticmethod
    def award_loyalty_points(booking: CourtBooking, db: Session, tenant_id: str) -> None:
        """Award loyalty points when booking is completed (1 point per R10)."""
        points_to_award = booking.total_price_cents // 1000
        if points_to_award <= 0:
            return

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

    @staticmethod
    def create_booking(
        db: Session,
        tenant_id: str,
        data: BookingCreate,
    ) -> tuple:
        """Create a new court booking with availability + equipment checks."""
        court = db.query(PadelCourt).filter(
            PadelCourt.id == data.court_id,
            PadelCourt.tenant_id == tenant_id,
            PadelCourt.active == True
        ).first()
        if not court:
            raise HTTPException(status_code=404, detail="Court not found")
        if court.maintenance_mode:
            raise HTTPException(status_code=400, detail="Court is under maintenance")

        if not BookingService.check_court_availability(
            db, tenant_id, data.court_id, data.booking_date,
            data.start_time, data.duration_minutes
        ):
            raise HTTPException(status_code=409, detail="Court is not available for the requested time slot")

        if data.equipment_rentals:
            if not BookingService.check_equipment_availability(
                db, tenant_id, data.equipment_rentals,
                data.booking_date, data.start_time, data.duration_minutes
            ):
                raise HTTPException(status_code=409, detail="Requested equipment is not available")

        booking_datetime = datetime.combine(data.booking_date, data.start_time)
        court_price = BookingService.calculate_court_price(
            court, booking_datetime, data.duration_minutes, db, tenant_id
        )

        equipment_price = 0
        for rental in data.equipment_rentals:
            eq = db.query(PadelEquipment).filter(
                PadelEquipment.id == rental.equipment_id,
                PadelEquipment.tenant_id == tenant_id
            ).first()
            equipment_price += eq.rental_price_cents * rental.quantity

        total_price = court_price + equipment_price
        end_datetime = booking_datetime + timedelta(minutes=data.duration_minutes)

        db_booking = CourtBooking(
            tenant_id=tenant_id,
            court_id=data.court_id,
            customer_id=data.customer_id,
            booking_date=data.booking_date,
            start_time=data.start_time,
            end_time=end_datetime.time(),
            duration_minutes=data.duration_minutes,
            court_price_cents=court_price,
            equipment_price_cents=equipment_price,
            total_price_cents=total_price,
            player_count=data.player_count,
            player_names=data.player_names,
            customer_notes=data.customer_notes,
            status="pending"
        )
        db.add(db_booking)
        db.flush()

        for rental in data.equipment_rentals:
            eq = db.query(PadelEquipment).filter(
                PadelEquipment.id == rental.equipment_id
            ).first()
            db_rental = BookingEquipment(
                booking_id=db_booking.id,
                equipment_id=rental.equipment_id,
                quantity=rental.quantity,
                price_cents=eq.rental_price_cents * rental.quantity
            )
            db.add(db_rental)

        db.commit()
        db.refresh(db_booking)
        logger.info(f"Created booking {db_booking.id} for court {court.court_number}")
        return db_booking, court

    @staticmethod
    def list_bookings(
        db: Session,
        tenant_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        court_id: Optional[int] = None,
        status: Optional[str] = None,
    ) -> List[CourtBooking]:
        query = db.query(CourtBooking).filter(CourtBooking.tenant_id == tenant_id)
        if from_date:
            query = query.filter(CourtBooking.booking_date >= from_date)
        if to_date:
            query = query.filter(CourtBooking.booking_date <= to_date)
        if court_id:
            query = query.filter(CourtBooking.court_id == court_id)
        if status:
            query = query.filter(CourtBooking.status == status)
        return query.order_by(
            CourtBooking.booking_date.desc(),
            CourtBooking.start_time.desc()
        ).all()

    @staticmethod
    def get_booking(db: Session, tenant_id: str, booking_id: int) -> CourtBooking:
        booking = db.query(CourtBooking).filter(
            CourtBooking.id == booking_id,
            CourtBooking.tenant_id == tenant_id
        ).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        return booking

    @staticmethod
    def update_booking(
        db: Session,
        tenant_id: str,
        booking_id: int,
        data,
    ) -> CourtBooking:
        booking = db.query(CourtBooking).filter(
            CourtBooking.id == booking_id,
            CourtBooking.tenant_id == tenant_id
        ).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")

        old_status = booking.status
        update_data = data.model_dump(exclude_unset=True)

        if 'start_time' in update_data or 'duration_minutes' in update_data:
            new_start = update_data.get('start_time', booking.start_time)
            new_duration = update_data.get('duration_minutes', booking.duration_minutes)

            if not BookingService.check_court_availability(
                db, tenant_id, booking.court_id, booking.booking_date,
                new_start, new_duration, exclude_booking_id=booking_id
            ):
                raise HTTPException(status_code=409, detail="Court is not available for the requested time slot")

            booking_datetime = datetime.combine(booking.booking_date, new_start)
            end_datetime = booking_datetime + timedelta(minutes=new_duration)
            update_data['end_time'] = end_datetime.time()

        for field, value in update_data.items():
            setattr(booking, field, value)

        db.commit()
        db.refresh(booking)

        if old_status != 'completed' and booking.status == 'completed':
            BookingService.award_loyalty_points(booking, db, tenant_id)

        logger.info(f"Updated booking {booking_id}")
        return booking

    @staticmethod
    def cancel_booking(db: Session, tenant_id: str, booking_id: int) -> None:
        booking = db.query(CourtBooking).filter(
            CourtBooking.id == booking_id,
            CourtBooking.tenant_id == tenant_id
        ).first()
        if not booking:
            raise HTTPException(status_code=404, detail="Booking not found")
        booking.status = 'cancelled'
        db.commit()
        logger.info(f"Cancelled booking {booking_id}")

    @staticmethod
    def find_available_slots(
        db: Session,
        tenant_id: str,
        query_date: date,
        duration_minutes: int,
    ) -> List[dict]:
        courts = db.query(PadelCourt).filter(
            PadelCourt.tenant_id == tenant_id,
            PadelCourt.active == True,
            PadelCourt.maintenance_mode == False
        ).all()

        time_slots = []
        for hour in range(6, 23):
            for minute in [0, 30]:
                time_slots.append(time(hour, minute))

        available_slots = []
        for court in courts:
            for slot_time in time_slots:
                if BookingService.check_court_availability(
                    db, tenant_id, court.id, query_date, slot_time, duration_minutes
                ):
                    booking_datetime = datetime.combine(query_date, slot_time)
                    price = BookingService.calculate_court_price(
                        court, booking_datetime, duration_minutes, db, tenant_id
                    )
                    available_slots.append({
                        'court_id': court.id,
                        'court_number': court.court_number,
                        'start_time': slot_time.strftime('%H:%M'),
                        'duration_minutes': duration_minutes,
                        'price_cents': price
                    })

        return available_slots
