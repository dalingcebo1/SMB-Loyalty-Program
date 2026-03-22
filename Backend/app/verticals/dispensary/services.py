"""Dispensary vertical service classes."""

import re
from datetime import date, datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from app.models import (
    DispensaryProductCategory,
    DispensaryProduct,
    DispensaryCustomerVerification,
    DispensaryPurchaseLimitTracking,
    DispensarySale,
    DispensarySaleItem,
    User,
    LoyaltyProgram,
    LoyaltyTransaction,
    PointBalance,
)

from .constants import (
    DEFAULT_DAILY_LIMIT_GRAMS,
    DEFAULT_MONTHLY_LIMIT_GRAMS,
    DEFAULT_TAX_RATE,
    SALE_NUMBER_PREFIX,
)
from .schemas import (
    CategoryCreate,
    CategoryUpdate,
    CategoryResponse,
    ProductCreate,
    ProductUpdate,
    ProductResponse,
    VerificationCreate,
    VerificationUpdate,
    VerificationResponse,
    SaleCreate,
    SaleItemResponse,
    SaleResponse,
    PurchaseLimitResponse,
)


class CategoryService:
    """CRUD operations for dispensary product categories."""

    @staticmethod
    def create_category(db: Session, tenant_id: str, category_data: CategoryCreate) -> DispensaryProductCategory:
        """Create a new dispensary product category."""
        category = DispensaryProductCategory(
            tenant_id=tenant_id,
            **category_data.dict()
        )
        db.add(category)
        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def list_categories(db: Session, tenant_id: str, active_only: bool = True) -> list:
        """Get all dispensary categories for the tenant."""
        query = db.query(DispensaryProductCategory).filter(
            DispensaryProductCategory.tenant_id == tenant_id
        )

        if active_only:
            query = query.filter(DispensaryProductCategory.active == True)  # noqa: E712

        categories = query.order_by(
            DispensaryProductCategory.display_order,
            DispensaryProductCategory.name,
        ).all()
        return categories

    @staticmethod
    def get_category(db: Session, tenant_id: str, category_id: int) -> DispensaryProductCategory:
        """Get a specific category by ID."""
        category = db.query(DispensaryProductCategory).filter(
            DispensaryProductCategory.id == category_id,
            DispensaryProductCategory.tenant_id == tenant_id,
        ).first()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        return category

    @staticmethod
    def update_category(
        db: Session, tenant_id: str, category_id: int, category_data: CategoryUpdate
    ) -> DispensaryProductCategory:
        """Update a category."""
        category = db.query(DispensaryProductCategory).filter(
            DispensaryProductCategory.id == category_id,
            DispensaryProductCategory.tenant_id == tenant_id,
        ).first()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        for field, value in category_data.dict(exclude_unset=True).items():
            setattr(category, field, value)

        db.commit()
        db.refresh(category)
        return category

    @staticmethod
    def delete_category(db: Session, tenant_id: str, category_id: int) -> None:
        """Delete a category (soft delete by setting active=False)."""
        category = db.query(DispensaryProductCategory).filter(
            DispensaryProductCategory.id == category_id,
            DispensaryProductCategory.tenant_id == tenant_id,
        ).first()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        category.active = False
        db.commit()


class ProductService:
    """CRUD operations for dispensary products."""

    @staticmethod
    def create_product(db: Session, tenant_id: str, product_data: ProductCreate) -> ProductResponse:
        """Create a new dispensary product."""
        # Verify category exists
        category = db.query(DispensaryProductCategory).filter(
            DispensaryProductCategory.id == product_data.category_id,
            DispensaryProductCategory.tenant_id == tenant_id,
        ).first()

        if not category:
            raise HTTPException(status_code=404, detail="Category not found")

        product = DispensaryProduct(
            tenant_id=tenant_id,
            **product_data.dict()
        )
        db.add(product)
        db.commit()
        db.refresh(product)

        # Add category name to response
        response = ProductResponse.from_orm(product)
        response.category_name = category.name
        return response

    @staticmethod
    def list_products(
        db: Session,
        tenant_id: str,
        category_id: Optional[int] = None,
        strain_type: Optional[str] = None,
        requires_medical_card: Optional[bool] = None,
        active_only: bool = True,
        featured_only: bool = False,
        in_stock_only: bool = False,
    ) -> List[ProductResponse]:
        """Get all dispensary products with optional filters."""
        query = db.query(DispensaryProduct).options(
            joinedload(DispensaryProduct.category)
        ).filter(
            DispensaryProduct.tenant_id == tenant_id
        )

        if category_id is not None:
            query = query.filter(DispensaryProduct.category_id == category_id)

        if strain_type:
            query = query.filter(DispensaryProduct.strain_type == strain_type)

        if requires_medical_card is not None:
            query = query.filter(DispensaryProduct.requires_medical_card == requires_medical_card)

        if active_only:
            query = query.filter(DispensaryProduct.active == True)  # noqa: E712

        if featured_only:
            query = query.filter(DispensaryProduct.featured == True)  # noqa: E712

        if in_stock_only:
            query = query.filter(DispensaryProduct.stock_quantity > 0)

        products = query.order_by(
            DispensaryProduct.display_order,
            DispensaryProduct.name,
        ).all()

        # Add category names to responses
        response_list = []
        for product in products:
            response = ProductResponse.from_orm(product)
            response.category_name = product.category.name if product.category else None
            response_list.append(response)

        return response_list

    @staticmethod
    def get_product(db: Session, tenant_id: str, product_id: int) -> ProductResponse:
        """Get a specific product by ID."""
        product = db.query(DispensaryProduct).options(
            joinedload(DispensaryProduct.category)
        ).filter(
            DispensaryProduct.id == product_id,
            DispensaryProduct.tenant_id == tenant_id,
        ).first()

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        response = ProductResponse.from_orm(product)
        response.category_name = product.category.name if product.category else None
        return response

    @staticmethod
    def update_product(
        db: Session, tenant_id: str, product_id: int, product_data: ProductUpdate
    ) -> ProductResponse:
        """Update a product."""
        product = db.query(DispensaryProduct).options(
            joinedload(DispensaryProduct.category)
        ).filter(
            DispensaryProduct.id == product_id,
            DispensaryProduct.tenant_id == tenant_id,
        ).first()

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        # If category_id is being updated, verify it exists
        if product_data.category_id is not None:
            category = db.query(DispensaryProductCategory).filter(
                DispensaryProductCategory.id == product_data.category_id,
                DispensaryProductCategory.tenant_id == tenant_id,
            ).first()

            if not category:
                raise HTTPException(status_code=404, detail="Category not found")

        for field, value in product_data.dict(exclude_unset=True).items():
            setattr(product, field, value)

        db.commit()
        db.refresh(product)

        response = ProductResponse.from_orm(product)
        response.category_name = product.category.name if product.category else None
        return response

    @staticmethod
    def delete_product(db: Session, tenant_id: str, product_id: int) -> None:
        """Delete a product (soft delete by setting active=False)."""
        product = db.query(DispensaryProduct).filter(
            DispensaryProduct.id == product_id,
            DispensaryProduct.tenant_id == tenant_id,
        ).first()

        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        product.active = False
        db.commit()


class VerificationService:
    """Customer verification management."""

    @staticmethod
    def create_verification(
        db: Session, tenant_id: str, verification_data: VerificationCreate
    ) -> VerificationResponse:
        """Create or update customer verification record."""
        # Check if verification already exists
        existing = db.query(DispensaryCustomerVerification).filter(
            DispensaryCustomerVerification.tenant_id == tenant_id,
            DispensaryCustomerVerification.customer_id == verification_data.customer_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=400,
                detail="Verification record already exists. Use PUT to update.",
            )

        # Verify customer exists
        customer = db.query(User).filter(User.id == verification_data.customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        # Set verification timestamps
        now = datetime.utcnow()
        verification = DispensaryCustomerVerification(
            tenant_id=tenant_id,
            **verification_data.dict()
        )

        if verification_data.age_verified:
            verification.age_verification_date = now

        if verification_data.has_medical_card:
            verification.medical_card_verified_date = now

        db.add(verification)
        db.commit()
        db.refresh(verification)

        response = VerificationResponse.from_orm(verification)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        return response

    @staticmethod
    def list_verifications(
        db: Session,
        tenant_id: str,
        status: Optional[str] = None,
        has_medical_card: Optional[bool] = None,
    ) -> List[VerificationResponse]:
        """List all customer verification records."""
        query = db.query(DispensaryCustomerVerification).filter(
            DispensaryCustomerVerification.tenant_id == tenant_id
        )

        if status:
            query = query.filter(DispensaryCustomerVerification.verification_status == status)

        if has_medical_card is not None:
            query = query.filter(DispensaryCustomerVerification.has_medical_card == has_medical_card)

        verifications = query.order_by(DispensaryCustomerVerification.created_at.desc()).all()

        # Enrich with customer names
        results = []
        for verification in verifications:
            customer = db.query(User).filter(User.id == verification.customer_id).first()
            response = VerificationResponse.from_orm(verification)
            response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
            results.append(response)

        return results

    @staticmethod
    def get_verification(db: Session, tenant_id: str, customer_id: int) -> VerificationResponse:
        """Get customer verification status."""
        verification = db.query(DispensaryCustomerVerification).filter(
            DispensaryCustomerVerification.tenant_id == tenant_id,
            DispensaryCustomerVerification.customer_id == customer_id,
        ).first()

        if not verification:
            raise HTTPException(status_code=404, detail="Verification record not found")

        customer = db.query(User).filter(User.id == customer_id).first()
        response = VerificationResponse.from_orm(verification)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        return response

    @staticmethod
    def update_verification(
        db: Session, tenant_id: str, customer_id: int, verification_data: VerificationUpdate
    ) -> VerificationResponse:
        """Update customer verification record."""
        verification = db.query(DispensaryCustomerVerification).filter(
            DispensaryCustomerVerification.tenant_id == tenant_id,
            DispensaryCustomerVerification.customer_id == customer_id,
        ).first()

        if not verification:
            raise HTTPException(status_code=404, detail="Verification record not found")

        # Update verification timestamps
        now = datetime.utcnow()
        for field, value in verification_data.dict(exclude_unset=True).items():
            if field == "age_verified" and value and not verification.age_verified:
                verification.age_verification_date = now
            if field == "has_medical_card" and value and not verification.has_medical_card:
                verification.medical_card_verified_date = now
            setattr(verification, field, value)

        db.commit()
        db.refresh(verification)

        customer = db.query(User).filter(User.id == customer_id).first()
        response = VerificationResponse.from_orm(verification)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        return response


class ComplianceService:
    """Compliance and purchase limit management."""

    @staticmethod
    def calculate_grams_from_unit_size(unit_size: str, quantity: int) -> float:
        """Calculate total grams from unit size string (e.g., '3.5g', '100mg')."""
        unit_size = unit_size.lower().strip()

        # Extract numeric value
        match = re.match(r'([\d.]+)\s*([a-z]+)', unit_size)
        if not match:
            return 0.0

        value = float(match.group(1))
        unit = match.group(2)

        # Convert to grams
        if unit == 'g':
            return value * quantity
        elif unit == 'mg':
            return (value / 1000.0) * quantity
        elif unit == 'oz':
            return value * 28.35 * quantity
        else:
            return 0.0

    @staticmethod
    def check_purchase_limits(
        db: Session,
        tenant_id: str,
        customer_id: int,
        total_grams: float,
        today: date,
    ) -> DispensaryPurchaseLimitTracking:
        """Check and return purchase limit tracking, creating if needed."""
        current_month = today.strftime("%Y-%m")

        limit_tracking = db.query(DispensaryPurchaseLimitTracking).filter(
            DispensaryPurchaseLimitTracking.tenant_id == tenant_id,
            DispensaryPurchaseLimitTracking.customer_id == customer_id,
            DispensaryPurchaseLimitTracking.current_day == today,
        ).first()

        if not limit_tracking:
            limit_tracking = DispensaryPurchaseLimitTracking(
                tenant_id=tenant_id,
                customer_id=customer_id,
                current_day=today,
                current_month=current_month,
                daily_limit_grams=DEFAULT_DAILY_LIMIT_GRAMS,
                monthly_limit_grams=DEFAULT_MONTHLY_LIMIT_GRAMS,
                daily_purchased_grams=0.0,
                monthly_purchased_grams=0.0,
                daily_transaction_count=0,
                monthly_transaction_count=0,
            )
            db.add(limit_tracking)
            db.flush()

        # Check daily limit
        if limit_tracking.daily_purchased_grams + total_grams > limit_tracking.daily_limit_grams:
            raise HTTPException(
                status_code=403,
                detail=f"Daily purchase limit exceeded. Remaining: {limit_tracking.daily_limit_grams - limit_tracking.daily_purchased_grams:.1f}g",
            )

        # Check monthly limit
        if limit_tracking.monthly_purchased_grams + total_grams > limit_tracking.monthly_limit_grams:
            raise HTTPException(
                status_code=403,
                detail=f"Monthly purchase limit exceeded. Remaining: {limit_tracking.monthly_limit_grams - limit_tracking.monthly_purchased_grams:.1f}g",
            )

        return limit_tracking

    @staticmethod
    def get_remaining_allowance(
        db: Session, tenant_id: str, customer_id: int
    ) -> PurchaseLimitResponse:
        """Get customer's current purchase limits and remaining allowance."""
        today = date.today()
        current_month = today.strftime("%Y-%m")

        # Get or create purchase limit tracking
        limit_tracking = db.query(DispensaryPurchaseLimitTracking).filter(
            DispensaryPurchaseLimitTracking.tenant_id == tenant_id,
            DispensaryPurchaseLimitTracking.customer_id == customer_id,
            DispensaryPurchaseLimitTracking.current_day == today,
        ).first()

        if not limit_tracking:
            # Create new tracking record for today
            limit_tracking = DispensaryPurchaseLimitTracking(
                tenant_id=tenant_id,
                customer_id=customer_id,
                current_day=today,
                current_month=current_month,
                daily_limit_grams=DEFAULT_DAILY_LIMIT_GRAMS,
                monthly_limit_grams=DEFAULT_MONTHLY_LIMIT_GRAMS,
                daily_purchased_grams=0.0,
                monthly_purchased_grams=0.0,
                daily_transaction_count=0,
                monthly_transaction_count=0,
            )
            db.add(limit_tracking)
            db.commit()
            db.refresh(limit_tracking)

        # Calculate remaining allowances
        daily_remaining = limit_tracking.daily_limit_grams - limit_tracking.daily_purchased_grams
        monthly_remaining = limit_tracking.monthly_limit_grams - limit_tracking.monthly_purchased_grams
        can_purchase = daily_remaining > 0 and monthly_remaining > 0

        response = PurchaseLimitResponse.from_orm(limit_tracking)
        response.daily_remaining_grams = max(0, daily_remaining)
        response.monthly_remaining_grams = max(0, monthly_remaining)
        response.can_purchase = can_purchase

        return response

    @staticmethod
    def generate_sales_report(
        db: Session, tenant_id: str, start_date: date, end_date: date
    ) -> dict:
        """Generate compliance sales report for regulatory requirements."""
        sales = db.query(DispensarySale).filter(
            DispensarySale.tenant_id == tenant_id,
            DispensarySale.sale_date >= start_date,
            DispensarySale.sale_date <= end_date,
        ).all()

        total_sales = len(sales)
        total_grams_sold = sum(sale.total_grams_sold for sale in sales)
        total_revenue_cents = sum(sale.total_cents for sale in sales)
        medical_card_sales = sum(1 for sale in sales if sale.medical_card_used)

        return {
            "period": {
                "start_date": start_date,
                "end_date": end_date,
            },
            "summary": {
                "total_transactions": total_sales,
                "total_grams_sold": round(total_grams_sold, 2),
                "total_revenue_cents": total_revenue_cents,
                "medical_card_transactions": medical_card_sales,
                "recreational_transactions": total_sales - medical_card_sales,
            },
            "sales": [
                {
                    "sale_number": sale.sale_number,
                    "sale_date": sale.sale_date,
                    "customer_age": sale.customer_age_at_sale,
                    "medical_card_used": sale.medical_card_used,
                    "total_grams": sale.total_grams_sold,
                    "total_cents": sale.total_cents,
                }
                for sale in sales
            ],
        }


class SaleService:
    """Sale processing with compliance workflow."""

    @staticmethod
    def generate_sale_number() -> str:
        """Generate unique sale number in format DSP-YYYYMMDD-####."""
        now = datetime.utcnow()
        return f"{SALE_NUMBER_PREFIX}-{now.strftime('%Y%m%d')}-{now.strftime('%H%M%S')}"

    @staticmethod
    def award_loyalty_points(
        db: Session,
        tenant_id: str,
        customer_id: int,
        sale_id: int,
        total_cents: int,
        sale_number: str,
    ) -> int:
        """Award loyalty points for a dispensary sale (1 point per R10)."""
        # Get active loyalty program
        program = db.query(LoyaltyProgram).filter(
            LoyaltyProgram.tenant_id == tenant_id,
        ).first()

        if not program:
            return 0

        # Calculate points: 1 point per R10
        points = int(total_cents / 1000)  # 1000 cents = R10

        if points <= 0:
            return 0

        # Get or create point balance
        balance = db.query(PointBalance).filter(
            PointBalance.tenant_id == tenant_id,
            PointBalance.user_id == customer_id,
        ).first()

        if not balance:
            balance = PointBalance(
                tenant_id=tenant_id,
                user_id=customer_id,
                points=0,
                lifetime_points=0,
            )
            db.add(balance)
            db.flush()

        # Update balance
        balance.points += points
        balance.lifetime_points += points

        # Create loyalty transaction
        transaction = LoyaltyTransaction(
            tenant_id=tenant_id,
            user_id=customer_id,
            type="EARN",
            points=points,
            description=f"Earned from dispensary sale {sale_number}",
            reference_type="dispensary_sale",
            reference_id=str(sale_id),
        )
        db.add(transaction)

        return points

    @staticmethod
    def create_sale(db: Session, tenant_id: str, sale_data: SaleCreate) -> SaleResponse:
        """Process a dispensary sale with compliance checks."""
        # 1. Verify customer verification status
        verification = db.query(DispensaryCustomerVerification).filter(
            DispensaryCustomerVerification.tenant_id == tenant_id,
            DispensaryCustomerVerification.customer_id == sale_data.customer_id,
            DispensaryCustomerVerification.age_verified == True,  # noqa: E712
            DispensaryCustomerVerification.verification_status == "verified",
        ).first()

        if not verification:
            raise HTTPException(
                status_code=403,
                detail="Customer age verification required before purchase",
            )

        # Calculate age
        if not verification.date_of_birth:
            raise HTTPException(status_code=400, detail="Customer date of birth required")

        today = date.today()
        age = today.year - verification.date_of_birth.year
        if today.month < verification.date_of_birth.month or \
           (today.month == verification.date_of_birth.month and today.day < verification.date_of_birth.day):
            age -= 1

        if age < 18:  # Minimum age requirement
            raise HTTPException(status_code=403, detail="Customer must be 18+ to purchase")

        # 2. Calculate total grams and validate products
        total_grams = 0.0
        sale_items_data = []

        for item in sale_data.items:
            product = db.query(DispensaryProduct).filter(
                DispensaryProduct.id == item.product_id,
                DispensaryProduct.tenant_id == tenant_id,
                DispensaryProduct.active == True,  # noqa: E712
            ).first()

            if not product:
                raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

            # Check stock
            if product.stock_quantity < item.quantity:
                raise HTTPException(
                    status_code=400,
                    detail=f"Insufficient stock for {product.name}. Available: {product.stock_quantity}",
                )

            # Check medical card requirement
            if product.requires_medical_card and not verification.has_medical_card:
                raise HTTPException(
                    status_code=403,
                    detail=f"Medical card required for {product.name}",
                )

            # Calculate grams for this item
            item_grams = ComplianceService.calculate_grams_from_unit_size(product.unit_size, item.quantity)
            total_grams += item_grams

            sale_items_data.append({
                "product": product,
                "quantity": item.quantity,
                "item_grams": item_grams,
            })

        # 3. Check purchase limits
        limit_tracking = ComplianceService.check_purchase_limits(
            db, tenant_id, sale_data.customer_id, total_grams, today
        )

        # 4. Calculate pricing
        subtotal_cents = sum(item["product"].price_cents * item["quantity"] for item in sale_items_data)
        tax_cents = int(subtotal_cents * DEFAULT_TAX_RATE)
        total_cents = subtotal_cents + tax_cents

        # 5. Create sale record
        sale_number = SaleService.generate_sale_number()
        sale = DispensarySale(
            tenant_id=tenant_id,
            customer_id=sale_data.customer_id,
            verification_id=verification.id,
            sale_number=sale_number,
            customer_age_at_sale=age,
            medical_card_used=verification.has_medical_card,
            total_grams_sold=total_grams,
            staff_id=sale_data.staff_id,
            subtotal_cents=subtotal_cents,
            tax_cents=tax_cents,
            discount_cents=0,
            total_cents=total_cents,
            payment_method=sale_data.payment_method,
            payment_status="completed",
            payment_reference=sale_data.payment_reference,
            compliance_notes=sale_data.compliance_notes,
        )
        db.add(sale)
        db.flush()

        # 6. Create sale items and update inventory
        for item_data in sale_items_data:
            product = item_data["product"]
            quantity = item_data["quantity"]

            sale_item = DispensarySaleItem(
                sale_id=sale.id,
                product_id=product.id,
                quantity=quantity,
                unit_price_cents=product.price_cents,
                subtotal_cents=product.price_cents * quantity,
                grams_sold=item_data["item_grams"],
                batch_number=product.batch_number,
                product_name=product.name,
                thc_percentage=product.thc_percentage,
                cbd_percentage=product.cbd_percentage,
                strain_type=product.strain_type,
            )
            db.add(sale_item)

            # Update product stock
            product.stock_quantity -= quantity

        # 7. Update purchase limits
        limit_tracking.daily_purchased_grams += total_grams
        limit_tracking.monthly_purchased_grams += total_grams
        limit_tracking.daily_transaction_count += 1
        limit_tracking.monthly_transaction_count += 1

        # 8. Award loyalty points
        points = SaleService.award_loyalty_points(
            db=db,
            tenant_id=tenant_id,
            customer_id=sale_data.customer_id,
            sale_id=sale.id,
            total_cents=total_cents,
            sale_number=sale_number,
        )

        if points > 0:
            sale.loyalty_points_awarded = points
            sale.loyalty_points_awarded_at = datetime.utcnow()

        db.commit()
        db.refresh(sale)

        # Build response
        customer = db.query(User).filter(User.id == sale_data.customer_id).first()
        staff = db.query(User).filter(User.id == sale_data.staff_id).first()

        response = SaleResponse.from_orm(sale)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        response.staff_name = f"{staff.first_name} {staff.last_name}" if staff else None
        response.items = [SaleItemResponse.from_orm(item) for item in sale.items]

        return response

    @staticmethod
    def list_sales(
        db: Session,
        tenant_id: str,
        customer_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        limit: int = 50,
    ) -> List[SaleResponse]:
        """Get dispensary sales with optional filters."""
        query = db.query(DispensarySale).filter(
            DispensarySale.tenant_id == tenant_id
        )

        if customer_id:
            query = query.filter(DispensarySale.customer_id == customer_id)

        if start_date:
            query = query.filter(DispensarySale.sale_date >= start_date)

        if end_date:
            query = query.filter(DispensarySale.sale_date <= end_date)

        sales = query.order_by(DispensarySale.sale_date.desc()).limit(limit).all()

        # Build responses with customer/staff names
        response_list = []
        for sale in sales:
            customer = db.query(User).filter(User.id == sale.customer_id).first()
            staff = db.query(User).filter(User.id == sale.staff_id).first()

            response = SaleResponse.from_orm(sale)
            response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
            response.staff_name = f"{staff.first_name} {staff.last_name}" if staff else None
            response.items = [SaleItemResponse.from_orm(item) for item in sale.items]
            response_list.append(response)

        return response_list

    @staticmethod
    def get_sale(db: Session, tenant_id: str, sale_id: int) -> SaleResponse:
        """Get a specific sale by ID."""
        sale = db.query(DispensarySale).filter(
            DispensarySale.id == sale_id,
            DispensarySale.tenant_id == tenant_id,
        ).first()

        if not sale:
            raise HTTPException(status_code=404, detail="Sale not found")

        customer = db.query(User).filter(User.id == sale.customer_id).first()
        staff = db.query(User).filter(User.id == sale.staff_id).first()

        response = SaleResponse.from_orm(sale)
        response.customer_name = f"{customer.first_name} {customer.last_name}" if customer else None
        response.staff_name = f"{staff.first_name} {staff.last_name}" if staff else None
        response.items = [SaleItemResponse.from_orm(item) for item in sale.items]

        return response
