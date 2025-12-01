# Admin Components Implementation Guide

## Quick Start

### 1. Import Components

```tsx
// Layout components
import { 
  AdminPageContainer, 
  AdminSection, 
  AdminGrid 
} from '../components/AdminGrid';

// Card components
import { 
  AdminCard, 
  StatCard, 
  ActionCard 
} from '../components/AdminCard';
```

### 2. Basic Page Structure

```tsx
function MyAdminPage() {
  return (
    <AdminPageContainer
      title="Page Title"
      description="Optional description"
      actions={
        <button>Action Button</button>
      }
    >
      <AdminSection title="Section Title">
        <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
          {/* Your content */}
        </AdminGrid>
      </AdminSection>
    </AdminPageContainer>
  );
}
```

## Component Recipes

### Recipe 1: Stats Dashboard

**Use Case:** Display key metrics with change indicators

```tsx
<AdminSection title="Key Metrics">
  <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }} gap="base">
    <StatCard
      label="Total Users"
      value="1,234"
      change="+12.5%"
      changeDirection="positive"
      info="Last 30 days"
    />
    <StatCard
      label="Revenue"
      value="R 45,678"
      change="-3.2%"
      changeDirection="negative"
      info="This month"
    />
    <StatCard
      label="Active Sessions"
      value="567"
      info="Right now"
    />
    <StatCard
      label="Conversion Rate"
      value="23.4%"
      change="+1.8%"
      changeDirection="positive"
    />
  </AdminGrid>
</AdminSection>
```

### Recipe 2: Quick Actions Grid

**Use Case:** Navigation shortcuts to different admin sections

```tsx
<AdminSection title="Quick Actions">
  <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }} gap="base">
    {actions.map(action => (
      <Link key={action.to} to={action.to}>
        <ActionCard
          title={action.title}
          description={action.description}
          icon={<action.icon className="w-5 h-5" />}
          onClick={() => {}}
          variant="primary"
        />
      </Link>
    ))}
  </AdminGrid>
</AdminSection>
```

### Recipe 3: Content Cards

**Use Case:** Display general content in card format

```tsx
<AdminSection>
  <AdminGrid cols={{ mobile: 1, tablet: 2 }} gap="base">
    <AdminCard 
      title="Recent Activity"
      icon={<HiClock className="w-5 h-5" />}
      padding="base"
    >
      <ul className="space-y-2">
        {activities.map(activity => (
          <li key={activity.id}>{activity.text}</li>
        ))}
      </ul>
    </AdminCard>

    <AdminCard 
      title="System Alerts"
      icon={<HiBell className="w-5 h-5" />}
      variant="warning"
      padding="base"
    >
      <p style={{ fontSize: 'var(--font-size-sm)' }}>
        {alertCount} alerts require attention
      </p>
    </AdminCard>
  </AdminGrid>
</AdminSection>
```

### Recipe 4: Mixed Layout

**Use Case:** Combine stats, actions, and content

```tsx
<AdminPageContainer title="Dashboard" description="Overview">
  {/* Stats Row */}
  <AdminSection>
    <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
      <StatCard label="Metric 1" value="123" />
      <StatCard label="Metric 2" value="456" />
      <StatCard label="Metric 3" value="789" />
      <StatCard label="Metric 4" value="101" />
    </AdminGrid>
  </AdminSection>

  {/* Actions Grid */}
  <AdminSection title="Quick Actions">
    <AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
      <ActionCard title="Action 1" description="Do something" icon={<Icon />} onClick={fn} />
      <ActionCard title="Action 2" description="Do another" icon={<Icon />} onClick={fn} />
      <ActionCard title="Action 3" description="Do more" icon={<Icon />} onClick={fn} />
    </AdminGrid>
  </AdminSection>

  {/* Content Cards */}
  <AdminSection title="Details">
    <AdminGrid cols={{ mobile: 1, tablet: 2 }}>
      <AdminCard title="Info" padding="base">
        Content here
      </AdminCard>
      <AdminCard title="More Info" padding="base">
        More content
      </AdminCard>
    </AdminGrid>
  </AdminSection>
</AdminPageContainer>
```

## Typography Patterns

### Using Design Tokens

```tsx
// Headings
<h1 style={{ fontSize: 'var(--font-size-3xl)' }}>
  Main Heading
</h1>

<h2 style={{ fontSize: 'var(--font-size-2xl)' }}>
  Section Heading
</h2>

<h3 style={{ fontSize: 'var(--font-size-xl)' }}>
  Subsection Heading
</h3>

// Body Text
<p style={{ fontSize: 'var(--font-size-base)' }}>
  Default paragraph text
</p>

<p style={{ fontSize: 'var(--font-size-sm)' }}>
  Secondary text or descriptions
</p>

// Labels & Metadata
<span style={{ 
  fontSize: 'var(--font-size-xs)',
  letterSpacing: 'var(--letter-spacing-wider)',
  textTransform: 'uppercase'
}}>
  Label
</span>
```

### Font Weights

```tsx
import { useState } from 'react';

// Light (rare, for large display text)
style={{ fontWeight: 'var(--font-weight-light)' }}  // 300

// Regular (body text)
style={{ fontWeight: 'var(--font-weight-regular)' }}  // 400

// Medium (emphasized text)
style={{ fontWeight: 'var(--font-weight-medium)' }}  // 500

// Semibold (headings, buttons)
style={{ fontWeight: 'var(--font-weight-semibold)' }}  // 600

// Bold (important headings)
style={{ fontWeight: 'var(--font-weight-bold)' }}  // 700
```

## Spacing Patterns

### Card Padding

```tsx
// Small padding (16px) - compact cards
<AdminCard padding="sm">Content</AdminCard>

// Base padding (24px) - default
<AdminCard padding="base">Content</AdminCard>

// Large padding (32px) - spacious cards
<AdminCard padding="lg">Content</AdminCard>
```

### Grid Gaps

```tsx
// Small gap (16px) - tight layouts
<AdminGrid gap="sm">...</AdminGrid>

// Base gap (24px) - default
<AdminGrid gap="base">...</AdminGrid>

// Large gap (32px) - spacious layouts
<AdminGrid gap="lg">...</AdminGrid>

// XL gap (40px) - very spacious
<AdminGrid gap="xl">...</AdminGrid>
```

### Custom Spacing

```tsx
// Use spacing tokens for margins/padding
<div style={{ 
  marginBottom: 'var(--spacing-6)',  // 24px
  padding: 'var(--spacing-4)'         // 16px
}}>
  Content
</div>
```

## Common Patterns

### Loading States

```tsx
{isLoading ? (
  <div className="flex items-center justify-center py-12">
    <LoadingSpinner />
    <span style={{ fontSize: 'var(--font-size-sm)' }}>
      Loading...
    </span>
  </div>
) : (
  <AdminGrid>
    {/* Content */}
  </AdminGrid>
)}
```

### Error States

```tsx
{error && (
  <div 
    className="p-3 text-red-700 bg-red-50 rounded-lg border border-red-200" 
    style={{ fontSize: 'var(--font-size-sm)' }}
  >
    {error.message}
  </div>
)}
```

### Empty States

```tsx
{items.length === 0 && (
  <AdminCard padding="lg">
    <div className="text-center">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <p 
        className="text-gray-500"
        style={{ fontSize: 'var(--font-size-base)' }}
      >
        No items found
      </p>
    </div>
  </AdminCard>
)}
```

## Grid Configuration Examples

### Stats Row (4 columns)

```tsx
<AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4, xl: 4 }}>
  <StatCard />
  <StatCard />
  <StatCard />
  <StatCard />
</AdminGrid>
```

### Action Grid (3 columns)

```tsx
<AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3, xl: 3 }}>
  <ActionCard />
  <ActionCard />
  <ActionCard />
</AdminGrid>
```

### Two Column Layout

```tsx
<AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 2, xl: 2 }}>
  <AdminCard />
  <AdminCard />
</AdminGrid>
```

### Asymmetric Layout

```tsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
  {/* Left: 2/3 width */}
  <div className="lg:col-span-2">
    <AdminCard>Main content</AdminCard>
  </div>
  
  {/* Right: 1/3 width */}
  <div className="lg:col-span-1">
    <AdminCard>Sidebar</AdminCard>
  </div>
</div>
```

## Variant Usage

### Card Variants

```tsx
// Default - neutral
<AdminCard variant="default" />

// Primary - important/featured
<AdminCard variant="primary" />

// Success - positive actions/metrics
<AdminCard variant="success" />

// Warning - caution/attention needed
<AdminCard variant="warning" />

// Error - problems/failures
<AdminCard variant="error" />
```

### Change Direction (StatCard)

```tsx
// Positive (green) - growth, improvement
<StatCard changeDirection="positive" />

// Negative (red) - decline, issues
<StatCard changeDirection="negative" />

// Neutral (gray) - no significant change
<StatCard changeDirection="neutral" />
```

## Responsive Considerations

### Mobile-First Approach

Always start with mobile (1 column), then expand:

```tsx
<AdminGrid 
  cols={{ 
    mobile: 1,    // Always 1 column on phones
    tablet: 2,    // 2 columns on tablets
    desktop: 3,   // 3 columns on desktop
    xl: 4         // 4 columns on large screens
  }}
>
```

### Touch Targets

Ensure all interactive elements meet 44x44px minimum:

```tsx
<button 
  className="min-h-[44px] px-4"
  style={{ fontSize: 'var(--font-size-sm)' }}
>
  Button Text
</button>
```

### Text Overflow

Handle long text gracefully:

```tsx
<div className="truncate">
  {longText}
</div>

// Or allow wrapping
<div className="break-words">
  {longText}
</div>
```

## Best Practices

### 1. Always Use Design Tokens

❌ **Don't:**
```tsx
<p className="text-sm">Text</p>
<div style={{ fontSize: '14px' }}>Text</div>
```

✅ **Do:**
```tsx
<p style={{ fontSize: 'var(--font-size-sm)' }}>Text</p>
```

### 2. Consistent Grid Patterns

❌ **Don't:**
```tsx
<div className="grid grid-cols-1 md:grid-cols-3 gap-5">
<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
```

✅ **Do:**
```tsx
<AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }}>
<AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 4 }}>
```

### 3. Semantic Section Titles

❌ **Don't:**
```tsx
<div>
  <h2>Quick Actions</h2>
  <div className="grid">...</div>
</div>
```

✅ **Do:**
```tsx
<AdminSection title="Quick Actions">
  <AdminGrid>...</AdminGrid>
</AdminSection>
```

### 4. Proper Card Usage

❌ **Don't:**
```tsx
<div className="bg-white p-4 rounded shadow">
  <div className="text-xs">Label</div>
  <div className="text-2xl">{value}</div>
</div>
```

✅ **Do:**
```tsx
<StatCard label="Label" value={value} />
```

## Migration Checklist

When updating an existing admin page:

- [ ] Import new components
- [ ] Replace page wrapper with `AdminPageContainer`
- [ ] Convert sections to `AdminSection`
- [ ] Replace manual grids with `AdminGrid`
- [ ] Convert custom cards to `AdminCard`/`StatCard`/`ActionCard`
- [ ] Replace fixed font sizes with design tokens
- [ ] Test mobile responsiveness
- [ ] Run TypeScript compilation
- [ ] Run tests
- [ ] Validate accessibility

## Troubleshooting

### Grid Not Responsive

**Problem:** Grid not changing columns at breakpoints

**Solution:** Ensure you're using the correct col configuration:

```tsx
// ✅ Correct
<AdminGrid cols={{ mobile: 1, tablet: 2, desktop: 3 }} />

// ❌ Wrong
<AdminGrid cols={{ mobile: 1, desktop: 3 }} />  // Missing tablet
```

### Typography Not Scaling

**Problem:** Text not scaling responsively

**Solution:** Use design tokens instead of Tailwind classes:

```tsx
// ✅ Correct
<p style={{ fontSize: 'var(--font-size-sm)' }}>Text</p>

// ❌ Wrong
<p className="text-sm">Text</p>
```

### Cards Too Wide on Mobile

**Problem:** Cards overflow viewport on mobile

**Solution:** Ensure parent uses mobile: 1 column:

```tsx
<AdminGrid cols={{ mobile: 1, tablet: 2 }}>
  <AdminCard>...</AdminCard>
</AdminGrid>
```

## Examples in the Codebase

**Reference implementations:**

1. **AdminWelcome.tsx** - Complete dashboard with stats, actions, sections
2. **Overview.tsx** - Simple metrics dashboard

Study these files for patterns and best practices.

---

**Need Help?**

- Check `design-tokens.css` for all available tokens
- Review `AdminCard.tsx` and `AdminGrid.tsx` for component APIs
- Refer to `ADMIN_PAGES_STANDARDIZATION_PHASE1.md` for detailed documentation
