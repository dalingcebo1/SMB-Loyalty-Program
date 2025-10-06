# Convenience Makefile

PYTHON ?= python
FRONTEND_DIR := Frontend
FRONTEND_NPM := npm --prefix $(FRONTEND_DIR)
DEV_ENV_FILE ?= Backend/.env.local
DEV_ENV_PREFIX := APP_ENV_FILE=$(DEV_ENV_FILE)

.PHONY: help snapshot-openapi refresh-openapi openapi-diff test coverage lint format backend-quality freeze-deps drift-check strict migrate \
	frontend-install frontend-build frontend-build-safe frontend-build-minimal frontend-dev frontend-preview \
	frontend-lint frontend-typecheck frontend-test frontend-test-watch frontend-test-coverage frontend-serve \
	frontend-cypress-open frontend-cypress-run

help:
	@echo "Available targets (Backend):"
	@echo "  snapshot-openapi       Regenerate OpenAPI snapshot"
	@echo "  refresh-openapi        Alias of snapshot-openapi"
	@echo "  openapi-diff           Show diff between current generated spec and committed snapshot (no write)"
	@echo "  test                   Run backend tests"
	@echo "  coverage               Run backend tests with coverage (threshold 70%)"
	@echo "  lint                   Run Ruff lint checks"
	@echo "  format                 Apply Ruff formatter in-place"
	@echo "  backend-quality        Run lint, type check, tests with coverage"
	@echo "  strict                 Run full strict gate (lint, format check, type check, audit, drift)"
	@echo "  migrate                Apply latest DB migrations (alembic upgrade head)"
	@echo "  freeze-deps            Re-freeze backend requirements.txt from requirements.in"
	@echo "  drift-check            Run migration drift check locally"
	@echo ""
	@echo "Available targets (Frontend):"
	@echo "  frontend-install       Install frontend dependencies"
	@echo "  frontend-dev           Start Vite dev server (approval required before invoking)"
	@echo "  frontend-build         Production build (full)"
	@echo "  frontend-build-safe    Production build with reduced memory"
	@echo "  frontend-build-minimal Minimal production build (lowest memory)"
	@echo "  frontend-preview       Preview built app"
	@echo "  frontend-lint          Run eslint"
	@echo "  frontend-typecheck     Run TypeScript project references build (type check)"
	@echo "  frontend-test          Run unit tests (vitest)"
	@echo "  frontend-test-watch    Run vitest in watch mode"
	@echo "  frontend-test-coverage Run vitest with coverage"
	@echo "  frontend-serve         Run node serve.js (static serving)"
	@echo "  frontend-cypress-open  Open Cypress UI"
	@echo "  frontend-cypress-run   Run Cypress tests headless"
	@echo ""
	@echo "Variables: PYTHON (default: python)"

snapshot-openapi:
	./Backend/scripts/update_openapi_snapshot.sh

refresh-openapi: snapshot-openapi

openapi-diff:
	@tmpfile=$$(mktemp) && \
	cd Backend && PYTHONPATH=. $(PYTHON) scripts/dump_openapi.py > $$tmpfile && \
	diff -u Backend/tests/openapi_snapshot.json $$tmpfile || true && \
	rm -f $$tmpfile

test:
	cd Backend && PYTHONPATH=. pytest -q

backend-quality:
	cd Backend && $(DEV_ENV_PREFIX) ruff check . && $(DEV_ENV_PREFIX) mypy . && PYTHONPATH=. pytest --cov=Backend --cov-report=term-missing -q

strict:
	# Fail if formatting changes would be applied
	 cd Backend && $(DEV_ENV_PREFIX) ruff format --check .
	# Lint & type check
	 cd Backend && $(DEV_ENV_PREFIX) ruff check . && $(DEV_ENV_PREFIX) mypy .
	# Security / vulnerability audit
	 cd Backend && $(DEV_ENV_PREFIX) pip-audit -r requirements.txt || (echo "pip-audit found issues" && exit 1)
	# Migration drift
	 cd Backend && $(DEV_ENV_PREFIX) $(PYTHON) scripts/check_migration_drift.py
	# Run tests with enforced coverage threshold
	cd Backend && PYTHONPATH=. pytest --cov=Backend --cov-report=term-missing --cov-fail-under=70 -q

lint:
	 cd Backend && $(DEV_ENV_PREFIX) ruff check .

format:
	 cd Backend && $(DEV_ENV_PREFIX) ruff format .

coverage:
	cd Backend && PYTHONPATH=. pytest --cov=Backend --cov-report=term-missing --cov-fail-under=70 -q

freeze-deps:
	 $(DEV_ENV_PREFIX) ./Backend/scripts/freeze_backend_deps.sh

drift-check:
	 cd Backend && $(DEV_ENV_PREFIX) $(PYTHON) scripts/check_migration_drift.py

migrate:
	@echo "[migrate] Using DATABASE_URL=$${DATABASE_URL:-<not set>}"
	@# Prefer project venv if present
	@if [ -f Backend/.venv/bin/activate ]; then \
		echo "[migrate] Activating Backend/.venv"; \
		. Backend/.venv/bin/activate; \
		cd Backend && alembic -c alembic.ini upgrade head; \
	else \
		echo "[migrate] No venv found, using system $(PYTHON)"; \
		cd Backend && alembic -c alembic.ini upgrade head; \
	fi

# ----------------------- Frontend Targets -----------------------

frontend-install:
	$(FRONTEND_NPM) install

frontend-dev:
	@echo "Per project guidelines, obtain approval before starting long-running dev servers."
	$(FRONTEND_NPM) run dev

frontend-build:
	$(FRONTEND_NPM) run build

frontend-build-safe:
	$(FRONTEND_NPM) run build:safe

frontend-build-minimal:
	$(FRONTEND_NPM) run build:minimal

frontend-preview:
	$(FRONTEND_NPM) run preview

frontend-lint:
	$(FRONTEND_NPM) run lint

frontend-typecheck:
	$(FRONTEND_NPM) exec tsc -b

frontend-test:
	$(FRONTEND_NPM) run test

frontend-test-watch:
	$(FRONTEND_NPM) run test:watch

frontend-test-coverage:
	$(FRONTEND_NPM) run test:coverage

frontend-serve:
	$(FRONTEND_NPM) run serve

frontend-cypress-open:
	$(FRONTEND_NPM) run cypress:open

frontend-cypress-run:
	$(FRONTEND_NPM) run cypress:run
