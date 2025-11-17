# Documentation Streamline Summary

Purpose: Provide a minimal, consistent set of docs for new contributors and maintainers.

Canonical locations:
- `docs/` — curated developer & ops documentation (onboarding, deploys, architecture)
- `Backend/` — backend-specific tests, OpenAPI snapshots, and scripts
- `Frontend/` — frontend-specific guides and quick-starts

What to archive or relocate:
- Move long ad-hoc files like `AZURE_DEPLOYMENT_OVERVIEW.md` into `docs/deployment.md` and update references.
- Archive experimental notes, brainstorming, and ephemeral task notes to `docs/archived/`.
- Keep only stable, reviewed, and actionable docs in root-level markdown files.

Next steps:
1. Walk through key files and move them into `docs/` with short summaries.
2. Replace root-level clutter with pointers to canonical `docs/` pages.
3. Add this `docs/` folder to the repository index and update `.gitignore` for private guidance files.
