# Branch Management Guide

This document outlines the branch strategy, cleanup procedures, and best practices for the SMB Loyalty Program repository.

## Branch Strategy Overview

### Protected Branches

| Branch | Purpose | Trigger |
|--------|---------|---------|
| `main` | Production-ready code | Deploys to production (Azure Container Apps + SWA) |
| `develop` | Integration branch | Pre-production testing |

### Branch Workflow

```
feature/xyz ──┐
fix/abc ──────┼──> develop ──> main ──> tag vX.Y.Z
chore/123 ────┘
```

1. **Feature Development**: Create branches from `develop` using naming conventions:
   - `feat/*` - New features
   - `fix/*` - Bug fixes
   - `chore/*` - Maintenance tasks
   - `docs/*` - Documentation updates

2. **Integration**: Merge to `develop` via PR with CI checks

3. **Production Release**: Merge `develop` to `main` via release PR

4. **Versioning**: Tag releases with semantic versions (`vMAJOR.MINOR.PATCH`)

## Branch Cleanup Recommendations

### Branches to Keep

- `main` - Production branch (protected)
- `develop` - Integration branch (protected)

### Branches to Delete

The following branches should be deleted as they are stale, superseded, or clutter the repository:

#### Dependabot Branches (Stale PRs)

These branches have open PRs that should either be reviewed and merged, or closed:

| Branch | PR | Recommendation |
|--------|-----|----------------|
| `dependabot/github_actions/actions/checkout-5` | #21 | Review & merge or close |
| `dependabot/github_actions/actions/github-script-8` | #32 | Review & merge or close |
| `dependabot/github_actions/actions/setup-node-6` | #47 | Review & merge or close |
| `dependabot/github_actions/actions/setup-python-6` | #15 | Review & merge or close |
| `dependabot/github_actions/github/codeql-action-4` | #48 | Review & merge or close |
| `dependabot/npm_and_yarn/Frontend/eslint/js-9.38.0` | #40 | Review & merge or close |
| `dependabot/npm_and_yarn/Frontend/jsdom-27.0.1` | #38 | Review & merge or close |
| `dependabot/npm_and_yarn/Frontend/postcss-8.5.6` | #16 | Review & merge or close |
| `dependabot/npm_and_yarn/Frontend/recharts-3.3.0` | #39 | Review & merge or close |
| `dependabot/npm_and_yarn/Frontend/zod-4.1.12` | #37 | Review & merge or close |
| `dependabot/pip/Backend/pydantic-2.12.3` | #41 | Review & merge or close |
| `dependabot/pip/Backend/redis-7.0.0` | #45 | Review & merge or close |
| `dependabot/pip/Backend/sendgrid-6.12.5` | #25 | Review & merge or close |
| `dependabot/pip/Backend/sentry-sdk-2.42.1` | #46 | Review & merge or close |
| `dependabot/pip/Backend/uvicorn-standard--0.38.0` | #43 | Review & merge or close |

#### Stale Feature/Fix Branches

| Branch | Status | Recommendation |
|--------|--------|----------------|
| `chore/middleware-ci-cleanup-2025-09-18` | Stale | Delete after verifying merged |
| `feat/subscriptions-time-cleanup` | Stale | Delete after verifying merged |
| `fix/include-alembic-ini` | Stale | Delete after verifying merged |
| `test/openapi-diff-workflow` | Stale | Delete after verifying merged |
| `copilot/improve-ui-eligibility-and-sizing` | Stale | Delete after verifying merged |

## Cleanup Commands

### Delete Remote Branches

After verifying branches are merged or no longer needed:

```bash
# Delete a single remote branch
git push origin --delete <branch-name>

# Delete multiple branches (example)
git push origin --delete \
  chore/middleware-ci-cleanup-2025-09-18 \
  feat/subscriptions-time-cleanup \
  fix/include-alembic-ini \
  test/openapi-diff-workflow \
  copilot/improve-ui-eligibility-and-sizing
```

### Close Stale Dependabot PRs

Using GitHub CLI:

```bash
# Close a single PR
gh pr close <PR-NUMBER> --comment "Closing stale dependency update"

# Close multiple PRs
for pr in 15 16 21 25 32 37 38 39 40 41 43 45 46 47 48; do
  gh pr close $pr --comment "Closing stale dependency update - will batch update dependencies"
done
```

### Batch Dependency Updates

Instead of individual Dependabot PRs, consider:

1. **Batch updates** by updating `package.json` and `requirements.txt` directly
2. **Use Dependabot grouping** in `.github/dependabot.yml`:

```yaml
groups:
  npm-dependencies:
    patterns:
      - "*"
  pip-dependencies:
    patterns:
      - "*"
```

## Branch Protection Settings

Configure these settings via GitHub repository settings:

### For `main` Branch

- ✅ Require pull request reviews before merging (2 reviews)
- ✅ Require status checks to pass before merging:
  - `backend-ci`
  - `frontend-ci`
  - `openapi-snapshot`
- ✅ Require branches to be up to date before merging
- ✅ Restrict who can push to matching branches
- ✅ Do not allow force pushes
- ✅ Do not allow deletions

### For `develop` Branch

- ✅ Require pull request reviews before merging (1 review)
- ✅ Require status checks to pass before merging:
  - `backend-ci`
  - `frontend-ci`
- ✅ Do not allow force pushes

## Automated Branch Cleanup

Consider enabling these GitHub features:

1. **Automatic branch deletion** after PR merge (Settings → General → "Automatically delete head branches")

2. **Stale branch detection** via GitHub Actions workflow:

```yaml
name: Stale Branch Cleanup
on:
  schedule:
    - cron: '0 0 * * 0'  # Weekly on Sunday

jobs:
  cleanup:
    runs-on: ubuntu-latest
    steps:
      - name: List stale branches
        run: |
          echo "Branches with no commits in 30+ days:"
          # List would be generated here
```

## Best Practices

1. **Keep branches short-lived**: Feature branches should be merged or closed within 1-2 weeks

2. **Use descriptive names**: `feat/user-authentication` not `my-feature`

3. **Clean up after merge**: Delete branches immediately after merging

4. **Regular audits**: Monthly review of open branches and PRs

5. **Consolidate updates**: Batch dependency updates instead of individual PRs

## Deployment Flow Verification

The current deployment strategy is well-configured:

```
┌─────────────┐    ┌─────────────┐    ┌─────────────────┐
│   develop   │───▶│    main     │───▶│   Production    │
│  (testing)  │    │ (deployable)│    │ (Azure/SWA)     │
└─────────────┘    └─────────────┘    └─────────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │   Tag       │
                   │  vX.Y.Z     │
                   └─────────────┘
```

**Trigger Points:**
- Push to `main` → Production deploy (`backend-deploy-prod.yml`, `frontend-deploy-prod.yml`)
- Push to `develop` → Dev environment deploy (`backend-deploy-dev.yml`, `frontend-deploy-dev.yml`)
- Tags (`v*`) → Release artifacts (if configured)

---

*Last updated: March 2026*
