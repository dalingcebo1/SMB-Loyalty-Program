# Business Logic Specification - Multi-Vertical Multi-Tenant Platform

**Document Version:** 1.0  
**Date:** November 30, 2025  
**Status:** Draft  
**Classification:** Confidential - Internal Use Only

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Business Context](#business-context)
3. [Core Business Rules](#core-business-rules)
4. [Tenant Management](#tenant-management)
5. [Vertical-Specific Logic](#vertical-specific-logic)
6. [Loyalty Program Rules](#loyalty-program-rules)
7. [Payment & Billing](#payment--billing)
8. [User Management & Permissions](#user-management--permissions)
9. [Data Isolation & Privacy](#data-isolation--privacy)
10. [White-Label & Branding](#white-label--branding)
11. [Domain Management](#domain-management)
12. [Subscription & Plans](#subscription--plans)
13. [Notifications & Communications](#notifications--communications)
14. [Analytics & Reporting](#analytics--reporting)
15. [Compliance & Audit](#compliance--audit)

---

## Executive Summary

This document defines the business logic and rules for the SMB Loyalty Program multi-vertical, multi-tenant SaaS platform. The platform enables businesses across different verticals (car wash, dispensary, padel, flower shop, beauty) to run white-label loyalty programs with their own branding, domains, and business rules.

**Key Principles:**
- **Tenant Isolation:** Each tenant's data is completely isolated
- **Vertical Flexibility:** Business rules adapt to vertical requirements
- **White-Label:** Each tenant appears as independent brand
- **Compliance:** Vertical-specific regulations (e.g., dispensary compliance)
- **Scalability:** Support thousands of tenants on shared infrastructure

---

## Business Context

### Platform Vision

Transform from single-vertical loyalty tool to **enterprise-grade multi-vertical SaaS platform** serving:
- Small businesses (1-5 locations)
- Regional chains (5-50 locations)
- Enterprise franchises (50+ locations)
- Multiple business verticals simultaneously

### Target Customers

| Tier | Characteristics | Monthly Volume | Support Level |
|------|----------------|----------------|---------------|
| Starter | 1 location, <500 customers | <1,000 transactions | Email only |
| Growth | 2-5 locations, 500-5,000 customers | 1K-10K transactions | Email + Chat |
| Professional | 6-25 locations, 5K-25K customers | 10K-100K transactions | Priority support |
| Enterprise | 25+ locations, 25K+ customers | 100K+ transactions | Dedicated CSM |

### Revenue Model

1. **Subscription-Based Pricing**
   - Monthly/Annual billing per tenant
   - Tiered pricing based on features and volume
   - Volume discounts for enterprise

2. **Transaction Fees**
   - Optional: % of loyalty redemptions
   - Payment processing fees (if using integrated payments)

3. **Professional Services**
   - Custom vertical development
   - Data migration services
   - Custom integrations

4. **Add-Ons**
   - Advanced analytics
   - SMS notifications
   - Custom domain SSL
   - API access for integrations

---

## Core Business Rules

### BR-001: Tenant Lifecycle

**Rule:** Every tenant progresses through defined lifecycle stages.

**States:**
1. **Pending** - Signed up but not activated
2. **Trial** - Active trial period (14-30 days)
3. **Active** - Paid subscription active
4. **Suspended** - Payment failed or policy violation
5. **Cancelled** - Requested cancellation (grace period)
6. **Archived** - Fully deactivated (data retained per policy)

**Transitions:**
```
Pending → Trial (admin approval or auto-approval)
Trial → Active (payment method added + subscription activated)
Trial → Cancelled (trial expired without payment)
Active → Suspended (payment failure after 3 attempts)
Suspended → Active (payment resolved within 30 days)
Suspended → Cancelled (unresolved after 30 days)
Cancelled → Archived (after data retention period)
```

**Business Logic:**
- Trial period: Default 14 days, configurable per plan
- Grace period after suspension: 7 days
- Data retention after cancellation: 90 days
- Archived tenant data deleted after: 1 year (except legal holds)

---

### BR-002: Tenant Provisioning

**Rule:** New tenants must be fully provisioned before accepting traffic.

**Provisioning Steps:**
1. **Tenant Record Creation**
   - Generate unique tenant_id (slug-safe)
   - Assign vertical_type
   - Initialize config JSON
   - Set default loyalty_type

2. **Schema Creation** (if schema-per-tenant)
   - Create PostgreSQL schema: `tenant_{tenant_id}`
   - Clone table structures
   - Apply vertical-specific tables
   - Set up indexes

3. **Admin User Creation**
   - Create first admin user
   - Send welcome email with setup link
   - Generate one-time activation token (24hr expiry)

4. **Default Data Seeding**
   - Create default loyalty program
   - Seed vertical-specific defaults (e.g., wash packages)
   - Create default notification templates
   - Initialize analytics dashboard

5. **Domain Configuration**
   - Assign subdomain: `{tenant_id}.smbloyalty.com`
   - Support custom domain addition
   - Generate SSL certificate

**Time Constraints:**
- Provisioning must complete within 5 minutes
- User receives confirmation email within 2 minutes
- Dashboard accessible within 10 minutes

**Rollback Policy:**
- If any step fails, rollback entire tenant creation
- Log failure for manual review
- Notify operations team for critical failures

---

### BR-003: Data Isolation

**Rule:** Tenant data MUST be completely isolated from other tenants.

**Isolation Mechanisms:**

1. **Database Level**
   - All queries MUST include `tenant_id` filter
   - Database triggers prevent cross-tenant data access
   - Separate schemas per tenant (production)
   - Audit log for cross-tenant access attempts

2. **Application Level**
   - Middleware enforces tenant context on every request
   - ORM queries automatically scoped by tenant_id
   - API responses filtered by tenant
   - File uploads segregated by tenant

3. **Cache Level**
   - Cache keys prefixed with tenant_id
   - Tenant-specific cache invalidation
   - No shared cache entries between tenants

**Validation:**
- Automated tests verify tenant isolation
- Quarterly security audits
- Penetration testing includes tenant boundary testing

**Incident Response:**
- Data leak across tenants = P0 incident
- Immediate investigation and remediation
- Customer notification per GDPR requirements
- Incident report within 24 hours

---

## Tenant Management

### BR-100: Tenant Creation

**Business Logic:**

**Self-Service Signup:**
1. User provides: business name, email, vertical, region
2. System generates unique tenant_id from business name
3. Validates email domain (no disposable email providers)
4. Creates tenant in "Pending" state
5. Sends verification email
6. Upon email verification → moves to "Trial"

**Admin-Created Tenants:**
1. Platform admin creates tenant via admin panel
2. Immediately set to "Trial" or "Active"
3. Bypass email verification
4. Admin can override default settings

**Validation Rules:**
- Business name: 3-100 characters, unique per vertical
- Email: Valid format, not already registered
- Vertical: Must be one of supported types
- Subdomain: Auto-generated, alphanumeric + hyphens only

---

### BR-101: Tenant Configuration

**Rule:** Each tenant has flexible configuration via JSON config field.

**Config Structure:**
```json
{
  "features": {
    "enable_points": true,
    "enable_stamps": false,
    "enable_tiers": true,
    "enable_referrals": true,
    "enable_sms": false,
    "enable_qr_checkin": true,
    "enable_online_ordering": false
  },
  "limits": {
    "max_locations": 5,
    "max_staff": 25,
    "max_monthly_transactions": 10000,
    "api_rate_limit": "100/minute"
  },
  "integrations": {
    "pos_system": "square",
    "email_provider": "sendgrid",
    "sms_provider": null,
    "accounting": null
  },
  "vertical_settings": {
    "carwash": {
      "enable_vehicle_tracking": true,
      "enable_package_subscriptions": true
    }
  },
  "branding": {
    "primary_color": "#1E40AF",
    "secondary_color": "#3B82F6",
    "logo_url": "https://cdn.smbloyalty.com/tenants/acme/logo.png",
    "favicon_url": "https://cdn.smbloyalty.com/tenants/acme/favicon.ico"
  }
}
```

**Feature Flags:**
- Features can be enabled/disabled per plan tier
- Some features require add-ons (e.g., SMS)
- Enterprise can request custom features

**Limits Enforcement:**
- Hard limits prevent usage beyond plan
- Soft limits warn when approaching threshold
- Automatic upgrade prompts when limit reached

---

### BR-102: Tenant Suspension & Reactivation

**Suspension Triggers:**
1. **Payment Failure**
   - First failed payment: Retry in 3 days
   - Second failed payment: Retry in 3 days + warning email
   - Third failed payment: Suspend tenant
   - Access limited to admin panel (read-only)
   - Customer-facing features disabled

2. **Policy Violation**
   - Fraudulent activity detected
   - Terms of service violation
   - Immediate suspension
   - Investigation by compliance team

3. **Manual Suspension**
   - Platform admin can suspend any tenant
   - Requires documented reason
   - Customer notified within 1 hour

**Suspended Tenant Behavior:**
- Admin can login (read-only access)
- Customer-facing app shows "Service Unavailable" message
- API returns 503 Service Unavailable
- Scheduled jobs paused
- Data remains intact

**Reactivation Process:**
1. Resolve suspension reason (payment updated, issue resolved)
2. Platform admin or automated system reactivates
3. Send reactivation confirmation email
4. Customer-facing services immediately available
5. Resume scheduled jobs

---

## Vertical-Specific Logic

### BR-200: Car Wash Vertical

**Business Rules:**

1. **Vehicle Tracking**
   - Customers can register multiple vehicles
   - Vehicle identified by license plate + make/model
   - QR code generated per vehicle
   - Vehicle history tracked (washes, packages, visits)

2. **Wash Packages**
   - Multi-tier packages (Basic, Premium, Ultimate)
   - Package includes specific services
   - Pricing per package
   - Upsell additional services

3. **Membership Subscriptions**
   - Unlimited washes per month for flat fee
   - Different tiers (e.g., Basic Membership, Premium Membership)
   - Auto-renewal on billing cycle
   - Cancellation requires 30-day notice

4. **Service Tracking**
   - Log each wash: timestamp, package, services, staff member
   - Track service duration and quality metrics
   - Generate wash completion QR code for customer verification

**Data Model:**
```sql
-- Car Wash specific tables in tenant schema
vehicles (
  id, tenant_id, customer_id, 
  license_plate, make, model, color, year,
  qr_code, last_wash_date, total_washes
)

wash_packages (
  id, tenant_id, name, description,
  services JSON, price_cents, duration_minutes
)

wash_history (
  id, tenant_id, vehicle_id, customer_id,
  package_id, services JSON, completed_at,
  staff_id, location_id, duration_minutes
)

memberships (
  id, tenant_id, customer_id, tier,
  monthly_price_cents, start_date, end_date,
  auto_renew, cancellation_date, status
)
```

---

### BR-201: Dispensary Vertical

**Business Rules:**

1. **Compliance Requirements**
   - Age verification mandatory (21+ in most jurisdictions)
   - Track purchase limits per customer per day
   - Log all transactions for regulatory reporting
   - Integrate with state compliance systems (e.g., METRC)

2. **Product Restrictions**
   - THC/CBD percentage tracking
   - Purchase quantity limits (e.g., 28g flower per day)
   - Product type restrictions by customer type (medical vs recreational)
   - Banned product list per jurisdiction

3. **Medical Card Verification**
   - Medical card number validation
   - Expiration date tracking
   - Different limits for medical cardholders
   - Privacy-protected storage of medical info

4. **Loyalty Restrictions**
   - Cannot offer "free" cannabis products
   - Loyalty points redeemable for discounts only
   - Compliance reporting on loyalty program usage

**Data Model:**
```sql
customer_verification (
  id, tenant_id, customer_id,
  verification_method, verified_at,
  age_verified, medical_card_number,
  medical_card_expiry, jurisdiction
)

compliance_log (
  id, tenant_id, transaction_id,
  customer_id, product_id, quantity,
  thc_percentage, transaction_type,
  compliance_system_id, reported_at
)

purchase_limits (
  id, tenant_id, customer_id,
  date, product_category, quantity_grams,
  limit_remaining, resets_at
)
```

**Compliance Logic:**
- Check daily limits before allowing purchase
- Auto-submit reports to state systems
- Alert management when approaching reporting deadlines
- Monthly compliance audit reports

---

### BR-202: Padel Vertical

**Business Rules:**

1. **Court Booking System**
   - Time slot management (e.g., 1-hour blocks)
   - Court availability real-time tracking
   - Advance booking limits (e.g., 7 days ahead)
   - Cancellation policies (e.g., 24hr notice)

2. **Membership & Pricing**
   - Member vs non-member pricing
   - Peak vs off-peak pricing
   - Group bookings (doubles, tournaments)
   - Package deals (e.g., 10 sessions)

3. **Tournament Management**
   - Tournament bracket creation
   - Player registration and teams
   - Match scheduling across courts
   - Scoring and results tracking

4. **Equipment Rental**
   - Racquet rental inventory
   - Ball purchase tracking
   - Equipment damage deposits

**Data Model:**
```sql
courts (
  id, tenant_id, name, location,
  surface_type, indoor_outdoor, status
)

bookings (
  id, tenant_id, court_id, customer_id,
  start_time, end_time, booking_type,
  price_cents, status, cancellation_time
)

tournaments (
  id, tenant_id, name, format,
  start_date, end_date, max_participants,
  entry_fee_cents, prize_pool_cents
)
```

---

### BR-203: Flower Shop Vertical

**Business Rules:**

1. **Product Catalog**
   - Seasonal products (flowers, plants)
   - Inventory tracking with expiration dates
   - Product bundles and arrangements
   - Custom arrangement requests

2. **Delivery Management**
   - Delivery zones with distance-based pricing
   - Time slot preferences (morning/afternoon)
   - Special delivery instructions
   - Driver assignment and routing

3. **Event Pre-Orders**
   - Wedding/event advance ordering
   - Deposit requirements for large orders
   - Consultation scheduling
   - Order modification deadlines

4. **Subscription Service**
   - Weekly/monthly flower subscriptions
   - Recurring deliveries
   - Subscription customization (preferences)

**Data Model:**
```sql
products (
  id, tenant_id, name, category,
  seasonal_availability JSON, price_cents,
  stock_quantity, expiration_tracking
)

deliveries (
  id, tenant_id, order_id,
  delivery_zone, delivery_date, time_slot,
  address, special_instructions,
  driver_id, status, completed_at
)

subscriptions (
  id, tenant_id, customer_id,
  frequency, preferences JSON,
  delivery_address, next_delivery_date,
  status, start_date
)
```

---

### BR-204: Beauty Vertical

**Business Rules:**

1. **Service Booking**
   - Appointment scheduling with staff
   - Service duration estimation
   - Back-to-back booking prevention (buffer time)
   - Client preferences (staff, services)

2. **Service Catalog**
   - Services with duration and pricing
   - Service bundles/packages
   - Add-on services
   - Seasonal promotions

3. **Client History**
   - Service history tracking
   - Product preferences and allergies
   - Before/after photos (with consent)
   - Personalized recommendations

4. **Staff Management**
   - Staff scheduling and availability
   - Service specializations
   - Commission tracking
   - Performance metrics

**Data Model:**
```sql
services (
  id, tenant_id, name, category,
  duration_minutes, price_cents,
  staff_ids JSON, description
)

appointments (
  id, tenant_id, customer_id, staff_id,
  service_id, start_time, end_time,
  status, notes, completed_at
)

client_profiles (
  id, tenant_id, customer_id,
  preferences JSON, allergies TEXT,
  service_history JSON, photos JSON
)
```

---

## Loyalty Program Rules

### BR-300: Points-Based Loyalty

**Earning Rules:**

1. **Purchase-Based Earning**
   - Base rate: 1 point per $1 spent (configurable)
   - Bonus multipliers for special events (2x Tuesdays)
   - Tier-based multipliers (Gold members: 1.5x)
   - Promotional campaigns (500 bonus points)

2. **Activity-Based Earning**
   - Sign-up bonus: 100 points
   - Referral bonus: 250 points per referred customer
   - Social media share: 50 points
   - Birthday bonus: 200 points
   - Review submission: 100 points

3. **Earning Limits**
   - Daily earning cap (optional, e.g., 5,000 points/day)
   - Promotional point expiry (e.g., bonus points expire in 90 days)
   - Activity earning throttles (e.g., max 1 review per order)

**Redemption Rules:**

1. **Point Value**
   - Redemption rate: 100 points = $1 discount (configurable)
   - Minimum redemption: 500 points
   - Maximum redemption per transaction: 50% of order value

2. **Redemption Restrictions**
   - Cannot redeem on already-discounted items
   - Cannot combine with certain promotions
   - Cannot redeem for cash
   - Cannot transfer points between customers

3. **Point Expiration**
   - Standard expiration: 2 years from earning date
   - Tier-based extensions (Platinum: no expiry)
   - Expiration warnings: 60 days, 30 days, 7 days before expiry

**Point Adjustment:**
- Returns: Deduct earned points from returned order
- Fraud: Admin can manually adjust points (with audit log)
- Compensation: Admin can award bonus points for service recovery

---

### BR-301: Stamp Card Loyalty

**Business Rules:**

1. **Card Creation**
   - Define number of stamps required (e.g., 10 stamps)
   - Define reward earned when card completed
   - Multiple card types per tenant (e.g., "Buy 10 Get 1 Free")

2. **Stamp Earning**
   - 1 stamp per qualifying transaction
   - Bonus stamps for higher-value purchases
   - Time-based restrictions (e.g., max 1 stamp per day)

3. **Reward Redemption**
   - Automatic reward issuance when card completed
   - Manual redemption by customer
   - Reward expiration (e.g., 30 days after earning)

4. **Card Expiration**
   - Cards expire if incomplete after X days
   - Warning notifications before expiry
   - Partial completion preserved (don't reset to 0)

**Data Model:**
```sql
stamp_cards (
  id, tenant_id, customer_id,
  card_type, stamps_earned, stamps_required,
  completed_at, reward_claimed, expires_at
)

stamp_transactions (
  id, tenant_id, stamp_card_id,
  transaction_id, stamps_earned,
  earned_at, bonus_reason
)
```

---

### BR-302: Tier-Based Loyalty

**Tier Structure:**

| Tier | Requirement | Benefits |
|------|-------------|----------|
| Bronze | 0-999 points | 1x points, standard service |
| Silver | 1,000-4,999 points | 1.25x points, 5% discount |
| Gold | 5,000-19,999 points | 1.5x points, 10% discount, priority booking |
| Platinum | 20,000+ points | 2x points, 15% discount, exclusive access, no expiry |

**Tier Advancement:**
- Evaluated monthly based on rolling 12-month activity
- Advancement immediate when threshold reached
- Demotion only at end of evaluation period (prevents yo-yo effect)

**Tier Maintenance:**
- Must maintain point threshold to retain tier
- Grace period: 1 month below threshold before demotion
- Re-advancement immediate if threshold regained

**Tier Benefits:**
- Point multipliers apply automatically
- Discounts applied at checkout
- Priority booking via dedicated scheduling
- Exclusive product access via feature flags

---

## Payment & Billing

### BR-400: Payment Processing

**Supported Payment Methods:**
1. Credit/Debit Cards (Stripe/Yoco)
2. Digital Wallets (Apple Pay, Google Pay)
3. Bank Transfer (for invoiced enterprise)
4. Loyalty Points redemption

**Payment Flow:**

1. **Customer Checkout**
   - Calculate order total
   - Apply available discounts and loyalty points
   - Display final amount
   - Collect payment method
   - Authorize payment (don't capture yet)

2. **Payment Authorization**
   - Validate payment method
   - Check fraud signals
   - Hold funds (authorization)
   - Generate transaction ID
   - Create order record

3. **Payment Capture**
   - Capture authorized payment after order fulfillment
   - For services: capture after service completion
   - For products: capture after shipment
   - For subscriptions: capture immediately

4. **Failed Payment Handling**
   - Retry failed payments 3 times (24hr intervals)
   - Notify customer of failure
   - Suspend subscription if all retries fail
   - Provide grace period to update payment method

**Refund Logic:**
- Full refund: Return payment + restore loyalty points
- Partial refund: Proportional point restoration
- Refund window: Within 30 days of purchase
- Automated refunds for technical errors

---

### BR-401: Subscription Billing

**Billing Cycles:**
- Monthly: Billed on same day each month
- Annual: Billed annually with discount (e.g., 2 months free)
- Custom: Enterprise contracts can specify custom cycles

**Subscription States:**
```
Trial → Active → Past Due → Cancelled
         ↓          ↓
      Active ←  Suspended
```

**Billing Logic:**

1. **Trial Period**
   - No charges during trial
   - Collect payment method upfront (authorize $1, release)
   - Convert to paid on trial end
   - Cancel if no payment method

2. **Active Subscription**
   - Bill on renewal date
   - Pro-rated upgrades (immediate charge for difference)
   - Downgrades effective at next billing cycle
   - Usage-based add-ons calculated monthly

3. **Failed Payment**
   - State → Past Due
   - Retry 3 times over 10 days
   - Dunning emails at days 1, 5, 10
   - Suspend after final failure
   - Allow 30 days to recover before cancellation

4. **Cancellation**
   - Customer-initiated: Effective end of billing period
   - Admin-initiated: Immediate cancellation
   - Refund policy: Pro-rated for annual subscriptions
   - Data retention: 90 days before archive

---

### BR-402: Usage-Based Billing

**Metered Services:**
- API calls (per 1,000 requests)
- SMS notifications (per message)
- Email sends (per email)
- Storage (per GB)
- Transaction fees (% of GMV)

**Metering Logic:**
1. Track usage in real-time
2. Aggregate daily totals
3. Calculate monthly bill at cycle end
4. Add to subscription invoice
5. Enforce soft/hard limits

**Overage Handling:**
- Soft limit: Warning email at 80% of quota
- Hard limit: Service throttled or blocked
- Automatic upgrade prompts
- Overage fees for excessive usage

---

## User Management & Permissions

### BR-500: User Roles

**Role Hierarchy:**

1. **Platform Admin** (System-level)
   - Full access to all tenants
   - Can create/delete/modify tenants
   - Access to platform analytics
   - System configuration

2. **Tenant Owner** (Tenant-level)
   - Full access to their tenant
   - Can manage admins and staff
   - Billing and subscription management
   - Cannot delete tenant (must contact support)

3. **Tenant Admin** (Tenant-level)
   - Manage tenant configuration
   - Manage staff users
   - View all reports
   - Cannot access billing

4. **Staff Manager** (Tenant-level)
   - Manage staff schedules
   - View staff performance
   - Limited configuration access
   - Cannot manage users

5. **Staff** (Tenant-level)
   - Process customer transactions
   - View customer profiles
   - Log activities
   - No configuration access

6. **Customer** (Tenant-level)
   - View own profile and history
   - Redeem loyalty rewards
   - Book appointments/services
   - No admin access

**Permission Matrix:**

| Action | Platform Admin | Owner | Admin | Staff Mgr | Staff | Customer |
|--------|---------------|-------|-------|-----------|-------|----------|
| Create Tenant | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Delete Tenant | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Manage Billing | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Manage Config | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Manage Users | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ |
| Process Transaction | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| View Analytics | ✅ | ✅ | ✅ | ✅* | ❌ | ❌ |
| Redeem Rewards | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

*Limited scope

---

### BR-501: Authentication & Authorization

**Authentication Methods:**

1. **Email + Password**
   - Minimum password requirements: 12 characters, 1 uppercase, 1 lowercase, 1 number
   - Password hashing: bcrypt with salt
   - Rate limiting: 5 failed attempts = 15-minute lockout
   - Password reset via email (token expires in 1 hour)

2. **Social Login** (Customers only)
   - Google OAuth
   - Facebook Login
   - Apple Sign-In
   - Linked to email address (auto-merge if email matches)

3. **SSO/SAML** (Enterprise only)
   - SAML 2.0 integration
   - Okta, Azure AD, OneLogin support
   - JIT provisioning
   - Attribute mapping

4. **API Keys** (Integrations)
   - API key per integration
   - Scoped permissions
   - Rotation policy: 90 days
   - Rate limiting per key

**Authorization Logic:**
- Capability-based (not role-based)
- Each endpoint checks required capabilities
- Capabilities assigned to roles
- Custom capabilities for enterprise

**Session Management:**
- JWT tokens with 24hr expiry
- Refresh token for 30 days
- Revoke tokens on logout
- Concurrent session limit: 5 per user

---

### BR-502: Multi-Factor Authentication

**MFA Requirements:**
- Mandatory for Platform Admins
- Optional for Tenant Owners/Admins
- Enforced for high-risk actions (billing changes)

**MFA Methods:**
1. TOTP (Google Authenticator, Authy)
2. SMS codes (fallback)
3. Email codes (fallback)
4. Recovery codes (one-time use)

**MFA Workflow:**
1. User enables MFA in account settings
2. Generate QR code for TOTP setup
3. Verify setup with test code
4. Provide 10 recovery codes (print/download)
5. Require MFA on every login
6. Remember device for 30 days (optional)

---

## Data Isolation & Privacy

### BR-600: Data Privacy

**Personal Data Classification:**

| Category | Examples | Retention | Encryption |
|----------|----------|-----------|------------|
| PII | Name, email, phone | As long as account active + 90 days | At rest + in transit |
| Financial | Payment methods, transaction history | 7 years (compliance) | At rest + in transit + tokenization |
| Health | Medical card info (dispensary) | As long as active + legal requirement | At rest + in transit + field-level |
| Usage | Analytics, logs | 2 years | In transit only |

**Data Subject Rights (GDPR/CCPA):**

1. **Right to Access**
   - Customer can download all their data
   - JSON export within 30 days
   - Includes: profile, transactions, loyalty history

2. **Right to Rectification**
   - Customer can update profile information
   - Request admin correction of incorrect data
   - Audit log of changes

3. **Right to Erasure**
   - "Delete my account" feature
   - Anonymize PII (keep transaction data for business records)
   - Complete deletion after retention period
   - Cannot delete if legal hold

4. **Right to Portability**
   - Export data in machine-readable format (JSON)
   - API endpoint for data export
   - Include loyalty points balance

5. **Right to Object**
   - Opt-out of marketing communications
   - Opt-out of data analytics
   - Restrict processing for specific purposes

**Data Processing Agreements:**
- DPA with each tenant
- Tenant is data controller
- Platform is data processor
- Sub-processor agreements (e.g., email provider)

---

### BR-601: Data Retention & Deletion

**Retention Policies:**

1. **Active Customer Data**
   - Retained while customer has account
   - Regular backups (7-day retention)
   - No automatic deletion

2. **Inactive Customer Data**
   - Inactive = No activity for 2 years
   - Warning email at 18 months
   - Anonymize after 2 years
   - Keep transaction records (anonymized)

3. **Cancelled Tenant Data**
   - Grace period: 90 days
   - Full backup provided to tenant
   - Soft delete (marked deleted, not physically removed)
   - Physical deletion after 1 year

4. **Compliance Data**
   - Financial records: 7 years
   - Audit logs: 5 years
   - Legal hold: Indefinite until released

**Deletion Process:**
1. Soft delete: Set `deleted_at` timestamp
2. Anonymization: Replace PII with placeholder
3. Physical delete: Remove row from database
4. Backup purge: Remove from backup rotation

---

## White-Label & Branding

### BR-700: Tenant Branding

**Branding Elements:**

1. **Visual Identity**
   - Logo (light/dark variants)
   - Primary color
   - Secondary color
   - Accent color
   - Font family (Google Fonts)

2. **Domain Configuration**
   - Default: `{tenant_id}.smbloyalty.com`
   - Custom domain: `loyalty.acmecarwash.com`
   - Wildcard subdomain support: `*.acmecarwash.com`
   - SSL certificate auto-provisioning

3. **Content Customization**
   - Welcome message
   - Terms of service
   - Privacy policy
   - Email templates
   - SMS templates

**Branding Rules:**
- All customer-facing UI uses tenant branding
- Platform branding never shown to customers
- Admin panel shows platform branding
- Emails use tenant branding + powered by footer

---

### BR-701: Theme System

**Theme Structure:**

1. **Pre-built Themes**
   - Light theme (default)
   - Dark theme
   - High contrast (accessibility)
   - Mobile-optimized

2. **Custom Themes**
   - CSS variable system
   - Color palette generator
   - Typography settings
   - Spacing/sizing scale
   - Border radius configuration

3. **Theme Preview**
   - Live preview before applying
   - Desktop/mobile/tablet views
   - Revert to previous theme

**Theme Application:**
- Changes apply immediately (no deploy)
- Cached on CDN (5-minute TTL)
- Fallback to default theme on error

---

## Domain Management

### BR-800: Domain Configuration

**Domain Types:**

1. **Platform Subdomain**
   - Format: `{tenant_id}.smbloyalty.com`
   - Automatically provisioned
   - SSL included
   - Cannot be removed (primary domain)

2. **Custom Domain**
   - Customer provides domain
   - DNS verification required
   - SSL auto-provisioning via Let's Encrypt
   - Can have multiple custom domains per tenant

3. **Wildcard Domain**
   - Format: `*.acmecarwash.com`
   - Supports multi-location tenants
   - Each location gets subdomain
   - Requires enterprise plan

**Domain Verification:**

1. **DNS Verification**
   - Customer adds TXT record: `_smbloyalty-verify.acmecarwash.com`
   - Value: Generated verification token
   - Platform checks DNS every 5 minutes
   - Auto-activate when verified

2. **File Verification**
   - Upload file to: `/.well-known/smbloyalty-verify.txt`
   - Content: Generated verification token
   - Platform fetches file via HTTP
   - Auto-activate when verified

**Domain Status:**
- Pending: Awaiting verification
- Verified: DNS verified, SSL pending
- Active: SSL provisioned, traffic routing
- Failed: Verification failed (retry or contact support)

---

## Subscription & Plans

### BR-900: Plan Tiers

**Starter Plan** - $49/month
- Features:
  - 1 location
  - Up to 500 customers
  - 1,000 transactions/month
  - Basic loyalty (points OR stamps)
  - Email notifications
  - Standard support (email only)
- Limits:
  - 2 admin users
  - 5 staff users
  - 10GB storage
  - Standard API rate limit

**Growth Plan** - $149/month
- Features:
  - Up to 5 locations
  - Up to 5,000 customers
  - 10,000 transactions/month
  - Advanced loyalty (points AND stamps, tiers)
  - Email + SMS notifications
  - Priority support (email + chat)
- Limits:
  - 5 admin users
  - 25 staff users
  - 50GB storage
  - Increased API rate limit

**Professional Plan** - $449/month
- Features:
  - Up to 25 locations
  - Up to 25,000 customers
  - 100,000 transactions/month
  - Full loyalty features
  - All notification channels
  - Analytics dashboard
  - API access
  - Priority support
- Limits:
  - 15 admin users
  - 100 staff users
  - 250GB storage
  - Higher API rate limit

**Enterprise Plan** - Custom pricing
- Features:
  - Unlimited locations
  - Unlimited customers
  - Unlimited transactions
  - Custom features
  - Dedicated account manager
  - SLA guarantees (99.9% uptime)
  - Custom integrations
  - SSO/SAML
- Limits:
  - Negotiated per contract

**Add-Ons:**
- SMS Credits: $0.05/message
- Advanced Analytics: $99/month
- Custom Domain SSL: Free (included)
- API Access (Starter/Growth): $49/month
- White Glove Onboarding: $999 one-time

---

## Notifications & Communications

### BR-1000: Notification Rules

**Notification Types:**

1. **Transactional** (Cannot opt-out)
   - Purchase confirmation
   - Appointment confirmation/reminder
   - Password reset
   - Account security alerts
   - Billing notices

2. **Loyalty Updates** (Can opt-out)
   - Points earned notification
   - Reward unlocked
   - Tier upgrade
   - Points expiring soon

3. **Marketing** (Opt-in required)
   - Promotional offers
   - New product announcements
   - Event invitations
   - Newsletter

**Notification Channels:**

1. **Email**
   - Default for all notification types
   - HTML + plain text versions
   - Unsubscribe link in footer
   - Bounce handling

2. **SMS**
   - Requires customer phone number + opt-in
   - Paid add-on for tenant
   - Character limit: 160
   - Delivery receipts tracked

3. **Push Notifications** (Future)
   - Requires mobile app
   - Opt-in per device
   - Rich notifications with actions

4. **In-App Notifications**
   - Bell icon with unread count
   - Notification center
   - Mark as read functionality

**Frequency Limits:**
- Marketing emails: Max 3 per week
- SMS: Max 1 per day
- Push: Max 5 per day
- In-app: No limit

---

## Analytics & Reporting

### BR-1100: Tenant Analytics

**Key Metrics:**

1. **Customer Metrics**
   - Total customers
   - Active customers (30-day activity)
   - New customers (period)
   - Customer lifetime value (LTV)
   - Churn rate

2. **Transaction Metrics**
   - Total transactions
   - Gross merchandise value (GMV)
   - Average order value (AOV)
   - Transactions per customer
   - Revenue by location

3. **Loyalty Metrics**
   - Points issued
   - Points redeemed
   - Redemption rate
   - Average points balance
   - Tier distribution

4. **Engagement Metrics**
   - App/web sessions
   - Notification open rates
   - Feature adoption rates
   - Customer satisfaction score

**Reporting:**
- Real-time dashboard
- Scheduled email reports (daily, weekly, monthly)
- Export to CSV/Excel
- Custom date ranges
- Comparison vs previous period

---

## Compliance & Audit

### BR-1200: Audit Logging

**Audited Events:**

1. **Security Events**
   - User login/logout
   - Failed login attempts
   - Password changes
   - MFA enrollment/disable
   - API key generation

2. **Data Access**
   - Customer data viewed
   - Customer data exported
   - Report generation
   - Bulk data operations

3. **Configuration Changes**
   - Tenant settings modified
   - User roles changed
   - Feature flags toggled
   - Pricing changes
   - Integration configurations

4. **Financial Events**
   - Transactions processed
   - Refunds issued
   - Subscription changes
   - Payment failures

**Audit Log Fields:**
- Timestamp (UTC)
- Actor (user_id or system)
- Action (verb + resource)
- Resource ID
- Before value
- After value
- IP address
- User agent
- Tenant ID

**Retention:**
- Audit logs retained for 5 years
- Immutable (cannot be edited/deleted)
- Encrypted at rest
- Regular backups
- Available via API for SIEM integration

---

## Appendix

### Glossary

- **Tenant:** A business using the platform (customer of the SaaS platform)
- **Customer:** End-user of a tenant's loyalty program
- **Vertical:** Business type (car wash, dispensary, padel, etc.)
- **GMV:** Gross Merchandise Value - total transaction volume
- **LTV:** Lifetime Value - total revenue from a customer
- **Churn:** Rate of customer cancellation/loss
- **DPA:** Data Processing Agreement
- **PII:** Personally Identifiable Information

### Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Nov 30, 2025 | AI/Platform Team | Initial specification |

---

**Document Status:** This is a living document and will be updated as business requirements evolve.

**Feedback:** Submit feedback or questions to: product@smbloyalty.com
