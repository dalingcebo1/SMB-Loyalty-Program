```markdown
# High Priority Authentication Tasks (completed)

Summary of completed high-priority tasks for authentication and onboarding. Canonical location: `docs/authentication/tasks.md`.

## Completed Items

- Consolidated duplicate onboarding components into `UnifiedOnboarding.tsx`.
- Standardized backend onboarding logic: all new users start with `onboarded=false`.
- Enforced phone verification for all users.
- Fixed social login user creation to require onboarding.

## Verification

Backend tests and integration tests confirm the flows are working as expected.

```
