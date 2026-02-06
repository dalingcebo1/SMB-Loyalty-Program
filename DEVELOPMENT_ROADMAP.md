# SMB Loyalty Platform - Development Roadmap

**Vision:** Transform the platform from carwash-focused to a true all-in-one SME solution with loyalty baked in.

**Timeline:** 12 weeks  
**Started:** February 5, 2026  
**Target Completion:** April 30, 2026

---

## 🎯 Current Phase: Phase 1 - Foundation Fixes

**Duration:** Weeks 1-2 (Feb 5 - Feb 18, 2026)  
**Status:** � Week 1 COMPLETE | Week 2 READY  
**Goal:** Fix structural issues blocking multi-vertical expansion

---

## Phase 1 Tasks

### Week 1: Vertical Infrastructure ✅ COMPLETE (100%)

#### Backend: Vertical Plugin System
- [x] Create `Backend/app/verticals/base.py` - Abstract `VerticalPlugin` class
  - ✅ Already exists with complete interface
  - ✅ Defines: `get_features()`, `get_nav_items()`, `get_dashboard_widgets()`, `get_default_services()`
  - ✅ Has validation methods: `validate_config()`, `supports_feature()`
  
- [x] Create `Backend/app/verticals/manager.py` - Vertical registry and loader
  - ✅ Already exists as `registry.py`
  - ✅ `VerticalManager.register()` - Register vertical plugins
  - ✅ `VerticalManager.get()` - Retrieve vertical by ID
  - ✅ `VerticalManager.load_features()` - Dynamically load vertical features
  
- [x] Update existing verticals to extend `VerticalPlugin`:
  - [x] `Backend/app/verticals/carwash.py` - ✅ Already implements interface
  - [x] `Backend/app/verticals/retail.py` - ✅ Already implements interface
  - [x] `Backend/app/verticals/beauty.py` - ✅ Already implements interface
  - [x] `Backend/app/verticals/padel.py` - ✅ Already implements interface
  - [x] `Backend/app/verticals/dispensary.py` - ✅ Already implements interface
  - [x] `Backend/app/verticals/flowershop.py` - ✅ Already implements interface

- [x] Add vertical validation to tenant creation
  - ✅ Already registered and auto-loaded on app startup (main.py line 1002)
  - ✅ All 6 verticals registered in `auto_register_all()`

#### Database: Schema Enhancements
- [x] Create migration: `alembic revision -m "add_vertical_config_support"`
  - ✅ Created: `f547a43c4eef_add_vertical_features_to_tenants.py`
  - ✅ Add `vertical_features` JSONB column to `tenants` table
  - ✅ Create `tenant_vertical_config` table with proper schema
  - ✅ Add indexes for performance
  - ✅ Populate default features for existing tenants

- [x] Update SQLAlchemy models
  - [x] ✅ Add `vertical_features` field to `Tenant` model
  - [x] ✅ Create `TenantVerticalConfig` model

#### Frontend: Dynamic Configuration
- [x] Create `Frontend/src/config/verticalConfig.ts`
  - ✅ Define `VerticalConfig` interface (labels, colors, icons, features)
  - ✅ Export config for all 6 verticals (carwash, retail, beauty, padel, flowershop, dispensary)
  - ✅ Helper functions: `getVerticalConfig()`, `hasVerticalFeature()`, `getVerticalLabels()`, `getVerticalNavItems()`

- [x] Create `Frontend/src/contexts/VerticalContext.tsx`
  - ✅ `VerticalProvider` component wrapping app
  - ✅ Export `useVertical()` hook
  - ✅ Export `useVerticalLabels()` for dynamic terminology
  - ✅ Export `useVerticalFeatures()` for feature checking
  - ✅ Export `useVerticalNavItems()` for navigation items

- [x] Create `Frontend/src/hooks/useVerticalFeatures.ts`
  - ✅ Implemented as part of VerticalContext
  - ✅ Hook to check if vertical supports a feature
  - ✅ `hasFeature('appointments')` → boolean
  - ✅ `hasFeature('inventory')` → boolean

- [x] Create `Frontend/src/components/VerticalRoute.tsx`
  - ✅ Component for conditional navigation rendering
  - ✅ Hide routes not applicable to tenant's vertical
  - ✅ Supports both feature flags and vertical whitelists

- [x] Update navigation to use vertical-aware components
  - [x] `Frontend/src/components/AdminSidebar.tsx` - Filter nav items by vertical features
  - [x] `Frontend/src/features/admin/components/AdminNav.tsx` - Filter nav items by vertical
  
**✅ Week 1: COMPLETE (100%)**

### Week 2: Subscription Monetization � IN PROGRESS

#### Backend: Stripe Integration ✅ COMPLETE
- [x] Create `Backend/app/plugins/subscriptions/stripe_sync.py`
  - Implemented `create_stripe_subscription(tenant_id, plan_id)`
  - Implemented `cancel_subscription(tenant_id, immediate=False)`
  - Implemented `update_subscription(tenant_id, new_plan_id)`
  - Implemented `create_checkout_session()` for payment UI
  - Implemented `ensure_stripe_customer()` helper

- [x] Add Stripe webhook handlers
  - [x] `Backend/app/plugins/subscriptions/webhooks.py` - Webhook routes mounted at `/webhooks/stripe`
  - Handle `invoice.payment_succeeded` - Update tenant status to 'active' ✅
  - Handle `invoice.payment_failed` - Start grace period ✅
  - Handle `customer.subscription.deleted` - Suspend tenant ✅
  - Handle `customer.subscription.updated` - Update plan/status ✅
  - Verify webhook signatures for security ✅

- [ ] Implement grace period logic
  - [ ] Create Celery task `check_overdue_subscriptions.py`
  - Run daily: check `tenants.subscription_status = 'past_due'`
  - If >7 days past due → set status to 'suspended'
  - Send warning emails at days 1, 3, 7

#### Backend: Usage Tracking ✅ COMPLETE
- [x] Create `Backend/app/middleware/usage_limiter.py`
  - Middleware to track API calls per tenant
  - Check plan limits on resource creation
  - Returns 402 Payment Required when exceeded

- [x] Create `Backend/app/services/usage_tracker.py`
  - `UsageTracker.get_current_usage(tenant_id)` - Return counts
  - Track: customers, transactions, API calls, storage (MB)
  - Cache results in Redis (1 hour TTL)
  - `check_limit()` - Validate resource against plan limits
  - `get_usage_history()` - Historical trends

- [x] Add plan limits enforcement
  - Integrated limit checks into `app/plugins/auth/routes.py` signup endpoint (customer limit) ✅
  - Integrated limit checks into `app/plugins/orders/routes.py` create endpoint (transaction limit) ✅
  - Returns 402 Payment Required with upgrade prompt
  - Created `get_plan_limits()` function in `Backend/app/core/plans.py`
  - Extracts limits from PLAN_REGISTRY

- [x] Create usage endpoint
  - [x] `Backend/app/routes/usage.py` - New routes file mounted at `/api/usage`
  - `GET /api/usage/current` - Current usage metrics
  - `GET /api/usage/summary` - Complete summary with plan info and limit checks
  - `GET /api/usage/limits/{resource}` - Check specific resource limit
  - `GET /api/usage/history?days=30` - Historical daily trends
  - `POST /api/usage/invalidate-cache` - Force cache refresh

#### Frontend: Billing UI ✅ COMPLETE
- [x] Create `Frontend/src/features/admin/pages/BillingSettings.tsx`
  - Current plan display with features list (Free/Pro/Enterprise)
  - Plan-specific feature lists with check icons
  - Usage meters (progress bars) with color coding:
    - Customers: current/limit with percentage
    - Transactions: monthly tracking
    - Storage: MB usage display
  - Color-coded status: green <70%, yellow 70-90%, red >90%
  - "Upgrade Plan" button for non-Enterprise plans
  - Refresh usage button with cache invalidation
  - Integrated with React Query for data fetching
  - Added to `/admin/billing` route
  - Added to admin navigation under "Payments & Billing"

- [x] Usage meter component (built inline in BillingSettings)
  - Reusable AdminCard component with variant styling
  - Color-coded progress bars based on usage percentage
  - Shows current/limit, percentage used, remaining count
  - "Limit exceeded" warnings with alert icons
  - Handles unlimited resources gracefully

- [ ] Create `Frontend/src/features/admin/components/InvoiceHistory.tsx`
  - Table of past invoices
  - Columns: Date, Amount, Status, Download PDF
  - Fetch from `GET /api/subscriptions/invoices`

- [ ] Add usage warnings to resource creation
  - Show modal when approaching limit (>90%)
  - Block action when limit reached with "Upgrade" CTA

#### Still TODO for Week 2
1. ~~Wire UsageLimiterMiddleware into `main.py` middleware stack~~ ✅ (Using endpoint-level checks instead)
2. ~~Integrate limit checks in customer creation endpoint~~ ✅ DONE
3. ~~Integrate limit checks in order creation endpoint~~ ✅ DONE
4. ~~Implement Stripe webhook handlers in `webhooks.py`~~ ✅ DONE
5. ~~Implement Stripe subscription sync functions~~ ✅ DONE
6. Create Celery task for grace period enforcement (nice-to-have)
7. Add usage warnings to frontend resource creation flows (nice-to-have)
8. Create InvoiceHistory component (nice-to-have)

**Week 2 Summary:**
- ✅ **COMPLETE** - Core subscription monetization infrastructure ready
- Backend: Stripe integration, webhooks, usage tracking, limit enforcement
- Frontend: Complete billing UI with usage meters and upgrade flow
- Platform can now track usage and enforce plan limits
- Stripe subscriptions can be created, updated, and cancelled
- 90% complete (remaining items are enhancements)

---

## Phase 2: Retail Vertical (Weeks 3-5)

**Status:** � IN PROGRESS  
**Goal:** Build first non-carwash vertical to production quality

### Week 3: Product & Inventory Management ✅ BACKEND COMPLETE

#### Backend: Database Models ✅ COMPLETE
- [x] Enhanced inventory backend (products, stock tracking, suppliers)
  - Created `Product` model with SKU, pricing, cost tracking, margins
  - Created `ProductCategory` model with hierarchical structure
  - Created `Supplier` model with contact information
  - Created `InventoryLevel` model for multi-location stock tracking
  - Created `StockMovement` model for complete audit trail
  - Created `LowStockAlert` model for automated alerts
  - All models include tenant_id for multi-tenancy
  - Proper indexes for performance (tenant+sku, tenant+product, etc.)

#### Backend: API Routes ✅ COMPLETE
- [x] Product Management API (`/api/retail/products`)
  - GET /products - List products with search, filters, low stock filter
  - POST /products - Create product with initial stock
  - PATCH /products/{id} - Update product details
  - Product cost and price tracked in cents for accuracy
  - Automatic margin calculation (profit percentage)
  - Barcode support for POS integration

- [x] Supplier Management API (`/api/retail/suppliers`)
  - GET /suppliers - List suppliers with product counts
  - POST /suppliers - Create new supplier
  - PATCH /suppliers/{id} - Update supplier details
  - Active/inactive status filtering

- [x] Category Management API (`/api/retail/categories`)
  - GET /categories - List categories with product counts
  - POST /categories - Create new category
  - Hierarchical categories (parent/child support)

- [x] Stock Management API (`/api/retail/stock`)
  - POST /stock/adjust - Adjust inventory levels with audit trail
  - GET /stock/low-alerts - View low stock alerts
  - POST /stock/low-alerts/{id}/acknowledge - Mark alert as acknowledged
  - Automatic low stock alert generation

#### Backend: Business Logic ✅ COMPLETE
- [x] Stock movement tracking with complete audit trail
  - Movement types: purchase, sale, adjustment, transfer, return
  - Unit cost tracking for COGS calculations
  - Reference to related records (orders, purchases)
  - User attribution for all stock changes

- [x] Low stock alerts system
  - Automatic alerts when quantity <= threshold
  - Alert acknowledgement tracking
  - Resolution workflow
  - Location-specific alerts for multi-location support

- [x] Multi-location inventory support
  - Track stock by location (main, warehouse, store-1, etc.)
  - Reserved quantity for pending orders
  - Available quantity calculation (total - reserved)

#### Frontend: Inventory Dashboard ✅ COMPLETE
- [x] Create `Frontend/src/features/retail/pages/InventoryDashboard.tsx`
  - Product list table with search and filters
  - Low stock indicators and warnings
  - Quick stock adjustment modal
  - Category and supplier filters
  - Add new product form
  - 5 stat cards (products, low stock, value, suppliers, categories)
  - Real-time data with React Query
  - Route: `/admin/retail/inventory`

- [x] Create inventory components
  - ProductList - Display products with expandable details
  - ProductForm - Create/edit modal form
  - LowStockAlerts - Alert management widget
  - All components with responsive CSS
  - Color-coded indicators (margins, stock levels)
  - Full CRUD operations with optimistic updates

- [x] Integration & Configuration
  - Routes configured in `Frontend/src/routes/index.tsx`
  - Vertical config updated with correct paths
  - TypeScript compilation clean (0 errors)
  - Lazy-loaded components for code splitting

**✅ Week 3 COMPLETE - See PHASE_2_WEEK_3_COMPLETE.md for full details**

### Week 4: Point of Sale (POS) 📅 NOT STARTED
- [ ] Sales transaction flow
- [ ] POS UI (tablet optimized)
- [ ] Receipt generation
- [ ] Payment processing (cash, card)
- [ ] Auto-decrement inventory on sale
- [ ] Receipt email/print
- [ ] Sales reporting dashboard

### Week 5: Retail-Specific Loyalty 📅 NOT STARTED
- [ ] Product-based rewards engine
- [ ] Retail onboarding flow
- [ ] Category-specific promotions

---

## Phase 3: Beauty/Salon Vertical (Weeks 6-8)

**Status:** 📅 NOT STARTED  
**Goal:** Appointment-based business support

### Week 6: Appointment System
- [ ] Booking infrastructure
- [ ] Availability engine
- [ ] Calendar UI

### Week 7: Staff Management
- [ ] Stylist profiles
- [ ] Commission tracking
- [ ] Shift scheduling

### Week 8: Beauty-Specific Loyalty
- [ ] Package deals
- [ ] Appointment reminders
- [ ] Review collection

---

## Phase 4: Core SME Features (Weeks 9-10)

**Status:** 📅 NOT STARTED  
**Goal:** Features needed by ALL verticals

### Week 9: Customer Engagement
- [ ] SMS integration (Twilio/Africa's Talking)
- [ ] Email campaigns (Resend/SendGrid)
- [ ] Campaign builder UI

### Week 10: Financial Tools
- [ ] Invoice generation
- [ ] Expense tracking
- [ ] P&L dashboard

---

## Phase 5: Polish & Scale Prep (Weeks 11-12)

**Status:** 📅 NOT STARTED  
**Goal:** Launch-ready platform

### Week 11: Performance & UX
- [ ] Query optimization
- [ ] Cache strategy
- [ ] Mobile responsiveness
- [ ] Loading states & error handling

### Week 12: Documentation & Demo
- [ ] Developer documentation
- [ ] User guides
- [ ] Demo mode with seed data
- [ ] Launch checklist completion

---

## 🎯 Success Metrics

### Business KPIs (Track Weekly)
- [ ] Tenant Growth: 10 paying tenants by Week 12
- [ ] Revenue per Tenant: $50-150/month
- [ ] Churn Rate: <5% monthly
- [ ] Feature Adoption: 80% POS usage (retail), 60% appointments (beauty)

### Technical KPIs
- [ ] API Response Time: p95 <200ms, p99 <500ms
- [ ] Uptime: 99.5%+
- [ ] Test Coverage: Backend >90%, Frontend >75%
- [ ] Lighthouse Score: Performance >85, Accessibility >90

---

## 📝 Implementation Notes

### Current Working Branch
- **Branch:** `main` (will create feature branches)
- **Next:** Create `feature/vertical-infrastructure` for Phase 1 Week 1

### Environment Setup
- Backend running on port 8000 (uvicorn)
- Frontend running on port 5174 (Vite)
- PostgreSQL on port 5433 (Docker)

### Code Standards
- Follow existing patterns in codebase
- Add tests for all new backend routes (pytest)
- Add tests for frontend components (Vitest)
- Update OpenAPI snapshot after API changes
- Run linters before committing (ruff, ESLint)

### Git Workflow
1. Create feature branch from `main`
2. Implement task with tests
3. Run quality checks: `make backend-quality`, `npm run lint`
4. Commit with descriptive message
5. Push and create PR (or merge to main for rapid iteration)

---

## 🚀 Current Sprint: Week 2 (Feb 6-12, 2026)

### Today's Progress (Feb 5) ✅ WEEK 1 COMPLETE!
1. ✅ Created comprehensive roadmap document
2. ✅ Verified backend vertical plugin system (already complete!)
3. ✅ Created frontend vertical configuration system:
   - ✅ `Frontend/src/config/verticalConfig.ts` - All 6 verticals configured
   - ✅ `Frontend/src/contexts/VerticalContext.tsx` - React context + hooks
   - ✅ `Frontend/src/components/VerticalRoute.tsx` - Conditional routing
4. ✅ Created database migration for vertical features:
   - ✅ Added `vertical_features` JSONB column to tenants
   - ✅ Created `tenant_vertical_config` table
   - ✅ Updated Tenant and TenantVerticalConfig models
5. ✅ Integrated VerticalProvider into frontend app (main.tsx)
6. ✅ Updated navigation to filter by vertical:
   - ✅ `AdminSidebar.tsx` - Filters carwash-specific items
   - ✅ `AdminNav.tsx` - Consistent filtering logic
   - ✅ `adminNavConfig.ts` - Added vertical metadata

### Next Steps (Feb 6-7)
1. 🔄 Start Week 2: Subscription Monetization
   - Wire Stripe webhook handlers
   - Implement usage tracking middleware  
   - Build billing settings UI

### Week 1 Summary
**Status:** 🟢 100% Complete!

**Delivered:**
- ✅ Backend vertical system (was already functional)
- ✅ Frontend vertical configuration (6 verticals: carwash, retail, beauty, padel, flowershop, dispensary)
- ✅ Database schema for vertical features (migration created and synced)
- ✅ All vertical TypeScript interfaces and hooks
- ✅ VerticalProvider integrated into React app
- ✅ Navigation components filter items by vertical
- ✅ Carwash-specific nav items (Vehicles, Wash History) only show for carwash tenants

**Key Achievement:** The platform now has a complete multi-vertical foundation. The UI will dynamically adapt based on tenant's business type, showing only relevant features and using appropriate terminology.

### Blockers
- None currently

### Decisions Needed
- Which SMS provider to use? (Twilio vs Africa's Talking)
- Stripe test mode vs production setup timeline

---

## 📚 Reference Links

- [Backend Architecture](ARCHITECTURE_IMPROVEMENTS_PHASE_5-8_COMPLETE.md)
- [Admin UI Standards](ADMIN_COMPONENTS_IMPLEMENTATION_GUIDE.md)
- [API Documentation](API_DOCUMENTATION.md)
- [Deployment Guide](DEPLOYMENT_GUIDE.md)

---

**Last Updated:** February 5, 2026 (10:15 UTC)  
**Updated By:** Phase 1 Week 1 - COMPLETE ✅  
**Next Update:** Week 2 Day 1 - Subscription Monetization Kickoff
