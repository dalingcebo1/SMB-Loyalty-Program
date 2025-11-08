# Copilot Instructions

## Architecture snapshot
- Monorepo with a FastAPI backend under `Backend/` and a Vite/React frontend under `Frontend/`.
- `Backend/main.py` wires middleware (rate limiting, security, logging) and mounts routers from `app/plugins/*` and `app/routes/*`; prefer adding endpoints via those modules instead of touching `main.py` directly.
- Backend uses a **plugin architecture**: each plugin under `app/plugins/<name>/` has a `plugin.py` that implements `register_routes(app)` and `register_models(metadata)` (optional). Routers live in `routes.py` within each plugin. New features should follow this pattern—create a plugin directory with `__init__.py`, `plugin.py`, and `routes.py`.
- Business logic leans on SQLAlchemy models in `app/models.py` and helper services inside `app/services/`; database access is always through `get_db()` dependencies so new routes should follow that pattern.
- The frontend uses React Query and capability guards (`features/admin/hooks/useCapabilities.ts`) to gate admin/staff views. Shared formatting lives in `src/utils/`, and reusable UI components for end-user pages are in `src/components/user/` (UserPage, UserHero, UserSection, UserCard).

## Domain invariants
- Monetary values are persisted as integer cents on the backend; all responses divide by 100, so frontend inputs must convert rands to cents before POSTing (`InventoryPage.tsx` shows `toCents`/`centsToRand`).
- Currency display must run through `utils/format.ts` (`formatCurrency` / `formatCents`) to keep locale (`en-ZA`, `ZAR`) consistent.
- Tenant context and capability checks are enforced server-side via dependencies in `app.core.tenant_context` (`get_tenant_context`) and `get_current_user`; **never** bypass these when adding routes. Multi-tenant resolution uses header precedence: `X-Tenant-ID` header → full domain match → subdomain → localhost fallback (dev only).

## Workflow guardrails
- Follow `.github/instructions/Server run.instructions.md`: do **not** start dev or production servers (`npm run dev`, `uvicorn`, etc.) without explicit approval; rely on lint/tests instead. Check the Problems panel for compilation issues before proposing a build.
- Backend quality gates: `cd Backend && pytest` for tests, `ruff check` and `mypy` for lint/type checks, `make backend-quality` to mirror CI. OpenAPI changes require updating `Backend/tests/openapi_snapshot.json` via `make snapshot-openapi`.
- Frontend validation: `npm run lint` and `npm test` (Vitest). Cypress smoke spec lives at `cypress/e2e/prod-smoke.cy.ts` and expects credentials via `CYPRESS_*` env vars when you run it manually.
- Database migrations: use `make migrate` to apply, `make drift-check` to validate. Alembic runs with `Backend/alembic.ini`; migrations live in `Backend/migrations/versions/`.
- Always run tests against Backend CI and Frontend CI workflows to catch integration issues early.

## Implementation patterns
- When mutating backend data, invalidate the relevant React Query caches (`queryClient.invalidateQueries`) as seen in admin inventory/components.
- Admin UI capability toggles rely on `ROLE_CAPABILITIES` (both `Backend/app/plugins/auth/routes.py::_role_capabilities` and `Frontend/src/features/admin/config/capabilities.ts`); add new permissions there and guard UI/actions with `useCapabilities().has('capability-name')`.
- Prefer composing new backend features under `app/plugins/<module>/routes.py` or `app/routes/` with Pydantic response models and dependency-injected sessions; write matching tests in `Backend/tests/`.
- Frontend localStorage helpers: use `readJsonStorage<T>()` from `src/utils/storage.ts` for safe JSON parsing with fallbacks, seen in `Welcome.tsx` for caching wash status.
- Respect logging conventions: structured access logs are handled by middleware, so emit app-level logs via `logging.getLogger(__name__)` only for actionable events. Production uses JSON formatting (`app/core/logging_config.py`), dev uses human-readable format.

## Testing & safety nets
- Snapshot and contract tests (`Backend/tests/test_openapi_snapshot.py`, `test_openapi_contract.py`) will fail if public endpoints change—update the snapshot intentionally via `make snapshot-openapi`. Set `ALLOW_NEW_ENDPOINTS=1` in CI to allow new endpoints for approval.
- Tenant-scoped data and rate limiting are covered by tests; mimic existing fixtures in `Backend/tests/conftest.py` instead of crafting ad-hoc clients. The test database uses `sqlite:///:memory:` by default, seeded per-test with default tenant and user.
- Frontend components commonly stub analytics with helpers from `src/utils/analytics.ts`; keep those no-op (console.log only) for tests unless explicitly extending tracking.

## Deployment awareness
- Branch strategy: day-to-day work targets `develop`; merging into `main` triggers Azure deploy workflows. Keep CI green (frontend, backend, e2e) before opening PRs. Use `workflow_dispatch` on `backend-azure-containerapps.yml` for manual redeploys.
- Environment files: never edit committed `.env` files without permission; create overrides via `Backend/.env.local` and `Frontend/.env.local` templates when needed. All backend Make targets automatically use `APP_ENV_FILE=Backend/.env.local` to isolate dev from production config.

## Backend ↔ Frontend integration contracts

### API communication patterns
- **Base URL construction**: Frontend uses `VITE_API_BASE_URL` (defaults to `/api` for relative paths). `Frontend/src/api/api.ts` handles URL normalization and automatically prepends `/api` to all backend calls.
- **Authentication flow**: JWT tokens stored in `localStorage.token`, automatically injected via axios interceptor. Backend validates via `get_current_user` dependency which decodes JWT and loads user from DB. Token contains `sub` (email), optional `tid` (tenant_id), and `exp` (expiry).
- **Auth endpoints**: `/auth/signup`, `/auth/login` (OAuth2 form), `/auth/me`, `/auth/reset-password-confirm`. Login response includes `LoginResponse` schema with nested `user` object and `onboarding_required` flag.
- **Global 401 handling**: `api.ts` interceptor catches 401s—only forces logout for `/auth/*` endpoints to avoid disrupting in-flight operations on token expiry.

### Key endpoint mappings (Frontend → Backend)
| Frontend usage | Backend route | Plugin/Module | Response schema |
|---|---|---|---|
| `api.get('/loyalty/me')` | `GET /api/loyalty/me` | `loyalty/routes.py` | `{visits, rewards_ready[], upcoming_rewards[]}` |
| `api.post('/loyalty/reward')` | `POST /api/loyalty/reward` | `loyalty/routes.py` | `{reward, milestone, pin}` |
| `api.get('/payments/user-wash-status')` | `GET /api/payments/user-wash-status` | `payments/routes.py` | `{status, order_id, started_at, ended_at?, ...}` |
| `api.get('/orders/{id}')` | `GET /api/orders/{id}` | `orders/routes.py` | `OrderDetailResponse` (camelCase + snake_case keys) |
| `api.post('/orders/create')` | `POST /api/orders/create` | `orders/routes.py` | `OrderCreateResponse` with `payment_pin` |
| `api.get('/catalog/services')` | `GET /api/catalog/services` | `catalog/routes.py` | Grouped by category: `{category: [{id, name, base_price}]}` |
| `api.get('/catalog/extras')` | `GET /api/catalog/extras` | `catalog/routes.py` | `[{id, name, price_map}]` |
| `api.get('/profile')` | `GET /api/profile/me` | `routes/profile.py` | `ProfileResponse` with vehicles nested |

### Type alignment issues ⚠️
- **Currency**: Backend always returns integer cents. Frontend must use `toCents()` before POST and `centsToRand()` or `formatCents()` for display. See `InventoryPage.tsx` and `utils/format.ts`.
- **Date formats**: Backend uses ISO 8601 strings (`created_at`, `started_at`). Frontend parses with `new Date()`.
- **Key casing inconsistency**: Orders API returns **both** camelCase and snake_case keys for compatibility (`orderId`/`order_id`, `paymentPin`/`payment_pin`). This is intentional during migration but should be standardized—prefer camelCase frontend, snake_case backend with explicit Pydantic `alias` config. **Action needed**: Audit all response models and pick one convention.
- **Shared types missing**: `Frontend/src/types.ts` defines frontend interfaces but they're manually kept in sync with backend Pydantic models. No code generation in place. **Action needed**: Consider OpenAPI → TypeScript codegen or shared schema repository.

### React Query cache invalidation rules
When backend mutations succeed, frontend **must** invalidate relevant cache keys:
- After creating/updating services → `queryClient.invalidateQueries({ queryKey: ['inventory', 'services'] })`
- After loyalty reward claim → `queryClient.invalidateQueries({ queryKey: ['loyalty'] })`
- After profile updates → `queryClient.invalidateQueries({ queryKey: ['user-profile'] })`
- Pattern: `['resource', ...filters]`. Examples in `InventoryPage.tsx`, `EnhancedProfile.tsx`, `UsersList.tsx`.

### Deprecated/moved files requiring cleanup 🧹
**Frontend legacy auth pages** (all have "moved" comments but still contain duplicate implementations):
- `Frontend/src/pages/Login.tsx` → should only re-export from `features/auth/pages/Login.tsx`
- `Frontend/src/pages/Signup.tsx` → should only re-export from `features/auth/pages/Signup.tsx`
- `Frontend/src/pages/Onboarding.tsx` → already cleaned, follow this pattern
- `Frontend/src/pages/ForgotPassword.tsx`, `ResetPassword.tsx`, `OTPVerify.tsx` → same issue

**Action needed**: Remove duplicate implementations from `src/pages/*.tsx` files that have "This file has been moved" comments—keep only the re-export statement. Routes in `src/routes/index.tsx` should import directly from `features/auth/pages/*`.

### TODOs flagged in codebase
- `BrandingPage.tsx:33`: Tenant ID hardcoded to `'default'`—must derive from `useAuth().user.tenant_id`.
- `SubscriptionUsagePage.tsx`: Marked deprecated but still routed. Remove route and file.
- `CohortChart.tsx`: Placeholder component with no implementation—either implement or remove from admin dashboard.

### Multi-tenant request context
- Backend resolves tenant via `get_tenant_context` dependency using header precedence (see Domain invariants above).
- Frontend doesn't explicitly send `X-Tenant-ID` header—relies on JWT's `tid` claim for tenant association.
- **Gap**: Admin cross-tenant operations (e.g., `BrandingPage`) need explicit tenant selection. Pattern not yet established—currently hardcoded to 'default'.

### Security boundaries
- All backend routes under plugins require `Depends(get_current_user)` at router or endpoint level. Public endpoints (health checks, metrics) live in `app/routes/` without this dependency.
- Frontend role-based routing uses `RequireAdmin`/`RequireStaff` components that check `user.role` from `AuthProvider`. This is **client-side only**—backend must always re-validate via `get_current_user` + capability checks.
- Staff/Admin API calls auto-inject token but backend enforces role via `_role_capabilities` and custom authz decorators in `app/core/authz.py`.

## When in doubt
- Check the Makefile for approved commands and use the provided scripts (`Backend/scripts/*`) instead of inventing new entrypoints.
- If a change touches multiple surfaces (backend + frontend), add tests on both sides before pushing.
- For new endpoints, update OpenAPI snapshot (`make snapshot-openapi`) and add TypeScript interfaces to `Frontend/src/types.ts` manually until codegen is implemented.
