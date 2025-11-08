# UI/UX Style Guide - User Pages

## Overview
This guide documents the standardized design system for user-facing pages. All improvements are centrally controlled through design tokens in `Frontend/src/index.css` and shared components in `Frontend/src/styles/user-app.css`.

## 1. Color Scheme (Centrally Controlled)

**Location:** `Frontend/src/index.css` `:root` variables

### Core Colors
```css
/* White background & cards */
--color-background: #ffffff;
--color-surface: #ffffff;
--color-surface-muted: #f8fafc;

/* Clean borders */
--color-border: #e2e8f0;
--color-border-subtle: #f1f5f9;
--color-border-strong: #cbd5e1;

/* Text hierarchy */
--color-text: #0f172a;
--color-text-muted: #64748b;
--color-text-soft: #94a3b8;

/* Grey icons */
--color-icon: #94a3b8;

/* Blue buttons */
--color-primary: #2563eb;
--color-primary-hover: #1d4ed8;
--color-primary-active: #1e40af;

/* Status colors */
--color-success: #22c55e;
--color-info: #0ea5e9;
--color-warning: #f97316;
--color-danger: #ef4444;
```

### Shadows (Subtle for white cards)
```css
--shadow-card: 0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.06);
--shadow-card-hover: 0 4px 6px rgba(15, 23, 42, 0.1), 0 2px 4px rgba(15, 23, 42, 0.06);
--shadow-hero: 0 10px 25px rgba(15, 23, 42, 0.08), 0 4px 10px rgba(15, 23, 42, 0.04);
--shadow-soft: 0 1px 2px rgba(15, 23, 42, 0.05);
```

## 2. Typography

### Principles
- Use `clamp()` for responsive, fluid typography
- Apply `word-break: normal` and `overflow-wrap: break-word` for natural text flow
- Avoid `hyphens: auto` on headings
- Always include `min-width: 0` on flex/grid children to enable text wrapping

### Hero Titles
```css
font-size: clamp(1.5rem, 4vw, 2rem);
font-weight: 700;
letter-spacing: -0.02em;
line-height: 1.2;
word-break: normal;
overflow-wrap: break-word;
```

### Hero Subtitles
```css
font-size: clamp(0.875rem, 2vw, 1rem);
line-height: 1.5;
color: var(--color-text-muted);
```

### Section Titles
```css
font-size: clamp(1.125rem, 2.5vw, 1.375rem);
font-weight: 600;
line-height: 1.3;
```

### Card Titles
```css
font-size: 1.125rem;
font-weight: 600;
line-height: 1.4;
```

### Body Text
```css
font-size: 0.875rem;
line-height: 1.5;
color: var(--color-text-muted);
```

### Eyebrows (Small labels)
```css
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.08em;
color: var(--color-text-muted);
```

## 3. Spacing System

### Hero Component
```css
/* Mobile */
padding: 1.75rem 1.5rem;
gap: 1.25rem;

/* Tablet (640px+) */
padding: 2rem 2.25rem;

/* Desktop (1024px+) */
padding: 2.5rem 2.75rem;

/* Compact variant */
padding: 1.5rem;  /* mobile */
padding: 1.75rem 2rem;  /* tablet */
padding: 2rem 2.25rem;  /* desktop */
```

### Cards
```css
/* Standard cards */
padding: 1.5rem;  /* mobile */
padding: 1.75rem;  /* tablet */
padding: 2rem;  /* desktop */
gap: 1rem;  /* mobile */
gap: 1.25rem;  /* tablet */
gap: 1.5rem;  /* desktop */

/* Tight cards */
padding: 1.25rem;  /* mobile */
padding: 1.5rem;  /* tablet */

/* Loose cards */
padding: 2rem;  /* mobile */
padding: 2.25rem;  /* tablet */
padding: 2.5rem;  /* desktop */
```

### Grid Gaps
```css
/* Insight cards grid */
gap: 1.5rem;
gap: 1.25rem;  /* mobile <768px */

/* General content grids */
gap: 1rem to 1.5rem depending on density
```

## 4. Component Guidelines

### Buttons

**Sizing:**
```css
/* Primary/Secondary */
padding: 0.7rem 1.25rem;
min-height: 40px;
font-size: 1rem;

/* Dense buttons */
padding: 0.6rem 1.1rem;
min-height: 36px;
font-size: 0.875rem;
```

**Colors:**
```css
/* Primary */
background: var(--color-primary);
color: #ffffff;

/* Secondary */
background: transparent;
color: var(--color-primary);
border: 1px solid rgba(37, 99, 235, 0.4);

/* Ghost */
background: #ffffff;
color: var(--color-text-muted);
border: 1px solid rgba(148, 163, 184, 0.5);
```

### Badges
```css
padding: 0.35rem 0.75rem;
border-radius: 999px;
font-size: 0.75rem;
font-weight: 600;
text-transform: uppercase;
letter-spacing: 0.04em;
white-space: nowrap;

/* Variants */
.badge--primary {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  border: 1px solid rgba(37, 99, 235, 0.2);
}

.badge--success {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
  border: 1px solid rgba(34, 197, 94, 0.2);
}

.badge--info {
  background: rgba(14, 165, 233, 0.1);
  color: #0284c7;
  border: 1px solid rgba(14, 165, 233, 0.2);
}
```

### Status Banners
```css
.status-banner {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.25rem;
  border-radius: var(--radius-lg);
  min-width: 0;
}

.status-banner__icon {
  width: 2.5rem;
  height: 2.5rem;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  font-size: 1.25rem;
  color: var(--color-primary);
}

.status-banner__content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

/* Variants */
.status-banner--info {
  background: rgba(14, 165, 233, 0.08);
  border-color: rgba(14, 165, 233, 0.2);
}

.status-banner--success {
  background: rgba(34, 197, 94, 0.08);
  border-color: rgba(34, 197, 94, 0.2);
}
```

### Cards (Surface Cards)
```css
.surface-card {
  background: var(--color-surface);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  min-width: 0;
}

/* Interactive cards */
.surface-card--interactive {
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}

.surface-card--interactive:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-card-hover);
  border-color: rgba(37, 99, 235, 0.2);
}

/* Muted cards */
.surface-card--muted {
  background: var(--color-surface-muted);
  border-color: var(--color-border-subtle);
  box-shadow: var(--shadow-soft);
}
```

## 5. Text Overflow Prevention

### Critical Rules
Always apply these to prevent text bleeding:

```css
/* On all flex/grid children */
min-width: 0;

/* On text containers */
word-break: normal;
overflow-wrap: break-word;

/* Avoid on headings */
/* DON'T use hyphens: auto on h1-h6 */

/* On buttons/badges */
white-space: nowrap;  /* For single-line items */
```

### Responsive Width Constraints
```css
/* Hero titles/subtitles */
width: 100%;
max-width: 100%;  /* mobile */
max-width: 90%;  /* tablet+ for titles */
max-width: 85%;  /* tablet+ for subtitles */
margin-inline: auto;  /* center when constrained */

/* Start-aligned heroes */
.user-hero--start .user-hero__title,
.user-hero--start .user-hero__subtitle {
  margin-inline: 0;
  max-width: 100%;
}
```

## 6. Icons

### Sizing
```css
/* Card icons (insight cards, etc) */
width: 3rem;
height: 3rem;
font-size: 1.5rem;
border-radius: var(--radius-lg);
background: var(--color-surface-muted);
color: var(--color-icon);

/* Status banner icons */
width: 2.5rem;
height: 2.5rem;
font-size: 1.25rem;
color: var(--color-primary);  /* or variant-specific */

/* Button icons */
width: 1.1em;
height: 1.1em;
color: currentColor;
```

## 7. Progress Indicators

### Circular Progress (React Circular Progressbar)
```jsx
<CircularProgressbar
  value={currentValue}
  maxValue={maxValue}
  text={`${currentValue}/${maxValue}`}
  styles={buildStyles({
    textSize: '16px',
    pathColor: '#2563eb',  // Use primary blue
    textColor: '#0f172a',
    trailColor: '#e5e7eb',
    pathTransitionDuration: 0.5,
  })}
/>
```

**Container sizing:**
```css
.insight-card__progress {
  width: 140px;  /* desktop */
  width: 120px;  /* mobile */
  margin: 1rem auto;
  flex-shrink: 0;
}
```

## 8. Responsive Breakpoints

```css
/* Mobile first, then: */

@media (min-width: 640px) {
  /* Tablet adjustments */
}

@media (min-width: 768px) {
  /* Small desktop */
}

@media (min-width: 1024px) {
  /* Desktop */
}
```

## 9. Page Structure

### Standard User Page Layout
```tsx
<UserPage className="page-name" size="wide">
  <UserHero
    eyebrow="Category"
    title={<>Main Title</>}
    actions={<>
      <button className="btn btn--primary">Primary Action</button>
      <button className="btn btn--secondary">Secondary Action</button>
    </>}
  />

  {conditionalBanner && (
    <UserCard className="status-banner status-banner--info" muted>
      <span className="status-banner__icon">
        <Icon />
      </span>
      <div className="status-banner__content">
        <h3 className="status-banner__title">Title</h3>
        <p className="status-banner__description">Description</p>
      </div>
    </UserCard>
  )}

  <UserSection title="Section Title" className="section-class">
    <div className="content-grid">
      <UserCard className="card-class" interactive>
        {/* Card content */}
      </UserCard>
    </div>
  </UserSection>
</UserPage>
```

## 10. Implementation Checklist

When updating a page to match this style guide:

- [ ] Remove unnecessary descriptive subtitles from heroes
- [ ] Update color references to use central tokens
- [ ] Apply proper spacing (padding/gap) values
- [ ] Add `min-width: 0` to all flex/grid children
- [ ] Use `clamp()` for responsive font sizes
- [ ] Apply proper text overflow rules (`word-break: normal`, `overflow-wrap: break-word`)
- [ ] Update button sizing if needed
- [ ] Ensure badges use new styling with borders
- [ ] Update shadows to use subtle variants
- [ ] Test on mobile, tablet, and desktop viewports
- [ ] Verify text stays within cards on all screen sizes
- [ ] Check icon colors match grey theme
- [ ] Verify interactive states (hover, focus) work correctly

## 11. Common Patterns

### Insight/Stat Cards Grid
```css
.insights-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 1.5rem;
}

@media (max-width: 768px) {
  .insights-grid {
    grid-template-columns: 1fr;
    gap: 1.25rem;
  }
}
```

### Card with Icon, Header, and Content
```tsx
<UserCard className="insight-card" interactive>
  <span className="insight-card__icon">
    <Icon />
  </span>
  <div className="surface-card__header">
    <h3 className="surface-card__title">Title</h3>
    <span className="badge badge--info">Label</span>
  </div>
  <p className="surface-card__subtitle">
    Description text
  </p>
  <div className="card-footer">
    {/* Additional content */}
  </div>
</UserCard>
```

## 12. Files Modified

Core style files that control the design system:
- `Frontend/src/index.css` - Color tokens, shadows, global resets
- `Frontend/src/styles/user-app.css` - Shared component styles
- `Frontend/src/pages/Welcome.css` - Page-specific refinements (pattern for other pages)

## Notes

- All measurements use rem units for accessibility
- Colors are centrally controlled via CSS custom properties
- Mobile-first responsive design approach
- Accessibility: 44px minimum touch targets, proper ARIA labels, semantic HTML
- Performance: Reduced shadow complexity, optimized transitions
- This design system ensures consistency across all user-facing pages
