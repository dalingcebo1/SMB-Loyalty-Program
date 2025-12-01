# Admin Modern CSS - Quick Reference Guide

## 🎨 Available CSS Classes

### Cards

#### Base Card
```css
.admin-card
```
- Background: White with subtle gradient border
- Shadow: Layered (xs + sm + accent color)
- Hover: Subtle transform
- Transition: 200ms smooth

#### Card Variants
```css
.admin-card-primary    /* Blue gradient background */
.admin-card-interactive /* Cursor pointer + active effect */
```

#### Specialized Cards
```css
.stat-card            /* For metrics with background pattern */
.action-card          /* For clickable action items */
```

---

### Alerts

```css
.admin-alert                /* Base alert styling */
.admin-alert-warning        /* Amber gradient */
.admin-alert-error          /* Red gradient */
.admin-alert-success        /* Green gradient */
.admin-alert-info           /* Blue gradient */
```

**Features:**
- Animated slide-down entrance
- Accent border (left or top)
- Gradient background
- Backdrop blur

**Example:**
```tsx
<div className="admin-alert admin-alert-warning">
  <p>⚠️ Action required</p>
</div>
```

---

### Badges

```css
.admin-badge                /* Base badge styling */
.admin-badge-gray           /* Neutral */
.admin-badge-blue           /* Info/Primary */
.admin-badge-green          /* Success/Active */
.admin-badge-amber          /* Warning */
.admin-badge-red            /* Error/Urgent */
.admin-badge-purple         /* Special */
```

**Stat Trend Badges:**
```css
.stat-trend-positive        /* Green with ↑ arrow */
.stat-trend-negative        /* Red with ↓ arrow */
```

**Example:**
```tsx
<span className="admin-badge admin-badge-green stat-trend-positive">
  +12.5%
</span>
```

---

### Buttons

```css
.admin-button               /* Base button */
.admin-button-primary       /* Blue gradient, main actions */
.admin-button-secondary     /* Gray border, secondary actions */
.admin-button-ghost         /* Transparent, tertiary actions */
```

**States:**
- `:hover` - Brightness increase, scale up
- `:active` - Scale down (0.98)
- `:disabled` - Opacity 0.5, cursor not-allowed

**Example:**
```tsx
<button className="admin-button admin-button-primary">
  Save Changes
</button>
```

---

### Icon Wrappers

```css
.admin-icon-wrapper         /* Base wrapper */
.admin-icon-wrapper-sm      /* 32×32px */
.admin-icon-wrapper-md      /* 40×40px */
.admin-icon-wrapper-lg      /* 48×48px */
```

**Features:**
- Gradient backgrounds
- Rounded corners
- Flex centering
- Shadow on hover

**Example:**
```tsx
<div className="admin-icon-wrapper admin-icon-wrapper-md">
  <HiUsers className="w-5 h-5" />
</div>
```

---

### Links

```css
.admin-link                 /* Styled link with hover underline */
```

**Features:**
- Blue color
- Underline on hover
- 150ms transition

**Example:**
```tsx
<a href="/path" className="admin-link">View Details →</a>
```

---

### Loading States

```css
.admin-skeleton            /* Shimmer loading effect */
.admin-pulse               /* Pulsing animation */
.admin-spinner             /* Rotating spinner */
```

**Example:**
```tsx
{/* Skeleton for text */}
<div className="admin-skeleton" style={{ height: '20px', width: '120px' }} />

{/* Spinner */}
<div className="admin-spinner" />
```

---

### Layout Utilities

#### Dividers
```css
.admin-divider             /* Horizontal divider */
.admin-divider-vertical    /* Vertical divider */
```

#### Sections
```css
.admin-section             /* Section container */
.admin-section-collapsible /* Collapsible details element */
```

**Example:**
```tsx
<details className="admin-section-collapsible">
  <summary>Advanced Options</summary>
  <div>Content here...</div>
</details>
```

#### Grid
```css
.admin-grid                /* Responsive auto-fit grid */
```

---

### Focus & Accessibility

```css
.admin-focus-ring          /* Custom focus ring (blue, 2px offset) */
```

**Automatically applied to:**
- Interactive cards
- Buttons
- Links (when focused)

---

## 🎯 Common Patterns

### Alert with Icon
```tsx
<div className="admin-alert admin-alert-warning">
  <div className="flex items-start gap-3">
    <div className="admin-icon-wrapper admin-icon-wrapper-md">
      <HiExclamation className="w-5 h-5" />
    </div>
    <div>
      <h3 className="font-semibold mb-1">Attention Needed</h3>
      <p className="text-sm">5 pending orders require review</p>
    </div>
  </div>
</div>
```

### Stat Card with Badge
```tsx
<div className="stat-card admin-card">
  <p className="text-xs text-gray-500 uppercase">Revenue</p>
  <p className="text-2xl font-bold">R 12,450</p>
  <span className="admin-badge admin-badge-green stat-trend-positive">
    +8.2%
  </span>
</div>
```

### Action Card with Badge
```tsx
<div className="action-card admin-card admin-card-interactive" onClick={...}>
  <div className="flex items-center justify-between">
    <h3 className="font-semibold">Manage Users</h3>
    <span className="admin-badge admin-badge-blue">12</span>
  </div>
  <p className="text-sm text-gray-600">Add, edit, or remove users</p>
</div>
```

### Loading Skeleton Grid
```tsx
<div className="admin-grid">
  {[1, 2, 3, 4].map(i => (
    <div key={i} className="admin-card">
      <div className="admin-skeleton" style={{ height: '16px', width: '60%' }} />
      <div className="admin-skeleton mt-2" style={{ height: '24px', width: '80%' }} />
      <div className="admin-skeleton mt-2" style={{ height: '14px', width: '40%' }} />
    </div>
  ))}
</div>
```

---

## 🌈 Color Reference

### Alert Colors
| Variant | Background | Border | Icon |
|---------|------------|--------|------|
| Warning | Amber 50 → 100 | Amber 400 | Amber 600 |
| Error | Red 50 → 100 | Red 400 | Red 600 |
| Success | Green 50 → 100 | Green 400 | Green 600 |
| Info | Blue 50 → 100 | Blue 400 | Blue 600 |

### Badge Colors
| Variant | Background | Text |
|---------|------------|------|
| Gray | Gray 100 → 200 | Gray 700 |
| Blue | Blue 100 → 200 | Blue 700 |
| Green | Green 100 → 200 | Green 700 |
| Amber | Amber 100 → 200 | Amber 700 |
| Red | Red 100 → 200 | Red 700 |
| Purple | Purple 100 → 200 | Purple 700 |

### Button Colors
| Variant | Background | Text | Hover |
|---------|------------|------|-------|
| Primary | Blue 500 → 600 | White | Brightness 110% |
| Secondary | Transparent | Gray 700 | Gray 50 |
| Ghost | Transparent | Gray 600 | Gray 100 |

---

## 🎬 Animation Reference

### Timing Functions
- **Fast**: 150ms - Micro-interactions
- **Base**: 200ms - Standard transitions
- **Medium**: 250ms - Hover effects
- **Slow**: 300ms - Complex animations

### Easing
```css
cubic-bezier(0.4, 0, 0.2, 1)  /* Natural, smooth */
```

### Available Animations
```css
@keyframes slideDown         /* Alert entrance */
@keyframes skeleton-loading  /* Shimmer effect */
@keyframes pulse            /* Breathing effect */
@keyframes spin             /* Spinner rotation */
```

---

## 📱 Responsive Behavior

All components are responsive by default:
- Mobile: Full width, stacked
- Tablet: 2-3 columns
- Desktop: 3-4 columns
- XL: 4+ columns

Grid auto-adjusts based on container size:
```css
.admin-grid {
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
}
```

---

## 🌙 Dark Mode

All classes support dark mode via `prefers-color-scheme: dark`:
- Backgrounds darken (gray-800 → gray-900)
- Text lightens (gray-900 → gray-100)
- Shadows adjust (lighter alpha)
- Borders soften

**Automatic** - no additional classes needed!

---

## ♿ Accessibility

### Focus Indicators
All interactive elements have visible focus rings:
```css
.admin-focus-ring:focus-visible {
  outline: 2px solid theme('colors.blue.500');
  outline-offset: 2px;
}
```

### Reduced Motion
Respects user preferences:
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### ARIA Support
- Semantic HTML maintained
- Role attributes preserved
- Screen reader friendly
- Keyboard navigable

---

## 🚀 Performance Tips

1. **Hardware Acceleration**: Use `transform` over `top`/`left`
2. **Lazy Load**: Import CSS only where needed
3. **CSS Variables**: Leverage for theme changes
4. **Avoid Layout Shifts**: Set explicit dimensions for skeletons
5. **Batch Updates**: Use CSS classes over inline styles

---

## 📦 Import Statement

```tsx
import '../../features/admin/styles/admin-modern.css';
```

**Import once** per admin page or in layout component.

---

**Version**: 1.0  
**Last Updated**: 2025-01-XX  
**File Location**: `/Frontend/src/features/admin/styles/admin-modern.css`
