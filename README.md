# SMB Loyalty Program

A multi-tenant SaaS loyalty platform for small and medium businesses — QR-based loyalty programs, order management, payment processing, and customer analytics, with a plugin-based backend and a React/Vite frontend.

| Workflow | Status |
| --- | --- |
| Frontend CI (lint, unit tests, build) | ![Frontend CI](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/frontend-ci.yml/badge.svg) |
| Backend CI (ruff, mypy, pytest, coverage ≥ 78%) | ![Backend CI](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/backend-ci.yml/badge.svg) |
| End-to-End Tests (Cypress smoke) | ![E2E Tests](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/e2e-tests.yml/badge.svg) |
| Production Deploy (Azure Container Apps) | ![Deploy](https://github.com/dalingcebo1/SMB-Loyalty-Program/actions/workflows/deploy.yml/badge.svg) |

## Documentation

All canonical documentation lives in [`docs/`](docs/):

| Document | Purpose |
|----------|---------|
| [ARCHITECTURE_AND_DEVELOPMENT.md](docs/ARCHITECTURE_AND_DEVELOPMENT.md) | Backend/frontend setup, API reference, testing, multi-tenant |
| [DEPLOYMENT_AND_OPERATIONS.md](docs/DEPLOYMENT_AND_OPERATIONS.md) | Azure, CI/CD, release flow, migrations, rollback, runbook |
| [SECURITY_AND_AUTH.md](docs/SECURITY_AND_AUTH.md) | Auth flows, Firebase, JWT, tenant domains, rate limiting |
| [UI_AND_DESIGN.md](docs/UI_AND_DESIGN.md) | Design tokens, component system, style guide |
| [BRANCH_MANAGEMENT.md](docs/BRANCH_MANAGEMENT.md) | Branch strategy, automated cleanup, Dependabot config |

## Monorepo Structure

```
SMB-Loyalty-Program/
├── Backend/          # FastAPI application
│   ├── app/
│   │   ├── core/     # rate limiting, auth, tenant context, jobs
│   │   ├── models.py # SQLAlchemy models
│   │   ├── plugins/  # feature modules (auth, loyalty, orders, payments…)
│   │   └── services/ # shared business logic helpers
│   ├── alembic/      # database migrations
│   ├── scripts/      # seed, smoke, build helpers
│   └── tests/        # pytest test suite
├── Frontend/         # Vite + React application
│   ├── src/
│   │   ├── features/ # domain slices (admin, auth, staff, user)
│   │   ├── utils/    # format, analytics, notifications
│   │   └── styles/   # design tokens and shared CSS
│   └── cypress/      # Cypress E2E smoke tests
└── docs/             # Canonical documentation (see table above)
```

## Quick Start

### Backend
```bash
cd Backend
cp .env.local.example .env.local   # configure database, secrets
pip install -r requirements.txt
make test                           # run tests
```

### Frontend
```bash
cd Frontend
npm install
npm run lint    # check code quality
npm test        # run Vitest unit tests
```

### Common Make Targets
```bash
make test               # backend tests
make backend-quality    # lint + type check + coverage
make snapshot-openapi   # regenerate OpenAPI snapshot
make frontend-lint      # ESLint
make frontend-test      # Vitest
```

## Branch Strategy

| Branch | Purpose | CI/CD |
|--------|---------|-------|
| `main` | Production-only | Triggers Azure prod deploy |
| `develop` | Integration | Triggers Azure dev deploy |
| `feat/*` / `fix/*` | Day-to-day work | PR into `develop` |

Deployment flow: `feat/x` → PR → `develop` → PR → `main` → production deploy.

## GitHub Secrets Required

Configure under **Settings → Secrets → Actions**:

| Secret | Purpose |
|--------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` | App signing key (32+ chars) |
| `JWT_SECRET` / `RESET_SECRET` | Token signing |
| `YOCO_SECRET_KEY` / `YOCO_WEBHOOK_SECRET` | Payment gateway |
| `CA_FIREBASE_CREDENTIALS_JSON` | Firebase service account JSON |
| `AZURE_CREDENTIALS` | Azure deployment credentials |
| `VITE_FIREBASE_*` | Firebase web SDK config (frontend) |

See [docs/SECURITY_AND_AUTH.md](docs/SECURITY_AND_AUTH.md) for full configuration details.
See [docs/DEPLOYMENT_AND_OPERATIONS.md](docs/DEPLOYMENT_AND_OPERATIONS.md) for Azure resource names and deployment procedures.
