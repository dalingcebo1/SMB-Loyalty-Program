# SMB Loyalty – User Experience Style Guard

This document supersedes the previous guide. It records the verified UI adjustments we just shipped so the same standards can be applied to every remaining page.

---

## 1. Layout & Wrapping Rules

- **Hero titles** must use the two-span pattern introduced on the welcome page:
  ```tsx
  <span className="user-hero__title-lines">
    <span className="user-hero__title-greeting">Welcome</span>
    <span className="user-hero__title-name">{dynamicName}</span>
  </span>
  ```
  The second span may wrap (`overflow-wrap: anywhere`) so long client names break naturally without shrinking the title.
- Every flex/grid child that contains text keeps `min-width: 0`, `white-space: normal`, `overflow-wrap: break-word`, and `word-break: normal`. Only apply `overflow-wrap: anywhere` to tokens (names, IDs) that may lack spaces.
- Preserve the clamp-based spacing defined in `Frontend/src/styles/user-app.css`. Extend those utilities instead of sprinkling manual margins.

## 2. Button System (Max Height: 38.37px)

All CTAs now share the compact silhouette that validated on welcome, booking, staff, and auth flows.

| Variant | Height | Vertical Padding | Font Size | Layout |
| --- | --- | --- | --- | --- |
| Primary / Secondary / Tertiary | `min-height: 38.37px` | `0.45rem` | `var(--text-md)` | `display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; line-height: 1.25;` |
| Dense | `min-height: 34px` | `0.4rem` | `var(--text-sm)` | Use only when CTAs stack tightly |
| Payment & Auth Buttons | `min-height: 38.37px` | `0.45–0.55rem` | `var(--text-md)` | Provider icons remain vertically centered via inline-flex |

### Implementation Checklist

1. Base all button classes (`.btn`, `.action-button`, `.payment-button`, `.auth-button`, staff `.action-btn`, etc.) on the measurements above.
2. Remove `white-space: nowrap` from button labels. Allow copy to wrap; rely on padding rather than forced truncation.
3. Treat `Frontend/src/styles/design-tokens.css` as the single source of truth:
   ```css
   --button-height-sm: 34px;
   --button-height-base: 38.37px;
   --button-height-lg: 38.37px;
   --button-height-xl: 38.37px;
   --touch-target-min: 38.37px;
   ```
   Any new component must read from these variables—no hard-coded heights.
4. Shared button styling lives in `styles/user-app.css` and `styles/shared-buttons.css`. Extend via modifiers rather than redefining padding or height.

## 3. Page-Specific Guidance

- **Welcome (`pages/Welcome.tsx`)** – keep the hero span pattern. Any personalised heading should mimic this structure.
- **Order Flow (`OrderForm.tsx`, `OrderConfirmation.css`, `Payment.css`)** – reuse `.action-button`; the flat variant removes shadows but preserves the size.
- **Auth (`features/auth/styles/auth-shared.css`)** – `.auth-button` now shares the 38.37px height so email and social actions align.
- **Staff Dashboard (`features/staff/components/DashboardOverview.css`)** – `.action-btn` is inline-flex and allows text wrapping while matching the shared sizing.

## 4. Colour & Contrast

- Primary blue (`--color-primary`), hover, and active tokens remain unchanged. When using the neutral charcoal CTA, confirm the foreground maintains ≥ 4.5:1 contrast.
- Status colours, badges, and surface tones continue to rely on existing tokens; no overrides were required for this pass.

## 5. Rollout Plan for Remaining Pages

1. Import the shared CSS before layering page-specific overrides.
2. Swap any ad-hoc hero markup for the two-span pattern when dynamic names are rendered.
3. Replace bespoke button rules with the shared classes or extend them with modifiers.
4. Validate in dev tools that buttons render at 38.37px (± browser rounding) and labels wrap gracefully.
5. Finish with `npm test` and `npm run lint` to guard against regressions.

## 6. Notes & Risks

- Buttons below the traditional 44px touch target follow a product directive; QA must keep an eye on tap precision during upcoming usability reviews.
- Any exception to these measurements needs explicit documentation plus tokens so the behaviour stays centrally configurable.
