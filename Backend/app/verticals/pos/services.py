"""
POS vertical service layer.

Encapsulates the transaction workflow business logic previously inline in
``app/routes/pos.py``.  Each public method is a single logical operation;
private helpers handle receipt numbering, totals calculation, inventory
decrements, and loyalty point awards.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import and_, desc, func
from sqlalchemy.orm import Session, joinedload

from app.models import (
    InventoryLevel,
    LoyaltyProgram,
    LoyaltyTransaction,
    PointBalance,
    Product,
    Sale,
    SaleItem,
    SalePayment,
    StockMovement,
    User,
)

from .schemas import (
    PaymentCreate,
    SaleCreate,
    SaleItemCreate,
    SaleStats,
)


class TransactionService:
    """Immutable transaction workflow — no update/delete on completed sales."""

    # ── Public API ──────────────────────────────────────────────────────

    @staticmethod
    def create_sale(
        db: Session,
        tenant_id: str,
        staff_id: int,
        data: SaleCreate,
    ) -> Sale:
        receipt_number = TransactionService._generate_receipt_number(
            db, tenant_id, data.location,
        )

        sale = Sale(
            tenant_id=tenant_id,
            user_id=staff_id,
            customer_id=data.customer_id,
            receipt_number=receipt_number,
            location=data.location,
            tax_rate=data.tax_rate,
            notes=data.notes,
            subtotal_cents=0,
            tax_cents=0,
            discount_cents=0,
            total_cents=0,
            sale_status="pending",
            payment_status="pending",
        )

        db.add(sale)
        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def add_item(
        db: Session,
        tenant_id: str,
        sale_id: int,
        item: SaleItemCreate,
    ) -> SaleItem:
        sale = (
            db.query(Sale)
            .filter(
                and_(
                    Sale.id == sale_id,
                    Sale.tenant_id == tenant_id,
                    Sale.sale_status == "pending",
                )
            )
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found or already completed")

        product = (
            db.query(Product)
            .filter(and_(Product.id == item.product_id, Product.tenant_id == tenant_id))
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # Check stock availability
        inventory = (
            db.query(InventoryLevel)
            .filter(
                and_(
                    InventoryLevel.tenant_id == tenant_id,
                    InventoryLevel.product_id == product.id,
                )
            )
            .first()
        )
        if inventory and inventory.quantity_in_stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock. Available: {inventory.quantity_in_stock}",
            )

        unit_price = product.price_cents
        item_total = (unit_price * item.quantity) - item.discount_cents

        sale_item = SaleItem(
            sale_id=sale.id,
            product_id=product.id,
            quantity=item.quantity,
            unit_price_cents=unit_price,
            discount_cents=item.discount_cents,
            total_cents=item_total,
            product_name=product.name,
            product_sku=product.sku,
        )
        db.add(sale_item)

        db.flush()
        all_items = db.query(SaleItem).filter(SaleItem.sale_id == sale.id).all()
        totals = TransactionService._calculate_totals(all_items, sale.tax_rate)

        sale.subtotal_cents = totals["subtotal_cents"]
        sale.discount_cents = totals["discount_cents"]
        sale.tax_cents = totals["tax_cents"]
        sale.total_cents = totals["total_cents"]

        db.commit()
        db.refresh(sale_item)
        return sale_item

    @staticmethod
    def remove_item(
        db: Session,
        tenant_id: str,
        sale_id: int,
        item_id: int,
    ) -> None:
        sale = (
            db.query(Sale)
            .filter(
                and_(
                    Sale.id == sale_id,
                    Sale.tenant_id == tenant_id,
                    Sale.sale_status == "pending",
                )
            )
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found or already completed")

        item = (
            db.query(SaleItem)
            .filter(and_(SaleItem.id == item_id, SaleItem.sale_id == sale_id))
            .first()
        )
        if not item:
            raise HTTPException(status_code=404, detail="Item not found")

        db.delete(item)

        remaining_items = (
            db.query(SaleItem)
            .filter(and_(SaleItem.sale_id == sale.id, SaleItem.id != item_id))
            .all()
        )

        if remaining_items:
            totals = TransactionService._calculate_totals(remaining_items, sale.tax_rate)
            sale.subtotal_cents = totals["subtotal_cents"]
            sale.discount_cents = totals["discount_cents"]
            sale.tax_cents = totals["tax_cents"]
            sale.total_cents = totals["total_cents"]
        else:
            sale.subtotal_cents = 0
            sale.discount_cents = 0
            sale.tax_cents = 0
            sale.total_cents = 0

        db.commit()

    @staticmethod
    def record_payment(
        db: Session,
        tenant_id: str,
        sale_id: int,
        payment: PaymentCreate,
    ) -> SalePayment:
        sale = (
            db.query(Sale)
            .filter(and_(Sale.id == sale_id, Sale.tenant_id == tenant_id))
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        if sale.sale_status not in ["pending", "completed"]:
            raise HTTPException(
                status_code=400,
                detail="Cannot add payment to voided/refunded sale",
            )

        change_given = 0
        if payment.payment_method == "cash":
            total_paid = sum(
                p.amount_cents for p in sale.sale_payments if p.status == "completed"
            )
            total_paid += payment.amount_cents
            if total_paid > sale.total_cents:
                change_given = total_paid - sale.total_cents

        new_payment = SalePayment(
            sale_id=sale.id,
            amount_cents=payment.amount_cents,
            payment_method=payment.payment_method,
            transaction_id=payment.transaction_id,
            status="completed",
            change_given_cents=change_given,
            completed_at=datetime.utcnow(),
        )
        db.add(new_payment)

        total_paid = sum(
            p.amount_cents for p in sale.sale_payments if p.status == "completed"
        )
        total_paid += payment.amount_cents

        if total_paid >= sale.total_cents:
            sale.payment_status = "completed"

        db.commit()
        db.refresh(new_payment)
        return new_payment

    @staticmethod
    def complete_sale(
        db: Session,
        tenant_id: str,
        sale_id: int,
        user_id: int,
    ) -> Sale:
        sale = (
            db.query(Sale)
            .options(joinedload(Sale.items), joinedload(Sale.sale_payments))
            .filter(
                and_(
                    Sale.id == sale_id,
                    Sale.tenant_id == tenant_id,
                    Sale.sale_status == "pending",
                )
            )
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found or already completed")

        if not sale.items:
            raise HTTPException(status_code=400, detail="Cannot complete sale with no items")

        if sale.payment_status != "completed":
            raise HTTPException(status_code=400, detail="Payment not completed")

        for item in sale.items:
            TransactionService._decrement_inventory(
                db, tenant_id, item.product_id, item.quantity, sale.id, user_id,
            )

        if sale.customer_id:
            TransactionService._award_loyalty_points(
                db, tenant_id, sale.customer_id, sale.total_cents, sale.id,
            )

        sale.sale_status = "completed"
        sale.completed_at = datetime.utcnow()

        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def void_sale(db: Session, tenant_id: str, sale_id: int) -> Sale:
        sale = (
            db.query(Sale)
            .filter(
                and_(
                    Sale.id == sale_id,
                    Sale.tenant_id == tenant_id,
                    Sale.sale_status == "pending",
                )
            )
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found or already completed")

        sale.sale_status = "voided"
        sale.voided_at = datetime.utcnow()

        db.commit()
        db.refresh(sale)
        return sale

    @staticmethod
    def get_sale(db: Session, tenant_id: str, sale_id: int) -> Sale:
        sale = (
            db.query(Sale)
            .options(joinedload(Sale.items), joinedload(Sale.sale_payments))
            .filter(and_(Sale.id == sale_id, Sale.tenant_id == tenant_id))
            .first()
        )
        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")
        return sale

    @staticmethod
    def list_sales(
        db: Session,
        tenant_id: str,
        *,
        status: Optional[str] = None,
        location: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        skip: int = 0,
        limit: int = 50,
    ) -> List[Sale]:
        query = (
            db.query(Sale)
            .options(joinedload(Sale.items), joinedload(Sale.sale_payments))
            .filter(Sale.tenant_id == tenant_id)
        )

        if status:
            query = query.filter(Sale.sale_status == status)
        if location:
            query = query.filter(Sale.location == location)
        if start_date:
            query = query.filter(Sale.created_at >= start_date)
        if end_date:
            query = query.filter(Sale.created_at <= end_date)

        query = query.order_by(desc(Sale.created_at))
        return query.offset(skip).limit(limit).all()

    @staticmethod
    def get_stats(db: Session, tenant_id: str) -> SaleStats:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)

        all_time = (
            db.query(func.count(Sale.id), func.coalesce(func.sum(Sale.total_cents), 0))
            .filter(and_(Sale.tenant_id == tenant_id, Sale.sale_status == "completed"))
            .first()
        )
        total_sales = all_time[0] or 0
        total_revenue = all_time[1] or 0
        avg_sale = int(total_revenue / total_sales) if total_sales > 0 else 0

        today = (
            db.query(func.count(Sale.id), func.coalesce(func.sum(Sale.total_cents), 0))
            .filter(
                and_(
                    Sale.tenant_id == tenant_id,
                    Sale.sale_status == "completed",
                    Sale.created_at >= today_start,
                )
            )
            .first()
        )
        sales_today = today[0] or 0
        revenue_today = today[1] or 0

        return SaleStats(
            total_sales=total_sales,
            total_revenue_cents=total_revenue,
            average_sale_cents=avg_sale,
            sales_today=sales_today,
            revenue_today_cents=revenue_today,
        )

    # ── Private helpers ─────────────────────────────────────────────────

    @staticmethod
    def _generate_receipt_number(db: Session, tenant_id: str, location: str) -> str:
        """Generate unique receipt number: POS-{location}-{YYYYMMDD}-{sequence}"""
        today = datetime.utcnow().date()
        prefix = f"POS-{location}-{today.strftime('%Y%m%d')}"

        last_sale = (
            db.query(Sale)
            .filter(
                and_(
                    Sale.tenant_id == tenant_id,
                    Sale.receipt_number.like(f"{prefix}-%"),
                    func.date(Sale.created_at) == today,
                )
            )
            .order_by(desc(Sale.receipt_number))
            .first()
        )

        if last_sale:
            try:
                last_seq = int(last_sale.receipt_number.split("-")[-1])
                sequence = last_seq + 1
            except (ValueError, IndexError):
                sequence = 1
        else:
            sequence = 1

        return f"{prefix}-{sequence:04d}"

    @staticmethod
    def _calculate_totals(items: List[SaleItem], tax_rate_bp: int) -> dict:
        """Calculate sale totals from line items."""
        subtotal = sum(item.total_cents for item in items)
        discount = sum(item.discount_cents for item in items)

        taxable_amount = subtotal - discount
        tax = int(taxable_amount * tax_rate_bp / 10000)
        total = taxable_amount + tax

        return {
            "subtotal_cents": subtotal,
            "discount_cents": discount,
            "tax_cents": tax,
            "total_cents": total,
        }

    @staticmethod
    def _decrement_inventory(
        db: Session,
        tenant_id: str,
        product_id: int,
        quantity: int,
        sale_id: int,
        user_id: int,
    ) -> None:
        """Decrement product inventory and create stock movement record."""
        inventory = (
            db.query(InventoryLevel)
            .filter(
                and_(
                    InventoryLevel.tenant_id == tenant_id,
                    InventoryLevel.product_id == product_id,
                )
            )
            .first()
        )

        if not inventory:
            raise HTTPException(
                status_code=400,
                detail=f"No inventory record found for product {product_id}",
            )

        if inventory.quantity_in_stock < quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for product {product_id}. Available: {inventory.quantity_in_stock}, Required: {quantity}",
            )

        inventory.quantity_in_stock -= quantity
        inventory.last_updated = datetime.utcnow()

        movement = StockMovement(
            tenant_id=tenant_id,
            product_id=product_id,
            quantity_change=-quantity,
            movement_type="sale",
            reference_id=str(sale_id),
            notes=f"POS Sale #{sale_id}",
            user_id=user_id,
        )
        db.add(movement)

    @staticmethod
    def _award_loyalty_points(
        db: Session,
        tenant_id: str,
        customer_id: int,
        sale_amount_cents: int,
        sale_id: int,
    ) -> Optional[int]:
        """Calculate and award loyalty points to customer based on sale amount."""
        loyalty_program = (
            db.query(LoyaltyProgram)
            .filter(LoyaltyProgram.tenant_id == tenant_id)
            .first()
        )

        if not loyalty_program or not loyalty_program.active:
            return None

        points_earned = int(sale_amount_cents * loyalty_program.accrual_ratio)

        if points_earned <= 0:
            return None

        point_balance = (
            db.query(PointBalance)
            .filter(
                and_(
                    PointBalance.tenant_id == tenant_id,
                    PointBalance.user_id == customer_id,
                )
            )
            .first()
        )

        if not point_balance:
            point_balance = PointBalance(
                tenant_id=tenant_id,
                user_id=customer_id,
                points=0,
                lifetime_points=0,
                updated_at=datetime.utcnow(),
            )
            db.add(point_balance)
            db.flush()

        point_balance.points += points_earned
        point_balance.lifetime_points += points_earned
        point_balance.updated_at = datetime.utcnow()

        transaction = LoyaltyTransaction(
            tenant_id=tenant_id,
            user_id=customer_id,
            type="EARN",
            points=points_earned,
            reference_type="sale",
            reference_id=str(sale_id),
            description=f"Points earned from POS sale #{sale_id}",
        )
        db.add(transaction)

        return points_earned
