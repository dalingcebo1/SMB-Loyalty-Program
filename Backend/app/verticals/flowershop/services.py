"""
Flowershop vertical service layer.

Encapsulates business logic previously inline in route handlers.
"""

from datetime import date, datetime
from typing import List, Optional

import requests as http_requests
from fastapi import HTTPException
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
import logging

from config import settings
from app.services.tenant_settings import get_tenant_settings
from app.models import (
    FlowerCategory,
    FlowerOccasion,
    FlowerProduct,
    FlowerOrder,
    FlowerOrderItem,
    DeliverySlot,
    Tenant,
    User,
    LoyaltyTransaction,
    PointBalance,
)
from .schemas import OrderItemResponse, OrderResponse, FlowerOrderPayResponse

logger = logging.getLogger(__name__)


# ── Helper: build order response ────────────────────────────────────────────

def _build_order_response(order: FlowerOrder) -> OrderResponse:
    """Build an OrderResponse from a FlowerOrder ORM instance."""
    return OrderResponse(
        **{
            **order.__dict__,
            'items': [OrderItemResponse(**item.__dict__) for item in order.items]
        }
    )


# ── Category Service ────────────────────────────────────────────────────────

class CategoryService:
    """Flower category CRUD operations."""

    @staticmethod
    def create_category(db: Session, tenant_id: str, data) -> FlowerCategory:
        existing = db.query(FlowerCategory).filter(
            FlowerCategory.tenant_id == tenant_id,
            FlowerCategory.name == data.name
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Category with this name already exists")

        db_category = FlowerCategory(tenant_id=tenant_id, **data.model_dump())
        db.add(db_category)
        db.commit()
        db.refresh(db_category)
        logger.info(f"Created flower category {db_category.id} for tenant {tenant_id}")
        return db_category

    @staticmethod
    def list_categories(db: Session, tenant_id: str, active_only: bool = True) -> List[FlowerCategory]:
        query = db.query(FlowerCategory).filter(FlowerCategory.tenant_id == tenant_id)
        if active_only:
            query = query.filter(FlowerCategory.active == True)
        return query.order_by(FlowerCategory.display_order, FlowerCategory.name).all()

    @staticmethod
    def get_category(db: Session, tenant_id: str, category_id: int) -> FlowerCategory:
        category = db.query(FlowerCategory).filter(
            FlowerCategory.id == category_id,
            FlowerCategory.tenant_id == tenant_id
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")
        return category

    @staticmethod
    def update_category(db: Session, tenant_id: str, category_id: int, data) -> FlowerCategory:
        category = db.query(FlowerCategory).filter(
            FlowerCategory.id == category_id,
            FlowerCategory.tenant_id == tenant_id
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(category, field, value)
        db.commit()
        db.refresh(category)
        logger.info(f"Updated category {category_id}")
        return category

    @staticmethod
    def delete_category(db: Session, tenant_id: str, category_id: int) -> None:
        category = db.query(FlowerCategory).filter(
            FlowerCategory.id == category_id,
            FlowerCategory.tenant_id == tenant_id
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        product_count = db.query(FlowerProduct).filter(
            FlowerProduct.category_id == category_id,
            FlowerProduct.tenant_id == tenant_id
        ).count()
        if product_count > 0:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot delete category with {product_count} products. Move or delete products first."
            )

        category.active = False
        db.commit()
        logger.info(f"Deleted category {category_id}")


# ── Occasion Service ────────────────────────────────────────────────────────

class OccasionService:
    """Flower occasion operations."""

    @staticmethod
    def create_occasion(db: Session, tenant_id: str, data) -> FlowerOccasion:
        db_occasion = FlowerOccasion(tenant_id=tenant_id, **data.model_dump())
        db.add(db_occasion)
        db.commit()
        db.refresh(db_occasion)
        logger.info(f"Created occasion {db_occasion.id} for tenant {tenant_id}")
        return db_occasion

    @staticmethod
    def list_occasions(db: Session, tenant_id: str, active_only: bool = True) -> List[FlowerOccasion]:
        query = db.query(FlowerOccasion).filter(FlowerOccasion.tenant_id == tenant_id)
        if active_only:
            query = query.filter(FlowerOccasion.active == True)
        return query.order_by(FlowerOccasion.name).all()


# ── Product Service ─────────────────────────────────────────────────────────

class ProductService:
    """Flower product CRUD with M2M occasion management."""

    @staticmethod
    def create_product(db: Session, tenant_id: str, data) -> FlowerProduct:
        category = db.query(FlowerCategory).filter(
            FlowerCategory.id == data.category_id,
            FlowerCategory.tenant_id == tenant_id
        ).first()
        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        product_data = data.model_dump(exclude={'occasion_ids'})
        db_product = FlowerProduct(tenant_id=tenant_id, **product_data)

        if data.occasion_ids:
            occasions = db.query(FlowerOccasion).filter(
                FlowerOccasion.id.in_(data.occasion_ids),
                FlowerOccasion.tenant_id == tenant_id
            ).all()
            db_product.occasions = occasions

        db.add(db_product)
        db.commit()
        db.refresh(db_product)
        logger.info(f"Created product {db_product.id} for tenant {tenant_id}")
        return db_product

    @staticmethod
    def list_products(
        db: Session,
        tenant_id: str,
        category_id: Optional[int] = None,
        occasion_id: Optional[int] = None,
        featured_only: bool = False,
        seasonal_only: bool = False,
        active_only: bool = True,
        search: Optional[str] = None,
    ) -> List[FlowerProduct]:
        query = db.query(FlowerProduct).filter(FlowerProduct.tenant_id == tenant_id)

        if category_id:
            query = query.filter(FlowerProduct.category_id == category_id)
        if occasion_id:
            query = query.join(FlowerProduct.occasions).filter(FlowerOccasion.id == occasion_id)
        if featured_only:
            query = query.filter(FlowerProduct.featured == True)
        if seasonal_only:
            query = query.filter(FlowerProduct.seasonal == True)
        if active_only:
            query = query.filter(FlowerProduct.active == True)
        if search:
            search_pattern = f"%{search}%"
            query = query.filter(
                or_(
                    FlowerProduct.name.ilike(search_pattern),
                    FlowerProduct.description.ilike(search_pattern)
                )
            )

        return query.order_by(FlowerProduct.display_order, FlowerProduct.name).all()

    @staticmethod
    def get_product(db: Session, tenant_id: str, product_id: int) -> FlowerProduct:
        product = db.query(FlowerProduct).filter(
            FlowerProduct.id == product_id,
            FlowerProduct.tenant_id == tenant_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        return product

    @staticmethod
    def update_product(db: Session, tenant_id: str, product_id: int, data) -> FlowerProduct:
        product = db.query(FlowerProduct).filter(
            FlowerProduct.id == product_id,
            FlowerProduct.tenant_id == tenant_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        if data.occasion_ids is not None:
            occasions = db.query(FlowerOccasion).filter(
                FlowerOccasion.id.in_(data.occasion_ids),
                FlowerOccasion.tenant_id == tenant_id
            ).all()
            product.occasions = occasions

        update_data = data.model_dump(exclude_unset=True, exclude={'occasion_ids'})
        for field, value in update_data.items():
            setattr(product, field, value)

        db.commit()
        db.refresh(product)
        logger.info(f"Updated product {product_id}")
        return product

    @staticmethod
    def delete_product(db: Session, tenant_id: str, product_id: int) -> None:
        product = db.query(FlowerProduct).filter(
            FlowerProduct.id == product_id,
            FlowerProduct.tenant_id == tenant_id
        ).first()
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")
        product.active = False
        db.commit()
        logger.info(f"Deleted product {product_id}")


# ── Order Service ───────────────────────────────────────────────────────────

class OrderService:
    """Order processing with inventory management and loyalty integration."""

    @staticmethod
    def generate_order_number(tenant_id: str, db: Session) -> str:
        today = date.today()
        count = db.query(func.count(FlowerOrder.id)).filter(
            FlowerOrder.tenant_id == tenant_id,
            func.date(FlowerOrder.order_date) == today
        ).scalar()
        return f"FLO-{today.strftime('%Y%m%d')}-{count + 1:04d}"

    @staticmethod
    def award_loyalty_points(order: FlowerOrder, db: Session, tenant_id: str) -> None:
        """Award loyalty points (1 point per R10 spent)."""
        points_to_award = order.total_cents // 1000
        if points_to_award <= 0:
            return

        transaction = LoyaltyTransaction(
            tenant_id=tenant_id,
            user_id=order.customer_id,
            points=points_to_award,
            type="EARN",
            reference_type="flower_order",
            reference_id=str(order.id),
            description=f"Flower order {order.order_number}"
        )
        db.add(transaction)

        balance = db.query(PointBalance).filter(
            PointBalance.tenant_id == tenant_id,
            PointBalance.user_id == order.customer_id
        ).first()

        if balance:
            balance.points += points_to_award
            balance.lifetime_points += points_to_award
            balance.updated_at = func.now()
        else:
            balance = PointBalance(
                tenant_id=tenant_id,
                user_id=order.customer_id,
                points=points_to_award,
                lifetime_points=points_to_award,
            )
            db.add(balance)

        order.loyalty_points_awarded = points_to_award
        order.loyalty_points_awarded_at = func.now()
        logger.info(f"Awarded {points_to_award} loyalty points for order {order.id}")

    @staticmethod
    def create_order(db: Session, tenant_id: str, data) -> FlowerOrder:
        """Create a new flower order with inventory checks."""
        customer = db.query(User).filter(User.id == data.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        if data.delivery_type == "delivery":
            if not all([data.delivery_address_line1, data.delivery_city, data.delivery_postal_code]):
                raise HTTPException(
                    status_code=400,
                    detail="Delivery address is required for delivery orders"
                )

        if data.delivery_date < date.today():
            raise HTTPException(status_code=400, detail="Delivery date cannot be in the past")

        subtotal_cents = 0
        order_items = []

        for item in data.items:
            product = db.query(FlowerProduct).filter(
                FlowerProduct.id == item.product_id,
                FlowerProduct.tenant_id == tenant_id,
                FlowerProduct.active == True
            ).first()
            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            if product.track_inventory:
                if product.stock_quantity < item.quantity:
                    raise HTTPException(
                        status_code=400,
                        detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}"
                    )

            unit_price = product.sale_price_cents if product.sale_price_cents else product.price_cents
            item_subtotal = unit_price * item.quantity

            order_items.append({
                'product_id': product.id,
                'product_name': product.name,
                'product_description': product.description,
                'quantity': item.quantity,
                'unit_price_cents': unit_price,
                'subtotal_cents': item_subtotal
            })
            subtotal_cents += item_subtotal

        delivery_fee_cents = 0
        if data.delivery_type == "delivery":
            if data.delivery_time_slot:
                slot = db.query(DeliverySlot).filter(
                    DeliverySlot.tenant_id == tenant_id,
                    DeliverySlot.delivery_date == data.delivery_date,
                    DeliverySlot.time_slot == data.delivery_time_slot
                ).first()
                if slot:
                    if not slot.available or slot.current_bookings >= slot.max_deliveries:
                        raise HTTPException(status_code=400, detail="Selected delivery slot is full")
                    delivery_fee_cents = slot.fee_cents
                    slot.current_bookings += 1
                else:
                    delivery_fee_cents = 5000
            else:
                delivery_fee_cents = 5000

        total_cents = subtotal_cents + delivery_fee_cents
        order_number = OrderService.generate_order_number(tenant_id, db)

        db_order = FlowerOrder(
            tenant_id=tenant_id,
            customer_id=data.customer_id,
            order_number=order_number,
            delivery_type=data.delivery_type,
            delivery_date=data.delivery_date,
            delivery_time_slot=data.delivery_time_slot,
            recipient_name=data.recipient_name,
            recipient_phone=data.recipient_phone,
            delivery_address_line1=data.delivery_address_line1,
            delivery_address_line2=data.delivery_address_line2,
            delivery_city=data.delivery_city,
            delivery_postal_code=data.delivery_postal_code,
            delivery_instructions=data.delivery_instructions,
            gift_message=data.gift_message,
            include_sender_name=data.include_sender_name,
            subtotal_cents=subtotal_cents,
            delivery_fee_cents=delivery_fee_cents,
            total_cents=total_cents,
            payment_method=data.payment_method,
            payment_status='pending',
            status='pending'
        )
        db.add(db_order)
        db.flush()

        for item_data in order_items:
            db_item = FlowerOrderItem(order_id=db_order.id, **item_data)
            db.add(db_item)

            product = db.query(FlowerProduct).filter(FlowerProduct.id == item_data['product_id']).first()
            if product and product.track_inventory:
                product.stock_quantity -= item_data['quantity']

        db.commit()
        db.refresh(db_order)
        logger.info(f"Created order {db_order.order_number} for tenant {tenant_id}")
        return db_order, order_items

    @staticmethod
    def list_orders(
        db: Session,
        tenant_id: str,
        from_date: Optional[date] = None,
        to_date: Optional[date] = None,
        status: Optional[str] = None,
        customer_id: Optional[int] = None,
    ) -> List[FlowerOrder]:
        query = db.query(FlowerOrder).filter(FlowerOrder.tenant_id == tenant_id)
        if from_date:
            query = query.filter(FlowerOrder.delivery_date >= from_date)
        if to_date:
            query = query.filter(FlowerOrder.delivery_date <= to_date)
        if status:
            query = query.filter(FlowerOrder.status == status)
        if customer_id:
            query = query.filter(FlowerOrder.customer_id == customer_id)
        return query.order_by(FlowerOrder.order_date.desc()).all()

    @staticmethod
    def get_order(db: Session, tenant_id: str, order_id: int) -> FlowerOrder:
        order = db.query(FlowerOrder).filter(
            FlowerOrder.id == order_id,
            FlowerOrder.tenant_id == tenant_id
        ).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        return order

    @staticmethod
    def update_order(db: Session, tenant_id: str, order_id: int, data) -> FlowerOrder:
        order = db.query(FlowerOrder).filter(
            FlowerOrder.id == order_id,
            FlowerOrder.tenant_id == tenant_id
        ).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")

        old_status = order.status
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(order, field, value)

        if 'status' in update_data:
            if order.status == 'confirmed' and old_status != 'confirmed':
                order.confirmed_at = func.now()
            elif order.status == 'delivered' and old_status != 'delivered':
                order.delivered_at = func.now()
            elif order.status == 'cancelled' and old_status != 'cancelled':
                order.cancelled_at = func.now()

        db.commit()
        db.refresh(order)

        if old_status != 'delivered' and order.status == 'delivered':
            if order.loyalty_points_awarded == 0:
                OrderService.award_loyalty_points(order, db, tenant_id)
                db.commit()

        logger.info(f"Updated order {order_id}")
        return order, old_status


# ── Delivery Slot Service ───────────────────────────────────────────────────

class DeliverySlotService:
    """Delivery slot management."""

    @staticmethod
    def create_slot(db: Session, tenant_id: str, data) -> DeliverySlot:
        existing = db.query(DeliverySlot).filter(
            DeliverySlot.tenant_id == tenant_id,
            DeliverySlot.delivery_date == data.delivery_date,
            DeliverySlot.time_slot == data.time_slot
        ).first()
        if existing:
            raise HTTPException(status_code=400, detail="Delivery slot already exists")

        db_slot = DeliverySlot(tenant_id=tenant_id, **data.model_dump())
        db.add(db_slot)
        db.commit()
        db.refresh(db_slot)
        logger.info(f"Created delivery slot for {data.delivery_date} {data.time_slot}")
        return db_slot

    @staticmethod
    def list_slots(
        db: Session,
        tenant_id: str,
        delivery_date: Optional[date] = None,
        available_only: bool = True,
    ) -> List[DeliverySlot]:
        query = db.query(DeliverySlot).filter(DeliverySlot.tenant_id == tenant_id)
        if delivery_date:
            query = query.filter(DeliverySlot.delivery_date == delivery_date)
        if available_only:
            query = query.filter(
                DeliverySlot.available == True,
                DeliverySlot.current_bookings < DeliverySlot.max_deliveries
            )
        return query.order_by(DeliverySlot.delivery_date, DeliverySlot.time_slot).all()


# ── Payment Service ─────────────────────────────────────────────────────────

class PaymentService:
    """Yoco/Stripe payment processing."""

    @staticmethod
    def _get_yoco_secret_for_tenant(tenant_id: str, db: Session) -> str:
        tenant = db.query(Tenant).filter_by(id=tenant_id).first()
        if tenant:
            ts = get_tenant_settings(tenant)
            if ts and ts.payment and ts.payment.secret_key:
                return ts.payment.secret_key
        return settings.yoco_secret_key

    @staticmethod
    def process_payment(
        db: Session,
        tenant_id: str,
        order_id: int,
    ) -> FlowerOrder:
        """Retrieve order for payment processing (validation only)."""
        order = db.query(FlowerOrder).filter(
            FlowerOrder.id == order_id,
            FlowerOrder.tenant_id == tenant_id,
        ).first()
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        if order.payment_status == "paid":
            raise HTTPException(status_code=400, detail="Order already paid")
        if order.payment_method != "card":
            raise HTTPException(
                status_code=400,
                detail="Yoco payment is only available for card orders",
            )
        return order

    @staticmethod
    def charge_yoco(
        db: Session,
        tenant_id: str,
        order: FlowerOrder,
        token: str,
    ) -> FlowerOrderPayResponse:
        """Execute Yoco charge and update order status."""
        secret_key = PaymentService._get_yoco_secret_for_tenant(tenant_id, db)
        if not secret_key:
            raise HTTPException(
                status_code=500,
                detail="Payment provider credentials not configured",
            )

        headers = {
            "X-Auth-Secret-Key": secret_key,
            "Content-Type": "application/json",
        }
        yoco_payload = {
            "token": token,
            "amountInCents": order.total_cents,
            "currency": "ZAR",
        }

        try:
            resp = http_requests.post(
                "https://online.yoco.com/v1/charges/",
                json=yoco_payload,
                headers=headers,
                timeout=15,
            )
        except Exception as e:
            logger.error(f"Could not reach Yoco for order {order.id}: {e}")
            raise HTTPException(status_code=502, detail=f"Could not reach Yoco: {e}")

        yoco_data = resp.json()
        charge_id = yoco_data.get("chargeId") or yoco_data.get("id")
        charge_status = yoco_data.get("status")

        if resp.status_code not in (200, 201) or charge_status != "successful":
            order.payment_status = "failed"
            order.payment_reference = charge_id
            db.commit()
            detail = yoco_data.get("error", {}).get("message", "Yoco payment failed")
            logger.warning(f"Yoco payment failed for order {order.id}: {detail}")
            raise HTTPException(status_code=400, detail=detail)

        order.payment_status = "paid"
        order.payment_reference = charge_id
        order.status = "confirmed"
        order.confirmed_at = func.now()

        if order.loyalty_points_awarded == 0:
            OrderService.award_loyalty_points(order, db, tenant_id)

        db.commit()
        db.refresh(order)

        logger.info(
            f"Yoco payment successful for order {order.order_number} "
            f"(charge {charge_id})"
        )

        return FlowerOrderPayResponse(
            order_id=order.id,
            order_number=order.order_number,
            payment_status=order.payment_status,
            total_cents=order.total_cents,
            message="Payment successful",
        )
