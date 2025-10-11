# Staff UI Mobile Testing Guide

## Quick Visual Tests

### Test 1: Homepage Dashboard (ModernStaffDashboard)
**URL:** `/staff/dashboard`

**Mobile (375px):**
- Hero section should fit within screen
- "Welcome Back" title should wrap if needed
- Stats cards stack vertically
- Quick actions buttons are full-width
- No horizontal scroll bar

**Tablet (768px):**
- Hero section displays properly
- Stats cards in 2-column grid
- Quick actions in row layout

**Desktop (1280px):**
- Content centered with sidebar visible
- Max-width container active (1152px = 6xl)
- Stats cards in 4-column grid

---

### Test 2: Payment Verification
**URL:** `/staff/payment-verification`

**Mobile (375px):**
- Verification method buttons stack vertically
- "QR Scanner", "Manual Entry", "PIN Verification" each on own row
- Daily stats wrap appropriately
- No text overflow in stats badges

**Tablet (768px):**
- Verification buttons display in single row
- Stats badges wrap to multiple rows if needed

**Desktop (1280px):**
- All content fits within max-width container
- Stats display in horizontal row

---

### Test 3: Customer Analytics
**URL:** `/staff/customer-analytics`

**Mobile (375px):**
- Hero "Customer & Loyalty Analytics" title wraps properly
- Range selector and buttons stack vertically
- 4 metric cards in 2x2 grid
- Top Customers and Loyalty Overview cards stack vertically

**Tablet (768px):**
- Hero controls remain horizontal
- Metric cards still in 2x2 grid
- Analytics panels stack vertically

**Desktop (1280px):**
- Analytics panels side-by-side
- All content within max-width

---

### Test 4: Manual Visit Logger
**URL:** `/staff/manual-visit-logger`

**Mobile (375px):**
- Hero title "Manual Visit Logging" fits screen
- Phone input full-width
- "Log Visit" and "Start Wash" buttons full-width
- Log panel and Recent Activity panel stack vertically

**Tablet (768px):**
- Panels remain stacked
- Typography scales up

**Desktop (1280px):**
- Panels display side-by-side in 2-column grid
- All content centered with padding

---

### Test 5: Car Wash Dashboard
**URL:** `/staff/carwash-dashboard`

**Mobile (375px):**
- Active washes section visible
- Wash cards stack vertically
- Action buttons full-width within cards
- History section below active washes

**Tablet (768px):**
- Similar to mobile but with more breathing room

**Desktop (1280px):**
- Wash cards may display in grid
- Max-width constraint active

---

## Critical Checkpoints

### 1. No Horizontal Scroll
**Test:** On every page at 375px width, scroll down completely
**Expected:** No horizontal scroll bar appears at any point

### 2. Text Wrapping
**Test:** Look for long text strings (titles, descriptions, buttons)
**Expected:** All text wraps to multiple lines rather than overflowing

### 3. Button Behavior
**Test:** All buttons on Payment Verification page at 320px width
**Expected:** Buttons stack vertically, don't force horizontal scroll

### 4. Sidebar Navigation
**Test:** Open hamburger menu on mobile (< 1024px)
**Expected:** 
- Sidebar slides in from left
- Overlay covers content
- No horizontal overflow
- Navigation items fully visible

### 5. Responsive Typography
**Test:** Hero sections on all pages from 320px to 1920px
**Expected:** 
- Font sizes scale smoothly
- No sudden jumps
- Always readable

---

## Device-Specific Tests

### iPhone SE (375 x 667)
- Dashboard loads without overflow
- Payment verification buttons stack
- Analytics hero wraps properly

### iPhone 12/13 (390 x 844)
- Similar to iPhone SE
- Slightly more horizontal space

### iPad Mini (768 x 1024)
- Sidebar hidden, hamburger visible
- Content uses more width
- Cards start arranging in rows

### iPad Pro (1024 x 1366)
- Sidebar permanently visible
- Desktop layout active
- Max-width containers visible

### Desktop (1920 x 1080)
- Full desktop experience
- Content centered
- Max-width prevents excessive line lengths

---

## Common Issues to Watch For

### ❌ Signs of Problems:
- Horizontal scroll bar on mobile
- Text cutting off at viewport edge
- Buttons overlapping or extending beyond container
- Cards causing page to be wider than screen
- Hero sections with oversized text on small screens

### ✅ Expected Behavior:
- All content fits within viewport width
- Vertical scrolling only
- Text wraps naturally
- Buttons resize or stack as needed
- Consistent padding/margins on all screen sizes

---

## Testing Tools

### Chrome DevTools
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Select device or enter custom dimensions
4. Test at: 320px, 375px, 768px, 1024px, 1440px

### Firefox Responsive Design Mode
1. Open DevTools (F12)
2. Click responsive design mode icon
3. Test at common breakpoints

### Safari
1. Open Web Inspector
2. Enter responsive design mode
3. Test on actual iOS device if possible

---

## Automated Checks

### ESLint
```bash
cd Frontend && npm run lint
```
Should pass with no errors.

### TypeScript
Check Problems panel in VS Code - should show no component errors.

### Visual Regression
Open each page and take screenshots at:
- 375px (mobile)
- 768px (tablet)
- 1280px (desktop)

Compare against expected layouts.

---

## Quick Validation Command

```bash
# Run linter
cd Frontend && npm run lint

# Check for common overflow issues
cd Frontend && grep -r "min-w-\[" src/features/staff/ | grep -v "sm:min-w"
# Should only show responsive variants (sm:min-w, md:min-w, etc.)
```

## Sign-Off Checklist

- [ ] All pages tested at 375px width
- [ ] No horizontal scrolling observed
- [ ] Hero sections display properly
- [ ] Buttons work on all screen sizes
- [ ] Sidebar navigation functions correctly
- [ ] Typography scales responsively
- [ ] Tables scroll horizontally within their containers (expected)
- [ ] ESLint passes
- [ ] No compilation errors in Problems panel
