# SMB-Loyalty-Program

| Workflow | Status |
| --- | --- |
| Frontend CI (lint, unit tests, build) | ![Frontend CI](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/frontend-ci.yml/badge.svg) |
| Backend CI (ruff, mypy, pytest, coverage ≥ 78%) | ![Backend CI](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/backend-ci.yml/badge.svg) |
| End-to-End Tests (Cypress smoke) | ![E2E Tests](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/e2e-tests.yml/badge.svg) |
| Production Deploy (Azure Container Apps) | ![Deploy](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/deploy.yml/badge.svg) |

We’re building a modern loyalty infrastructure that empowers small businesses and global enterprises alike to reward customers through seamless digital experiences—starting with QR-based programs for SMBs, and evolving into a blockchain-powered loyalty protocol for the future of partner ecosystems.

## Recent Maintenance Highlights (October 2025)

- Root `pytest.ini` now discovers both `tests/` and `Backend/tests/`, so coverage gates exercise the full backend suite during CI.
- The backend authentication override in `Backend/tests/conftest.py` has been aligned with FastAPI’s dependency signature. Tests now read bearer tokens from the `Authorization` header and decode JWTs using the same logic as production routes.
- `Frontend/package-lock.json` has been regenerated to include missing peer type packages, ensuring `npm ci` matches local installs without manual flags.

## Branch Strategy & Environments

- `main` — production-only. The Azure Container App deploy workflow triggers automatically on pushes to this branch and requires review + passing checks.
- `develop` — integration branch. Open Codespaces from here, land feature branches via PR, and soak changes without touching production.
- `feature/*` (or `fix/*`) — short-lived branches for day-to-day work. Open PRs into `develop`.

Deployment flow:
1. Feature branch → PR → `develop` (CI must pass).
2. When `develop` is stable, open a PR from `develop` to `main`.
3. Merge into `main` to trigger the production deployment workflow. Use the manual `workflow_dispatch` on `backend-azure-containerapps.yml` for ad-hoc redeploys without merging.

Tip: protect both `main` and `develop` with required reviews and status checks so accidental pushes do not bypass CI/CD.

## GitHub Secrets
Add the following secrets under Settings > Secrets > Actions in your GitHub repository:

- **AWS_ACCESS_KEY_ID**: AWS access key for deployment actions
- **AWS_SECRET_ACCESS_KEY**: AWS secret access key for deployment actions
- **AWS_REGION**: AWS region for S3 and Elastic Beanstalk (e.g., `us-east-1`)
- **S3_BUCKET_NAME**: S3 bucket name for frontend hosting
- **EB_S3_BUCKET**: S3 bucket name for Elastic Beanstalk application versions

## Backend Development Environment

### Python Version
The backend targets Python 3.11 (CI currently runs 3.10/3.12 for compatibility). Use 3.11 locally for closest parity.

### Environment Files & Isolation

Copy the local example to keep development separate from production:

```
cp Backend/.env.local.example Backend/.env.local
```

All backend Make targets now export `APP_ENV_FILE=Backend/.env.local` automatically so local commands use SQLite unless you override it. To point at a different configuration temporarily:

```
APP_ENV_FILE=Backend/.env.staging make test
```

### Installing Dependencies
```
cd Backend
pip install -r requirements.txt
# Optional (dev tooling):
pip install ruff mypy pip-audit pytest-cov
```

### Editor Import Warnings (Pylance / VS Code)
If you see "Import ... could not be resolved" warnings:
1. Ensure the interpreter selected in VS Code is the one where you installed deps.
2. Pylance may need the workspace root (monorepo) – add a `.env` at repo root with:
```
PYTHONPATH=Backend
```
3. Run `pip install -r Backend/requirements.txt` inside an activated virtualenv.
4. Set `python.analysis.extraPaths` to `["Backend"]` in `.vscode/settings.json` (optional).

### Linting & Formatting (Ruff)
```
ruff check Backend
```
Project rules are in `pyproject.toml`. Line length set to 100. To auto-fix:
```
ruff check Backend --fix
```

### Type Checking (Mypy)
```
mypy Backend
```
`ignore_missing_imports` is enabled initially; tighten this over time by adding per-module stubs.

### Tests
```
pytest -q
```
Run with coverage:
```
pytest --cov=Backend --cov-report=term-missing -q
```
Pytest discovery is configured at the repository root to include both `tests/` and `Backend/tests/`; add additional paths in `pytest.ini` if you introduce new top-level packages.

### Security Audit
```
pip-audit -r Backend/requirements.txt
```
Currently non-blocking in CI; convert to blocking once critical issues addressed.

### Running the API Locally
```
uvicorn main:app --reload --port 8000
```
Environment variables are loaded from layered files (highest precedence first):

- `Backend/.env.local` – developer-specific overrides (not committed).
- `Backend/.env.production` – optional checked-in reference for production defaults.
- `Backend/.env` – legacy fallback; keep for platform deployments until migrated.

Create `Backend/.env.local` from the template below to keep your local secrets out of the shared production file.

> Tip: set `APP_ENV_FILE=/absolute/path/to/file` to point the backend at a one-off dotenv when debugging.

### Structured Logging
Production uses JSON logs; locally you get human-readable logs. To preview prod style:
```
ENVIRONMENT=production uvicorn main:app --port 8000
```

### Sentry (Optional)
Set `SENTRY_DSN` to enable Sentry. Tracing sample rate defaults to 0.1.

### Rate Limiting Notes
Token bucket logic is in `app/core/rate_limit.py`. Public metadata and user/tenant scoped endpoints have explicit limits. Future global middleware can wrap all routes if threat model changes.

### Docker Build (Multi-stage)
```
docker build -t loyalty-backend -f Backend/Dockerfile Backend
docker run -p 8000:8000 loyalty-backend
```

### OpenAPI Snapshot & Contract Checks
We enforce stability of existing public API paths via two mechanisms:

1. `Backend/tests/test_openapi_contract.py` – asserts critical endpoints are present.
2. `Backend/tests/test_openapi_snapshot.py` + `Backend/tests/openapi_snapshot.json` – snapshot diff.

Regenerating the snapshot (when intentionally adding/removing endpoints):
```
./Backend/scripts/update_openapi_snapshot.sh
git add Backend/tests/openapi_snapshot.json
```
CI will fail if the snapshot file still contains the placeholder `_requires_init` key or if previously recorded paths disappear without an updated snapshot.

### Migration Drift Check
CI runs a migration drift check (`scripts/check_migration_drift.py`) to detect when model changes aren't captured in Alembic migrations. If it fails:
```
alembic -c Backend/alembic.ini revision --autogenerate -m "sync models"
alembic -c Backend/alembic.ini upgrade head
```
Review the autogenerated migration for unintended operations before committing.

### Coverage Threshold
Backend quality workflow enforces a coverage floor (currently 78%). Raise incrementally as the codebase matures.

### Makefile Targets
Quick helpers:
```
make snapshot-openapi   # regenerate OpenAPI snapshot
make test               # run backend tests
make backend-quality    # lint + type + coverage
```

## Deployment & Release

### Image Publishing
Version tags (`vX.Y.Z`) now trigger two GitHub Actions workflows:
- `release-backend.yml` builds & pushes `ghcr.io/<owner>/smb-loyalty-backend:<tag>` and `:latest`.
- `release-frontend.yml` builds & pushes `ghcr.io/<owner>/smb-loyalty-frontend:<tag>` and `:latest`.

Tag creation example:
```
git tag v1.0.0
git push origin v1.0.0
```

### Local Database Options
1. **SQLite (default)** – remove `DATABASE_URL` or set `sqlite:///./dev.db`.
2. **Local Postgres** – start the helper compose file:
```
docker compose -f docker-compose.local-db.yml up -d
export DATABASE_URL=postgresql+psycopg2://postgres:postgres@localhost:5433/loyalty_local
```
Run migrations:
```
make migrate
```

### Production Compose (Example)
`docker-compose.prod.yml` expects images already published to GHCR. Provide a sanitized `Backend/.env` with real secrets (never commit) and then:
```
PUBLIC_API_BASE_URL=https://api.example.com \
POSTGRES_USER=postgres POSTGRES_PASSWORD=secret POSTGRES_DB=loyalty_prod \
BACKEND_TAG=v1.0.0 FRONTEND_TAG=v1.0.0 docker compose -f docker-compose.prod.yml up -d
```

### Release Checklist
1. Ensure working tree clean, CI green.
2. `make strict` (format check, lint, type, audit, drift, coverage).
3. `make openapi-diff` – snapshot updated if intentional changes.
4. Bump version in changelog / docs (if maintained) and create tag.
5. Wait for `release-backend` & `release-frontend` workflow success.
6. Deploy using compose / platform referencing the immutable tag (digest preferred).
7. Post-deploy smoke test: health, auth, one core API path, payment sandbox call.
8. Monitor logs & Sentry for new error classes for ~15 minutes.

### Helper Scripts
`scripts/build_push_backend.sh <tag>` and `scripts/build_push_frontend.sh <tag>` allow local image build & push (requires `docker login ghcr.io`). These mirror the CI process for ad‑hoc hotfix validation.

### Sanitized Environment Templates
`Backend/.env.example` and `Frontend/.env.example` enumerate required variables. For local development:

1. Copy `Backend/.env.example` to `Backend/.env.local` and adjust values (SQLite by default).
2. Leave `Backend/.env` for production secrets only (or replace with `Backend/.env.production` and configure your host to load it).
3. Add production secrets via Azure Container Apps or your orchestration platform rather than committing them.

### Rollback
Redeploy previous known-good tag (no rebuild). Database downgrades are avoided unless absolutely necessary; prefer forward fixes.

### Future Improvements
- Add SBOM + provenance attestation.
- Add automated OpenAPI diff comment on PRs.
- Progressive tightening of mypy overrides.

### New Endpoint Gate
Adding endpoints without updating the snapshot now fails the test unless you set `ALLOW_NEW_ENDPOINTS=1` (temporary override for PR). Standard flow:
```
make snapshot-openapi
git add Backend/tests/openapi_snapshot.json
```

### Load Testing (k6)
Basic traffic scenario lives in `Backend/loadtests/basic_traffic.js`.
Run locally (needs k6 installed):
```
k6 run Backend/loadtests/basic_traffic.js --env API_BASE=http://localhost:8000 --env TEST_USER=demo@example.com --env TEST_PASS=password
```

### Stricter Typing (Payments Module Pilot)
`app.plugins.payments.*` now uses stricter mypy settings (disallow untyped defs, implicit optional, etc.). Expand this pattern gradually to other critical modules after addressing type gaps.


## Frontend Development Quick Start
```
cd Frontend
npm install
npm run dev
```

API base URL configured via `VITE_API_BASE_URL` (see `Frontend/.env.example` if present).

### Production smoke checks (Cypress)

`cypress/e2e/prod-smoke.cy.ts` exercises the production login/admin journey for admin, staff, and customer personas and fails if the React error boundary appears or if any `console.error` is raised. If the required credentials are not supplied (for example in CI branches that do not expose production secrets) the suite now self-skips before any commands execute, keeping builds green while signaling the missing inputs. Populate credentials through environment variables when you run it to avoid hard-coding secrets:

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

The spec clears storage between runs, so you can repeat it to hunt for intermittent UI regressions.

