# SMB Loyalty Program API Documentation

## Overview
The SMB Loyalty Program provides a comprehensive multi-tenant SaaS platform for small and medium businesses to manage customer loyalty programs, process orders, and handle payments.

## Base URL
- Development: `http://localhost:8000`
- Production: `https://api.yourdomain.com`

## Authentication
All API endpoints require authentication via JWT token except for public endpoints.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Tenant-ID: <tenant_id> (optional, can be inferred from domain)
```

## Core API Endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user info
- `PUT /api/auth/me` - Update current user
- `POST /api/auth/logout` - User logout

### User Profile (`/api/profile`)
- `GET /api/profile/me` - Get detailed user profile with loyalty stats
- `PUT /api/profile/me` - Update user profile
- `GET /api/profile/me/vehicles` - Get user's vehicles
- `POST /api/profile/me/vehicles` - Add new vehicle
- `PUT /api/profile/me/vehicles/{id}` - Update vehicle
- `DELETE /api/profile/me/vehicles/{id}` - Delete vehicle
- `GET /api/profile/me/orders` - Get user's order history
- `GET /api/profile/me/redemptions` - Get user's redemption history
- `GET /api/profile/me/loyalty-summary` - Get loyalty program summary

### Customer Management (`/api/customers`) - Staff/Admin Only
- `GET /api/customers` - List customers with search and pagination
- `GET /api/customers/{id}` - Get detailed customer information
- `GET /api/customers/{id}/orders` - Get customer's order history

### Orders (`/api/orders`)
- `GET /api/orders` - List orders
- `POST /api/orders` - Create new order
- `GET /api/orders/{id}` - Get order details
- `PUT /api/orders/{id}` - Update order
- `POST /api/orders/{id}/complete` - Mark order as completed

### Payments (`/api/payments`)
- `POST /api/payments/create` - Create payment for order
- `GET /api/payments/{id}` - Get payment status
- `POST /api/payments/webhook` - Yoco webhook handler

### Loyalty Program (`/api/loyalty`)
- `GET /api/loyalty/rewards` - List available rewards
- `POST /api/loyalty/redeem` - Redeem a reward
- `GET /api/loyalty/redemptions` - List user's redemptions
- `GET /api/loyalty/balance` - Get user's loyalty balance

### Catalog (`/api/catalog`)
- `GET /api/catalog/services` - List services/products
- `POST /api/catalog/services` - Create new service (admin only)
- `PUT /api/catalog/services/{id}` - Update service (admin only)
- `DELETE /api/catalog/services/{id}` - Delete service (admin only)

### Business Reports (`/api/reports`) - Staff/Admin Only
- `GET /api/reports/business-summary` - Business metrics summary
- `GET /api/reports/revenue-chart` - Revenue chart data
- `GET /api/reports/top-services` - Top performing services
- `GET /api/reports/loyalty-stats` - Loyalty program statistics
- `GET /api/reports/customer-segments` - Customer segmentation analysis

### Notifications (`/api/notifications`)
- `GET /api/notifications/my` - Get user's notifications
- `POST /api/notifications/{id}/read` - Mark notification as read
- `POST /api/notifications/read-all` - Mark all notifications as read
- `GET /api/notifications/unread-count` - Get unread notification count
- `DELETE /api/notifications/{id}` - Delete notification
- `POST /api/notifications/send` - Send notification (admin only)
- `GET /api/notifications/admin/all` - List all notifications (admin only)
- `GET /api/notifications/admin/stats` - Notification statistics (admin only)

### Subscriptions (`/api/subscriptions`)
- `GET /api/subscriptions/plans` - List subscription plans
- `POST /api/subscriptions/setup-subscription` - Setup subscription
- `POST /api/subscriptions/cancel-subscription` - Cancel subscription
- `GET /api/subscriptions/subscription-status` - Get subscription status
- `POST /api/subscriptions/webhook/yoco-subscription` - Subscription webhook

### Business Onboarding (`/api/onboarding`)
- `POST /api/onboarding/create-business` - Create new business account
- `GET /api/onboarding/status` - Get onboarding progress
- `POST /api/onboarding/complete-step` - Complete onboarding step

### Health Checks
- `GET /health/` - Basic health check
- `GET /health/detailed` - Detailed system health
- `GET /health/ready` - Readiness probe (Kubernetes)
- `GET /health/live` - Liveness probe (Kubernetes)
- `GET /health/metrics` - Application metrics

## Data Models

### User
```json
{
  "id": 1,
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "phone": "+27123456789",
  "role": "user",
  "tenant_id": "business123",
  "onboarded": true,
  "created_at": "2025-01-01T00:00:00Z"
}
```

### Order
```json
{
  "id": 1,
  "service_id": 1,
  "user_id": 1,
  "tenant_id": "business123",
  "amount": 5000,
  "status": "completed",
  "type": "paid",
  "quantity": 1,
  "extras": [],
  "created_at": "2025-01-01T00:00:00Z",
  "service": {
    "id": 1,
    "name": "Basic Wash",
    "category": "wash",
    "base_price": 5000
  }
}
```

### Customer Overview
```json
{
  "id": 1,
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone": "+27123456789",
  "joined_date": "2024-01-01T00:00:00Z",
  "total_visits": 15,
  "total_spent": 75000,
  "loyalty_points": 150,
  "last_visit": "2025-01-01T00:00:00Z"
}
```

### Business Summary
```json
{
  "revenue": {
    "current": 150000,
    "prev_period": 120000,
    "percent_change": 25.0
  },
  "orders": {
    "current": 45,
    "prev_period": 38,
    "percent_change": 18.4
  },
  "customers": {
    "unique_count": 32,
    "new_customers": 8,
    "new_customer_change": 14.3
  },
  "loyalty": {
    "redemptions": 12,
    "redemption_change": 9.1,
    "points_redeemed": 450
  }
}
```

## Error Responses

### Standard Error Format
```json
{
  "detail": "Error message",
  "status_code": 400,
  "error_type": "validation_error"
}
```

### Common HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Rate Limiting
- Default: 100 requests per minute per IP
- Authenticated users: 300 requests per minute
- Premium subscribers: 1000 requests per minute

## Pagination
List endpoints support pagination with query parameters:
- `limit` - Number of items per page (default: 50, max: 100)
- `offset` - Number of items to skip (default: 0)

## Filtering and Sorting
Many list endpoints support:
- `search` - Text search across relevant fields
- `sort_by` - Field to sort by
- `sort_dir` - Sort direction ("asc" or "desc")

## Webhooks
The system supports webhooks for real-time updates:
- Payment status changes
- Order completions
- Subscription events
- Loyalty redemptions

## Multi-Tenant Support
The API is designed for multi-tenancy:
- Tenant context is determined by domain or X-Tenant-ID header
- All data is automatically scoped to the appropriate tenant
- Cross-tenant data access is prevented

## Business Verticals Supported
- Car Wash (`carwash`)
- Padel Courts (`padel`)
- Beauty Salon (`beauty`)
- Flower Shop (`flowershop`)
- Dispensary (`dispensary`)

Each vertical has specialized features and default configurations.

## Security Features
- JWT-based authentication
- Rate limiting
- Input validation
- SQL injection prevention
- Cross-tenant data isolation
- Webhook signature verification

## SDK and Examples
For frontend integration examples, see the Frontend Integration Guide.

For testing and development, see the Launch Features Testing Guide.
