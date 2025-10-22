# UI Improvements Quick Reference Guide

## Text Overflow Prevention - Before & After

### ❌ Before
```css
.card-title {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
}
/* Issue: Long text would overflow the card */
```

### ✅ After
```css
.card-title {
  font-size: var(--font-size-lg);
  color: var(--color-text-primary);
  line-height: var(--line-height-snug);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  word-break: normal;
  overflow-wrap: normal;
}
/* Result: Text truncates with ... when too long */
```

## Common Patterns

### Single Line Text with Ellipsis
```html
<h3 class="truncate">Very Long Title That Would Overflow</h3>
<!-- Shows: "Very Long Title That Wou..." -->
```

### Multi-Line Description (3 lines max)
```html
<p class="line-clamp-3">
  Long description that will show up to 3 lines before being 
  truncated with an ellipsis at the end of the third line...
</p>
```

### Card Layout with Proper Text Containment
```html
<div class="card">
  <div class="card-header min-w-0">
    <h3 class="card-title">Product Name</h3>
    <p class="card-description">
      This is a longer description that will wrap nicely
    </p>
  </div>
</div>
```

### Flex Container with Text
```html
<div style="display: flex; gap: 1rem;">
  <div class="min-w-0" style="flex: 1;">
    <h3 class="truncate">User Name That Might Be Long</h3>
    <p class="text-secondary truncate">email@example.com</p>
  </div>
  <button>Action</button>
</div>
```

## Typography Hierarchy Examples

### Display Text (Hero Sections)
```html
<h1 class="text-display" style="font-size: var(--font-size-4xl);">
  Welcome to Your Dashboard
</h1>
<!-- Line-height: 1.25, no word breaking -->
```

### Section Headings
```html
<h2 class="text-heading" style="font-size: var(--font-size-2xl);">
  Recent Orders
</h2>
<!-- Line-height: 1.375, single line preferred -->
```

### Body Text
```html
<p class="text-body">
  This is regular body text that will wrap naturally at word
  boundaries and has a comfortable 1.5 line-height for reading.
</p>
```

### Labels & Badges
```html
<span class="text-label">STATUS</span>
<span class="badge-text">Active</span>
<!-- Uppercase, wide spacing, no wrapping -->
```

## Button Text Handling

### Already Correct ✅
```html
<button class="btn btn--primary btn--base">
  Book a Wash
</button>
<!-- Buttons automatically have white-space: nowrap -->
```

## Responsive Text Sizes

### Mobile-First Approach
```html
<h1 class="text-responsive-xl">
  Adapts from 2xl on mobile to 3xl on desktop
</h1>
```

## Accessibility Features

### Screen Reader Only Content
```html
<span class="sr-only">
  This text is only visible to screen readers
</span>
```

### Focus Indicators
```html
<button class="btn focus-ring">
  Accessible Button
</button>
<!-- Shows clear outline on keyboard focus -->
```

## Common Utility Combinations

### Card Content
```css
.card-content {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-3);
  min-width: 0; /* Allow text to shrink */
}

.card-title {
  /* Use .truncate or .text-heading */
}

.card-description {
  /* Use .line-clamp-3 or .text-body-relaxed */
}
```

### List Items with Icons
```html
<div style="display: flex; align-items: center; gap: 0.75rem;">
  <svg style="flex-shrink: 0;">...</svg>
  <div class="min-w-0" style="flex: 1;">
    <h4 class="truncate">Item Name</h4>
    <p class="text-caption truncate">Subtitle</p>
  </div>
</div>
```

### Table Cells
```html
<td>
  <div class="truncate" style="max-width: 200px;">
    Long cell content
  </div>
</td>
```

## Color Utilities

```html
<p class="text-primary">Primary text color</p>
<p class="text-secondary">Secondary (muted) text</p>
<p class="text-tertiary">Tertiary (subtle) text</p>
<p class="text-success">Success message</p>
<p class="text-error">Error message</p>
<p class="text-warning">Warning message</p>
```

## Font Weight Utilities

```html
<span class="font-light">300</span>
<span class="font-regular">400</span>
<span class="font-medium">500</span>
<span class="font-semibold">600</span>
<span class="font-bold">700</span>
<span class="font-extrabold">800</span>
```

## Layout Helpers

### Prevent Overflow
```html
<div class="overflow-hidden">
  Content that won't overflow parent
</div>
```

### Allow Flex/Grid Shrinking
```html
<div style="display: flex;">
  <div class="min-w-0" style="flex: 1;">
    <!-- This can shrink below its content width -->
  </div>
</div>
```

## Best Practices

### ✅ DO
- Use `.truncate` for single-line text that might overflow
- Use `.line-clamp-X` for multi-line descriptions
- Add `min-width: 0` to flex/grid children containing text
- Use semantic HTML with appropriate heading levels
- Apply `.text-nowrap` to buttons, badges, and labels
- Use design token variables for consistency

### ❌ DON'T
- Don't manually set `width: 100%` on text elements in flex containers
- Don't use `word-break: break-all` on regular text
- Don't forget `line-height` when setting font sizes
- Don't mix pixel values with design tokens
- Don't create custom text styles when utilities exist
- Don't apply `white-space: nowrap` to body text

## Testing Text Overflow

### Manual Test Cases
1. **Long Names**: "Extraordinarily Long Business Name That Exceeds Container Width"
2. **URLs**: "https://very-long-url-that-should-break-properly.com/path/to/resource"
3. **No Spaces**: "verylongwordwithoutanyspacesthatmightcauseissues"
4. **Mixed Content**: "Short text followed by a reallylongwordwithnospaces"
5. **Numbers**: "1234567890123456789012345678901234567890"

### Mobile Testing
- Test on 320px width (iPhone SE)
- Test on 375px width (iPhone standard)
- Test on 768px width (iPad portrait)
- Verify text scales properly with viewport

## Performance Notes

- Utility classes are tiny (< 5KB total)
- CSS-only solutions (no JS overhead)
- Reusable patterns reduce overall CSS size
- No layout recalculations from text overflow

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| text-overflow | ✅ | ✅ | ✅ | ✅ |
| -webkit-line-clamp | ✅ | ✅ | ✅ | ✅ |
| line-clamp | ⚠️ | ⚠️ | ⚠️ | ⚠️ |
| overflow-wrap | ✅ | ✅ | ✅ | ✅ |
| word-break | ✅ | ✅ | ✅ | ✅ |

⚠️ = Newer property, fallback provided

## Quick Troubleshooting

### Text Still Overflowing?
1. Check if parent has `min-width: 0` (for flex/grid)
2. Verify `.truncate` or `.line-clamp-X` is applied
3. Ensure no `width: 100%` on text element itself
4. Check if `overflow: hidden` is on parent

### Text Not Wrapping?
1. Remove `white-space: nowrap`
2. Add `word-break: normal` and `overflow-wrap: break-word`
3. Check parent width constraints

### Layout Breaking on Mobile?
1. Apply `overflow-x: hidden` to page container
2. Use fluid typography (clamp)
3. Test with DevTools mobile simulation
