# Project Documentation Pack

This folder contains a concise, maintained pack of documentation meant for contributors and maintainers.

Included:
- `CHECKLIST.md` — quick onboarding and contribution checklist
- `STREAMLINE_SUMMARY.md` — summary of documentation structure and recommended canonical docs
- `BRANCH_MANAGEMENT.md` — branch strategy, cleanup procedures, and protection recommendations
- `OPERATIONS_RUNBOOK.md` — operational procedures and maintenance guides
- `DEV_DEPLOYMENT_RUNBOOK.md` — development environment deployment guide

Guidelines:
- Keep `docs/` as the canonical set for user-facing and developer-facing docs.
- Move high-value, long-lived guides (deployment, architecture, testing) into `docs/` and retire ad-hoc files in the repo root when possible.
- Do not store AI agent guidance, Copilot instructions, or internal runbook secrets in the repository. Keep those in private channels or separate secret stores.
