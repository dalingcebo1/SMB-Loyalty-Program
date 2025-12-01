# Technical Specification: Database Schema

**Document Version:** 1.0  
**Last Updated:** December 1, 2025  
**Classification:** Confidential - Internal Use Only

---

## Table of Contents

1. [Database Architecture](#database-architecture)
2. [Migration Strategy](#migration-strategy)
3. [Schema-Per-Tenant Design](#schema-per-tenant-design)
4. [Core Tables (public schema)](#core-tables-public-schema)
5. [Tenant Tables (tenant_* schemas)](#tenant-tables-tenant_-schemas)
6. [Vertical-Specific Tables](#vertical-specific-tables)
7. [Indexes & Performance](#indexes--performance)
8. [Data Retention & Archival](#data-retention--archival)
9. [Backup & Recovery](#backup--recovery)

---

## 1. Database Architecture

### 1.1 Technology
- **DBMS:** PostgreSQL 15+
- **ORM:** SQLAlchemy 2.0+ with asyncio support
- **Migrations:** Alembic
- **Connection Pooling:** SQLAlchemy pooling (10-20 connections per worker)

### 1.2 Current State (Row-Level Isolation)
```sql
-- Every table has tenant_id
CREATE TABLE orders (
    id UUID PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    user_id UUID NOT NULL,
    -- ...
);

-- Queries always filter by tenant_id
SELECT * FROM orders WHERE tenant_id = ? AND ...;
```

**Limitations:**
- Index bloat (every table needs `tenant_id` index)
- Query complexity (always join/filter by tenant_id)
- Security risk (missing WHERE tenant_id = ? causes data leak)
- Performance degradation as data grows

### 1.3 Target State (Schema-Per-Tenant)
```sql
-- Public schema: tenant metadata only
CREATE SCHEMA public;
CREATE TABLE public.tenants (...);
CREATE TABLE public.tenant_domains (...);

-- Per-tenant schema: all tenant data
CREATE SCHEMA tenant_abc123;
CREATE TABLE tenant_abc123.orders (...);  -- No tenant_id column
CREATE TABLE tenant_abc123.users (...);

-- Queries use search_path
SET search_path TO tenant_abc123, public;
SELECT * FROM orders WHERE ...;  -- Auto-scoped to tenant
```

**Benefits:**
- Complete data isolation (impossible to leak data)
- Simpler queries (no tenant_id joins)
- Better performance (smaller indexes, no cross-tenant scans)
- Easier compliance (delete schema = delete all tenant data)

---

## 2. Migration Strategy

### 2.1 Phase 1: Parallel Write (Current)
- All writes go to row-level tables with `tenant_id`
- Reads from row-level tables
- Begin schema creation for new tenants only

### 2.2 Phase 2: Dual Write (Transition)
- New tenants → schema-per-tenant
- Existing tenants → continue row-level, background copy to schemas
- Gradually migrate tenant-by-tenant during low-traffic windows

### 2.3 Phase 3: Schema-Only (Target)
- All reads/writes from tenant schemas
- Drop row-level `tenant_id` columns
- Public schema only has tenant metadata

### 2.4 Migration Script Example
```python
async def migrate_tenant_to_schema(tenant_id: UUID, db: AsyncSession):
    """
    1. Create schema: CREATE SCHEMA tenant_{uuid}
    2. Create all tables in new schema
    3. Copy data: INSERT INTO tenant_{uuid}.orders SELECT * FROM orders WHERE tenant_id = ?
    4. Verify row counts match
    5. Update tenants table: schema_migrated = TRUE
    6. Switch application to use schema search_path
    7. Monitor for 24 hours
    8. Archive old row-level data
    """
```

---

## 3. Schema-Per-Tenant Design

### 3.1 Naming Convention
```
tenant_{tenant_uuid_without_hyphens}

Example:
tenant_id: 550e8400-e29b-41d4-a716-446655440000
schema_name: tenant_550e8400e29b41d4a716446655440000
```

### 3.2 Schema Creation Template
```sql
-- Create schema
CREATE SCHEMA IF NOT EXISTS tenant_550e8400e29b41d4a716446655440000;

-- Set ownership
ALTER SCHEMA tenant_550e8400e29b41d4a716446655440000 OWNER TO app_user;

-- Grant permissions
GRANT USAGE ON SCHEMA tenant_550e8400e29b41d4a716446655440000 TO app_user;
GRANT ALL ON ALL TABLES IN SCHEMA tenant_550e8400e29b41d4a716446655440000 TO app_user;

-- Apply schema template (users, orders, inventory, etc.)
-- See section 5 for table definitions
```

### 3.3 Search Path Management
```python
class TenantContext:
    async def set_search_path(self, db: AsyncSession):
        """Set search_path for this request"""
        await db.execute(
            text(f"SET search_path TO {self.schema_name}, public")
        )
```

---

## 4. Core Tables (public schema)

### 4.1 tenants
```sql
CREATE TABLE public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    subdomain VARCHAR(100) UNIQUE NOT NULL,
    schema_name VARCHAR(100) UNIQUE,  -- e.g., tenant_abc123
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, suspended, deleted
    subscription_tier VARCHAR(50) NOT NULL DEFAULT 'free',
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',  -- flexible config storage
    
    CONSTRAINT valid_subdomain CHECK (subdomain ~ '^[a-z0-9-]+$'),
    CONSTRAINT valid_schema_name CHECK (schema_name ~ '^tenant_[a-z0-9]+$')
);

CREATE INDEX idx_tenants_status ON public.tenants(status);
CREATE INDEX idx_tenants_subscription_expires ON public.tenants(subscription_expires_at) 
    WHERE subscription_expires_at IS NOT NULL;
```

**Key Fields:**
- `schema_name`: Points to PostgreSQL schema for this tenant's data
- `status`: Lifecycle management (active, suspended for non-payment, deleted for soft-delete)
- `subscription_tier`: free, basic, premium, enterprise
- `metadata`: Store flexible config without schema changes

---

### 4.2 tenant_domains
```sql
CREATE TABLE public.tenant_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    domain_type VARCHAR(50) NOT NULL,  -- subdomain, custom_domain
    domain_value VARCHAR(255) NOT NULL,  -- e.g., "mycarwash" or "mycarwash.com"
    is_verified BOOLEAN DEFAULT FALSE,
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(domain_value, domain_type)
);

CREATE INDEX idx_tenant_domains_lookup ON public.tenant_domains(domain_value, domain_type);
CREATE INDEX idx_tenant_domains_tenant ON public.tenant_domains(tenant_id);
```

**Purpose:** Map custom domains and subdomains to tenants for request routing.

---

### 4.3 tenant_config
```sql
CREATE TABLE public.tenant_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    config_key VARCHAR(255) NOT NULL,
    config_value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by UUID,  -- user_id who made the change
    
    UNIQUE(tenant_id, config_key)
);

CREATE INDEX idx_tenant_config_lookup ON public.tenant_config(tenant_id, config_key);
```

**Example Configs:**
```json
{
  "config_key": "branding",
  "config_value": {
    "logo_url": "https://cdn.../logo.png",
    "primary_color": "#0066CC",
    "secondary_color": "#FF6600"
  }
}

{
  "config_key": "enabled_verticals",
  "config_value": ["carwash", "loyalty", "padel"]
}

{
  "config_key": "feature_flags",
  "config_value": {
    "mobile_app": true,
    "sms_notifications": false,
    "tiered_loyalty": true
  }
}
```

---

### 4.4 vertical_registry
```sql
CREATE TABLE public.vertical_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vertical_key VARCHAR(100) UNIQUE NOT NULL,  -- carwash, dispensary, padel
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    icon_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    requires_compliance BOOLEAN DEFAULT FALSE,
    schema_version VARCHAR(20) DEFAULT '1.0',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO public.vertical_registry (vertical_key, display_name, requires_compliance) VALUES
    ('carwash', 'Car Wash', FALSE),
    ('dispensary', 'Cannabis Dispensary', TRUE),
    ('padel', 'Padel Courts', FALSE),
    ('flowershop', 'Flower Shop', FALSE),
    ('beauty', 'Beauty Salon', FALSE);
```

---

### 4.5 tenant_vertical_config
```sql
CREATE TABLE public.tenant_vertical_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    vertical_id UUID NOT NULL REFERENCES public.vertical_registry(id),
    is_enabled BOOLEAN DEFAULT TRUE,
    config JSONB DEFAULT '{}',  -- vertical-specific settings
    enabled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    enabled_by UUID,  -- user_id
    
    UNIQUE(tenant_id, vertical_id)
);

CREATE INDEX idx_tenant_vertical_tenant ON public.tenant_vertical_config(tenant_id);
```

**Example Config:**
```json
{
  "dispensary": {
    "license_number": "ABC-123",
    "age_verification_required": true,
    "delivery_enabled": false
  }
}
```

---

## 5. Tenant Tables (tenant_* schemas)

### 5.1 users
```sql
CREATE TABLE {schema}.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    firebase_uid VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    phone VARCHAR(50),
    phone_verified BOOLEAN DEFAULT FALSE,
    scope VARCHAR(50) NOT NULL DEFAULT 'end_user',  -- end_user, staff, admin
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Loyalty
    loyalty_points INTEGER DEFAULT 0,
    loyalty_tier VARCHAR(50) DEFAULT 'bronze',  -- bronze, silver, gold, platinum
    lifetime_points INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_email CHECK (email ~ '^[^@]+@[^@]+\.[^@]+$'),
    CONSTRAINT valid_scope CHECK (scope IN ('end_user', 'staff', 'admin', 'super_admin')),
    CONSTRAINT positive_points CHECK (loyalty_points >= 0)
);

CREATE INDEX idx_users_email ON {schema}.users(email);
CREATE INDEX idx_users_firebase_uid ON {schema}.users(firebase_uid);
CREATE INDEX idx_users_scope ON {schema}.users(scope);
CREATE INDEX idx_users_loyalty_tier ON {schema}.users(loyalty_tier);
```

---

### 5.2 user_capabilities
```sql
CREATE TABLE {schema}.user_capabilities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES {schema}.users(id) ON DELETE CASCADE,
    capability VARCHAR(100) NOT NULL,  -- e.g., inventory.edit, order.refund
    granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    granted_by UUID,  -- user_id of admin who granted
    
    UNIQUE(user_id, capability)
);

CREATE INDEX idx_user_capabilities_user ON {schema}.user_capabilities(user_id);
```

---

### 5.3 orders
```sql
CREATE TABLE {schema}.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(50) UNIQUE NOT NULL,  -- ORD-2025-001234
    user_id UUID NOT NULL REFERENCES {schema}.users(id),
    vertical VARCHAR(50) NOT NULL,  -- carwash, dispensary, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'pending_payment',
    
    -- Pricing (all in cents)
    subtotal_cents INTEGER NOT NULL,
    discount_cents INTEGER DEFAULT 0,
    tax_cents INTEGER DEFAULT 0,
    total_cents INTEGER NOT NULL,
    
    -- Loyalty
    loyalty_points_earned INTEGER DEFAULT 0,
    loyalty_points_used INTEGER DEFAULT 0,
    
    -- Payment
    payment_method VARCHAR(50),  -- card, cash, ewallet
    payment_intent_id VARCHAR(255),  -- Stripe/payment gateway ID
    paid_at TIMESTAMP WITH TIME ZONE,
    
    -- Fulfillment
    assigned_to UUID,  -- staff user_id
    completed_at TIMESTAMP WITH TIME ZONE,
    cancelled_at TIMESTAMP WITH TIME ZONE,
    cancellation_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    CONSTRAINT valid_status CHECK (status IN (
        'pending_payment', 'paid', 'processing', 'completed', 
        'cancelled', 'refunded'
    )),
    CONSTRAINT positive_amounts CHECK (
        subtotal_cents >= 0 AND 
        discount_cents >= 0 AND 
        tax_cents >= 0 AND 
        total_cents >= 0
    )
);

CREATE INDEX idx_orders_user ON {schema}.orders(user_id);
CREATE INDEX idx_orders_status ON {schema}.orders(status);
CREATE INDEX idx_orders_created ON {schema}.orders(created_at DESC);
CREATE INDEX idx_orders_vertical ON {schema}.orders(vertical);
CREATE INDEX idx_orders_assigned ON {schema}.orders(assigned_to) WHERE assigned_to IS NOT NULL;
```

---

### 5.4 order_items
```sql
CREATE TABLE {schema}.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES {schema}.orders(id) ON DELETE CASCADE,
    product_id UUID,  -- NULL if product deleted
    product_name VARCHAR(255) NOT NULL,  -- snapshot at order time
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price_cents INTEGER NOT NULL,
    total_price_cents INTEGER NOT NULL,
    
    -- Product snapshot
    metadata JSONB DEFAULT '{}',  -- store product details at order time
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_quantity CHECK (quantity > 0),
    CONSTRAINT positive_prices CHECK (unit_price_cents >= 0 AND total_price_cents >= 0)
);

CREATE INDEX idx_order_items_order ON {schema}.order_items(order_id);
CREATE INDEX idx_order_items_product ON {schema}.order_items(product_id) WHERE product_id IS NOT NULL;
```

---

### 5.5 inventory
```sql
CREATE TABLE {schema}.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    vertical VARCHAR(50) NOT NULL,
    
    -- Pricing
    price_cents INTEGER NOT NULL,
    cost_cents INTEGER,  -- for margin calculation
    
    -- Stock
    stock_quantity INTEGER,  -- NULL = unlimited (services)
    low_stock_threshold INTEGER,
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    -- Media
    image_url VARCHAR(500),
    gallery_urls JSONB DEFAULT '[]',  -- array of image URLs
    
    -- SEO/Display
    slug VARCHAR(255),
    sort_order INTEGER DEFAULT 0,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',  -- vertical-specific fields
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_price CHECK (price_cents >= 0),
    CONSTRAINT positive_stock CHECK (stock_quantity IS NULL OR stock_quantity >= 0)
);

CREATE INDEX idx_inventory_vertical ON {schema}.inventory(vertical);
CREATE INDEX idx_inventory_category ON {schema}.inventory(category);
CREATE INDEX idx_inventory_active ON {schema}.inventory(is_active);
CREATE INDEX idx_inventory_slug ON {schema}.inventory(slug);
CREATE INDEX idx_inventory_sort ON {schema}.inventory(sort_order);
```

---

### 5.6 loyalty_transactions
```sql
CREATE TABLE {schema}.loyalty_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES {schema}.users(id),
    transaction_type VARCHAR(50) NOT NULL,  -- earned, redeemed, expired, adjusted
    points INTEGER NOT NULL,  -- positive for earn, negative for redeem
    balance_after INTEGER NOT NULL,
    
    -- Reference
    order_id UUID REFERENCES {schema}.orders(id),
    description TEXT,
    
    -- Expiration (for earned points)
    expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID,  -- NULL for system, user_id for manual adjustments
    
    CONSTRAINT valid_transaction_type CHECK (transaction_type IN (
        'earned', 'redeemed', 'expired', 'adjusted', 'bonus'
    ))
);

CREATE INDEX idx_loyalty_transactions_user ON {schema}.loyalty_transactions(user_id);
CREATE INDEX idx_loyalty_transactions_created ON {schema}.loyalty_transactions(created_at DESC);
CREATE INDEX idx_loyalty_transactions_expires ON {schema}.loyalty_transactions(expires_at) 
    WHERE expires_at IS NOT NULL;
```

---

### 5.7 rewards
```sql
CREATE TABLE {schema}.rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    reward_type VARCHAR(50) NOT NULL,  -- discount, free_item, cashback
    
    -- Cost
    points_required INTEGER NOT NULL,
    
    -- Discount details (if type = discount)
    discount_type VARCHAR(50),  -- percentage, fixed_amount
    discount_value INTEGER,  -- e.g., 10 for 10%, 1000 for R10
    max_discount_cents INTEGER,
    
    -- Free item details (if type = free_item)
    free_product_id UUID,
    
    -- Restrictions
    min_purchase_cents INTEGER,
    valid_for_verticals JSONB DEFAULT '[]',  -- empty = all verticals
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    stock_quantity INTEGER,  -- NULL = unlimited
    
    -- Validity
    valid_from TIMESTAMP WITH TIME ZONE,
    valid_until TIMESTAMP WITH TIME ZONE,
    
    -- Display
    image_url VARCHAR(500),
    sort_order INTEGER DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT positive_points CHECK (points_required > 0)
);

CREATE INDEX idx_rewards_active ON {schema}.rewards(is_active);
CREATE INDEX idx_rewards_validity ON {schema}.rewards(valid_from, valid_until);
```

---

### 5.8 reward_redemptions
```sql
CREATE TABLE {schema}.reward_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES {schema}.users(id),
    reward_id UUID NOT NULL REFERENCES {schema}.rewards(id),
    order_id UUID REFERENCES {schema}.orders(id),
    
    points_redeemed INTEGER NOT NULL,
    discount_applied_cents INTEGER,
    
    voucher_code VARCHAR(100) UNIQUE,  -- for tracking/validation
    
    status VARCHAR(50) NOT NULL DEFAULT 'active',  -- active, used, expired, cancelled
    used_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_redemption_status CHECK (status IN (
        'active', 'used', 'expired', 'cancelled'
    ))
);

CREATE INDEX idx_reward_redemptions_user ON {schema}.reward_redemptions(user_id);
CREATE INDEX idx_reward_redemptions_voucher ON {schema}.reward_redemptions(voucher_code);
CREATE INDEX idx_reward_redemptions_expires ON {schema}.reward_redemptions(expires_at)
    WHERE status = 'active';
```

---

## 6. Vertical-Specific Tables

### 6.1 Car Wash: bays
```sql
CREATE TABLE {schema}.carwash_bays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'available',  -- available, in_use, maintenance
    current_order_id UUID REFERENCES {schema}.orders(id),
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 6.2 Car Wash: queue
```sql
CREATE TABLE {schema}.carwash_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES {schema}.orders(id),
    bay_id UUID REFERENCES {schema}.carwash_bays(id),
    position INTEGER NOT NULL,
    vehicle_type VARCHAR(50),
    priority VARCHAR(50) DEFAULT 'normal',  -- normal, high, vip
    estimated_start TIMESTAMP WITH TIME ZONE,
    actual_start TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_carwash_queue_position ON {schema}.carwash_queue(position);
```

---

### 6.3 Dispensary: products (extends inventory)
```sql
CREATE TABLE {schema}.dispensary_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_id UUID NOT NULL REFERENCES {schema}.inventory(id) ON DELETE CASCADE,
    
    -- Cannabis-specific
    strain_type VARCHAR(50),  -- indica, sativa, hybrid
    thc_percentage DECIMAL(5,2),
    cbd_percentage DECIMAL(5,2),
    terpenes JSONB DEFAULT '{}',
    
    -- Compliance
    license_number VARCHAR(100),
    batch_number VARCHAR(100),
    lab_tested BOOLEAN DEFAULT FALSE,
    test_results_url VARCHAR(500),
    harvest_date DATE,
    
    -- Weight/Size
    weight_grams DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dispensary_products_strain ON {schema}.dispensary_products(strain_type);
CREATE INDEX idx_dispensary_products_batch ON {schema}.dispensary_products(batch_number);
```

---

### 6.4 Dispensary: age_verifications
```sql
CREATE TABLE {schema}.dispensary_age_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES {schema}.users(id),
    verification_method VARCHAR(50) NOT NULL,  -- id_document, manual
    date_of_birth DATE NOT NULL,
    id_document_url VARCHAR(500),  -- encrypted storage
    verified_by UUID,  -- staff user_id for manual verification
    status VARCHAR(50) NOT NULL DEFAULT 'pending',  -- pending, approved, rejected
    verified_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT valid_verification_status CHECK (status IN ('pending', 'approved', 'rejected'))
);

CREATE INDEX idx_age_verifications_user ON {schema}.dispensary_age_verifications(user_id);
CREATE INDEX idx_age_verifications_status ON {schema}.dispensary_age_verifications(status);
```

---

### 6.5 Padel: courts
```sql
CREATE TABLE {schema}.padel_courts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    court_type VARCHAR(50),  -- indoor, outdoor
    surface_type VARCHAR(50),  -- artificial_grass, concrete
    features JSONB DEFAULT '{}',  -- lighting, heating, etc.
    hourly_rate_cents INTEGER NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

---

### 6.6 Padel: bookings
```sql
CREATE TABLE {schema}.padel_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    court_id UUID NOT NULL REFERENCES {schema}.padel_courts(id),
    user_id UUID NOT NULL REFERENCES {schema}.users(id),
    order_id UUID REFERENCES {schema}.orders(id),
    
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    duration_minutes INTEGER NOT NULL,
    
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed',  -- confirmed, cancelled, completed
    cancellation_reason TEXT,
    
    -- Players
    players JSONB DEFAULT '[]',  -- array of {name, email}
    
    price_cents INTEGER NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    
    CONSTRAINT valid_booking_status CHECK (status IN ('confirmed', 'cancelled', 'completed')),
    CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX idx_padel_bookings_court ON {schema}.padel_bookings(court_id);
CREATE INDEX idx_padel_bookings_date ON {schema}.padel_bookings(booking_date);
CREATE INDEX idx_padel_bookings_user ON {schema}.padel_bookings(user_id);
CREATE UNIQUE INDEX idx_padel_bookings_unique ON {schema}.padel_bookings(court_id, booking_date, start_time)
    WHERE status = 'confirmed';
```

---

## 7. Indexes & Performance

### 7.1 Composite Indexes
```sql
-- Frequently queried combinations
CREATE INDEX idx_orders_user_status ON {schema}.orders(user_id, status);
CREATE INDEX idx_orders_user_created ON {schema}.orders(user_id, created_at DESC);
CREATE INDEX idx_inventory_vertical_active ON {schema}.inventory(vertical, is_active);

-- Covering indexes for common queries
CREATE INDEX idx_users_email_cover ON {schema}.users(email) 
    INCLUDE (first_name, last_name, loyalty_points);
```

### 7.2 Partial Indexes
```sql
-- Only index active/relevant records
CREATE INDEX idx_orders_pending ON {schema}.orders(created_at)
    WHERE status IN ('pending_payment', 'paid', 'processing');

CREATE INDEX idx_rewards_active_valid ON {schema}.rewards(points_required)
    WHERE is_active = TRUE AND (valid_until IS NULL OR valid_until > NOW());
```

### 7.3 JSONB Indexes
```sql
-- GIN indexes for JSONB columns
CREATE INDEX idx_inventory_metadata_gin ON {schema}.inventory USING GIN (metadata);
CREATE INDEX idx_tenant_config_value_gin ON public.tenant_config USING GIN (config_value);

-- Index specific JSONB keys
CREATE INDEX idx_inventory_tags ON {schema}.inventory 
    USING GIN ((metadata -> 'tags'));
```

---

## 8. Data Retention & Archival

### 8.1 Retention Policies

| Table | Retention | Archive Strategy |
|-------|-----------|------------------|
| orders | 7 years | Move to cold storage after 2 years |
| loyalty_transactions | 7 years | Archive after user churns + 1 year |
| users (inactive) | 3 years | Soft-delete, hard-delete after 3 years GDPR |
| reward_redemptions | 2 years | Archive expired redemptions after 1 year |

### 8.2 Archival Process
```sql
-- Create archive schema per tenant
CREATE SCHEMA tenant_abc123_archive;

-- Move old orders
INSERT INTO tenant_abc123_archive.orders
SELECT * FROM tenant_abc123.orders
WHERE created_at < NOW() - INTERVAL '2 years';

DELETE FROM tenant_abc123.orders
WHERE id IN (SELECT id FROM tenant_abc123_archive.orders);
```

---

## 9. Backup & Recovery

### 9.1 Backup Strategy
- **Full Backup:** Daily at 2 AM UTC
- **Incremental:** Every 6 hours
- **Retention:** 30 days online, 1 year in glacier storage
- **Testing:** Monthly restore test to staging environment

### 9.2 Point-in-Time Recovery
- PostgreSQL WAL archiving enabled
- 7-day PITR window
- Recovery objective: 5 minutes

### 9.3 Tenant-Level Backup
```bash
# Backup single tenant schema
pg_dump --schema=tenant_abc123 --file=tenant_abc123_backup.sql

# Restore tenant schema
psql --file=tenant_abc123_backup.sql
```

---

## Appendix A: Migration Scripts

### A.1 Create Tenant Schema
```sql
CREATE OR REPLACE FUNCTION create_tenant_schema(p_tenant_id UUID)
RETURNS TEXT AS $$
DECLARE
    v_schema_name TEXT;
BEGIN
    -- Generate schema name
    v_schema_name := 'tenant_' || REPLACE(p_tenant_id::TEXT, '-', '');
    
    -- Create schema
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', v_schema_name);
    
    -- Create all tables (users, orders, inventory, etc.)
    -- ... (full table creation DDL)
    
    -- Update tenants table
    UPDATE public.tenants 
    SET schema_name = v_schema_name
    WHERE id = p_tenant_id;
    
    RETURN v_schema_name;
END;
$$ LANGUAGE plpgsql;
```

---

## Appendix B: Common Queries

### B.1 Revenue by Vertical
```sql
SELECT 
    vertical,
    COUNT(*) as order_count,
    SUM(total_cents) / 100.0 as total_revenue
FROM orders
WHERE status = 'completed'
    AND created_at >= NOW() - INTERVAL '30 days'
GROUP BY vertical
ORDER BY total_revenue DESC;
```

### B.2 Top Customers
```sql
SELECT 
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    COUNT(o.id) as order_count,
    SUM(o.total_cents) / 100.0 as lifetime_value
FROM users u
JOIN orders o ON o.user_id = u.id
WHERE o.status = 'completed'
GROUP BY u.id
ORDER BY lifetime_value DESC
LIMIT 100;
```

---

**End of Database Schema Specification**
