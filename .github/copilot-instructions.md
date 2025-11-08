# Copilot Instructions

## Architecture snapshot
- Monorepo with a FastAPI backend under `Backend/` and a Vite/React frontend under `Frontend/`.
- `Backend/main.py` wires middleware (rate limiting, security, logging) and mounts routers from `app/plugins/*` and `app/routes/*`; prefer adding endpoints via those modules instead of touching `main.py` directly.
- Business logic leans on SQLAlchemy models in `app/models.py` and helper services inside `app/services/`; database access is always through `get_db()` dependencies so new routes should follow that pattern.
- The frontend uses React Query and capability guards (`features/admin/hooks/useCapabilities.ts`) to gate admin/staff views. Shared formatting lives in `src/utils/`.

## Domain invariants
- Monetary values are persisted as integer cents on the backend; all responses divide by 100, so frontend inputs must convert rands to cents before POSTing (`InventoryPage.tsx` shows `toCents`/`centsToRand`).
- Currency display must run through `utils/format.ts` (`formatCurrency` / `formatCents`) to keep locale (`en-ZA`, `ZAR`) consistent.
- Tenant context and capability checks are enforced server-side via dependencies in `app.core.tenant_context` and `get_current_user`; do not bypass them when adding routes.

## Workflow guardrails
- Follow `.github/instructions/Server run.instructions.md`: do **not** start dev or production servers (`npm run dev`, `uvicorn`, etc.) without explicit approval; rely on lint/tests instead.
- Backend quality gates: `cd Backend && pytest` for tests, `ruff check` and `mypy` for lint/type checks, `make backend-quality` to mirror CI. OpenAPI changes require updating `Backend/tests/openapi_snapshot.json` via `make snapshot-openapi`.
- Frontend validation: `npm run lint` and `npm test` (Vitest). Cypress smoke spec lives at `cypress/e2e/prod-smoke.cy.ts` and expects credentials via `CYPRESS_*` env vars when you run it manually.
- Always run tests against Backend CI and Frontend CI workflows to catch integration issues early.

## Implementation patterns
- When mutating backend data, invalidate the relevant React Query caches (`queryClient.invalidateQueries`) as seen in admin inventory/components.
- Admin UI capability toggles rely on `ROLE_CAPABILITIES`; add new permissions there and guard UI/actions with `useCapabilities().has('capability-name')`.
- Prefer composing new backend features under `app/plugins/<module>/routes.py` or `app/routes/` with Pydantic response models and dependency-injected sessions; write matching tests in `Backend/tests/`.
- Respect logging conventions: structured access logs are handled by middleware, so emit app-level logs via `logging.getLogger(__name__)` only for actionable events.

## Testing & safety nets
- Snapshot and contract tests (`Backend/tests/test_openapi_snapshot.py`, `test_openapi_contract.py`) will fail if public endpoints change—update the snapshot intentionally.
- Tenant-scoped data and rate limiting are covered by tests; mimic existing fixtures in `Backend/tests/conftest.py` instead of crafting ad-hoc clients.
- Frontend components commonly stub analytics with helpers from `src/utils/analytics.ts`; keep those no-op for tests unless explicitly extending tracking.

## Deployment awareness
- Branch strategy: day-to-day work targets `develop`; merging into `main` triggers Azure deploy workflows. Keep CI green (frontend, backend, e2e) before opening PRs.
- Environment files: never edit committed `.env` files without permission; create overrides via `Backend/.env.local` and `Frontend/.env.local` templates when needed.

## When in doubt
- Check the Makefile for approved commands and use the provided scripts (`Backend/scripts/*`) instead of inventing new entrypoints.
- If a change touches multiple surfaces (backend + frontend), add tests on both sides before pushing.
