# Past Orders Compact List & Modal Refactor (2025-11-10)

## Summary
Converted the Past Orders view from a grid of large cards into a compact, keyboard-accessible list with simplified modal details and smaller, standardized buttons. Stabilized accompanying tests to validate rendering and modal content.

## Objectives Addressed
- Shrink oversized buttons to align with style guide compact CTA sizing.
- Replace card layout with an information-dense list showing only: summary, date, status badge, total, view action.
- Simplify modal: remove timeline, loyalty, progress sections; keep essentials (service, order ID, status, extras, total paid, PIN, QR code, actions).
- Fix modal loading flow and close behavior (escape key, backdrop click, scroll lock) and ensure correct centering/width.
- Add resilient tests to confirm list rendering and modal essential fields.

## Implementation Details
### Files Touched
- `Frontend/src/pages/PastOrders.tsx`
  - Added `OrderRow` component for compact list rendering with ARIA attributes (`role="button"`, keyboard activation).
  - Normalized order detail fetch (`loadOrderDetails`) mapping variant field names (e.g., `payment_pin` vs `paymentPin`).
  - Introduced modal scroll lock + escape key handling in `useEffect`.
  - Simplified modal markup; added `data-testid="order-detail-table"` for test synchronization.
  - Removed previous complex sections (timeline, loyalty progress, large layout artifacts).
- `Frontend/src/pages/PastOrders.css` (prior changes in earlier steps)
  - Defines `.orders-list--compact`, `.order-row` structure, condensed grid columns for summary/meta/amount/view.
  - Minimal modal styling (narrow width, reduced padding, compact QR container).
- `Frontend/src/styles/shared-buttons.css`
  - Reduced padding & font size for `.action-button` variants to approach height guidance (using smaller vertical rhythm).
- `Frontend/src/pages/__tests__/PastOrders.compact.test.tsx`
  - Mocks API, toast, QR code, router navigation.
  - Adds tests: (1) list renders with two rows and currency formatting; (2) modal displays essentials after async load.
  - Updated to wait for `order-detail-table` test id, strict match for PIN label, role-based heading assertion.
  - Wrapped click inside `act` to flush React state transitions.

### Modal Loading Fixes
- Loading state now isolated: `modalLoading` true shows spinner-only overlay; only switches to populated modal after `setModalOrder` + `setModalLoading(false)`.
- Added `data-testid="order-detail-table"` so tests wait for populated content rather than timing out on spinner.
- Escape key and backdrop click close modal; scroll is locked while loading or viewing details.

### Accessibility & Semantics
- Each list item: `role="button"`, `tabIndex={0}`, handles `Enter` and `Space` keys for activation.
- Modal uses `role="dialog"`, `aria-modal="true"`, and generated `aria-labelledby` / `aria-describedby` attributes referencing title and order ID.
- Status badge text preserved in uppercase; still needs future enhancement for a visually hidden accessible status phrase (optional follow-up).

## Alignment With Style Guide
| Area | Style Guide Expectation | Current Implementation | Notes |
|------|-------------------------|------------------------|-------|
| Button Height | ~38.37px base / 34px dense | Reduced padding & font size; likely around 34–38px | Verify actual rendered height; consider using CSS vars `--button-height-base` directly. |
| Text Wrapping | Avoid forced nowrap; allow break-word | Removed large card layout; row summary relies on natural wrapping | Confirm `min-width:0` on row internal flex children (add if missing). |
| Hero Pattern | Two-span greeting/name | PastOrders hero uses simple title only | Acceptable (no dynamic name); no change needed. |
| Tokens Usage | Use design tokens (colors/heights/shadows) | Modal & rows rely partly on hard-coded spacing | Could migrate spacing to existing clamp utilities and tokens. |
| Badge Styling | Uppercase, compact, consistent palette | Badge class reused; variant mapping simplified | Ensure color tokens applied (verify in CSS). |
| Shadows | Prefer tokenized `var(--shadow-card)` | Modal may rely on bespoke shadow (check CSS) | If custom, refactor to token variable later. |

## Tests
- Passing suite for PastOrders (2 tests). The second test ensures loaded state by waiting for `order-detail-table` and verifying absence of loading text.
- Act warnings eliminated; stable asynchronous assertions.

## Edge Cases Considered
- Orders with malformed dates (fallback to "Unknown date").
- Extras array variance (string vs object shape). 
- Missing fields (`payment_pin`, `service_name`) with fallback placeholders.
- Rapid open/close sequences (scroll lock managed; event listeners cleaned up).

## Follow-Up Recommendations
1. Replace manual button sizing with tokens: `min-height: var(--button-height-base)` for consistency.
2. Add `aria-label` or visually hidden label for status badge describing semantic status beyond uppercase code.
3. Ensure `.order-row__main` children (meta elements) have `min-width:0` to prevent overflow clipping in narrow viewports.
4. Add a test for an order with extras to confirm extras render correctly when present.
5. Consider migrating loading overlay to a reusable component if other pages adopt similar pattern.
6. Add React Query invalidation when booking again if it mutates order history (future state updates).

## Verification
- Vitest run: PastOrders tests green (modal content asserts service, PIN, total, QR).
- Lint: No errors in modified files.
- No server start performed in adherence to project guardrails.

## Status
All tracked tasks completed; modal refactor and loading behavior fixed and verified via tests.

---
Generated on 2025-11-10.
