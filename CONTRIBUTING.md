## Contributing Guidelines

### Branch Strategy
- `main`: production deploy only. Merges here trigger deployment workflows; do not open feature PRs directly against `main`.
- `develop`: integration branch. All feature and fix branches target `develop` first. Periodic release PRs merge `develop` into `main` after quality gates pass.
- `feat/*`, `fix/*`, `chore/*`: short‑lived branches for scoped changes. Keep diffs small and focused.

### Pull Request Hygiene
- Before pushing: `git diff --name-status develop...HEAD` to ensure only intended files are included.
- If base branch was reset or your PR diff looks huge unexpectedly, close and recreate the PR (caching can misrepresent removed files).
- For endpoint additions/removals: regenerate the OpenAPI snapshot (`make snapshot-openapi`) and commit the updated `Backend/tests/openapi_snapshot.json`.
- Include concise rationale in the PR body; link to related docs or tickets.

### Time Handling Standard
- Always use `utc_now()` from `app/utils/time.py` for timestamps (no direct `datetime.utcnow()` in code or tests).
- Patterns: `utc_now()`, `utc_now().isoformat()`, `utc_now().date()`, arithmetic like `utc_now() - timedelta(days=7)`.
- In tests, monkeypatch or fixture‑override `app.utils.time.utc_now` for deterministic behavior.

### Testing & Quality Gates
- Run `make backend-quality` (ruff + mypy + coverage) before opening a backend PR.
- Ensure frontend changes pass `npm run lint` and `npm test` when touching React code.
- Do not start dev servers unless explicitly required for a manual verification round; rely on tests.

### OpenAPI & Contracts
- Contract tests will fail if public endpoints change without snapshot update.
- Use environment variable `ALLOW_NEW_ENDPOINTS=1` only for transitional PRs; remove before final merge.

### Migrations
- When models change: generate Alembic revision (`make migrate` or the documented commands) and review diff carefully. Separate large refactors from functional changes where possible.

### Prohibited / Discouraged Patterns
- `datetime.utcnow()` anywhere outside `utc_now()` wrapper.
- Large PRs mixing migrations, feature code, and unrelated formatting.
- Introducing secrets into committed `.env` files (never edit them without explicit approval).

### Release Flow
1. Merge feature branches into `develop`.
2. When stable: open PR `develop -> main` with summary of changes and confirm CI green.
3. Tag and monitor post‑deploy metrics & Sentry.

### Branch Protection Recommendations
Configure (via repository settings) protections for `main` and `develop`:
- Require status checks: backend CI, frontend CI, OpenAPI snapshot tests.
- Require at least 1 review for `develop`, 2 for `main`.
- Disallow force pushes and deletions.

### Pre‑commit (Optional Enforcement)
Add a `.pre-commit-config.yaml` with a simple grep hook blocking `datetime.utcnow(`; or extend ruff with a custom rule if needed.

### Contributor Onboarding
1. Clone & create `Backend/.env.local` from example.
2. Install dependencies (`pip install -r Backend/requirements.txt`).
3. Run `pytest -q` to verify a clean baseline.
4. Implement change using patterns above; open PR to `develop`.

### Questions
If unsure about architecture, time handling, or release process, consult `README.md` (Time Handling section) or ask maintainers before proceeding.

---
Keeping these guidelines tight ensures reliable deploys and predictable reviews.