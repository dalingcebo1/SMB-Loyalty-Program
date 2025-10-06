# Development Environment Isolation

To prevent accidental access to production services while working locally or running tests, use explicit environment files and overrides. This workflow keeps developer machines on SQLite by default and ensures automated tooling cannot silently reuse production credentials.

## Quick Start

1. Copy the local example file and customize it as needed:
   ```bash
   cp Backend/.env.local.example Backend/.env.local
   ```
2. Run backend commands with `APP_ENV_FILE` pointing at your local file. The Makefile targets added below handle this automatically.
3. Do **not** keep production secrets in tracked files. Deployment environments should inject their own variables (Azure Container Apps, GitHub Secrets, etc.).

## Environment File Precedence

`config.Settings` loads files in the following order:

1. `APP_ENV_FILE` (when set)
2. `Backend/.env.local`
3. `Backend/.env.development`
4. `Backend/.env.production`
5. `Backend/.env`

For test runs, `APP_ENV_FILE` defaults to unset and the loader falls back to pure in-memory defaults. Setting `APP_ENV_FILE` for Make targets ensures local scripts pick up SQLite rather than a shared production DSN.

## Recommended Files

| File | Purpose | Notes |
|------|---------|-------|
| `Backend/.env.local` | Developer overrides (SQLite by default) | Ignored by git. Copy from `.env.local.example`. |
| `Backend/.env.production` | Reference for deployment keys | Do **not** fill with real secrets. |
| `Backend/.env` | Leave blank or with placeholders | Avoid storing production credentials. |

## Makefile Targets

The Make targets automatically export `APP_ENV_FILE=Backend/.env.local`. Customize the file for your local setup (e.g., point to a Docker Postgres instance) without risking the production DSN.

If you need to test against a different configuration, temporarily override:

```bash
APP_ENV_FILE=Backend/.env.staging make test
```

## VS Code / IDE Integration

- Update launch configurations or task definitions to set `APP_ENV_FILE` (for example, in `.vscode/launch.json`).
- For terminal sessions, add `export APP_ENV_FILE=Backend/.env.local` to your shell profile when working on the project.

## Additional Tips

- CI pipelines should continue to set explicit environment variables; the loader will ignore `.env` files when `PYTEST_CURRENT_TEST` is set.
- Scripts that must talk to production (rare) should accept an explicit `--env-file` or `--database-url` argument so they never depend on the default `.env` file.
