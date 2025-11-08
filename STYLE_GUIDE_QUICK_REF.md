# Quick Reference: Applying Style Guide to Other Pages

## Pre-flight Checklist

Before starting, ensure you have:
- [ ] Read the full `STYLE_GUIDE.md`
- [ ] Identified the page to update (e.g., `OrderForm.tsx`, `Account.tsx`, etc.)
- [ ] Located the page's CSS file (e.g., `OrderForm.css`)

## Step-by-Step Application Guide

### 1. Review Current Page Structure
```bash
# Check the page component
grep -n "UserHero\|UserSection\|UserCard" Frontend/src/pages/YourPage.tsx

# Check the page styles
cat Frontend/src/pages/YourPage.css
```

### 2. Update Color References (if page-specific CSS exists)

Replace old color values with tokens:
```css
/* BEFORE */
background: #f0f4ff;
color: #1e3a8a;
border: 1px solid #cbd5e1;

/* AFTER */
background: var(--color-surface-muted);
color: var(--color-text);
border: 1px solid var(--color-border);
```

### 3. Remove Unnecessary Subtitles

**In .tsx file:**
```tsx
/* BEFORE */
<UserHero
  title="Page Title"
  subtitle="Long descriptive text that's not needed"
/>

/* AFTER */
<UserHero
  title="Page Title"
/>
```

### 4. Fix Text Overflow Issues

**In .css file:**
```css
/* Add to any text containers */
.your-card-class {
  min-width: 0;  /* Critical for flex/grid children */
}

.your-text-class {
  word-break: normal;
  overflow-wrap: break-word;
}

/* Remove from headings if present */
h1, h2, h3 {
  /* Remove: hyphens: auto; */
  word-break: normal;
}
```

### 5. Update Spacing

**Hero sections:**
```css
.your-hero {
  padding: 1.75rem 1.5rem;
  gap: 1.25rem;
}

@media (min-width: 640px) {
  .your-hero {
    padding: 2rem 2.25rem;
  }
}

@media (min-width: 1024px) {
  .your-hero {
    padding: 2.5rem 2.75rem;
  }
}
```

**Cards:**
```css
.your-card {
  padding: 1.5rem;
  gap: 1rem;
}

@media (min-width: 640px) {
  .your-card {
    padding: 1.75rem;
    gap: 1.25rem;
  }
}

@media (min-width: 1024px) {
  .your-card {
    padding: 2rem;
    gap: 1.5rem;
  }
}
```

### 6. Update Typography

**Replace fixed sizes with responsive clamp:**
```css
/* BEFORE */
.title {
  font-size: 2rem;
}

/* AFTER */
.title {
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  line-height: 1.3;
}
```

### 7. Update Icons

**In .css file:**
```css
.your-icon {
  width: 3rem;
  height: 3rem;
  font-size: 1.5rem;
  border-radius: var(--radius-lg);
  background: var(--color-surface-muted);
  color: var(--color-icon);  /* Grey icons */
}
```

### 8. Update Buttons (if page-specific)

**Usually buttons inherit from global styles, but if overridden:**
```css
/* Remove page-specific button sizing */
/* Let global .btn styles from user-app.css apply */

/* Only keep semantic overrides like: */
.your-special-button {
  /* Specific behavior only */
}
```

### 9. Update Badges (if present)

```css
.your-badge {
  padding: 0.35rem 0.75rem;
  border-radius: 999px;
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.your-badge--primary {
  background: rgba(37, 99, 235, 0.1);
  color: #1d4ed8;
  border: 1px solid rgba(37, 99, 235, 0.2);
}
```

### 10. Update Shadows

```css
/* BEFORE */
box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);

/* AFTER */
box-shadow: var(--shadow-card);

/* For hover states */
box-shadow: var(--shadow-card-hover);
```

## Testing After Updates

### Visual Tests
```bash
# Start dev server (get approval first per instructions)
npm run dev

# Check these viewports:
# - Mobile: 375px
# - Tablet: 768px
# - Desktop: 1024px, 1440px
```

### Automated Tests
```bash
cd Frontend

# Lint
npm run lint

# Type check
npx tsc --noEmit

# Unit tests
npm test -- --run

# If tests fail, check:
# - Did you break any component props?
# - Did you change class names that tests depend on?
```

### Manual Verification Checklist

- [ ] Text stays within cards at all viewport sizes
- [ ] No horizontal scrolling
- [ ] Buttons are properly sized (not too big/small)
- [ ] Icons are grey (#94a3b8)
- [ ] Primary actions are blue (#2563eb)
- [ ] Cards have white background
- [ ] Shadows are subtle
- [ ] Spacing feels consistent
- [ ] Typography is readable and properly sized
- [ ] Interactive elements (hover/focus) work correctly

## Common Patterns to Look For

### Pattern 1: Gradient Buttons (Remove)
```tsx
/* BEFORE */
<button className="gradient-button">Action</button>

/* AFTER */
<button className="btn btn--primary">Action</button>
```

### Pattern 2: Colorful Icons (Simplify)
```css
/* BEFORE */
.icon-wash {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
}

/* AFTER */
.icon-wash {
  background: var(--color-surface-muted);
  color: var(--color-icon);
}
```

### Pattern 3: Large Padding (Reduce)
```css
/* BEFORE */
padding: 4rem 3rem;

/* AFTER */
padding: 2rem;

@media (min-width: 1024px) {
  padding: 2.5rem 2.75rem;
}
```

### Pattern 4: Fixed Widths (Make Responsive)
```css
/* BEFORE */
width: 600px;
max-width: 800px;

/* AFTER */
width: 100%;
max-width: 100%;
min-width: 0;
```

## Common Mistakes to Avoid

❌ **DON'T** change `UserHero`, `UserCard`, `UserSection` component APIs
✅ **DO** update props passed to them

❌ **DON'T** add `hyphens: auto` to headings
✅ **DO** use `word-break: normal` and `overflow-wrap: break-word`

❌ **DON'T** use hardcoded colors
✅ **DO** use CSS custom properties from `index.css`

❌ **DON'T** forget `min-width: 0` on flex/grid children
✅ **DO** add it to any container that has text content

❌ **DON'T** use pixel values for font sizes
✅ **DO** use `clamp()` for responsive typography

## Files to Reference

When updating a page, keep these files open:

1. `STYLE_GUIDE.md` - Full style guide
2. `Frontend/src/index.css` - Color tokens
3. `Frontend/src/styles/user-app.css` - Shared component styles
4. `Frontend/src/pages/Welcome.tsx` - Reference implementation
5. `Frontend/src/pages/Welcome.css` - Page-specific patterns

## Example: Complete Page Update

```tsx
// Before
<UserPage className="mypage-page">
  <UserHero
    title="My Page"
    subtitle="This is a long descriptive subtitle that we don't need"
  />
  <UserSection title="Content" subtitle="More descriptive text">
    <div className="old-card-style">
      <h3 style={{color: '#4338ca'}}>Hardcoded Title</h3>
      <p style={{fontSize: '14px'}}>Hardcoded text</p>
    </div>
  </UserSection>
</UserPage>

// After
<UserPage className="mypage-page" size="wide">
  <UserHero
    title="My Page"
    actions={
      <button className="btn btn--primary">Primary Action</button>
    }
  />
  <UserSection title="Content">
    <UserCard className="content-card">
      <h3 className="surface-card__title">Title</h3>
      <p className="surface-card__subtitle">Description</p>
    </UserCard>
  </UserSection>
</UserPage>
```

## Getting Help

If you encounter issues:

1. Check the `STYLE_GUIDE.md` for the specific component
2. Look at `Welcome.tsx` and `Welcome.css` for reference
3. Verify your changes with `npm run lint` and `npm test`
4. Test on multiple viewport sizes
5. Compare with the style guide checklist

## Summary

The goal is consistency, not perfection. Focus on:
- White cards with subtle shadows
- Blue buttons
- Grey icons
- Proper spacing
- Text that stays within bounds
- No unnecessary descriptive text

These changes make the UI feel cleaner, more professional, and easier to scan.
