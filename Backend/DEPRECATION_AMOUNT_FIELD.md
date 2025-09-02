# Deprecation Notice: Legacy `amount` Field (Rands) in Payment APIs

We have introduced a canonical integer cents field `amount_cents` for all payment and order related endpoints.
The existing floating-point (rands) `amount` field is now considered legacy and will be removed after the deprecation window.

## Timeline
- Introduced: 2025-09-02
- Deprecation announcement: 2025-09-02 (this document)
- Target removal date: 2025-11-01 (60 days window) — subject to change based on client adoption feedback.

## Current Behavior
Responses now include both fields:
```
{
  "amount_cents": 12345,
  "amount": 123.45,
  ...
}
```
`amount` is always derived as `amount_cents / 100` server-side to avoid client misinterpretation.

## Action Required for Clients
1. Migrate all consumers to rely on `amount_cents` as the source of truth.
2. Perform currency display by dividing by 100 (or using provided helpers) at the presentation layer.
3. Stop sending or relying on any inbound floating-point monetary representations (if applicable) and prefer integer cents payloads.

## Future Removal
After the target removal date, the `amount` field will be eliminated from responses. A final reminder will be issued two weeks prior to removal.

## Testing & Contract Validation
Automated contract tests (`tests/test_payments_contract.py`) ensure both fields currently exist and that `amount == amount_cents / 100`.
These tests will be updated to expect absence of `amount` post-removal.

## Rationale
- Eliminates ambiguity around units.
- Prevents floating point rounding errors across heterogeneous clients.
- Simplifies auditing and reconciliation processes.

## Questions / Feedback
Please open an issue or contact the backend team before the removal date if you have migration blockers.
