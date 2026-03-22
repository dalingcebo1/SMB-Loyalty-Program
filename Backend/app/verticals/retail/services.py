"""
Retail vertical service layer.

Encapsulates business logic previously inline in route handlers. Each service
class is stateless — all state flows through the ``db`` session.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import HTTPException
from sqlalchemy import func, desc
from sqlalchemy.orm import Session

from app.models import (
    Product,
    ProductCategory,
    Supplier,
    InventoryLevel,
    StockMovement,
    LowStockAlert,
)

from .schemas import (
    CategoryCreate,
    CategoryResponse,
    InventoryStatsResponse,
    ProductCreate,
    ProductResponse,
    ProductUpdate,
    SupplierCreate,
    SupplierResponse,
    LowStockAlertResponse,
)


# ── Helpers ─────────────────────────────────────────────────────────────────

def _create_stock_movement(
    db: Session,
    tenant_id: str,
    product_id: int,
    quantity: int,
    movement_type: str,
    reason: Optional[str],
    user_id: int,
    unit_cost_cents: Optional[int] = None,
    location: str = "main",
) -> StockMovement:
    """Create a stock movement record and update inventory level."""
    movement = StockMovement(
        tenant_id=tenant_id,
        product_id=product_id,
        quantity=quantity,
        type=movement_type,
        reason=reason,
        performed_by=user_id,
        unit_cost_cents=unit_cost_cents,
        location=location,
    )
    db.add(movement)

    # Update inventory level
    inv_level = (
        db.query(InventoryLevel)
        .filter(
            InventoryLevel.tenant_id == tenant_id,
            InventoryLevel.product_id == product_id,
            InventoryLevel.location == location,
        )
        .first()
    )

    if not inv_level:
        inv_level = InventoryLevel(
            tenant_id=tenant_id,
            product_id=product_id,
            location=location,
            quantity=0,
        )
        db.add(inv_level)

    inv_level.quantity += quantity
    inv_level.updated_at = datetime.utcnow()

    return movement


def _check_low_stock_alerts(
    db: Session,
    tenant_id: str,
    product_id: int,
    location: str = "main",
) -> None:
    """Check if product has fallen below threshold and create alert if needed."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product or not product.track_inventory:
        return

    inv_level = (
        db.query(InventoryLevel)
        .filter(
            InventoryLevel.tenant_id == tenant_id,
            InventoryLevel.product_id == product_id,
            InventoryLevel.location == location,
        )
        .first()
    )

    if not inv_level:
        return

    if inv_level.available_quantity <= product.low_stock_threshold:
        # Check if alert already exists
        existing = (
            db.query(LowStockAlert)
            .filter(
                LowStockAlert.tenant_id == tenant_id,
                LowStockAlert.product_id == product_id,
                LowStockAlert.location == location,
                LowStockAlert.resolved == False,  # noqa: E712
            )
            .first()
        )

        if not existing:
            alert = LowStockAlert(
                tenant_id=tenant_id,
                product_id=product_id,
                location=location,
                current_quantity=inv_level.available_quantity,
                threshold=product.low_stock_threshold,
            )
            db.add(alert)


# ── Product helpers ─────────────────────────────────────────────────────────

def _build_product_response(
    product: Product,
    inv: Optional[InventoryLevel],
) -> ProductResponse:
    """Build a ``ProductResponse`` from a Product + optional InventoryLevel."""
    current_stock = inv.available_quantity if inv else 0
    is_low = inv.is_low_stock if inv else False
    return ProductResponse(
        id=product.id,
        sku=product.sku,
        name=product.name,
        description=product.description,
        category_id=product.category_id,
        category_name=product.category.name if product.category else None,
        supplier_id=product.supplier_id,
        supplier_name=product.supplier.name if product.supplier else None,
        cost=product.cost,
        price=product.price,
        margin_percent=product.margin_percent,
        barcode=product.barcode,
        unit_of_measure=product.unit_of_measure,
        track_inventory=product.track_inventory,
        low_stock_threshold=product.low_stock_threshold,
        current_stock=current_stock,
        is_low_stock=is_low,
        active=product.active,
        created_at=product.created_at,
    )


# ── Service classes ─────────────────────────────────────────────────────────


class InventoryService:
    """Inventory and stock management operations."""

    @staticmethod
    def get_stats(db: Session, tenant_id: str) -> InventoryStatsResponse:
        total_products = (
            db.query(func.count(Product.id))
            .filter(Product.tenant_id == tenant_id)
            .scalar()
            or 0
        )

        low_stock_count = (
            db.query(func.count(LowStockAlert.id))
            .filter(
                LowStockAlert.tenant_id == tenant_id,
                LowStockAlert.resolved == False,  # noqa: E712
            )
            .scalar()
            or 0
        )

        inventory_value_query = (
            db.query(func.sum(Product.cost_cents * InventoryLevel.quantity))
            .join(InventoryLevel, Product.id == InventoryLevel.product_id)
            .filter(Product.tenant_id == tenant_id)
            .scalar()
        )
        total_inventory_value_cents = int(inventory_value_query) if inventory_value_query else 0

        total_suppliers = (
            db.query(func.count(Supplier.id))
            .filter(Supplier.tenant_id == tenant_id)
            .scalar()
            or 0
        )

        total_categories = (
            db.query(func.count(ProductCategory.id))
            .filter(ProductCategory.tenant_id == tenant_id)
            .scalar()
            or 0
        )

        return InventoryStatsResponse(
            total_products=total_products,
            low_stock_count=low_stock_count,
            total_inventory_value_cents=total_inventory_value_cents,
            total_suppliers=total_suppliers,
            total_categories=total_categories,
        )

    @staticmethod
    def adjust_stock(
        db: Session,
        tenant_id: str,
        product_id: int,
        quantity: int,
        reason: str,
        user_id: int,
        location: str = "main",
    ) -> dict:
        product = (
            db.query(Product)
            .filter(Product.id == product_id, Product.tenant_id == tenant_id)
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        _create_stock_movement(
            db=db,
            tenant_id=tenant_id,
            product_id=product_id,
            quantity=quantity,
            movement_type="adjustment",
            reason=reason,
            user_id=user_id,
            location=location,
        )
        _check_low_stock_alerts(db, tenant_id, product_id, location)
        db.commit()
        return {"message": "Stock adjusted successfully"}

    @staticmethod
    def list_low_stock_alerts(
        db: Session,
        tenant_id: str,
        resolved: bool = False,
    ) -> List[LowStockAlertResponse]:
        alerts = (
            db.query(LowStockAlert)
            .join(Product)
            .filter(
                LowStockAlert.tenant_id == tenant_id,
                LowStockAlert.resolved == resolved,
            )
            .order_by(desc(LowStockAlert.created_at))
            .all()
        )
        return [
            LowStockAlertResponse(
                id=alert.id,
                product_id=alert.product_id,
                product_name=alert.product.name,
                product_sku=alert.product.sku,
                current_quantity=alert.current_quantity,
                threshold=alert.threshold,
                location=alert.location,
                acknowledged=alert.acknowledged,
                created_at=alert.created_at,
            )
            for alert in alerts
        ]


class ProductService:
    """Product CRUD operations."""

    @staticmethod
    def list_products(
        db: Session,
        tenant_id: str,
        *,
        search: Optional[str] = None,
        category_id: Optional[int] = None,
        low_stock_only: bool = False,
        active_only: bool = True,
    ) -> List[ProductResponse]:
        query = db.query(Product).filter(Product.tenant_id == tenant_id)

        if active_only:
            query = query.filter(Product.active == True)  # noqa: E712

        if category_id:
            query = query.filter(Product.category_id == category_id)

        if search:
            search_term = f"%{search}%"
            query = query.filter(
                (Product.name.ilike(search_term))
                | (Product.sku.ilike(search_term))
                | (Product.barcode.ilike(search_term))
            )

        products = query.all()

        # Fetch inventory levels
        product_ids = [p.id for p in products]
        inv_levels = (
            db.query(InventoryLevel)
            .filter(
                InventoryLevel.tenant_id == tenant_id,
                InventoryLevel.product_id.in_(product_ids),
            )
            .all()
        )
        inv_map = {inv.product_id: inv for inv in inv_levels}

        result: List[ProductResponse] = []
        for product in products:
            inv = inv_map.get(product.id)
            is_low = inv.is_low_stock if inv else False

            if low_stock_only and not is_low:
                continue

            result.append(_build_product_response(product, inv))

        return result

    @staticmethod
    def create_product(
        db: Session,
        tenant_id: str,
        data: ProductCreate,
        user_id: int,
    ) -> ProductResponse:
        # Check SKU uniqueness
        existing = (
            db.query(Product)
            .filter(Product.tenant_id == tenant_id, Product.sku == data.sku)
            .first()
        )
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Product with SKU '{data.sku}' already exists",
            )

        product = Product(
            tenant_id=tenant_id,
            sku=data.sku,
            name=data.name,
            description=data.description,
            category_id=data.category_id,
            supplier_id=data.supplier_id,
            cost_cents=data.cost_cents,
            price_cents=data.price_cents,
            barcode=data.barcode,
            unit_of_measure=data.unit_of_measure,
            track_inventory=data.track_inventory,
            low_stock_threshold=data.low_stock_threshold,
        )
        db.add(product)
        db.flush()

        if data.initial_stock > 0:
            _create_stock_movement(
                db=db,
                tenant_id=tenant_id,
                product_id=product.id,
                quantity=data.initial_stock,
                movement_type="purchase",
                reason="Initial stock",
                user_id=user_id,
                unit_cost_cents=data.cost_cents,
            )

        db.commit()
        db.refresh(product)

        inv = (
            db.query(InventoryLevel)
            .filter(
                InventoryLevel.tenant_id == tenant_id,
                InventoryLevel.product_id == product.id,
            )
            .first()
        )

        return _build_product_response(product, inv)

    @staticmethod
    def update_product(
        db: Session,
        tenant_id: str,
        product_id: int,
        data: ProductUpdate,
    ) -> ProductResponse:
        product = (
            db.query(Product)
            .filter(Product.id == product_id, Product.tenant_id == tenant_id)
            .first()
        )
        if not product:
            raise HTTPException(status_code=404, detail="Product not found")

        update_data = data.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(product, key, value)

        db.commit()
        db.refresh(product)

        inv = (
            db.query(InventoryLevel)
            .filter(
                InventoryLevel.tenant_id == tenant_id,
                InventoryLevel.product_id == product.id,
            )
            .first()
        )

        return _build_product_response(product, inv)


class SupplierService:
    """Supplier CRUD operations."""

    @staticmethod
    def list_suppliers(
        db: Session,
        tenant_id: str,
        active_only: bool = True,
    ) -> List[SupplierResponse]:
        query = db.query(Supplier).filter(Supplier.tenant_id == tenant_id)
        if active_only:
            query = query.filter(Supplier.active == True)  # noqa: E712

        suppliers = query.all()

        product_counts = (
            db.query(Product.supplier_id, func.count(Product.id).label("count"))
            .filter(Product.tenant_id == tenant_id)
            .group_by(Product.supplier_id)
            .all()
        )
        count_map = {supplier_id: count for supplier_id, count in product_counts}

        return [
            SupplierResponse(
                id=s.id,
                name=s.name,
                contact_person=s.contact_person,
                email=s.email,
                phone=s.phone,
                address=s.address,
                active=s.active,
                product_count=count_map.get(s.id, 0),
                created_at=s.created_at,
            )
            for s in suppliers
        ]

    @staticmethod
    def create_supplier(
        db: Session,
        tenant_id: str,
        data: SupplierCreate,
    ) -> SupplierResponse:
        supplier = Supplier(tenant_id=tenant_id, **data.dict())
        db.add(supplier)
        db.commit()
        db.refresh(supplier)

        return SupplierResponse(
            id=supplier.id,
            name=supplier.name,
            contact_person=supplier.contact_person,
            email=supplier.email,
            phone=supplier.phone,
            address=supplier.address,
            active=supplier.active,
            product_count=0,
            created_at=supplier.created_at,
        )


class CategoryService:
    """Product category CRUD operations."""

    @staticmethod
    def list_categories(
        db: Session,
        tenant_id: str,
    ) -> List[CategoryResponse]:
        categories = (
            db.query(ProductCategory)
            .filter(
                ProductCategory.tenant_id == tenant_id,
                ProductCategory.active == True,  # noqa: E712
            )
            .all()
        )

        product_counts = (
            db.query(Product.category_id, func.count(Product.id).label("count"))
            .filter(Product.tenant_id == tenant_id)
            .group_by(Product.category_id)
            .all()
        )
        count_map = {cat_id: count for cat_id, count in product_counts}

        return [
            CategoryResponse(
                id=c.id,
                name=c.name,
                description=c.description,
                parent_id=c.parent_id,
                active=c.active,
                product_count=count_map.get(c.id, 0),
            )
            for c in categories
        ]

    @staticmethod
    def create_category(
        db: Session,
        tenant_id: str,
        data: CategoryCreate,
    ) -> CategoryResponse:
        category = ProductCategory(tenant_id=tenant_id, **data.dict())
        db.add(category)
        db.commit()
        db.refresh(category)

        return CategoryResponse(
            id=category.id,
            name=category.name,
            description=category.description,
            parent_id=category.parent_id,
            active=category.active,
            product_count=0,
        )
