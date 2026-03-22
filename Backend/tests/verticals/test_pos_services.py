"""
Tests for the POS vertical service layer.

Covers: TransactionService (create, items, payments, complete, void, stats).
Also includes loyalty integration and endpoint integration tests.
"""

import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import (
    InventoryLevel,
    LoyaltyProgram,
    LoyaltyTransaction,
    PointBalance,
    Product,
    Sale,
    SaleItem,
    SalePayment,
    User,
)
from app.verticals.pos.schemas import (
    PaymentCreate,
    SaleCreate,
    SaleItemCreate,
)
from app.verticals.pos.services import TransactionService
from config import settings


# ── Helpers ─────────────────────────────────────────────────────────────────

def _make_staff_user(db: Session, tenant_id: str, email: str = "pos-staff@test.com") -> User:
    user = db.query(User).filter_by(email=email).first()
    if user:
        return user
    user = User(
        email=email,
        hashed_password=None,
        onboarded=True,
        first_name="POS",
        last_name="Staff",
        phone="0812345680",
        tenant_id=tenant_id,
        role="staff",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_customer(db: Session, tenant_id: str) -> User:
    email = "customer@test.com"
    user = db.query(User).filter_by(email=email).first()
    if user:
        return user
    user = User(
        email=email,
        hashed_password=None,
        onboarded=True,
        first_name="Customer",
        last_name="User",
        phone="0812345681",
        tenant_id=tenant_id,
        role="user",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_product(db: Session, tenant_id: str, sku: str = "POS-PROD-001", price_cents: int = 10000) -> Product:
    product = Product(
        tenant_id=tenant_id,
        sku=sku,
        name=f"POS Product {sku}",
        cost_cents=5000,
        price_cents=price_cents,
        track_inventory=True,
        low_stock_threshold=5,
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _make_inventory(db: Session, tenant_id: str, product_id: int, qty: int = 100) -> InventoryLevel:
    inv = InventoryLevel(
        tenant_id=tenant_id,
        product_id=product_id,
        location="main",
        quantity=qty,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return inv


def _make_loyalty_program(db: Session, tenant_id: str) -> LoyaltyProgram:
    existing = db.query(LoyaltyProgram).filter_by(tenant_id=tenant_id).first()
    if existing:
        existing.accrual_ratio = 0.1  # 1 point per 10 cents
        db.commit()
        return existing
    program = LoyaltyProgram(
        tenant_id=tenant_id,
        name="POS Loyalty",
        accrual_ratio=0.1,
        redemption_ratio=100,
    )
    db.add(program)
    db.commit()
    db.refresh(program)
    return program


# ── TransactionService tests ───────────────────────────────────────────────

class TestTransactionService:
    def test_create_sale(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        data = SaleCreate(location="main", tax_rate=1500)
        sale = TransactionService.create_sale(db_session, tenant_id, staff.id, data)

        assert sale.receipt_number.startswith("POS-main-")
        assert sale.sale_status == "pending"
        assert sale.total_cents == 0

    def test_add_item(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="ADD-ITEM-001")
        _make_inventory(db_session, tenant_id, product.id)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(),
        )
        item = TransactionService.add_item(
            db_session, tenant_id, sale.id,
            SaleItemCreate(product_id=product.id, quantity=2),
        )

        assert item.product_id == product.id
        assert item.quantity == 2
        assert item.unit_price_cents == product.price_cents

        # Verify sale totals updated
        db_session.refresh(sale)
        assert sale.subtotal_cents > 0

    def test_remove_item(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="REM-ITEM-001")
        _make_inventory(db_session, tenant_id, product.id)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(),
        )
        item = TransactionService.add_item(
            db_session, tenant_id, sale.id,
            SaleItemCreate(product_id=product.id, quantity=1),
        )

        TransactionService.remove_item(db_session, tenant_id, sale.id, item.id)

        db_session.refresh(sale)
        assert sale.subtotal_cents == 0
        assert sale.total_cents == 0

    def test_record_payment(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="PAY-001", price_cents=5000)
        _make_inventory(db_session, tenant_id, product.id)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(tax_rate=0),
        )
        TransactionService.add_item(
            db_session, tenant_id, sale.id,
            SaleItemCreate(product_id=product.id, quantity=1),
        )

        db_session.refresh(sale)
        payment = TransactionService.record_payment(
            db_session, tenant_id, sale.id,
            PaymentCreate(amount_cents=sale.total_cents, payment_method="cash"),
        )
        assert payment.status == "completed"
        assert payment.amount_cents == sale.total_cents

    def test_complete_sale(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="COMP-001", price_cents=5000)
        _make_inventory(db_session, tenant_id, product.id, qty=50)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(tax_rate=0),
        )
        TransactionService.add_item(
            db_session, tenant_id, sale.id,
            SaleItemCreate(product_id=product.id, quantity=2),
        )
        db_session.refresh(sale)
        TransactionService.record_payment(
            db_session, tenant_id, sale.id,
            PaymentCreate(amount_cents=sale.total_cents, payment_method="card"),
        )
        completed = TransactionService.complete_sale(
            db_session, tenant_id, sale.id, staff.id,
        )

        assert completed.sale_status == "completed"
        assert completed.completed_at is not None

    def test_void_sale(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(),
        )
        voided = TransactionService.void_sale(db_session, tenant_id, sale.id)

        assert voided.sale_status == "voided"
        assert voided.voided_at is not None

    def test_get_sale(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(),
        )
        fetched = TransactionService.get_sale(db_session, tenant_id, sale.id)

        assert fetched.id == sale.id
        assert fetched.receipt_number == sale.receipt_number

    def test_get_sale_not_found(self, db_session: Session):
        tenant_id = settings.default_tenant
        with pytest.raises(Exception) as exc:
            TransactionService.get_sale(db_session, tenant_id, 999999)
        assert exc.value.status_code == 404

    def test_list_sales(self, db_session: Session):
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)

        TransactionService.create_sale(
            db_session, tenant_id, staff.id, SaleCreate(),
        )
        sales = TransactionService.list_sales(db_session, tenant_id)
        assert len(sales) >= 1

    def test_get_stats(self, db_session: Session):
        tenant_id = settings.default_tenant
        stats = TransactionService.get_stats(db_session, tenant_id)
        assert stats.total_sales >= 0
        assert stats.total_revenue_cents >= 0

    def test_receipt_number_sequential(self, db_session: Session):
        """Receipt numbers should increment for the same day/location."""
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)

        sale1 = TransactionService.create_sale(
            db_session, tenant_id, staff.id,
            SaleCreate(location="counter"),
        )
        sale2 = TransactionService.create_sale(
            db_session, tenant_id, staff.id,
            SaleCreate(location="counter"),
        )

        # Both start with the same prefix, but sequence differs
        assert sale1.receipt_number.startswith("POS-counter-")
        assert sale2.receipt_number.startswith("POS-counter-")
        seq1 = int(sale1.receipt_number.split("-")[-1])
        seq2 = int(sale2.receipt_number.split("-")[-1])
        assert seq2 == seq1 + 1


# ── Loyalty integration tests ──────────────────────────────────────────────

class TestLoyaltyIntegration:
    def test_completing_sale_awards_loyalty_points(self, db_session: Session):
        """Completing a sale with a customer should award loyalty points."""
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        customer = _make_customer(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="LOYAL-001", price_cents=10000)
        _make_inventory(db_session, tenant_id, product.id, qty=100)
        _make_loyalty_program(db_session, tenant_id)

        # Create sale linked to customer
        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id,
            SaleCreate(customer_id=customer.id, tax_rate=0),
        )
        TransactionService.add_item(
            db_session, tenant_id, sale.id,
            SaleItemCreate(product_id=product.id, quantity=1),
        )
        db_session.refresh(sale)
        TransactionService.record_payment(
            db_session, tenant_id, sale.id,
            PaymentCreate(amount_cents=sale.total_cents, payment_method="card"),
        )
        TransactionService.complete_sale(db_session, tenant_id, sale.id, staff.id)

        # Verify loyalty points
        balance = db_session.query(PointBalance).filter_by(
            tenant_id=tenant_id, user_id=customer.id,
        ).first()
        assert balance is not None
        assert balance.points > 0

        # 10000 cents * 0.1 ratio = 1000 points
        assert balance.points == 1000

        # Verify loyalty transaction record
        txn = db_session.query(LoyaltyTransaction).filter_by(
            tenant_id=tenant_id, user_id=customer.id, type="EARN",
        ).first()
        assert txn is not None
        assert txn.points == 1000

    def test_no_loyalty_without_customer(self, db_session: Session):
        """Sales without a customer_id should not award loyalty points."""
        tenant_id = settings.default_tenant
        staff = _make_staff_user(db_session, tenant_id)
        product = _make_product(db_session, tenant_id, sku="NOLOY-001", price_cents=5000)
        _make_inventory(db_session, tenant_id, product.id, qty=100)
        _make_loyalty_program(db_session, tenant_id)

        sale = TransactionService.create_sale(
            db_session, tenant_id, staff.id,
            SaleCreate(customer_id=None, tax_rate=0),
        )
        TransactionService.add_item(
            db_session, tenant_id, sale.id,
            SaleItemCreate(product_id=product.id, quantity=1),
        )
        db_session.refresh(sale)
        TransactionService.record_payment(
            db_session, tenant_id, sale.id,
            PaymentCreate(amount_cents=sale.total_cents, payment_method="cash"),
        )

        # Count loyalty transactions before
        before_count = db_session.query(LoyaltyTransaction).filter_by(
            tenant_id=tenant_id,
        ).count()

        TransactionService.complete_sale(db_session, tenant_id, sale.id, staff.id)

        # Verify no new loyalty transaction
        after_count = db_session.query(LoyaltyTransaction).filter_by(
            tenant_id=tenant_id,
        ).count()
        assert after_count == before_count


# ── POS Endpoint integration tests ────────────────────────────────────────

class TestPOSEndpoints:
    TENANT_HEADERS = {"X-Tenant-ID": settings.default_tenant}

    def test_create_sale_endpoint(self, client: TestClient, db_session: Session):
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.post("/api/retail/pos/sales", headers=self.TENANT_HEADERS, json={
            "location": "main",
            "tax_rate": 1500,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["sale_status"] == "pending"
        assert "receipt_number" in data
        assert data["receipt_number"].startswith("POS-main-")

    def test_get_stats_endpoint(self, client: TestClient, db_session: Session):
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.get("/api/retail/pos/stats", headers=self.TENANT_HEADERS)
        assert resp.status_code == 200
        data = resp.json()
        assert "total_sales" in data
        assert "total_revenue_cents" in data
        assert "average_sale_cents" in data
        assert "sales_today" in data
        assert "revenue_today_cents" in data

    def test_list_sales_endpoint(self, client: TestClient, db_session: Session):
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        resp = client.get("/api/retail/pos/sales", headers=self.TENANT_HEADERS)
        assert resp.status_code == 200
        assert isinstance(resp.json(), list)

    def test_user_role_blocked(self, client: TestClient, db_session: Session):
        """Regular users should get 403 on POS endpoints."""
        user = db_session.query(User).first()
        user.role = "user"
        db_session.commit()

        resp = client.post("/api/retail/pos/sales", headers=self.TENANT_HEADERS, json={
            "location": "main",
        })
        assert resp.status_code == 403

    def test_full_sale_workflow(self, client: TestClient, db_session: Session):
        """End-to-end: create sale → add item → pay → complete → verify inventory."""
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        h = self.TENANT_HEADERS
        tenant_id = settings.default_tenant

        # Create product with stock
        r = client.post("/api/api/retail/products", headers=h, json={
            "sku": "FLOW-001", "name": "Flow Product", "price_cents": 5000,
            "cost_cents": 3000, "initial_stock": 20,
        })
        assert r.status_code == 201
        product_id = r.json()["id"]

        # Create sale (no tax for simpler math)
        r = client.post("/api/retail/pos/sales", headers=h, json={
            "location": "main", "tax_rate": 0,
        })
        assert r.status_code == 201
        sale_id = r.json()["id"]

        # Add 3 items
        r = client.post(f"/api/retail/pos/sales/{sale_id}/items", headers=h, json={
            "product_id": product_id, "quantity": 3,
        })
        assert r.status_code == 201
        assert r.json()["total_cents"] == 15000  # 3 * 5000

        # Verify totals
        r = client.get(f"/api/retail/pos/sales/{sale_id}", headers=h)
        assert r.json()["total_cents"] == 15000

        # Pay exact amount
        r = client.post(f"/api/retail/pos/sales/{sale_id}/payments", headers=h, json={
            "amount_cents": 15000, "payment_method": "card",
        })
        assert r.status_code == 201

        # Complete
        r = client.post(f"/api/retail/pos/sales/{sale_id}/complete", headers=h)
        assert r.status_code == 200
        assert r.json()["sale_status"] == "completed"

        # Verify inventory decremented
        r = client.get("/api/api/retail/products?search=FLOW-001", headers=h)
        assert r.json()[0]["current_stock"] == 17  # 20 - 3

    def test_void_sale_workflow(self, client: TestClient, db_session: Session):
        """Voiding a sale should work and prevent further modifications."""
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        h = self.TENANT_HEADERS
        r = client.post("/api/retail/pos/sales", headers=h, json={"location": "main"})
        sale_id = r.json()["id"]

        r = client.post(f"/api/retail/pos/sales/{sale_id}/void", headers=h)
        assert r.status_code == 200
        assert r.json()["sale_status"] == "voided"

        # Cannot void again
        r = client.post(f"/api/retail/pos/sales/{sale_id}/void", headers=h)
        assert r.status_code == 404

    def test_cash_change_calculation(self, client: TestClient, db_session: Session):
        """Cash overpayment should calculate correct change."""
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        h = self.TENANT_HEADERS

        # Create product
        r = client.post("/api/api/retail/products", headers=h, json={
            "sku": "CASH-001", "name": "Cash Test", "price_cents": 7500,
            "initial_stock": 10,
        })
        product_id = r.json()["id"]

        # Sale with 0 tax
        r = client.post("/api/retail/pos/sales", headers=h, json={
            "location": "main", "tax_rate": 0,
        })
        sale_id = r.json()["id"]

        r = client.post(f"/api/retail/pos/sales/{sale_id}/items", headers=h, json={
            "product_id": product_id, "quantity": 1,
        })

        # Overpay with cash
        r = client.post(f"/api/retail/pos/sales/{sale_id}/payments", headers=h, json={
            "amount_cents": 10000, "payment_method": "cash",
        })
        assert r.status_code == 201
        assert r.json()["change_given_cents"] == 2500  # 10000 - 7500

    def test_error_complete_no_items(self, client: TestClient, db_session: Session):
        """Cannot complete a sale with no items."""
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        h = self.TENANT_HEADERS
        r = client.post("/api/retail/pos/sales", headers=h, json={"location": "main"})
        sale_id = r.json()["id"]

        # Pay something (payment_status becomes completed)
        client.post(f"/api/retail/pos/sales/{sale_id}/payments", headers=h, json={
            "amount_cents": 100, "payment_method": "card",
        })

        r = client.post(f"/api/retail/pos/sales/{sale_id}/complete", headers=h)
        assert r.status_code == 400
        assert "no items" in r.json()["detail"].lower()

    def test_error_complete_no_payment(self, client: TestClient, db_session: Session):
        """Cannot complete a sale without full payment."""
        user = db_session.query(User).first()
        user.role = "admin"
        db_session.commit()

        h = self.TENANT_HEADERS

        r = client.post("/api/api/retail/products", headers=h, json={
            "sku": "NOPAY-001", "name": "No Pay", "price_cents": 5000,
            "initial_stock": 10,
        })
        product_id = r.json()["id"]

        r = client.post("/api/retail/pos/sales", headers=h, json={"location": "main"})
        sale_id = r.json()["id"]

        client.post(f"/api/retail/pos/sales/{sale_id}/items", headers=h, json={
            "product_id": product_id, "quantity": 1,
        })

        r = client.post(f"/api/retail/pos/sales/{sale_id}/complete", headers=h)
        assert r.status_code == 400
        assert "payment" in r.json()["detail"].lower()
