# Docs Pack Changes Summary

What I changed:
- Added `docs/` with `README.md`, `CHECKLIST.md`, and `STREAMLINE_SUMMARY.md` as the canonical documentation pack.
- Added `docs/archived/INDEX.md` to track candidate docs for archival.
- Updated root `.gitignore` to ignore AI/internal instruction files stored under `.github/`.

Why:
- Centralize and standardize project documentation for easier onboarding and maintenance.
- Prevent private AI/Copilot instruction files from being accidentally committed.

Next actions for maintainers:
1. Review the files listed in `docs/archived/INDEX.md` and decide which to move or delete.
2. Migrate high-value docs (e.g., `AZURE_DEPLOYMENT_OVERVIEW.md`) into `docs/` with a single-sentence summary and link from the root.
3. Run `git status` and confirm the `.gitignore` changes behave as expected.
4. If you want, I can open PR with these changes and suggested migrations.
