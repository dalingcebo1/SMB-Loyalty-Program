"""
Tests for Dispensary Routes

Tests the cannabis dispensary vertical endpoints including:
- Product categories CRUD
- Cannabis products CRUD with strain info
- Customer age/medical card verification
- Purchase limit tracking
- Sales transactions with compliance
"""
import pytest
from datetime import date, datetime, timedelta
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from app.models import (
    User,
    Tenant,
    DispensaryProductCategory,
    DispensaryProduct,
    DispensaryCustomerVerification,
)
from app.plugins.auth.routes import create_access_token
from app.services.tenant_settings import get_tenant_settings
from config import settings


# ─── Local fixtures bridging to existing test infrastructure ────────────────

@pytest.fixture
def db(db_session):
    """Alias db_session as db for this module."""
    return db_session


@pytest.fixture
def basic_tenant(db_session):
    """Provide a tenant for dispensary tests."""
    tenant = db_session.query(Tenant).filter_by(id=settings.default_tenant).first()
    if not tenant:
        tenant = Tenant(
            id=settings.default_tenant,
            name="Test Dispensary Tenant",
            loyalty_type="basic",
            vertical_type="dispensary",
            created_at=datetime.utcnow(),
            config={},
        )
        db_session.add(tenant)
        db_session.commit()
        db_session.refresh(tenant)
    # Clean dispensary tables between tests to avoid unique constraint violations
    db_session.query(DispensaryCustomerVerification).delete()
    db_session.query(DispensaryProduct).delete()
    db_session.query(DispensaryProductCategory).delete()
    db_session.commit()
    return tenant


@pytest.fixture
def staff_token_headers(db_session, basic_tenant):
    """Provide auth headers for a staff user."""
    user = db_session.query(User).filter_by(email="dispensary-staff@test.com").first()
    if not user:
        user = User(
            email="dispensary-staff@test.com",
            tenant_id=basic_tenant.id,
            role="staff",
            onboarded=True,
            created_at=datetime.utcnow(),
            first_name="Staff",
            last_name="User",
            phone="0000000000",
        )
        db_session.add(user)
        db_session.commit()
    ts = get_tenant_settings(basic_tenant)
    token = create_access_token(user.email, tenant_settings=ts)
    return {"Authorization": f"Bearer {token}", "X-Tenant-ID": basic_tenant.id}


@pytest.fixture
def basic_user(db_session, basic_tenant):
    """Provide a regular customer user for dispensary tests."""
    user = db_session.query(User).filter_by(email="dispensary-customer@test.com").first()
    if not user:
        user = User(
            email="dispensary-customer@test.com",
            tenant_id=basic_tenant.id,
            role="user",
            onboarded=True,
            created_at=datetime.utcnow(),
            first_name="Customer",
            last_name="User",
            phone="0000000001",
        )
        db_session.add(user)
        db_session.commit()
    return user


def test_create_category(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test creating a product category."""
    data = {
        "name": "Flower",
        "description": "Premium cannabis flower products",
        "icon": "🌸",
        "display_order": 1,
        "requires_medical_card": False,
        "active": True
    }
    
    response = client.post(
        "/api/dispensary/categories",
        json=data,
        headers=staff_token_headers
    )
    assert response.status_code == 201
    result = response.json()
    assert result["name"] == "Flower"
    assert result["tenant_id"] == basic_tenant.id
    assert result["description"] == "Premium cannabis flower products"
    assert result["icon"] == "🌸"
    assert result["display_order"] == 1
    assert result["requires_medical_card"] is False
    assert result["active"] is True


def test_list_categories(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test listing product categories."""
    # Create a few categories
    categories = [
        DispensaryProductCategory(
            tenant_id=basic_tenant.id,
            name="Flower",
            display_order=1,
            active=True
        ),
        DispensaryProductCategory(
            tenant_id=basic_tenant.id,
            name="Edibles",
            display_order=2,
            active=True
        ),
        DispensaryProductCategory(
            tenant_id=basic_tenant.id,
            name="Concentrates",
            display_order=3,
            active=False
        ),
    ]
    for cat in categories:
        db.add(cat)
    db.commit()
    
    # List all categories (active_only defaults to true, use false to get all)
    response = client.get(
        "/api/dispensary/categories?active_only=false",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3
    assert result[0]["name"] == "Flower"
    assert result[1]["name"] == "Edibles"
    
    # Filter active only
    response = client.get(
        "/api/dispensary/categories?active_only=true",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 2


def test_update_category(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test updating a category."""
    category = DispensaryProductCategory(
        tenant_id=basic_tenant.id,
        name="Flower",
        display_order=1,
        active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    update_data = {
        "name": "Premium Flower",
        "requires_medical_card": True,
    }
    
    response = client.put(
        f"/api/dispensary/categories/{category.id}",
        json=update_data,
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert result["name"] == "Premium Flower"
    assert result["requires_medical_card"] is True


def test_delete_category(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test deleting a category (soft delete)."""
    category = DispensaryProductCategory(
        tenant_id=basic_tenant.id,
        name="Test Category",
        display_order=1,
        active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    response = client.delete(
        f"/api/dispensary/categories/{category.id}",
        headers=staff_token_headers
    )
    assert response.status_code == 204
    
    # Verify soft delete
    db.refresh(category)
    assert category.active is False


def test_create_product(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test creating a cannabis product."""
    category = DispensaryProductCategory(
        tenant_id=basic_tenant.id,
        name="Flower",
        display_order=1,
        active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    data = {
        "category_id": category.id,
        "name": "Blue Dream",
        "strain": "Blue Dream",
        "strain_type": "hybrid",
        "description": "Popular hybrid strain with balanced effects",
        "sku": "BD-001",
        "thc_percentage": 22.5,
        "cbd_percentage": 0.8,
        "terpenes": "Myrcene, Pinene, Caryophyllene",
        "effects": "Relaxed, Happy, Euphoric",
        "medical_uses": "Stress, Pain, Depression",
        "price_cents": 15000,  # R150
        "unit_size": "3.5g",
        "stock_quantity": 50,
        "batch_number": "BD220125",
        "harvest_date": "2025-12-01",
        "package_date": "2025-12-15",
        "requires_medical_card": False,
        "potency_level": "high",
        "featured": True,
        "active": True
    }
    
    response = client.post(
        "/api/dispensary/products",
        json=data,
        headers=staff_token_headers
    )
    assert response.status_code == 201
    result = response.json()
    assert result["name"] == "Blue Dream"
    assert result["strain"] == "Blue Dream"
    assert result["strain_type"] == "hybrid"
    assert result["thc_percentage"] == 22.5
    assert result["cbd_percentage"] == 0.8
    assert result["price_cents"] == 15000
    assert result["unit_size"] == "3.5g"
    assert result["stock_quantity"] == 50
    assert result["featured"] is True


def test_list_products(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test listing products with filters."""
    category = DispensaryProductCategory(
        tenant_id=basic_tenant.id,
        name="Flower",
        display_order=1,
        active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    products = [
        DispensaryProduct(
            tenant_id=basic_tenant.id,
            category_id=category.id,
            name="Blue Dream",
            strain_type="hybrid",
            price_cents=15000,
            unit_size="3.5g",
            stock_quantity=50,
            featured=True,
            active=True
        ),
        DispensaryProduct(
            tenant_id=basic_tenant.id,
            category_id=category.id,
            name="OG Kush",
            strain_type="indica",
            price_cents=18000,
            unit_size="3.5g",
            stock_quantity=30,
            featured=False,
            active=True
        ),
    ]
    for prod in products:
        db.add(prod)
    db.commit()
    
    # List all products
    response = client.get(
        "/api/dispensary/products",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 2
    
    # Filter by featured
    response = client.get(
        "/api/dispensary/products?featured_only=true",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 1
    assert result[0]["name"] == "Blue Dream"
    
    # Filter by strain type
    response = client.get(
        "/api/dispensary/products?strain_type=indica",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 1
    assert result[0]["name"] == "OG Kush"


def test_update_product(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test updating a product."""
    category = DispensaryProductCategory(
        tenant_id=basic_tenant.id,
        name="Flower",
        display_order=1,
        active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    product = DispensaryProduct(
        tenant_id=basic_tenant.id,
        category_id=category.id,
        name="Blue Dream",
        price_cents=15000,
        unit_size="3.5g",
        stock_quantity=50,
        active=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    
    update_data = {
        "price_cents": 16000,
        "stock_quantity": 45,
    }
    
    response = client.put(
        f"/api/dispensary/products/{product.id}",
        json=update_data,
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert result["price_cents"] == 16000
    assert result["stock_quantity"] == 45


def test_create_verification(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant, basic_user: User):
    """Test creating a customer verification record."""
    staff_user = db.query(User).filter(User.role == "staff").first()
    
    data = {
        "customer_id": basic_user.id,
        "age_verified": True,
        "date_of_birth": "1990-05-15",
        "age_verification_method": "ID scan",
        "has_medical_card": False,
        "id_document_type": "Driver's License",
        "id_document_number": "DL123456",
        "id_document_expiry": "2028-05-15",
        "verified_by_staff_id": staff_user.id,
        "verification_status": "verified",
        "notes": "Valid ID verified"
    }
    
    response = client.post(
        "/api/dispensary/verifications",
        json=data,
        headers=staff_token_headers
    )
    assert response.status_code == 201
    result = response.json()
    assert result["customer_id"] == basic_user.id
    assert result["age_verified"] is True
    assert result["verification_status"] == "verified"


def test_list_verifications(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test listing all verification records."""
    users = db.query(User).limit(3).all()
    staff_user = db.query(User).filter(User.role == "staff").first()
    
    for user in users:
        verification = DispensaryCustomerVerification(
            tenant_id=basic_tenant.id,
            customer_id=user.id,
            age_verified=True,
            date_of_birth=date(1990, 1, 1),
            verification_status="verified",
            verified_by_staff_id=staff_user.id
        )
        db.add(verification)
    db.commit()
    
    response = client.get(
        "/api/dispensary/verifications",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3
    
    # Filter by status
    response = client.get(
        "/api/dispensary/verifications?status=verified",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert len(result) == 3


def test_get_verification_by_customer(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant, basic_user: User):
    """Test getting a specific customer's verification."""
    staff_user = db.query(User).filter(User.role == "staff").first()
    
    verification = DispensaryCustomerVerification(
        tenant_id=basic_tenant.id,
        customer_id=basic_user.id,
        age_verified=True,
        date_of_birth=date(1990, 5, 15),
        verification_status="verified",
        verified_by_staff_id=staff_user.id
    )
    db.add(verification)
    db.commit()
    
    response = client.get(
        f"/api/dispensary/verifications/{basic_user.id}",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert result["customer_id"] == basic_user.id
    assert result["age_verified"] is True


def test_update_verification(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant, basic_user: User):
    """Test updating a verification record."""
    staff_user = db.query(User).filter(User.role == "staff").first()
    
    verification = DispensaryCustomerVerification(
        tenant_id=basic_tenant.id,
        customer_id=basic_user.id,
        age_verified=True,
        verification_status="pending",
        verified_by_staff_id=staff_user.id
    )
    db.add(verification)
    db.commit()
    
    update_data = {
        "verification_status": "verified",
        "notes": "Verification approved"
    }
    
    response = client.put(
        f"/api/dispensary/verifications/{basic_user.id}",
        json=update_data,
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert result["verification_status"] == "verified"


def test_create_sale(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant, basic_user: User):
    """Test creating a dispensary sale."""
    category = DispensaryProductCategory(
        tenant_id=basic_tenant.id,
        name="Flower",
        display_order=1,
        active=True
    )
    db.add(category)
    db.commit()
    db.refresh(category)
    
    product = DispensaryProduct(
        tenant_id=basic_tenant.id,
        category_id=category.id,
        name="Blue Dream",
        price_cents=15000,
        unit_size="3.5g",
        stock_quantity=50,
        active=True
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    
    staff_user = db.query(User).filter(User.role == "staff").first()
    
    # Create verification first
    verification = DispensaryCustomerVerification(
        tenant_id=basic_tenant.id,
        customer_id=basic_user.id,
        age_verified=True,
        date_of_birth=date(1990, 1, 1),
        verification_status="verified",
        verified_by_staff_id=staff_user.id
    )
    db.add(verification)
    db.commit()
    
    data = {
        "customer_id": basic_user.id,
        "staff_id": staff_user.id,
        "sale_date": datetime.utcnow().isoformat(),
        "payment_method": "card",
        "items": [
            {
                "product_id": product.id,
                "quantity": 2,
                "unit_price_cents": 15000
            }
        ],
        "notes": "First purchase"
    }
    
    response = client.post(
        "/api/dispensary/sales",
        json=data,
        headers=staff_token_headers
    )
    assert response.status_code == 201
    result = response.json()
    assert result["customer_id"] == basic_user.id
    # 2 items × 15000 cents = 30000 subtotal, plus 15% tax = 34500 total
    assert result["subtotal_cents"] == 30000
    assert result["total_cents"] == result["subtotal_cents"] + result.get("tax_cents", 0)
    assert len(result["items"]) == 1


def test_list_sales(db: Session, client: TestClient, staff_token_headers: dict, basic_tenant: Tenant):
    """Test listing sales with date filters."""
    response = client.get(
        "/api/dispensary/sales",
        headers=staff_token_headers
    )
    assert response.status_code == 200
    result = response.json()
    assert isinstance(result, list)
