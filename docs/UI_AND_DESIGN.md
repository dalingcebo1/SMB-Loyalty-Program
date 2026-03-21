# UI & Design System Guide

## Overview

The frontend uses a token-based design system with shared CSS variables as the single source of truth. All new components must read from these tokens rather than hardcoding values.

---

## Design Tokens

### Source File

**`Frontend/src/styles/design-tokens.css`** — the only place to define base values.

### Key Tokens

#### Button Heights
```css
--button-height-sm:   34px;
--button-height-base: 38.37px;
--button-height-lg:   38.37px;
--button-height-xl:   38.37px;
--touch-target-min:   38.37px;
```

All CTAs share the 38.37px compact silhouette (a product directive). QA should monitor tap precision in usability reviews.

#### Text Scale
```css
--text-xs:  0.75rem;
--text-sm:  0.875rem;
--text-md:  1rem;
--text-lg:  1.125rem;
--text-xl:  1.25rem;
--text-2xl: 1.5rem;
```

#### Colors

| Token | Purpose |
|-------|---------|
| `--color-primary` | Primary action blue |
| `--color-primary-hover` | Hover state |
| `--color-primary-active` | Active/pressed state |
| Status tokens | Badges, alerts, feedback |
| Surface tokens | Card backgrounds, borders |

All status and surface colours rely on existing tokens — no overrides unless explicitly extending the palette.

#### Spacing

Clamp-based spacing is defined in `Frontend/src/styles/user-app.css`. Extend those utilities instead of adding manual margins.

---

## Button System

### Variants

| Variant | Height | Vertical Padding | Font | Usage |
|---------|--------|-----------------|------|-------|
| Primary / Secondary / Tertiary | `min-height: 38.37px` | `0.45rem` | `var(--text-md)` | Standard CTA |
| Dense | `min-height: 34px` | `0.4rem` | `var(--text-sm)` | Only when CTAs stack tightly |
| Payment | `min-height: 38.37px` | `0.45–0.55rem` | `var(--text-md)` | Payment action buttons |
| Auth | `min-height: 38.37px` | `0.45–0.55rem` | `var(--text-md)` | Email + social login |

### Button Layout

All button variants use:
```css
display: inline-flex;
align-items: center;
justify-content: center;
gap: 0.5rem;
line-height: 1.25;
```

Provider icons (Google, etc.) are vertically centered via `inline-flex`.

### Implementation Rules

1. Base all button classes on `design-tokens.css` height variables — no hardcoded heights.
2. Remove `white-space: nowrap` from button labels. Allow text to wrap; use padding not truncation.
3. Shared button styles live in `styles/user-app.css` and `styles/shared-buttons.css`. Extend via modifiers.
4. Button class naming: `.btn`, `.action-button`, `.payment-button`, `.auth-button`, `.action-btn` (staff).

### Page-Specific Button Guidance

| Page / Component | Class | Notes |
|-----------------|-------|-------|
| Welcome (`pages/Welcome.tsx`) | `.btn` | Hero + secondary CTAs |
| Order Flow (`OrderForm.tsx`) | `.action-button` | Flat variant, no shadows |
| Auth (`features/auth/styles/auth-shared.css`) | `.auth-button` | Email + social aligned at 38.37px |
| Staff Dashboard (`DashboardOverview.css`) | `.action-btn` | Inline-flex, wrappable labels |

---

## Layout & Wrapping

### Hero Title Pattern

Dynamic names must use the two-span pattern to handle long names gracefully:

```tsx
<span className="user-hero__title-lines">
  <span className="user-hero__title-greeting">Welcome</span>
  <span className="user-hero__title-name">{dynamicName}</span>
</span>
```

The second span may wrap (`overflow-wrap: anywhere`) so long client names break naturally without shrinking the title. Apply this pattern to any personalised heading.

### Text Overflow Rules

For all flex/grid children containing text:

```css
min-width: 0;
white-space: normal;
overflow-wrap: break-word;
word-break: normal;
```

Use `overflow-wrap: anywhere` only for tokens (IDs, generated names) that may lack spaces.

---

## Color & Contrast

- Primary blue and hover/active states are defined in `design-tokens.css`; do not override with ad-hoc values.
- Neutral charcoal CTAs must maintain ≥ 4.5:1 contrast ratio against their background.
- Use existing surface and status tokens for cards and badges.

### Accessibility

- All interactive elements must maintain ≥ 4.5:1 contrast (text/background).
- Focus indicators must be visible (do not remove `outline`).
- Button tap targets are 38.37px (below the traditional 44px — per product directive). QA monitors precision.

---

## Component Library

### Shared Styles

| File | Contains |
|------|---------|
| `styles/design-tokens.css` | All CSS variables (heights, colors, spacing, text scale) |
| `styles/user-app.css` | Global user-facing layout, clamp spacing |
| `styles/shared-buttons.css` | Button base classes and modifiers |
| `features/auth/styles/auth-shared.css` | Auth page button and form styles |
| `features/staff/components/DashboardOverview.css` | Staff dashboard action styling |

### Currency Display

**Always** route monetary values through `src/utils/format.ts`:

```typescript
import { formatCurrency, formatCents } from '@/utils/format';

// Display a rand amount (locale: en-ZA, currency: ZAR)
formatCurrency(50)       // "R 50.00"

// Display cents stored value
formatCents(5000)        // "R 50.00"
```

**Never** format currency manually. All backend amounts are integer cents; divide by 100 before displaying.

### Notifications / Toast

Use helpers from `src/utils/notifications.ts`. Analytics events are emitted automatically.

```typescript
import { showToast } from '@/utils/notifications';
showToast({ level: 'info', message: 'Order created' });
showToast({ level: 'error', message: 'Payment failed' });
// skipDedupe: true — allow repeated messages
showToast({ level: 'info', message: 'Processing batch...', skipDedupe: true });
```

### Capability Guards

Gate admin/staff UI elements:

```typescript
import { useCapabilities } from '@/features/admin/hooks/useCapabilities';

const { has } = useCapabilities();

return has('manage_inventory') ? <InventoryButton /> : null;
```

---

## Admin UI Patterns

### Page Structure

Admin pages follow a consistent hierarchy:
```
<PageHeader title="…" actions={<HeaderActions />} />
<FilterBar />                    {/* search + filter controls */}
<DataTable columns={…} data={…} />
<Pagination />
```

### Data Mutation Pattern

After creating, updating, or deleting data:

```typescript
const queryClient = useQueryClient();

const mutation = useMutation(updateItem, {
  onSuccess: () => {
    queryClient.invalidateQueries(['items']);  // refresh the list
    showToast({ level: 'success', message: 'Item updated' });
  }
});
```

### Inventory / Monetary Input

Convert between rands (user input) and cents (API) at the boundary:

```typescript
// Before submitting to API:
const amountCents = toCents(formValues.amount);   // multiply by 100

// Populating a form from API data:
const displayValue = centsToRand(item.price);     // divide by 100
```

---

## Staff UI Design

### Layout Principles

- Staff views are designed for both desktop and mobile use cases.
- Card nesting is audited for depth (max 2 levels visible at once).
- Action buttons must be large enough to tap comfortably on mobile.
- Navigation follows a persistent sidebar on desktop, bottom nav on mobile.

### Staff Dashboard

- **Overview** cards show key daily metrics (visits, revenue, active orders).
- **Quick Actions** (`.action-btn`) allow common workflows without navigating away.
- Action buttons use inline-flex with wrappable labels — avoid truncating service names.

### Mobile Considerations

- All touch targets minimum 38.37px (design decision; 44px is WCAG recommended — monitor in user testing).
- Test critical flows on real mobile devices, not just browser DevTools.
- Avoid relying on hover states for essential information.

---

## Theming

The design system supports per-tenant theming via CSS variable overrides. Token overrides can be applied at the `:root` level or on a scoped container to enable white-labelled deployments.

```css
/* Example tenant override */
[data-tenant="acme"] {
  --color-primary: #e63329;
  --color-primary-hover: #c4271f;
}
```

Tenant-specific theme values sourced from the `tenants.config` JSON field are applied at app initialization.

---

## Adding New Components

### Checklist

1. Read all values from `design-tokens.css` — no hardcoded heights, colours, or spacing.
2. Use existing shared classes (`btn`, `action-button`, etc.) before creating new ones.
3. Follow the two-span hero pattern for any heading with dynamic user content.
4. Apply text overflow rules (`min-width: 0; overflow-wrap: break-word`) to all flex/grid text children.
5. Gate admin-only UI with `useCapabilities().has(...)`.
6. Use `formatCurrency` / `formatCents` for all monetary display.
7. Add Vitest test in `src/features/<domain>/__tests__/` for new interactive components.
8. Run `npm run lint` and `npm test` before committing.

### Rollout Steps for Existing Pages

When bringing a page into compliance with this system:
1. Import shared CSS before layering page-specific overrides.
2. Replace hero headings with the two-span pattern.
3. Replace bespoke button rules with shared classes or modifiers.
4. Validate in browser DevTools that buttons render at 38.37px (± rounding).
5. Verify label text wraps gracefully at narrow viewport widths.
6. Finish with `npm test` and `npm run lint`.

---

## Notifications

Centralised toast helpers live in `src/utils/notifications.ts`. Always import these instead of calling `react-toastify` directly.

### Core Helpers

| Helper | Purpose |
|--------|---------|
| `notifySuccess(msg)` / `notifyError(msg)` | Generic success / error toasts |
| `notifyOrderConfirmed(orderId)` | Order confirmation (with emoji) |
| `notifyPaymentSuccess(amountCents)` | Payment succeeded |
| `notifyClipboard(message?)` | Clipboard copy feedback |
| `notifyRedeemSuccess()` / `notifyRedeemError()` | Loyalty redemption outcomes |
| `notifyBookingConfirmed()` | Booking confirmed → redirect to payment |

### i18n Keys (`notifySuccessKey` / `notifyErrorKey`)

Use translation keys for plan management messages instead of ad-hoc strings:

| Key | Default English |
|-----|----------------|
| `notifications.plan.created` | Plan created |
| `notifications.plan.updated` | Plan updated |
| `notifications.plan.archived` | Plan archived |
| `notifications.plan.restored` | Plan restored |
| `notifications.generic.error` | An unexpected error occurred |

### Dedupe Behaviour

Identical messages within a 2 500 ms window are suppressed. Pass `skipDedupe: true` when rapid repeats are intentional (e.g. streaming progress).

```ts
notifyInfo('Processing batch...', { skipDedupe: true, autoClose: 1500 });
```

A single `<ToastContainer />` must remain at the page root (handled in user-facing page layouts).
