"""
Tests for the Dispensary vertical service layer.

Covers: ComplianceService, CategoryService, ProductService,
        VerificationService, SaleService, and tenant isolation.
"""

import re
from datetime import date, datetime, timedelta

import pytest
from sqlalchemy.orm import Session

from app.models import (
    DispensaryProductCategory,
    DispensaryProduct,
    DispensaryCustomerVerification,
    DispensarySale,
    LoyaltyProgram,
    PointBalance,
    Tenant,
    User,
)
from app.verticals.dispensary.schemas import (
    CategoryCreate,
    CategoryUpdate,
    ProductCreate,
    ProductUpdate,
    VerificationCreate,
    SaleCreate,
    SaleItemCreate,
)
from app.verticals.dispensary.services import (
    CategoryService,
    ComplianceService,
    ProductService,
    SaleService,
    VerificationService,
)
from config import settings


# ── Helpers ─────────────────────────────────────────────────────────────────


def _ensure_dispensary_tenant(db: Session, tenant_id: str | None = None) -> Tenant:
    """Ensure a dispensary tenant exists and return it."""
    tid = tenant_id or settings.default_tenant
    tenant = db.query(Tenant).filter_by(id=tid).first()
    if not tenant:
        tenant = Tenant(
            id=tid,
            name="Test Dispensary",
            loyalty_type="basic",
            vertical_type="dispensary",
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
    email: str = "disp-test@test.com",
    role: str = "staff",
    first_name: str = "Test",
    last_name: str = "User",
) -> User:
    """Create and return a user, reusing if the email already exists."""
    user = db.query(User).filter_by(email=email).first()
    if user:
        return user
    user = User(
        email=email,
        tenant_id=tenant_id,
        role=role,
        first_name=first_name,
        last_name=last_name,
        phone="0811111111",
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def _make_category(
    db: Session,
    tenant_id: str,
    name: str = "Flower",
    **kwargs,
) -> DispensaryProductCategory:
    """Create a dispensary category directly in the DB."""
    cat = DispensaryProductCategory(
        tenant_id=tenant_id,
        name=name,
        display_order=kwargs.get("display_order", 0),
        requires_medical_card=kwargs.get("requires_medical_card", False),
        active=kwargs.get("active", True),
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


def _make_product(
    db: Session,
    tenant_id: str,
    category_id: int,
    name: str = "Blue Dream 3.5g",
    price_cents: int = 15000,
    unit_size: str = "3.5g",
    stock_quantity: int = 100,
    **kwargs,
) -> DispensaryProduct:
    """Create a dispensary product directly in the DB."""
    product = DispensaryProduct(
        tenant_id=tenant_id,
        category_id=category_id,
        name=name,
        price_cents=price_cents,
        unit_size=unit_size,
        stock_quantity=stock_quantity,
        strain=kwargs.get("strain", "Blue Dream"),
        strain_type=kwargs.get("strain_type", "hybrid"),
        thc_percentage=kwargs.get("thc_percentage", 22.0),
        cbd_percentage=kwargs.get("cbd_percentage", 0.5),
        requires_medical_card=kwargs.get("requires_medical_card", False),
        active=kwargs.get("active", True),
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def _make_verification(
    db: Session,
    tenant_id: str,
    customer_id: int,
    staff_id: int,
    dob: date | None = None,
    age_verified: bool = True,
    has_medical_card: bool = False,
    status: str = "verified",
) -> DispensaryCustomerVerification:
    """Create a customer verification record directly in the DB."""
    if dob is None:
        dob = date.today() - timedelta(days=365 * 25)
    v = DispensaryCustomerVerification(
        tenant_id=tenant_id,
        customer_id=customer_id,
        age_verified=age_verified,
        date_of_birth=dob,
        age_verification_date=datetime.utcnow() if age_verified else None,
        has_medical_card=has_medical_card,
        medical_card_verified_date=datetime.utcnow() if has_medical_card else None,
        verified_by_staff_id=staff_id,
        verification_status=status,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


def _ensure_loyalty_program(db: Session, tenant_id: str) -> LoyaltyProgram:
    """Ensure a loyalty program exists for the tenant."""
    program = db.query(LoyaltyProgram).filter_by(tenant_id=tenant_id).first()
    if not program:
        program = LoyaltyProgram(tenant_id=tenant_id, name="Dispensary Rewards")
        db.add(program)
        db.commit()
        db.refresh(program)
    return program


# ── ComplianceService tests ────────────────────────────────────────────────


class TestComplianceService:
    """Tests for ComplianceService helper methods."""

    def test_calculate_grams_3_5g(self):
        result = ComplianceService.calculate_grams_from_unit_size("3.5g", 2)
        assert result == pytest.approx(7.0)

    def test_calculate_grams_100mg(self):
        result = ComplianceService.calculate_grams_from_unit_size("100mg", 5)
        assert result == pytest.approx(0.5)

    def test_calculate_grams_1oz(self):
        result = ComplianceService.calculate_grams_from_unit_size("1 oz", 1)
        assert result == pytest.approx(28.35)

    def test_calculate_grams_invalid_unit(self):
        result = ComplianceService.calculate_grams_from_unit_size("10xyz", 3)
        assert result == 0.0

    def test_calculate_grams_empty_string(self):
        result = ComplianceService.calculate_grams_from_unit_size("", 1)
        assert result == 0.0

    def test_age_verification_exactly_18(self):
        """Born exactly 18 years ago today: age should be 18 (valid)."""
        today = date.today()
        dob = today.replace(year=today.year - 18)
        age = today.year - dob.year
        if today.month < dob.month or (today.month == dob.month and today.day < dob.day):
            age -= 1
        assert age == 18

    def test_age_verification_under_18(self):
        """Born 17 years and 364 days ago: age should be 17 (invalid)."""
        today = date.today()
        dob = today - timedelta(days=365 * 18 - 1)
        age = today.year - dob.year
        if today.month < dob.month or (today.month == dob.month and today.day < dob.day):
            age -= 1
        assert age < 18


# ── CategoryService tests ──────────────────────────────────────────────────


class TestCategoryService:
    """Tests for dispensary CategoryService."""

    def test_create_category(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        data = CategoryCreate(
            name="Edibles",
            description="Cannabis-infused food products",
            icon="cookie",
            display_order=1,
            requires_medical_card=False,
        )
        result = CategoryService.create_category(db_session, tenant.id, data)

        assert result.name == "Edibles"
        assert result.description == "Cannabis-infused food products"
        assert result.icon == "cookie"
        assert result.display_order == 1
        assert result.requires_medical_card is False
        assert result.active is True
        assert result.tenant_id == tenant.id

    def test_list_categories_active_only(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        _make_category(db_session, tenant.id, name="Active Cat", active=True)
        _make_category(db_session, tenant.id, name="Inactive Cat", active=False)

        active = CategoryService.list_categories(db_session, tenant.id, active_only=True)
        all_cats = CategoryService.list_categories(db_session, tenant.id, active_only=False)

        active_names = {c.name for c in active}
        all_names = {c.name for c in all_cats}

        assert "Active Cat" in active_names
        assert "Inactive Cat" not in active_names
        assert "Inactive Cat" in all_names

    def test_update_category_partial(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat = _make_category(
            db_session, tenant.id, name="Concentrates", display_order=5
        )

        updated = CategoryService.update_category(
            db_session, tenant.id, cat.id,
            CategoryUpdate(description="Wax, shatter, live resin"),
        )

        assert updated.description == "Wax, shatter, live resin"
        assert updated.name == "Concentrates"  # unchanged
        assert updated.display_order == 5  # unchanged

    def test_delete_category_soft_delete(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat = _make_category(db_session, tenant.id, name="Topicals")

        assert cat.active is True
        CategoryService.delete_category(db_session, tenant.id, cat.id)

        refreshed = db_session.query(DispensaryProductCategory).filter_by(id=cat.id).first()
        assert refreshed is not None
        assert refreshed.active is False


# ── ProductService tests ───────────────────────────────────────────────────


class TestProductService:
    """Tests for dispensary ProductService."""

    def test_create_product(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat = _make_category(db_session, tenant.id, name="Flower - Create")

        data = ProductCreate(
            category_id=cat.id,
            name="OG Kush 3.5g",
            price_cents=18000,
            unit_size="3.5g",
            strain="OG Kush",
            strain_type="indica",
            thc_percentage=24.0,
            stock_quantity=50,
        )
        result = ProductService.create_product(db_session, tenant.id, data)

        assert result.name == "OG Kush 3.5g"
        assert result.category_id == cat.id
        assert result.category_name == "Flower - Create"
        assert result.price_cents == 18000
        assert result.strain_type == "indica"
        assert result.active is True

    def test_create_product_invalid_category(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        data = ProductCreate(
            category_id=999999,
            name="Ghost Product",
            price_cents=1000,
            unit_size="1g",
        )
        with pytest.raises(Exception) as exc:
            ProductService.create_product(db_session, tenant.id, data)
        assert exc.value.status_code == 404

    def test_list_products_filter_by_category(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat_a = _make_category(db_session, tenant.id, name="Flower - ListA")
        cat_b = _make_category(db_session, tenant.id, name="Edibles - ListB")

        _make_product(db_session, tenant.id, cat_a.id, name="Flower Prod A")
        _make_product(db_session, tenant.id, cat_b.id, name="Edible Prod B")

        results = ProductService.list_products(db_session, tenant.id, category_id=cat_a.id)
        names = {p.name for p in results}
        assert "Flower Prod A" in names
        assert "Edible Prod B" not in names

    def test_list_products_filter_by_strain_type(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat = _make_category(db_session, tenant.id, name="Flower - Strain")
        _make_product(
            db_session, tenant.id, cat.id, name="Indica P", strain_type="indica"
        )
        _make_product(
            db_session, tenant.id, cat.id, name="Sativa P", strain_type="sativa"
        )

        results = ProductService.list_products(
            db_session, tenant.id, strain_type="indica"
        )
        names = {p.name for p in results}
        assert "Indica P" in names
        assert "Sativa P" not in names

    def test_list_products_active_only(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat = _make_category(db_session, tenant.id, name="Flower - Active")
        _make_product(
            db_session, tenant.id, cat.id, name="Active Prod", active=True
        )
        _make_product(
            db_session, tenant.id, cat.id, name="Inactive Prod", active=False
        )

        active = ProductService.list_products(db_session, tenant.id, active_only=True)
        all_prods = ProductService.list_products(
            db_session, tenant.id, active_only=False
        )

        active_names = {p.name for p in active}
        all_names = {p.name for p in all_prods}
        assert "Active Prod" in active_names
        assert "Inactive Prod" not in active_names
        assert "Inactive Prod" in all_names

    def test_update_product_validates_new_category(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        cat = _make_category(db_session, tenant.id, name="Flower - UpdCat")
        product = _make_product(db_session, tenant.id, cat.id, name="Update Cat P")

        with pytest.raises(Exception) as exc:
            ProductService.update_product(
                db_session,
                tenant.id,
                product.id,
                ProductUpdate(category_id=999999),
            )
        assert exc.value.status_code == 404


# ── VerificationService tests ──────────────────────────────────────────────


class TestVerificationService:
    """Tests for dispensary VerificationService."""

    def test_create_verification(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        customer = _make_user(
            db_session, tenant.id, email="verif-cust@test.com", role="user"
        )
        staff = _make_user(
            db_session, tenant.id, email="verif-staff@test.com", role="staff"
        )

        data = VerificationCreate(
            customer_id=customer.id,
            age_verified=True,
            date_of_birth=date(1990, 5, 15),
            age_verification_method="drivers_license",
            has_medical_card=True,
            medical_card_number="MC-12345",
            verified_by_staff_id=staff.id,
            verification_status="verified",
        )
        result = VerificationService.create_verification(db_session, tenant.id, data)

        assert result.customer_id == customer.id
        assert result.age_verified is True
        assert result.has_medical_card is True
        assert result.age_verification_date is not None
        assert result.medical_card_verified_date is not None
        assert result.verification_status == "verified"

    def test_list_verifications_filter_by_status(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        staff = _make_user(
            db_session, tenant.id, email="vlist-staff@test.com", role="staff"
        )
        cust_a = _make_user(
            db_session, tenant.id, email="vlist-a@test.com", role="user"
        )
        cust_b = _make_user(
            db_session, tenant.id, email="vlist-b@test.com", role="user"
        )

        _make_verification(
            db_session, tenant.id, cust_a.id, staff.id, status="verified"
        )
        _make_verification(
            db_session, tenant.id, cust_b.id, staff.id, status="pending"
        )

        verified = VerificationService.list_verifications(
            db_session, tenant.id, status="verified"
        )
        assert any(v.customer_id == cust_a.id for v in verified)
        assert not any(v.customer_id == cust_b.id for v in verified)

    def test_list_verifications_filter_by_medical_card(self, db_session: Session):
        tenant = _ensure_dispensary_tenant(db_session)
        staff = _make_user(
            db_session, tenant.id, email="vmed-staff@test.com", role="staff"
        )
        cust_med = _make_user(
            db_session, tenant.id, email="vmed-yes@test.com", role="user"
        )
        cust_no = _make_user(
            db_session, tenant.id, email="vmed-no@test.com", role="user"
        )

        _make_verification(
            db_session, tenant.id, cust_med.id, staff.id, has_medical_card=True
        )
        _make_verification(
            db_session, tenant.id, cust_no.id, staff.id, has_medical_card=False
        )

        with_card = VerificationService.list_verifications(
            db_session, tenant.id, has_medical_card=True
        )
        assert any(v.customer_id == cust_med.id for v in with_card)
        assert not any(v.customer_id == cust_no.id for v in with_card)


# ── SaleService tests ──────────────────────────────────────────────────────


class TestSaleService:
    """Tests for dispensary SaleService."""

    def test_generate_sale_number_format(self):
        sale_number = SaleService.generate_sale_number()
        assert sale_number.startswith("DSP-")
        # Format: DSP-YYYYMMDD-HHMMSS
        parts = sale_number.split("-")
        assert len(parts) == 3
        assert len(parts[1]) == 8  # YYYYMMDD
        assert parts[1].isdigit()
        assert len(parts[2]) == 6  # HHMMSS

    def test_generate_sale_number_has_today_date(self):
        sale_number = SaleService.generate_sale_number()
        today_str = datetime.utcnow().strftime("%Y%m%d")
        assert today_str in sale_number

    def test_award_loyalty_points(self, db_session: Session):
        """1 point per R10 (1000 cents)."""
        tenant = _ensure_dispensary_tenant(db_session)
        _ensure_loyalty_program(db_session, tenant.id)
        customer = _make_user(
            db_session, tenant.id, email="loyalty-cust@test.com", role="user"
        )

        # R150 = 15000 cents → 15 points
        points = SaleService.award_loyalty_points(
            db=db_session,
            tenant_id=tenant.id,
            customer_id=customer.id,
            sale_id=1,
            total_cents=15000,
            sale_number="DSP-TEST-001",
        )
        assert points == 15

        balance = (
            db_session.query(PointBalance)
            .filter_by(tenant_id=tenant.id, user_id=customer.id)
            .first()
        )
        assert balance is not None
        assert balance.points == 15
        assert balance.lifetime_points == 15

    def test_award_loyalty_points_no_program(self, db_session: Session):
        """No loyalty program → 0 points."""
        tenant = _ensure_dispensary_tenant(db_session)
        # Ensure no loyalty program
        db_session.query(LoyaltyProgram).filter_by(tenant_id=tenant.id).delete()
        db_session.commit()

        customer = _make_user(
            db_session, tenant.id, email="loyalty-noprog@test.com", role="user"
        )
        points = SaleService.award_loyalty_points(
            db=db_session,
            tenant_id=tenant.id,
            customer_id=customer.id,
            sale_id=1,
            total_cents=50000,
            sale_number="DSP-TEST-002",
        )
        assert points == 0

    def test_create_sale_requires_verification(self, db_session: Session):
        """Sale fails without verified customer."""
        tenant = _ensure_dispensary_tenant(db_session)
        customer = _make_user(
            db_session, tenant.id, email="sale-noverif@test.com", role="user"
        )
        staff = _make_user(
            db_session, tenant.id, email="sale-staff@test.com", role="staff"
        )
        cat = _make_category(db_session, tenant.id, name="Flower - SaleReq")
        product = _make_product(db_session, tenant.id, cat.id, name="Sale Req P")

        sale_data = SaleCreate(
            customer_id=customer.id,
            items=[SaleItemCreate(product_id=product.id, quantity=1)],
            staff_id=staff.id,
            payment_method="cash",
        )
        with pytest.raises(Exception) as exc:
            SaleService.create_sale(db_session, tenant.id, sale_data)
        assert exc.value.status_code == 403
        assert "verification" in str(exc.value.detail).lower()

    def test_create_sale_checks_medical_card(self, db_session: Session):
        """Product requiring medical card fails if customer doesn't have one."""
        tenant = _ensure_dispensary_tenant(db_session)
        customer = _make_user(
            db_session, tenant.id, email="sale-nomc@test.com", role="user"
        )
        staff = _make_user(
            db_session, tenant.id, email="sale-mc-staff@test.com", role="staff"
        )
        _make_verification(
            db_session,
            tenant.id,
            customer.id,
            staff.id,
            has_medical_card=False,
        )
        cat = _make_category(db_session, tenant.id, name="Medical - MC")
        med_product = _make_product(
            db_session,
            tenant.id,
            cat.id,
            name="Medical Only P",
            requires_medical_card=True,
        )

        sale_data = SaleCreate(
            customer_id=customer.id,
            items=[SaleItemCreate(product_id=med_product.id, quantity=1)],
            staff_id=staff.id,
            payment_method="cash",
        )
        with pytest.raises(Exception) as exc:
            SaleService.create_sale(db_session, tenant.id, sale_data)
        assert exc.value.status_code == 403
        assert "medical card" in str(exc.value.detail).lower()

    def test_create_sale_checks_stock(self, db_session: Session):
        """Sale fails if insufficient stock."""
        tenant = _ensure_dispensary_tenant(db_session)
        customer = _make_user(
            db_session, tenant.id, email="sale-stock@test.com", role="user"
        )
        staff = _make_user(
            db_session, tenant.id, email="sale-stock-staff@test.com", role="staff"
        )
        _make_verification(db_session, tenant.id, customer.id, staff.id)
        cat = _make_category(db_session, tenant.id, name="Flower - Stock")
        product = _make_product(
            db_session, tenant.id, cat.id, name="Low Stock P", stock_quantity=1
        )

        sale_data = SaleCreate(
            customer_id=customer.id,
            items=[SaleItemCreate(product_id=product.id, quantity=5)],
            staff_id=staff.id,
            payment_method="cash",
        )
        with pytest.raises(Exception) as exc:
            SaleService.create_sale(db_session, tenant.id, sale_data)
        assert exc.value.status_code == 400
        assert "insufficient stock" in str(exc.value.detail).lower()


# ── Tenant isolation tests ─────────────────────────────────────────────────


class TestTenantIsolation:
    """Verify service methods scope data to the correct tenant."""

    TENANT_B_ID = "disp-isolation-tenant-b"

    def _ensure_tenant_b(self, db: Session) -> Tenant:
        tenant = db.query(Tenant).filter_by(id=self.TENANT_B_ID).first()
        if not tenant:
            tenant = Tenant(
                id=self.TENANT_B_ID,
                name="Isolation Tenant B",
                loyalty_type="standard",
                vertical_type="dispensary",
                primary_domain=self.TENANT_B_ID,
                created_at=datetime.utcnow(),
            )
            db.add(tenant)
            db.commit()
            db.refresh(tenant)
        return tenant

    def test_categories_tenant_isolated(self, db_session: Session):
        tenant_a = _ensure_dispensary_tenant(db_session)
        tenant_b = self._ensure_tenant_b(db_session)

        _make_category(db_session, tenant_a.id, name="TenantA Only Cat")

        cats_a = CategoryService.list_categories(db_session, tenant_a.id, active_only=False)
        cats_b = CategoryService.list_categories(db_session, tenant_b.id, active_only=False)

        assert any(c.name == "TenantA Only Cat" for c in cats_a)
        assert not any(c.name == "TenantA Only Cat" for c in cats_b)

    def test_products_tenant_isolated(self, db_session: Session):
        tenant_a = _ensure_dispensary_tenant(db_session)
        tenant_b = self._ensure_tenant_b(db_session)

        cat = _make_category(db_session, tenant_a.id, name="Flower - Iso")
        _make_product(db_session, tenant_a.id, cat.id, name="TenantA Only Prod")

        prods_a = ProductService.list_products(db_session, tenant_a.id)
        prods_b = ProductService.list_products(db_session, tenant_b.id)

        assert any(p.name == "TenantA Only Prod" for p in prods_a)
        assert not any(p.name == "TenantA Only Prod" for p in prods_b)

    def test_verifications_tenant_isolated(self, db_session: Session):
        tenant_a = _ensure_dispensary_tenant(db_session)
        tenant_b = self._ensure_tenant_b(db_session)

        staff = _make_user(
            db_session, tenant_a.id, email="iso-staff@test.com", role="staff"
        )
        cust = _make_user(
            db_session, tenant_a.id, email="iso-cust@test.com", role="user"
        )

        _make_verification(db_session, tenant_a.id, cust.id, staff.id)

        verifs_a = VerificationService.list_verifications(db_session, tenant_a.id)
        verifs_b = VerificationService.list_verifications(db_session, tenant_b.id)

        assert any(v.customer_id == cust.id for v in verifs_a)
        assert not any(v.customer_id == cust.id for v in verifs_b)
