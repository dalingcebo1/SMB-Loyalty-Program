# Architecture & Development Guide

## Architecture Overview

The repository is a monorepo containing a **FastAPI backend** and a **Vite/React frontend** deployed to Azure (Container Apps + Static Web Apps).

```
┌─────────────────────────────────────────┐
│          Azure Static Web Apps          │
│       React + Vite (Frontend/)          │
│  React Query · Capability guards · JWT  │
└──────────────────┬──────────────────────┘
                   │ HTTPS / REST + JWT
┌──────────────────▼──────────────────────┐
│       Azure Container Apps              │
│         FastAPI (Backend/)              │
│  Rate limiting · Auth · Middleware      │
│  app/plugins/* · app/routes/*           │
└──────────────────┬──────────────────────┘
                   │ SQLAlchemy
┌──────────────────▼──────────────────────┐
│      Azure PostgreSQL Flexible Server   │
│  Multi-tenant · Alembic migrations      │
└─────────────────────────────────────────┘
```

### Backend Structure (`Backend/`)

- **`main.py`** — application entry point; wires middleware (rate limiting, security, structured logging) and mounts router plugins.
- **`app/core/`** — cross-cutting infrastructure: `rate_limit.py`, `tenant_context.py`, `audit.py`, `authz.py`, `jobs.py`.
- **`app/models.py`** — SQLAlchemy ORM models (single source of truth).
- **`app/plugins/<module>/routes.py`** — feature endpoints (auth, loyalty, orders, payments, subscriptions, tenants, users, analytics, verticals). Add new features here, not in `main.py`.
- **`app/services/`** — reusable business logic consumed by multiple plugins.
- **`alembic/`** — database migration scripts. Never call `Base.metadata.create_all` in production.
- **`scripts/`** — helper scripts for seeding, smoke testing, and building images.
- **`tests/`** — pytest suite; mirrors production fixtures from `conftest.py`.

### Frontend Structure (`Frontend/src/`)

- **`features/`** — domain slices: `admin/`, `auth/`, `staff/`, `user/` each containing pages, components, and hooks.
- **`features/admin/hooks/useCapabilities.ts`** — capability guard hook; gates all admin/staff views.
- **`utils/format.ts`** — `formatCurrency` / `formatCents` (locale `en-ZA`, currency `ZAR`). **Always** route monetary display through these.
- **`utils/analytics.ts`** — analytics helpers (no-op stubs in tests).
- **`styles/`** — `design-tokens.css` (single source of CSS variables), `user-app.css`, `shared-buttons.css`.

### Key Domain Invariants

- **Monetary values** are persisted as integer cents on the backend. Responses divide by 100; frontend inputs must convert rands → cents before POSTing (e.g. `toCents` / `centsToRand` in `InventoryPage.tsx`).
- **Timestamps** use `utc_now()` from `app/utils/time.py`; never call `datetime.utcnow()` directly.
- **Tenant scope** is enforced server-side via `get_current_user` and `app/core/tenant_context.py`; do not bypass these dependencies when adding routes.
- **Capabilities** are defined in `ROLE_CAPABILITIES`; add new permissions there and guard UI actions with `useCapabilities().has('capability-name')`.

---

## Backend Development

### Prerequisites

- Python 3.11 (CI runs 3.10/3.12 for compatibility)
- PostgreSQL (or SQLite for local dev)

### Environment Setup

```bash
cd Backend

# Copy local env template (SQLite by default)
cp .env.local.example .env.local

# Install runtime + dev dependencies
pip install -r requirements.txt
pip install ruff mypy pip-audit pytest-cov

# For VS Code Pylance / import resolution, add to .vscode/settings.json:
# "python.analysis.extraPaths": ["Backend"]
# Or set PYTHONPATH=Backend in a repo-root .env file.
```

All `make` targets automatically export `APP_ENV_FILE=Backend/.env.local`.
To test against a different config: `APP_ENV_FILE=Backend/.env.staging make test`.

### Linting & Type Checking

```bash
# Lint (project rules in pyproject.toml, line length 100)
ruff check Backend
ruff check Backend --fix       # auto-fix

# Type check
mypy Backend

# Combined quality gate (mirrors CI)
make backend-quality
```

Temporary lint suppressions (`E402`, `I001`, `B904`) will be removed incrementally as refactors proceed.

### Testing

```bash
# Run all backend tests
make test
# or: cd Backend && PYTHONPATH=. pytest -q

# With coverage (≥78% required by CI)
make coverage
```

Add new tests in `Backend/tests/`. Reuse fixtures from `Backend/tests/conftest.py` — do not craft ad-hoc `TestClient` instances.

```bash
# Security audit (currently non-blocking in CI)
pip-audit -r Backend/requirements.txt
```

### OpenAPI Snapshot

Two test mechanisms prevent unintentional API contract breaks:

1. `test_openapi_contract.py` — asserts critical endpoints exist.
2. `test_openapi_snapshot.py` + `openapi_snapshot.json` — snapshot diff.

When intentionally adding or removing endpoints:
```bash
make snapshot-openapi
git add Backend/tests/openapi_snapshot.json
```

Use `ALLOW_NEW_ENDPOINTS=1` as a temporary PR override only.

### Database Migrations

```bash
# Check current revision
alembic -c Backend/alembic.ini current

# Apply latest
make migrate
# or: alembic -c Backend/alembic.ini upgrade head

# Generate new migration when models change
alembic -c Backend/alembic.ini revision --autogenerate -m "describe change"
```

CI runs a **migration drift check** (`scripts/check_migration_drift.py`) to detect unrecorded model changes. If it fails, generate a migration with the command above and review it before committing.

### Adding a New Feature (Backend)

1. Create `app/plugins/<module>/` with `__init__.py`, `plugin.py`, `routes.py`.
2. Define Pydantic request/response schemas inline or in `schemas.py`.
3. Inject `db: Session = Depends(get_db)` and `current_user` via existing dependency patterns.
4. Mount the router in `main.py` following the same pattern as existing plugins.
5. Write tests in `Backend/tests/test_<module>.py`.
6. Run `make snapshot-openapi` if public endpoints changed.

### Local Database Options

| Option | How |
|--------|-----|
| SQLite (default) | Remove `DATABASE_URL` or set `sqlite:///./dev.db` |
| Local Postgres | `docker compose -f docker-compose.local-db.yml up -d` then `export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/loyalty_local` |

### Docker

```bash
docker build -t loyalty-backend -f Backend/Dockerfile Backend
docker run -p 8000:8000 loyalty-backend
```

---

## Frontend Development

### Prerequisites

- Node.js 18+ and npm

### Setup

```bash
cd Frontend
npm install
```

### Development Commands

```bash
npm run lint          # ESLint
npm test              # Vitest unit tests (watch: npm run test:watch)
npm run test:coverage # Coverage report
```

### Adding a New Feature (Frontend)

1. Create components under `src/features/<domain>/`.
2. Gate admin actions with `useCapabilities().has('capability-name')`.
3. After mutations, invalidate React Query caches: `queryClient.invalidateQueries(['key'])`.
4. Display money through `formatCurrency` / `formatCents` from `src/utils/format.ts`.
5. Add Vitest tests in `src/features/<domain>/__tests__/`.
6. Run `npm run lint` and `npm test`.

### Environment Variables (Frontend)

```
VITE_API_BASE_URL=http://localhost:8000    # backend URL
VITE_YOCO_PUBLIC_KEY=pk_test_...          # payment gateway
VITE_FIREBASE_API_KEY=...                  # Firebase (see SECURITY_AND_AUTH.md)
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Copy `Frontend/.env.example` to `Frontend/.env.local` for local development.

### E2E Tests (Cypress)

```bash
cd Frontend
CYPRESS_BASE_URL="https://www.chaosx.co.za" \
  CYPRESS_ADMIN_EMAIL="<admin email>" \
  CYPRESS_ADMIN_PASSWORD="<password>" \
  CYPRESS_STAFF_EMAIL="<staff email>" \
  CYPRESS_STAFF_PASSWORD="<password>" \
  CYPRESS_USER_EMAIL="<customer email>" \
  CYPRESS_USER_PASSWORD="<password>" \
  npx cypress run --spec cypress/e2e/prod-smoke.cy.ts --browser electron --headless
```

The smoke spec self-skips when credentials are absent (keeps CI green on branches without production secrets).

---

## API Reference

### Base URLs

| Environment | URL |
|-------------|-----|
| Local | `http://localhost:8000` |
| Dev | `https://dev-loyalty-backend.mangoplant-11c2323f.southafricanorth.azurecontainerapps.io` |
| Production | Configured via `VITE_API_BASE_URL` |

### Authentication

All endpoints (except public ones) require a JWT bearer token:

```
Authorization: Bearer <jwt_token>
Content-Type: application/json
X-Tenant-ID: <tenant_id>   (optional — inferred from Host header or domain mapping)
```

### Core Endpoints

#### Authentication (`/api/auth`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/login` | Email/password login |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/refresh` | Refresh JWT token |
| GET | `/api/auth/me` | Get current user |
| PUT | `/api/auth/me` | Update current user |
| POST | `/api/auth/logout` | Logout |

#### User Profile (`/api/profile`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/profile/me` | Profile with loyalty stats |
| PUT | `/api/profile/me` | Update profile |
| GET | `/api/profile/me/orders` | Order history |
| GET | `/api/profile/me/loyalty-summary` | Loyalty summary |

#### Orders (`/api/orders`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/orders` | List orders |
| POST | `/api/orders` | Create order |
| GET | `/api/orders/{id}` | Order details |
| POST | `/api/orders/{id}/complete` | Complete order |

#### Payments (`/api/payments`)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/payments/create` | Create payment |
| GET | `/api/payments/{id}` | Payment status |
| POST | `/api/payments/webhook` | Yoco webhook |

#### Loyalty (`/api/loyalty`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/loyalty/rewards` | Available rewards |
| POST | `/api/loyalty/redeem` | Redeem reward |
| GET | `/api/loyalty/balance` | Points balance |

#### Catalog (`/api/catalog`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/catalog/services` | List services/products |
| POST | `/api/catalog/services` | Create service (admin) |
| PUT | `/api/catalog/services/{id}` | Update service (admin) |
| DELETE | `/api/catalog/services/{id}` | Delete service (admin) |

#### Customers — Staff/Admin (`/api/customers`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/customers` | List with search + pagination |
| GET | `/api/customers/{id}` | Customer detail |
| GET | `/api/customers/{id}/orders` | Customer orders |

#### Analytics/Reports — Staff/Admin (`/api/reports`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/reports/business-summary` | Key metrics |
| GET | `/api/reports/revenue-chart` | Revenue chart data |
| GET | `/api/reports/top-services` | Top services |
| GET | `/api/reports/loyalty-stats` | Loyalty statistics |

#### Subscriptions (`/api/subscriptions`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/subscriptions/plans` | Subscription plans |
| POST | `/api/subscriptions/setup-subscription` | Setup subscription |
| POST | `/api/subscriptions/cancel-subscription` | Cancel subscription |
| GET | `/api/subscriptions/subscription-status` | Status |

#### Notifications (`/api/notifications`)
| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/my` | User notifications |
| POST | `/api/notifications/{id}/read` | Mark read |
| GET | `/api/notifications/unread-count` | Unread count |

#### Health
| Method | Path | Description |
|--------|------|-------------|
| GET | `/health/` | Basic health check |
| GET | `/health/detailed` | Full system status |
| GET | `/health/ready` | Kubernetes readiness probe |
| GET | `/health/live` | Kubernetes liveness probe |
| GET | `/health/metrics` | Application metrics |

### Data Models

#### User
```json
{
  "id": 1,
  "email": "user@example.com",
  "first_name": "Jane",
  "last_name": "Doe",
  "phone": "+27123456789",
  "role": "user",
  "tenant_id": "business123",
  "onboarded": true,
  "created_at": "2025-01-01T00:00:00Z"
}
```

#### Order
```json
{
  "id": 1,
  "service_id": 1,
  "user_id": 1,
  "tenant_id": "business123",
  "amount": 5000,
  "status": "completed",
  "type": "paid",
  "created_at": "2025-01-01T00:00:00Z",
  "service": { "id": 1, "name": "Basic Wash", "base_price": 5000 }
}
```

> `amount` and `base_price` are integer **cents**. Divide by 100 before displaying.

#### Business Summary
```json
{
  "revenue": { "current": 150000, "prev_period": 120000, "percent_change": 25.0 },
  "orders": { "current": 45, "prev_period": 38, "percent_change": 18.4 },
  "customers": { "unique_count": 32, "new_customers": 8 },
  "loyalty": { "redemptions": 12, "points_redeemed": 450 }
}
```

### Error Responses

```json
{
  "detail": "Error message",
  "status_code": 400,
  "error_type": "validation_error"
}
```

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden (wrong role/capability) |
| 404 | Not Found |
| 422 | Validation Error |
| 429 | Rate Limited |
| 500 | Internal Server Error |

### Rate Limits

| Client type | Requests/min |
|-------------|-------------|
| Unauthenticated | 100 |
| Authenticated user | 300 |
| Premium subscriber | 1000 |

### Pagination

List endpoints accept:
- `limit` — items per page (default 50, max 100)
- `offset` — items to skip (default 0)
- `search` — text search
- `sort_by` / `sort_dir` — sorting

---

## Multi-Tenant Architecture

### Tenant Resolution Order

When a request arrives, the backend resolves the tenant context in this priority:

1. **`X-Tenant-ID` header** — explicit override (highest priority)
2. **`tenant_domains` table** — dynamic domain mapping (preferred for production)
3. **`primary_domain` field** — legacy static mapping (backward compatible)
4. **`DEFAULT_TENANT` env var** — fallback (dev/staging only; disabled in production)

### Tenant Domain Management

```bash
# Add a new domain (Admin API)
POST /api/admin/tenant-domains/
{
  "tenant_id": "acme-carwash",
  "domain": "loyalty.acmecarwash.com",
  "is_primary": true,
  "environment": "production"
}

# List domains for a tenant
GET /api/admin/tenant-domains?tenant_id=acme-carwash

# Lookup tenant by domain
GET /api/admin/tenant-domains/lookup/loyalty.acmecarwash.com

# Update / delete a mapping
PATCH /api/admin/tenant-domains/{id}
DELETE /api/admin/tenant-domains/{id}
```

### Domain Table Schema

```sql
CREATE TABLE tenant_domains (
    id          SERIAL PRIMARY KEY,
    tenant_id   VARCHAR NOT NULL REFERENCES tenants(id),
    domain      VARCHAR NOT NULL UNIQUE,
    is_primary  BOOLEAN DEFAULT FALSE,
    environment VARCHAR,   -- 'dev', 'staging', 'production'
    created_at  TIMESTAMP DEFAULT NOW()
);
-- Indexes
CREATE INDEX ix_tenant_domains_lookup   ON tenant_domains(domain, tenant_id);
CREATE INDEX ix_tenant_domains_tenant_id ON tenant_domains(tenant_id);
```

### Seeded Dev Domains

Run `python Backend/scripts/seed_tenant_domains.py` to register:

- `orange-pond-06eea490f.3.azurestaticapps.net` (dev frontend)
- `localhost:5173` (local development)
- `127.0.0.1:5173` (local development)

### Business Verticals

Each tenant is associated with a vertical that drives specialized features and default catalog:

| Vertical key | Business type |
|--------------|--------------|
| `carwash` | Car Wash |
| `padel` | Padel Courts |
| `beauty` | Beauty Salon |
| `flowershop` | Flower Shop |
| `dispensary` | Dispensary |

### Environment Config for Tenant Resolution

```bash
# Dev / staging: enable default tenant fallback
ALLOW_DEFAULT_TENANT_FALLBACK_NON_PROD=true
DEFAULT_TENANT=default

# Production: set DEFAULT_TENANT (fallback auto-enabled)
ENVIRONMENT=production
DEFAULT_TENANT=<your-default-tenant-id>
```

---

## Testing Strategy

### Backend Tests

```bash
make test                 # all tests
make coverage             # with report (≥78% required)
PYTHONPATH=. pytest -q tests/test_auth.py   # single file
```

Key test files:
- `tests/test_openapi_contract.py` — ensures critical public endpoints remain stable
- `tests/test_openapi_snapshot.py` — full snapshot diff
- `tests/conftest.py` — shared fixtures (always reuse these)

### Frontend Tests (Vitest)

```bash
npm test                       # all unit tests
npm run test:watch             # watch mode
npm run test:coverage          # coverage report
```

Tests in `src/**/__tests__/`. Analytics helpers are stubbed via `src/utils/analytics.ts` — keep no-op for unit tests.

### Load Testing (k6)

```bash
k6 run Backend/loadtests/basic_traffic.js \
  --env API_BASE=http://localhost:8000 \
  --env TEST_USER=demo@example.com \
  --env TEST_PASS=password
```
