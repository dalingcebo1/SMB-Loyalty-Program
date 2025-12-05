# Technical Specification: API Layer

**Document Version:** 1.0  
**Last Updated:** December 1, 2025  
**Classification:** Confidential - Internal Use Only

---

## Table of Contents

1. [API Architecture](#api-architecture)
2. [Authentication & Authorization](#authentication--authorization)
3. [Tenant Resolution](#tenant-resolution)
4. [Core API Endpoints](#core-api-endpoints)
5. [Vertical-Specific APIs](#vertical-specific-apis)
6. [White-Label APIs](#white-label-apis)
7. [Analytics & Insights APIs](#analytics--insights-apis)
8. [Error Handling](#error-handling)
9. [Rate Limiting](#rate-limiting)
10. [Versioning Strategy](#versioning-strategy)

---

## 1. API Architecture

### 1.1 Technology Stack
- **Framework:** FastAPI 0.104+
- **Protocol:** REST with JSON payloads
- **Authentication:** Firebase Auth + JWT
- **Documentation:** OpenAPI 3.0 (Swagger/ReDoc)
- **Validation:** Pydantic v2 models

### 1.2 Base URL Structure
```
Production:  https://api.{tenant-domain}/
Development: https://apismbloyaltyapp-dev.{region}.azurecontainerapps.io/
```

### 1.3 Request/Response Format

#### Standard Request Headers
```http
Authorization: Bearer {firebase-jwt-token}
X-Tenant-Domain: {tenant-domain}  # Optional, auto-resolved
Content-Type: application/json
Accept: application/json
```

#### Standard Response Envelope
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "timestamp": "2025-12-01T10:30:00Z",
    "tenant_id": "uuid",
    "request_id": "uuid"
  }
}
```

#### Error Response Envelope
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "User-friendly error message",
    "details": { ... },
    "timestamp": "2025-12-01T10:30:00Z"
  },
  "meta": {
    "request_id": "uuid"
  }
}
```

---

## 2. Authentication & Authorization

### 2.1 Authentication Flow

#### Firebase Token Validation
```python
# Dependency: get_current_user
async def get_current_user(
    authorization: str = Header(...),
    db: Session = Depends(get_db)
) -> User:
    """
    1. Extract Bearer token from Authorization header
    2. Verify Firebase JWT signature
    3. Extract Firebase UID
    4. Query users table by firebase_uid
    5. Return User model or raise 401
    """
```

#### User Scopes
```python
class UserScope(str, Enum):
    END_USER = "end_user"
    STAFF = "staff"
    ADMIN = "admin"
    SUPER_ADMIN = "super_admin"
```

### 2.2 Permission System

#### Capability-Based Authorization
```python
class Capability(str, Enum):
    # User Management
    USER_VIEW = "user.view"
    USER_EDIT = "user.edit"
    USER_DELETE = "user.delete"
    
    # Inventory Management
    INVENTORY_VIEW = "inventory.view"
    INVENTORY_EDIT = "inventory.edit"
    
    # Orders
    ORDER_VIEW = "order.view"
    ORDER_PROCESS = "order.process"
    ORDER_REFUND = "order.refund"
    
    # Branding
    BRANDING_VIEW = "branding.view"
    BRANDING_EDIT = "branding.edit"
    
    # Analytics
    ANALYTICS_VIEW = "analytics.view"
    ANALYTICS_EXPORT = "analytics.export"
    
    # Vertical Modules
    VERTICAL_ENABLE = "vertical.enable"
    VERTICAL_CONFIGURE = "vertical.configure"
```

#### Dependency Example
```python
async def require_capability(
    capability: Capability,
    user: User = Depends(get_current_user)
) -> User:
    """Verify user has required capability"""
    if not user.has_capability(capability):
        raise HTTPException(
            status_code=403,
            detail=f"Missing capability: {capability}"
        )
    return user
```

---

## 3. Tenant Resolution

### 3.1 Resolution Strategy

#### Priority Order
1. **Custom Domain:** Match `Host` header against `tenant_domains.custom_domain`
2. **Subdomain:** Extract subdomain from `{subdomain}.loyalty.app`
3. **Header Override:** Check `X-Tenant-Domain` header (dev/testing only)
4. **User Context:** Fallback to user's default tenant

#### Implementation
```python
async def get_tenant_context(
    request: Request,
    db: Session = Depends(get_db)
) -> TenantContext:
    """
    1. Parse Host header
    2. Query tenant_domains table
    3. Load tenant metadata from cache or DB
    4. Return TenantContext with tenant_id, schema, config
    """
```

### 3.2 Schema Routing (Post-Migration)

```python
class TenantContext:
    tenant_id: UUID
    schema_name: str  # e.g., "tenant_abc123"
    config: TenantConfig
    
    def set_search_path(self, db: Session):
        """Set PostgreSQL search_path for this request"""
        db.execute(text(f"SET search_path TO {self.schema_name}, public"))
```

---

## 4. Core API Endpoints

### 4.1 Tenant Metadata

#### GET /api/tenant-meta
```http
GET /api/tenant-meta HTTP/1.1
Host: mycarwash.com
```

**Response:**
```json
{
  "success": true,
  "data": {
    "tenant_id": "uuid",
    "name": "My Car Wash",
    "subdomain": "mycarwash",
    "custom_domain": "mycarwash.com",
    "logo_url": "https://cdn.../logo.png",
    "primary_color": "#0066CC",
    "secondary_color": "#FF6600",
    "enabled_verticals": ["carwash", "loyalty"],
    "features": {
      "mobile_app": true,
      "sms_notifications": true,
      "tiered_loyalty": false
    }
  }
}
```

**Caching:** 5 minutes (React Query), 1 hour (CDN)

---

### 4.2 User Management

#### POST /api/auth/register
```http
POST /api/auth/register HTTP/1.1
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecureP@ss123",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+27821234567"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "firebase_uid": "firebase-uid",
    "email": "user@example.com",
    "scope": "end_user",
    "created_at": "2025-12-01T10:30:00Z"
  }
}
```

#### GET /api/users/me
```http
GET /api/users/me HTTP/1.1
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "phone": "+27821234567",
    "scope": "end_user",
    "loyalty_points": 150,
    "loyalty_tier": "silver",
    "capabilities": ["order.create", "order.view"]
  }
}
```

#### PATCH /api/users/me
```http
PATCH /api/users/me HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "first_name": "Jane",
  "phone": "+27829876543"
}
```

---

### 4.3 Loyalty System

#### GET /api/loyalty/points
```http
GET /api/loyalty/points HTTP/1.1
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current_points": 150,
    "lifetime_points": 450,
    "tier": "silver",
    "next_tier": "gold",
    "points_to_next_tier": 350,
    "recent_transactions": [
      {
        "id": "uuid",
        "type": "earned",
        "points": 50,
        "description": "Car wash purchase",
        "created_at": "2025-11-28T14:20:00Z"
      }
    ]
  }
}
```

#### POST /api/loyalty/redeem
```http
POST /api/loyalty/redeem HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "reward_id": "uuid",
  "points_to_redeem": 100
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "redemption_id": "uuid",
    "reward_name": "R50 Discount",
    "points_redeemed": 100,
    "remaining_points": 50,
    "voucher_code": "WASH50-ABC123",
    "expires_at": "2025-12-31T23:59:59Z"
  }
}
```

---

### 4.4 Order Management

#### POST /api/orders
```http
POST /api/orders HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "vertical": "carwash",
  "items": [
    {
      "product_id": "uuid",
      "quantity": 1,
      "price_cents": 15000
    }
  ],
  "payment_method": "card",
  "apply_loyalty_points": 50
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "order_number": "ORD-2025-001234",
    "status": "pending_payment",
    "subtotal_cents": 15000,
    "loyalty_discount_cents": 500,
    "total_cents": 14500,
    "payment_intent_id": "pi_xyz123",
    "created_at": "2025-12-01T10:30:00Z"
  }
}
```

#### GET /api/orders/{order_id}
```http
GET /api/orders/uuid HTTP/1.1
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "order_id": "uuid",
    "order_number": "ORD-2025-001234",
    "status": "completed",
    "vertical": "carwash",
    "items": [...],
    "subtotal_cents": 15000,
    "total_cents": 14500,
    "loyalty_points_earned": 15,
    "created_at": "2025-12-01T10:30:00Z",
    "completed_at": "2025-12-01T10:35:00Z"
  }
}
```

#### GET /api/orders
```http
GET /api/orders?status=completed&limit=10&offset=0 HTTP/1.1
Authorization: Bearer {token}
```

**Query Parameters:**
- `status`: Filter by order status (optional)
- `vertical`: Filter by vertical (optional)
- `limit`: Results per page (default 20, max 100)
- `offset`: Pagination offset

---

### 4.5 Inventory Management

#### GET /api/inventory
```http
GET /api/inventory?vertical=carwash&category=services HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: inventory.view
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "uuid",
        "name": "Premium Wash",
        "description": "Full exterior and interior wash",
        "category": "services",
        "vertical": "carwash",
        "price_cents": 15000,
        "stock_quantity": null,
        "is_active": true,
        "image_url": "https://cdn.../wash.jpg"
      }
    ],
    "total": 12,
    "limit": 20,
    "offset": 0
  }
}
```

#### POST /api/inventory
```http
POST /api/inventory HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: inventory.edit
Content-Type: application/json

{
  "name": "Express Wash",
  "description": "Quick exterior wash",
  "category": "services",
  "vertical": "carwash",
  "price_cents": 8000,
  "is_active": true
}
```

#### PATCH /api/inventory/{item_id}
```http
PATCH /api/inventory/uuid HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: inventory.edit
Content-Type: application/json

{
  "price_cents": 8500,
  "is_active": false
}
```

---

## 5. Vertical-Specific APIs

### 5.1 Car Wash Vertical

#### GET /api/carwash/bays
```http
GET /api/carwash/bays HTTP/1.1
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bays": [
      {
        "id": "uuid",
        "name": "Bay 1",
        "status": "available",
        "current_order": null
      },
      {
        "id": "uuid",
        "name": "Bay 2",
        "status": "in_use",
        "current_order": {
          "order_id": "uuid",
          "started_at": "2025-12-01T10:20:00Z",
          "estimated_completion": "2025-12-01T10:50:00Z"
        }
      }
    ]
  }
}
```

#### POST /api/carwash/queue
```http
POST /api/carwash/queue HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "order_id": "uuid",
  "vehicle_type": "sedan",
  "priority": "normal"
}
```

---

### 5.2 Dispensary Vertical

#### GET /api/dispensary/products
```http
GET /api/dispensary/products?category=flower&strain_type=indica HTTP/1.1
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "uuid",
        "name": "Blue Dream",
        "category": "flower",
        "strain_type": "hybrid",
        "thc_percentage": 22.5,
        "cbd_percentage": 0.8,
        "price_cents": 12000,
        "weight_grams": 3.5,
        "stock_quantity": 45,
        "lab_tested": true,
        "compliance": {
          "license_number": "ABC-123",
          "batch_number": "BD-2025-11-001"
        }
      }
    ]
  }
}
```

#### POST /api/dispensary/age-verify
```http
POST /api/dispensary/age-verify HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "date_of_birth": "1990-05-15",
  "id_document": "base64-encoded-image"
}
```

---

### 5.3 Padel Vertical

#### GET /api/padel/courts
```http
GET /api/padel/courts?date=2025-12-05 HTTP/1.1
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "courts": [
      {
        "id": "uuid",
        "name": "Court 1",
        "type": "indoor",
        "surface": "artificial_grass",
        "availability": [
          {
            "start_time": "08:00",
            "end_time": "09:00",
            "status": "available",
            "price_cents": 30000
          },
          {
            "start_time": "09:00",
            "end_time": "10:00",
            "status": "booked"
          }
        ]
      }
    ]
  }
}
```

#### POST /api/padel/bookings
```http
POST /api/padel/bookings HTTP/1.1
Authorization: Bearer {token}
Content-Type: application/json

{
  "court_id": "uuid",
  "date": "2025-12-05",
  "start_time": "08:00",
  "duration_minutes": 60,
  "players": [
    {"name": "John Doe", "email": "john@example.com"}
  ]
}
```

---

## 6. White-Label APIs

### 6.1 Branding Configuration

#### GET /api/admin/branding
```http
GET /api/admin/branding HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: branding.view
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logo_url": "https://cdn.../logo.png",
    "favicon_url": "https://cdn.../favicon.ico",
    "primary_color": "#0066CC",
    "secondary_color": "#FF6600",
    "accent_color": "#00CC66",
    "font_family": "Inter, sans-serif",
    "custom_css": ".btn-primary { border-radius: 8px; }",
    "email_header_url": "https://cdn.../email-header.png",
    "social_links": {
      "facebook": "https://facebook.com/...",
      "instagram": "https://instagram.com/..."
    }
  }
}
```

#### PATCH /api/admin/branding
```http
PATCH /api/admin/branding HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: branding.edit
Content-Type: application/json

{
  "primary_color": "#0055AA",
  "logo_url": "https://cdn.../new-logo.png"
}
```

**Side Effects:**
- Invalidates tenant-meta cache
- Emits `tenant-theme:refresh` event to connected clients
- Regenerates CDN cached assets

---

### 6.2 Email Templates

#### GET /api/admin/email-templates
```http
GET /api/admin/email-templates HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: branding.view
```

**Response:**
```json
{
  "success": true,
  "data": {
    "templates": [
      {
        "id": "welcome_email",
        "name": "Welcome Email",
        "subject": "Welcome to {{tenant_name}}!",
        "body_html": "<html>...</html>",
        "variables": ["tenant_name", "user_name", "activation_link"]
      }
    ]
  }
}
```

---

## 7. Analytics & Insights APIs

### 7.1 Dashboard Metrics

#### GET /api/analytics/dashboard
```http
GET /api/analytics/dashboard?period=30d HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: analytics.view
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-11-01",
      "end": "2025-12-01"
    },
    "metrics": {
      "total_revenue_cents": 450000,
      "total_orders": 125,
      "active_users": 89,
      "new_users": 23,
      "average_order_value_cents": 3600,
      "loyalty_points_issued": 1250,
      "loyalty_points_redeemed": 450
    },
    "trends": {
      "revenue_change_percent": 15.2,
      "orders_change_percent": 8.7
    }
  }
}
```

---

### 7.2 User Insights

#### GET /api/analytics/users
```http
GET /api/analytics/users?segment=high_value&limit=50 HTTP/1.1
Authorization: Bearer {token}
X-Required-Capability: analytics.view
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "user_id": "uuid",
        "email": "user@example.com",
        "total_spent_cents": 125000,
        "order_count": 45,
        "loyalty_tier": "gold",
        "last_order_at": "2025-11-28T14:20:00Z",
        "lifetime_value_cents": 125000
      }
    ],
    "total": 50
  }
}
```

---

## 8. Error Handling

### 8.1 Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | Missing or invalid token |
| `INSUFFICIENT_PERMISSIONS` | 403 | Missing capability |
| `RESOURCE_NOT_FOUND` | 404 | Resource doesn't exist |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### 8.2 Validation Error Details

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request data",
    "details": {
      "email": ["Invalid email format"],
      "price_cents": ["Must be greater than 0"]
    }
  }
}
```

---

## 9. Rate Limiting

### 9.1 Default Limits

| Endpoint Pattern | Limit | Window |
|------------------|-------|--------|
| `/api/auth/*` | 5 requests | per minute |
| `/api/orders` (POST) | 10 requests | per minute |
| `/api/*` (GET) | 100 requests | per minute |
| `/api/admin/*` | 60 requests | per minute |

### 9.2 Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1701432000
```

---

## 10. Versioning Strategy

### 10.1 Current Approach
- **Version:** Implicit v1 (no version in URL)
- **Breaking Changes:** Avoid; use optional fields and feature flags
- **Future:** Move to `/api/v2/` when necessary

### 10.2 Deprecation Process
1. Announce deprecation in API response headers
2. 90-day notice via email to affected tenants
3. Maintain parallel endpoints during transition
4. Remove deprecated endpoint after grace period

---

## Appendix A: Authentication Examples

### A.1 Firebase Token Exchange
```python
import firebase_admin
from firebase_admin import auth as firebase_auth

def verify_firebase_token(token: str) -> dict:
    try:
        decoded = firebase_auth.verify_id_token(token)
        return {
            "firebase_uid": decoded["uid"],
            "email": decoded.get("email"),
            "email_verified": decoded.get("email_verified", False)
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail="Invalid token")
```

---

## Appendix B: WebSocket Events (Future)

### B.1 Real-Time Order Updates
```javascript
// Client subscribes to order updates
ws.send(JSON.stringify({
  type: "subscribe",
  channel: "order:uuid"
}));

// Server pushes status updates
{
  "type": "order:status_changed",
  "data": {
    "order_id": "uuid",
    "status": "in_progress",
    "timestamp": "2025-12-01T10:35:00Z"
  }
}
```

---

**End of API Specification Document**
