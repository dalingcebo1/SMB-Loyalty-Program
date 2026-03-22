"""
Tests for the Retail vertical service layer.

Covers: InventoryService, ProductService, SupplierService, CategoryService.
Also includes tenant isolation and endpoint integration tests.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    InventoryLevel,
    LowStockAlert,
    Product,
    ProductCategory,
    Supplier,
    StockMovement,
    User,
)
from app.verticals.retail.schemas import (
    CategoryCreate,
    ProductCreate,
    ProductUpdate,
    SupplierCreate,
)
from app.verticals.retail.services import (
    CategoryService,
    InventoryService,
    ProductService,
    SupplierService,
)
from config import settings


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_staff_user(db: Session, tenant_id: str, email: str = "staff@test.com") -> User:
    """Create and return a staff-level user."""
    user = db.query(User).filter_by(email=email).first()
    if user:
        return user
    user = User(
        email=email,
        hashed_password=None,
        onboarded=True,
        first_name="Staff",
        last_name="User",
        phone="0812345679",
        tenant_id=tenant_id,
        role="staff",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_product(db: Session, tenant_id: str, sku: str = "SKU-001", price_cents: int = 5000) -> Product:
    """Create a product directly in the database."""
    product = Product(
        tenant_id=tenant_id,
        sku=sku,
        name=f"Product {sku}",
        cost_cents=3000,
        price_cents=price_cents,
        track_inventory=True,
        low_stock_threshold=5,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _make_inventory(db: Session, tenant_id: str, product_id: int, quantity: int = 100) -> InventoryLevel:
    """Create an inventory level record."""
    inv = InventoryLevel(
        tenant_id=tenant_id,
        product_id=product_id,
        location="main",
        quantity=quantity,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


# ── ProductService tests ────────────────────────────────────────────────────

class TestProductService:
    def test_create_product(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        data = ProductCreate(
            sku="TEST-001",
            name="Test Product",
            price_cents=10000,
            cost_cents=5000,
            initial_stock=50,
        )
        result = ProductService.create_product(db_session, tenant_id, data, staff.id)

        assert result.sku == "TEST-001"
        assert result.name == "Test Product"
        assert result.current_stock == 50
        assert result.active is True

    def test_create_product_duplicate_sku(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        data = ProductCreate(sku="DUP-001", name="First", price_cents=100)
        ProductService.create_product(db_session, tenant_id, data, staff.id)

        with pytest.raises(Exception) as exc:
            ProductService.create_product(db_session, tenant_id, data, staff.id)
        assert "already exists" in str(exc.value.detail)

    def test_list_products(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)

        ProductService.create_product(
            db_session, tenant_id,
            ProductCreate(sku="LIST-A", name="Alpha", price_cents=100), staff.id,
        )
        ProductService.create_product(
            db_session, tenant_id,
            ProductCreate(sku="LIST-B", name="Beta", price_cents=200), staff.id,
        )

        products = ProductService.list_products(db_session, tenant_id)
        skus = {p.sku for p in products}
        assert "LIST-A" in skus
        assert "LIST-B" in skus

    def test_list_products_search(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)

        ProductService.create_product(
            db_session, tenant_id,
            ProductCreate(sku="SRCH-1", name="Searchable Widget", price_cents=100),
            staff.id,
        )
        results = ProductService.list_products(db_session, tenant_id, search="Widget")
        assert any(p.name == "Searchable Widget" for p in results)

    def test_update_product(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        created = ProductService.create_product(
            db_session, tenant_id,
            ProductCreate(sku="UPD-001", name="Original", price_cents=100), staff.id,
        )
        updated = ProductService.update_product(
            db_session, tenant_id, created.id,
            ProductUpdate(name="Updated Name", price_cents=200),
        )
        assert updated.name == "Updated Name"

    def test_update_product_not_found(self, db_session: Session):
        tenant_id = settings.default_tenant
        with pytest.raises(Exception) as exc:
            ProductService.update_product(
                db_session, tenant_id, 999999,
                ProductUpdate(name="Ghost"),
            )
        assert exc.value.status_code == 404


# ── SupplierService tests ──────────────────────────────────────────────────

class TestSupplierService:
    def test_create_supplier(self, db_session: Session):
        tenant_id = settings.default_tenant
        data = SupplierCreate(name="Acme Corp", email="acme@example.com")
        result = SupplierService.create_supplier(db_session, tenant_id, data)

        assert result.name == "Acme Corp"
        assert result.email == "acme@example.com"
        assert result.active is True

    def test_list_suppliers(self, db_session: Session):
        tenant_id = settings.default_tenant
        SupplierService.create_supplier(
            db_session, tenant_id, SupplierCreate(name="Supplier A"),
        )
        suppliers = SupplierService.list_suppliers(db_session, tenant_id)
        assert any(s.name == "Supplier A" for s in suppliers)


# ── CategoryService tests ──────────────────────────────────────────────────

class TestCategoryService:
    def test_create_category(self, db_session: Session):
        tenant_id = settings.default_tenant
        data = CategoryCreate(name="Electronics")
        result = CategoryService.create_category(db_session, tenant_id, data)

        assert result.name == "Electronics"
        assert result.active is True

    def test_list_categories(self, db_session: Session):
        tenant_id = settings.default_tenant
        CategoryService.create_category(
            db_session, tenant_id, CategoryCreate(name="Books"),
        )
        categories = CategoryService.list_categories(db_session, tenant_id)
        assert any(c.name == "Books" for c in categories)


# ── InventoryService tests ─────────────────────────────────────────────────

class TestInventoryService:
    def test_get_stats(self, db_session: Session):
        tenant_id = settings.default_tenant
        stats = InventoryService.get_stats(db_session, tenant_id)
        assert stats.total_products >= 0
        assert stats.total_suppliers >= 0
        assert stats.total_categories >= 0

    def test_adjust_stock(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="STOCK-001")
        _make_inventory(db_session, tenant_id, product.id, quantity=50)

        result = InventoryService.adjust_stock(
            db_session, tenant_id, product.id, 10, "Restock", staff.id,
        )
        assert result["message"] == "Stock adjusted successfully"

        # Verify stock changed
        inv = db_session.query(InventoryLevel).filter_by(
            tenant_id=tenant_id, product_id=product.id,
        ).first()
        assert inv.quantity == 60

    def test_adjust_stock_product_not_found(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        with pytest.raises(Exception) as exc:
            InventoryService.adjust_stock(
                db_session, tenant_id, 999999, 10, "Missing", staff.id,
            )
        assert exc.value.status_code == 404

    def test_list_low_stock_alerts(self, db_session: Session):
        tenant_id = settings.default_tenant
        alerts = InventoryService.list_low_stock_alerts(db_session, tenant_id)
        assert isinstance(alerts, list)


# ── Tenant isolation test ──────────────────────────────────────────────────

class TestTenantIsolation:
    def test_products_tenant_isolated(self, db_session: Session):
        """Products created under Tenant A are invisible to Tenant B."""
        tenant_a = settings.default_tenant
        tenant_b = "tenant-isolation-test"

        # Ensure tenant B exists
        from app.models import Tenant
        from datetime import datetime

        if not db_session.query(Tenant).filter_by(id=tenant_b).first():
            db_session.add(Tenant(
                id=tenant_b,
                name="Isolation Tenant B",
                loyalty_type="standard",
                primary_domain=tenant_b,
                created_at=datetime.utcnow(),
            ))
            db_session.commit()

        staff = _make_staff_user(db_session, tenant_a)

        # Create product under Tenant A
        ProductService.create_product(
            db_session, tenant_a,
            ProductCreate(sku="ISO-001", name="A-Only Product", price_cents=100),
            staff.id,
        )

        # Verify Tenant A can see it
        products_a = ProductService.list_products(db_session, tenant_a)
        assert any(p.sku == "ISO-001" for p in products_a)

        # Verify Tenant B cannot see it
        products_b = ProductService.list_products(db_session, tenant_b)
        assert not any(p.sku == "ISO-001" for p in products_b)


# ── Endpoint integration tests ─────────────────────────────────────────────

class TestRetailEndpoints:
    """Integration tests hitting the actual HTTP endpoints."""

    TENANT_HEADERS = {"X-Tenant-ID": settings.default_tenant}

    def test_get_stats_endpoint(self, client: TestClient, db_session: Session):
        """Staff can access inventory stats."""
        # Make the test user a staff member
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.get("/api/api/retail/stats", headers=self.TENANT_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_products" in data

    def test_create_product_endpoint(self, client: TestClient, db_session: Session):
        """Admin can create a product via the API."""
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.post("/api/api/retail/products", headers=self.TENANT_HEADERS, json={
            "sku": "EP-001",
            "name": "Endpoint Product",
            "price_cents": 1500,
            "cost_cents": 1000,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["sku"] == "EP-001"

    def test_create_supplier_endpoint(self, client: TestClient, db_session: Session):
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.post("/api/api/retail/suppliers", headers=self.TENANT_HEADERS, json={"name": "Test Vendor"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Test Vendor"

    def test_create_category_endpoint(self, client: TestClient, db_session: Session):
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.post("/api/api/retail/categories", headers=self.TENANT_HEADERS, json={"name": "Test Cat"})
        assert resp.status_code == 201
        assert resp.json()["name"] == "Test Cat"

    def test_user_role_blocked(self, client: TestClient, db_session: Session):
        """Regular users should get 403 on write endpoints."""
        user = db_session.query(User).first()
        user.role = "user"
        db_session.commit()

        resp = client.post("/api/api/retail/products", headers=self.TENANT_HEADERS, json={
            "sku": "NOPE", "name": "No Access", "price_cents": 100,
        })
        assert resp.status_code == 403
