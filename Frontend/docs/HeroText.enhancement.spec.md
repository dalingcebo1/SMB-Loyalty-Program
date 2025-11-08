# HeroText Enhancement Specification

## 1. Summary
Evolve the existing `HeroText` component (currently used on auth pages) into a flexible hero system consistent with staff-facing layout patterns (e.g. `ModernStaffDashboard`, `ManualVisitLogger`, `CustomerAnalytics`). The goal is to unify typography, wrapping strategy, color modes, and layout extensibility without introducing regressions.

## 2. Goals
1. Harmonize hero typography between public/auth pages and staff pages (stepped responsive sizes).
2. Improve subtitle wrapping: rely on container measure + balanced wrapping; reduce aggressive mid‑word breaks/hyphenation.
3. Support contextual tones (default, inverted on dark/gradient, subtle plain) via a simple `tone` prop.
4. Allow optional aside content (status badges / controls) that reflows under the hero on small screens.
5. Provide container-based width management rather than fixed `ch` values for better alignment with staff `max-w-*` patterns.
6. Ensure accessibility: single logical heading per page, semantic levels adjustable, maintain contrast in all tones.
7. Establish a migration path requiring minimal code edits for existing pages.

## 3. Non-Goals
- Implementing dynamic localization resizing beyond width variable override.
- Introducing runtime JS line balancing polyfills (native CSS only for now).
- Replacing Tailwind utilities used in staff pages; we layer improvements without refactoring those pages entirely.
- Comprehensive visual regression tooling (left for a later phase).

## 4. Current State Analysis
| Aspect | Current Auth (`HeroText`) | Staff Pages Pattern |
|--------|---------------------------|---------------------|
| Title sizing | `var(--text-3xl)` + media override | Utility chain `text-2xl sm:text-3xl lg:text-4xl` |
| Subtitle sizing | clamp between sm-md | `text-sm sm:text-base` |
| Wrapping | `text-wrap: balance` + `overflow-wrap: break-word` + hyphens | Natural wrapping (no hyphens, no forced breaks) |
| Measure | Fixed `max-width: 42ch` | Container width (`max-w-xl`) |
| Colors | Inherit `--color-text`/`--color-text-soft` | Contextual on gradients (indigo/blue variants) |
| Layout addons | None | Badges/controls appear adjacent (flex row) |
| Aside/status support | Absent | Inline cluster with controls |

## 5. Requirements
### Functional
- R1: Provide responsive stepped title sizes (mobile / sm / lg) configurable via CSS custom properties.
- R2: Subtitle should balance lines when supported (`text-wrap: balance`) else natural wrapping with minimal forced breaks.
- R3: Support `tone` prop mapping to pre-defined color variable sets (e.g. `--hero-title-color`, `--hero-subtitle-color`).
- R4: Support optional `aside` prop displayed beside hero text on `md+` screens and stacked below on smaller screens.
- R5: Allow overriding subtitle measure via `subtitleMaxWidth` OR container size tokens.
- R6: Preserve existing `eyebrow`, `title`, `subtitle`, `as`, `align` functionality.
- R7: Provide dev-only warning if multiple `HeroText` components render with `as="h1"` inside the same React tree (potential duplicate main headings).

### Accessibility
- A1: Ensure contrast ratios: default tone vs. background ≥ WCAG AA (use current variable palette; dark surfaces attach 'inverted' tone selecting lighter text vars).
- A2: `aside` content must remain reachable in DOM order after hero text; stacking order should preserve logical reading sequence.
- A3: Eyebrow stays non-heading; supports screen reader emphasis via visually bold text only.

### Performance
- P1: Avoid extra layout thrash; rely on modern CSS only (no JS measure calculations).
- P2: Additional CSS should be minimal (<1kb gzipped). No new runtime dependencies.

### Maintainability
- M1: Changes isolated to `HeroText` and new stylesheet (`hero-text.css` enhancement). No modifications to existing staff page markup initially.
- M2: Clear documentation update describing tone & aside usage (extend `HeroText.md`).

## 6. Proposed API Extensions
```ts
interface HeroTextProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
  align?: 'left' | 'center';
  subtitleMaxWidth?: string; // retained
  tone?: 'default' | 'inverted' | 'subtle' | 'brand';
  aside?: React.ReactNode; // new cluster content
  layout?: 'stack' | 'inline'; // inline attempts side-by-side when space
  compact?: boolean; // applies tighter leading and tracking
  id?: string;
  className?: string;
}
```

## 7. CSS Strategy
Add variable set (possibly in `hero-text.css`):
```css
:root {
  --hero-title-mobile: var(--text-2xl);
  --hero-title-sm: var(--text-3xl);
  --hero-title-lg: var(--text-4xl);
  --hero-subtitle-mobile: var(--text-sm);
  --hero-subtitle-sm: var(--text-base);
}

.hero-text--stepped .hero-text__title {
  font-size: var(--hero-title-mobile);
}
@media (min-width: 640px) {
  .hero-text--stepped .hero-text__title { font-size: var(--hero-title-sm); }
  .hero-text--stepped .hero-text__subtitle { font-size: var(--hero-subtitle-sm); }
}
@media (min-width: 1024px) {
  .hero-text--stepped .hero-text__title { font-size: var(--hero-title-lg); }
}

.hero-text[data-tone='inverted'] { --hero-title-color: #fff; --hero-subtitle-color: #eef2ff; }
.hero-text[data-tone='default'] { --hero-title-color: var(--color-text); --hero-subtitle-color: var(--color-text-soft); }
.hero-text[data-tone='subtle'] { --hero-title-color: var(--color-text-muted); --hero-subtitle-color: var(--color-text-soft); }
.hero-text[data-tone='brand'] { --hero-title-color: var(--color-primary); --hero-subtitle-color: var(--color-primary-contrast); }

.hero-text__title { color: var(--hero-title-color); }
.hero-text__subtitle { color: var(--hero-subtitle-color); }

.hero-text--inline { display: flex; flex-direction: column; gap: 1rem; }
@media (min-width: 768px) {
  .hero-text--inline { flex-direction: row; align-items: center; justify-content: space-between; }
  .hero-text--inline .hero-text__aside { flex-shrink: 0; }
}

@supports (text-wrap: balance) {
  .hero-text__subtitle { text-wrap: balance; }
}
```

Remove or relax `hyphens:auto` and `overflow-wrap: break-word` when `tone='default'` & content length below threshold; fallback only if a word exceeds container width (optional progressive enhancement later).

## 8. Migration Plan
1. Introduce new props & CSS (feature flag via class `.hero-text--v2`).
2. Replace auth usages incrementally: add `layout='inline'` only where needed (likely keep `stack` for auth).
3. Staff pages: optional adoption to replace bespoke hero markup (deferred: low priority).
4. Documentation update & developer note about avoiding multiple `h1`.
5. Add console warning in development for duplicate main headings.

## 9. Phased Implementation
| Phase | Description | Output |
|-------|-------------|--------|
| P1 | Add CSS variables & tone mapping, keep old structure | Extended `hero-text.css` |
| P2 | Extend component props; implement `aside` & `layout` logic | Updated `HeroText.tsx` |
| P3 | Migrate auth pages to new variant (retain existing appearance) | Auth pages diff |
| P4 | Add dev warning & doc updates | Docs + runtime check |
| P5 | Optional staff page unification | Staff pages incremental PRs |

## 10. Risks & Mitigations
| Risk | Impact | Mitigation |
|------|--------|-----------|
| Tone contrast mis-match | Reduced readability | Pre-test contrast with brand palette; fallback to default tone if insufficient |
| Layout shift on migration | Visual regression | Ship under `.hero-text--v2` class and snapshot diff before removal of old styles |
| Duplicate `h1` creeping in | Accessibility issue | Dev console warning & lint rule candidate |
| Increased CSS size | Performance | Audit final gzip (<1kb target) |

## 11. Test Plan
### Unit (Vitest)
- Render with each `tone` ensures correct `data-tone` attribute & computed style (basic color presence).
- Render with `aside` and `layout='inline'` verifies reflow classes at `md` breakpoint (jsdom: class presence only).
- Duplicate h1 warning triggers when two `HeroText` with `as='h1'` in same render tree (mock console.warn).

### Integration (Cypress)
- Visual check at 375px/768px/1280px for balanced wrapping (screenshots).
- Subtitle length stress test (long lorem) wraps without horizontal scroll.

## 12. Metrics / Success Criteria
- ≤ 1kb added CSS compressed.
- No new ESLint/type errors.
- Zero accessibility violations (Axe) on auth pages after migration.
- Subtitle line count reduced for medium-length strings compared to old variant (manual observation or automated heuristic).

## 13. Future Extensions (Deferred)
- Automatic detection of very long words and introduce `hyphens:auto` selectively.
- `HeroCluster` abstracting hero + filter controls (for analytics/staff pages).
- Localization length analyzer feeding dynamic `subtitleMaxWidth`.

## 14. Approval Checklist
- [ ] Design sign-off (visual consistency with staff pages)
- [ ] Accessibility review (contrast, heading semantics)
- [ ] Performance check (bundle diff)
- [ ] Developer documentation updated
- [ ] Test suite additions merged

---
Document created: No code changes applied yet; ready for review.
