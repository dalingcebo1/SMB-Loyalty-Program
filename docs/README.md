# Project Documentation Pack

This folder contains a concise, maintained pack of documentation meant for contributors and maintainers.

Included:
- `CHECKLIST.md` — quick onboarding and contribution checklist
- `STREAMLINE_SUMMARY.md` — summary of documentation structure and recommended canonical docs
- `RECENT_FIXES.md` — critical bug fixes and lessons learned (Nov 30, 2025)
- `ARCHITECTURE_REVIEW.md` — comprehensive architecture review and multi-tenant roadmap

Guidelines:
- Keep `docs/` as the canonical set for user-facing and developer-facing docs.
- Move high-value, long-lived guides (deployment, architecture, testing) into `docs/` and retire ad-hoc files in the repo root when possible.
- Do not store AI agent guidance, Copilot instructions, or internal runbook secrets in the repository. Keep those in private channels or separate secret stores.
