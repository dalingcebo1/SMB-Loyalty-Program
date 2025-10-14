# UI Text Wrapping Quick Reference

## ✅ What Was Fixed

1. **Vertical text breaking** - Text no longer displays one character per line
2. **Button text wrapping** - Buttons maintain single-line text
3. **Navigation wrapping** - Nav items stay inline
4. **Heading breaks** - No mid-word breaks in titles
5. **Responsive layout** - Proper flex/grid behavior on all screen sizes

## 📋 CSS Classes to Use

### For Headings/Titles
```tsx
<h2 className="text-lg font-semibold whitespace-nowrap">
  Title Text
</h2>
```

### For Buttons
```tsx
<button className="px-4 py-2 rounded-lg ...">
  Button Label
</button>
// No whitespace-nowrap needed - handled globally
```

### For Status Badges
```tsx
<span className="badge px-3 py-1 rounded-full whitespace-nowrap">
  Status
</span>
```

### For Flex Containers
```tsx
<div className="flex items-center gap-3 flex-wrap">
  {/* Items can wrap to next line if needed */}
</div>
```

### For Responsive Headers
```tsx
<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
  <div className="min-w-0 flex-shrink-0">
    {/* Content won't break awkwardly */}
  </div>
</div>
```

## 🚫 What NOT to Do

❌ Don't use `word-break: break-all` on UI text  
❌ Don't apply `min-width: 0` globally  
❌ Don't force narrow widths on text containers  
❌ Don't use fixed widths on responsive text  

## ✅ What TO Do

✅ Use `whitespace-nowrap` for labels and badges  
✅ Use `flex-wrap` for groups of badges/chips  
✅ Use responsive flex direction (`flex-col lg:flex-row`)  
✅ Add `min-w-0` only to specific flex children  
✅ Test at 375px, 768px, and 1024px+ widths  

## 📱 Responsive Patterns

### Mobile (< 768px)
- Vertical stacking (flex-col)
- Full-width elements
- Single-column grids

### Tablet (768px - 1023px)
- 2-column grids
- Compact headers
- Some horizontal layouts

### Desktop (1024px+)
- 4-column grids
- Full horizontal layouts
- Side-by-side elements

## 🔍 Quick Debug Checklist

If text is breaking vertically:
1. Check if element has `word-break: break-all` → Change to `normal`
2. Check if parent has extreme `min-width` constraint
3. Add `whitespace-nowrap` to the text element
4. Check if parent flex container needs `min-w-0`
5. Verify container has adequate width at that breakpoint

## 📚 Files Changed

- `/Frontend/src/index.css` - Global rules
- `/Frontend/src/features/staff/components/text-wrapping-fixes.css` - Staff-specific rules
- `/Frontend/src/features/staff/components/StaffLayout.tsx` - Import new CSS
- `/Frontend/src/features/staff/components/DashboardOverview.tsx` - Card titles
- `/Frontend/src/features/staff/components/ActiveWashesManager.tsx` - Header layout

## 🎯 Testing

```bash
# Lint
npm run lint

# Type check
npx tsc --noEmit

# Build
npm run build

# Dev server
npm run dev
```

## 📞 Need Help?

- Review: `PROFESSIONAL_UI_TEXT_FIX.md` for full details
- Check: `text-wrapping-fixes.css` for all CSS rules
- Reference: Material Design typography guidelines
- Standards: WCAG 2.1 AA for accessibility
