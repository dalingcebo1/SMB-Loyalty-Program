# Launch Features Testing Guide

This guide covers testing the critical launch features: subscription billing, business onboarding, and health monitoring.

## 1. Subscription Billing Tests

### A. Unit Tests

Create tests for the subscription billing service:

```python
# tests/test_subscription_billing.py
import pytest
from unittest.mock import Mock, patch
from app.services.subscription_billing import billing_service

class TestSubscriptionBilling:
    
    @patch('app.services.subscription_billing.requests.post')
    def test_create_customer(self, mock_post):
        """Test customer creation with Yoco API."""
        mock_post.return_value.json.return_value = {
            'id': 'cus_test123',
            'email': 'test@example.com'
        }
        mock_post.return_value.status_code = 200
        
        result = billing_service.create_customer(
            email='test@example.com',
            first_name='John',
            last_name='Doe',
            phone='+27123456789'
        )
        
        assert result['id'] == 'cus_test123'
        assert result['email'] == 'test@example.com'
    
    @patch('app.services.subscription_billing.requests.post')
    def test_create_subscription(self, mock_post):
        """Test subscription creation."""
        mock_post.return_value.json.return_value = {
            'id': 'sub_test123',
            'status': 'active',
            'redirect_url': 'https://yoco.com/redirect'
        }
        mock_post.return_value.status_code = 200
        
        result = billing_service.create_subscription(
            customer_id='cus_test123',
            plan_id='plan_basic',
            tenant_id='test_tenant'
        )
        
        assert result['id'] == 'sub_test123'
        assert result['status'] == 'active'
        assert 'redirect_url' in result
```

### B. Integration Tests

Test the subscription API endpoints:

```python
# tests/test_subscription_endpoints.py
import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

class TestSubscriptionEndpoints:
    
    def test_setup_subscription(self, auth_headers):
        """Test subscription setup endpoint."""
        response = client.post(
            "/api/subscriptions/setup-subscription",
            headers=auth_headers,
            json={
                "plan_id": "plan_basic",
                "customer": {
                    "first_name": "John",
                    "last_name": "Doe", 
                    "email": "john@example.com",
                    "phone": "+27123456789"
                }
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert "subscription_id" in data["data"]
    
    def test_subscription_status(self, auth_headers):
        """Test subscription status endpoint."""
        response = client.get(
            "/api/subscriptions/subscription-status",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "subscription" in data["data"]
        assert "billing" in data["data"]
```

### C. Webhook Tests

Test webhook signature verification and processing:

```python
# tests/test_subscription_webhooks.py
import hmac
import hashlib
import json
from fastapi.testclient import TestClient

def create_webhook_signature(payload: str, secret: str) -> str:
    """Create webhook signature for testing."""
    return hmac.new(
        secret.encode(),
        payload.encode(),
        hashlib.sha256
    ).hexdigest()

class TestSubscriptionWebhooks:
    
    def test_webhook_signature_verification(self):
        """Test webhook signature verification."""
        payload = '{"event": "subscription.charged", "data": {}}'
        secret = "test_webhook_secret"
        signature = create_webhook_signature(payload, secret)
        
        response = client.post(
            "/api/subscriptions/webhook/yoco-subscription",
            data=payload,
            headers={
                "Content-Type": "application/json",
                "X-Yoco-Signature": signature
            }
        )
        
        assert response.status_code == 200
    
    def test_subscription_charged_webhook(self):
        """Test subscription charged event processing."""
        payload = {
            "event": "subscription.charged",
            "data": {
                "id": "sub_test123",
                "customer_id": "cus_test123",
                "amount": 29900,
                "currency": "ZAR"
            }
        }
        
        # Process webhook and verify database updates
        # Check that payment record is created
        # Verify subscription status is updated
```

## 2. Business Onboarding Tests

### A. Service Tests

```python
# tests/test_business_onboarding.py
import pytest
from app.services.business_onboarding import onboarding_service

class TestBusinessOnboarding:
    
    def test_create_business(self, db_session):
        """Test business creation."""
        result = onboarding_service.create_business(
            business_name="Test Carwash",
            vertical_type="carwash",
            owner_email="owner@test.com",
            owner_first_name="John",
            owner_last_name="Smith",
            owner_phone="+27123456789",
            db=db_session
        )
        
        assert result["tenant_name"] == "Test Carwash"
        assert result["vertical_type"] == "carwash"
        assert "tenant_id" in result
        assert "trial_ends_at" in result
    
    def test_complete_onboarding_step(self, db_session):
        """Test step completion."""
        # Create business first
        business = onboarding_service.create_business(...)
        
        # Complete business info step
        result = onboarding_service.complete_onboarding_step(
            tenant_id=business["tenant_id"],
            step="business_info",
            data={"business_name": "Updated Name"},
            db=db_session
        )
        
        assert result["current_step"] == "services_setup"
        assert result["next_step"] == "subscription_setup"
```

### B. API Endpoint Tests

```python
# tests/test_onboarding_endpoints.py
class TestOnboardingEndpoints:
    
    def test_create_business_endpoint(self):
        """Test business creation endpoint."""
        response = client.post(
            "/api/onboarding/create-business",
            json={
                "business_name": "Test Beauty Salon",
                "vertical_type": "beauty",
                "owner_email": "owner@salon.com",
                "owner_first_name": "Jane",
                "owner_last_name": "Doe",
                "owner_phone": "+27987654321"
            }
        )
        
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["tenant_name"] == "Test Beauty Salon"
    
    def test_onboarding_status(self, auth_headers):
        """Test onboarding status endpoint."""
        response = client.get(
            "/api/onboarding/status",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert "current_step" in data["data"]
        assert "steps" in data["data"]
        assert "trial_status" in data["data"]
```

## 3. Health Check Tests

### A. Health Endpoint Tests

```python
# tests/test_health_endpoints.py
class TestHealthEndpoints:
    
    def test_basic_health_check(self):
        """Test basic health check."""
        response = client.get("/health/")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
    
    def test_detailed_health_check(self):
        """Test detailed health check."""
        response = client.get("/health/detailed")
        
        assert response.status_code == 200
        data = response.json()
        assert "checks" in data
        assert "database" in data["checks"]
        assert "environment" in data["checks"]
    
    def test_readiness_check(self):
        """Test readiness probe."""
        response = client.get("/health/ready")
        
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ready"
```

## 4. End-to-End Tests

### A. Complete Business Setup Flow

```python
# tests/test_e2e_business_setup.py
class TestBusinessSetupFlow:
    
    def test_complete_business_onboarding(self):
        """Test complete business setup flow."""
        
        # 1. Create business
        business_data = {
            "business_name": "E2E Test Business",
            "vertical_type": "padel",
            "owner_email": "e2e@test.com",
            "owner_first_name": "E2E",
            "owner_last_name": "Test",
            "owner_phone": "+27111111111"
        }
        
        create_response = client.post(
            "/api/onboarding/create-business",
            json=business_data
        )
        assert create_response.status_code == 200
        
        # 2. Get auth token for created user
        # (implement authentication)
        
        # 3. Complete business info step
        # 4. Set up services
        # 5. Configure subscription
        # 6. Complete customization
        # 7. Verify onboarding is complete
        
        status_response = client.get(
            "/api/onboarding/status",
            headers=auth_headers
        )
        data = status_response.json()
        assert data["data"]["completed"] is True
```

### B. Subscription Lifecycle Test

```python
class TestSubscriptionLifecycle:
    
    def test_subscription_setup_and_billing(self):
        """Test complete subscription lifecycle."""
        
        # 1. Set up subscription
        # 2. Simulate successful payment webhook
        # 3. Verify subscription is active
        # 4. Simulate billing cycle webhook
        # 5. Cancel subscription
        # 6. Verify cancellation
```

## 5. Performance Tests

### A. Load Testing

```python
# tests/test_performance.py
import asyncio
import aiohttp

class TestPerformance:
    
    async def test_health_check_performance(self):
        """Test health check response time."""
        async with aiohttp.ClientSession() as session:
            start_time = time.time()
            
            tasks = [
                session.get("http://localhost:8000/health/")
                for _ in range(100)
            ]
            
            responses = await asyncio.gather(*tasks)
            end_time = time.time()
            
            # All requests should complete in reasonable time
            assert end_time - start_time < 5.0
            
            # All responses should be successful
            for response in responses:
                assert response.status == 200
```

## 6. Manual Testing Checklist

### Subscription Billing
- [ ] Create subscription with valid plan
- [ ] Handle payment failure gracefully
- [ ] Cancel active subscription
- [ ] Process webhook events correctly
- [ ] Display subscription status accurately

### Business Onboarding
- [ ] Register new business successfully
- [ ] Complete all onboarding steps
- [ ] Handle validation errors
- [ ] Show trial status correctly
- [ ] Generate appropriate default services

### Health Monitoring
- [ ] Health checks return correct status
- [ ] Detailed checks show system state
- [ ] Metrics endpoint provides useful data
- [ ] Error conditions are handled properly

### Integration Testing
- [ ] Authentication works across all endpoints
- [ ] Database transactions are handled correctly
- [ ] Error responses are consistent
- [ ] API documentation is accurate

## 7. Test Data Setup

### Database Fixtures

```python
# tests/conftest.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

@pytest.fixture
def db_session():
    """Create test database session."""
    engine = create_engine("sqlite:///test.db")
    Base.metadata.create_all(bind=engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()
    
    yield session
    
    session.close()
    Base.metadata.drop_all(bind=engine)

@pytest.fixture
def test_tenant(db_session):
    """Create test tenant."""
    tenant = Tenant(
        id="test_tenant",
        name="Test Business",
        vertical_type="carwash",
        loyalty_type="standard"
    )
    db_session.add(tenant)
    db_session.commit()
    return tenant
```

## 8. CI/CD Testing

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test Launch Features

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v2
    
    - name: Set up Python
      uses: actions/setup-python@v2
      with:
        python-version: '3.12'
    
    - name: Install dependencies
      run: |
        cd Backend
        pip install -r requirements.txt
        pip install -r dev-requirements.txt
    
    - name: Run tests
      run: |
        cd Backend
        pytest tests/ -v --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v1
```

Run the complete test suite with:

```bash
# Backend tests
cd Backend
pytest tests/ -v

# Run specific test categories
pytest tests/test_subscription_billing.py -v
pytest tests/test_business_onboarding.py -v
pytest tests/test_health_endpoints.py -v

# Run with coverage
pytest --cov=app --cov-report=html
```
