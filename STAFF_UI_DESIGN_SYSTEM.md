# Staff UI Design System Standards

## Design Audit Findings

### Current Issues Identified

1. **Inconsistent Border Radius**
   - Mix of `rounded-lg`, `rounded-xl`, `rounded-2xl`
   - Cards use different radii across components

2. **Color Palette Inconsistency**
   - ManualVisitLogger uses teal/cyan (outlier)
   - Should use primary blue/indigo/purple palette

3. **Icon Container Sizes**
   - Mix of `h-10 w-10`, `h-11 w-11`, `h-12 w-12`
   - Should standardize to `h-10 w-10`

4. **Button Styling Variations**
   - Multiple button styles without clear hierarchy
   - Inconsistent padding and rounded corners

## Standardized Design System

### 1. Color Palette

#### Primary Colors (Blue/Indigo/Purple Gradient)
```
Hero Gradients: from-indigo-600 via-purple-600 to-blue-600
Icon Backgrounds: from-blue-100 to-indigo-100 (light)
                  from-indigo-500 to-purple-600 (dark)
```

#### Semantic Colors
```
Success: emerald-600, emerald-100
Warning: amber-600, amber-100  
Error: rose-600, rose-100
Info: blue-600, blue-100
```

#### Neutral Colors
```
Background: gray-50
Cards: white
Borders: gray-200
Text Primary: gray-900
Text Secondary: gray-600
Text Tertiary: gray-500
```

### 2. Typography Scale

```
Hero H1: text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold
Hero H2: text-[clamp(1.5rem,3vw,2rem)] font-semibold  
Section H2: text-lg sm:text-xl font-semibold
Section H3: text-base sm:text-lg font-semibold
Body: text-sm sm:text-base
Caption: text-xs sm:text-sm
```

### 3. Spacing System

```
Section Gaps: space-y-8
Card Padding: p-6
Compact Padding: p-4
Relaxed Padding: p-8
Element Gaps: gap-4 (default), gap-6 (relaxed)
```

### 4. Border Radius

```
Cards/Panels: rounded-xl (0.75rem)
Buttons: rounded-lg (0.5rem)
Badges/Pills: rounded-full
Small Elements: rounded-lg
Hero Sections: rounded-2xl or rounded-3xl
```

### 5. Shadows

```
Card Default: shadow-sm
Card Hover: hover:shadow-md
Elevated: shadow-lg
Overlay: shadow-xl
```

### 6. Component Standards

#### Button Hierarchy

**Primary Button:**
```tsx
className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium 
           hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 
           focus:ring-offset-2 transition-colors"
```

**Secondary Button:**
```tsx
className="px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg 
           font-medium hover:bg-gray-50 focus:ring-2 focus:ring-indigo-500 
           focus:ring-offset-2 transition-colors"
```

**Danger Button:**
```tsx
className="px-4 py-2 bg-rose-600 text-white rounded-lg font-medium 
           hover:bg-rose-700 focus:ring-2 focus:ring-rose-500 
           focus:ring-offset-2 transition-colors"
```

#### Icon Containers

**Standard Size:**
```tsx
className="flex h-10 w-10 items-center justify-center rounded-xl 
           bg-gradient-to-br from-blue-100 to-indigo-100"
```

**Variations by Context:**
- Analytics: blue-100 to indigo-100
- Success: emerald-100 to teal-100  
- Warning: amber-100 to orange-100
- Info: blue-100 to-indigo-100

#### Cards

**Standard Card:**
```tsx
className="rounded-xl border border-gray-200 bg-white/95 p-6 shadow-sm 
           backdrop-blur-sm"
```

**Interactive Card:**
```tsx
className="rounded-xl border border-gray-200 bg-white/95 p-6 shadow-sm 
           backdrop-blur-sm hover:shadow-md transition-shadow cursor-pointer"
```

#### Hero Sections

**Standard Hero:**
```tsx
<StaffPageContainer
  surface="glass"
  width="xl"
  padding="relaxed"
  className="relative overflow-hidden text-white"
>
  <div className="relative z-10">
    <h1 className="text-[clamp(1.75rem,3.5vw,2.5rem)] font-bold">Title</h1>
    <p className="text-[clamp(1rem,2vw,1.125rem)] text-blue-100">Subtitle</p>
  </div>
  <div className="absolute inset-0 opacity-30 bg-[radial-gradient(...)]" />
</StaffPageContainer>
```

### 7. Interactive States

```
Hover: hover:bg-gray-50, hover:shadow-md
Focus: focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2
Active: active:scale-95
Disabled: disabled:opacity-50 disabled:cursor-not-allowed
```

### 8. Transitions

```
Standard: transition-colors
Enhanced: transition-all duration-200
Hover Effects: hover:-translate-y-0.5 transition-transform
```

### 9. Responsive Breakpoints

```
Mobile: < 640px (default)
Tablet: sm: 640px+
Desktop: lg: 1024px+
Wide: xl: 1280px+
```

## Implementation Checklist

- [ ] Standardize all hero section colors to indigo/purple/blue
- [ ] Unify all icon containers to h-10 w-10
- [ ] Standardize button styles (primary/secondary/danger)
- [ ] Ensure all cards use rounded-xl
- [ ] Apply consistent padding (p-6 for cards)
- [ ] Use shadow-sm for default cards
- [ ] Standardize badge/pill styling
- [ ] Ensure consistent spacing (space-y-8 between sections)
- [ ] Apply focus rings to all interactive elements
- [ ] Use consistent transition classes

## Exceptions

1. **Tables**: May need horizontal scroll on mobile (acceptable)
2. **Charts**: May use varied colors for data visualization
3. **Status Badges**: May use semantic colors (success/warning/error)
4. **Specific Brand Elements**: Customer-facing vs staff-facing differences acceptable

## Testing

After applying standards:
1. Visual regression test at 375px, 768px, 1280px
2. Verify color contrast ratios (WCAG AA)
3. Test focus states with keyboard navigation
4. Verify hover states on all interactive elements
5. Check loading and empty states
