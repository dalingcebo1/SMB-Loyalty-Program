# Quick Start Guide - Using the New UI Components

## 🚀 What Has Been Built

### Phase 1 Complete ✅
1. **Design System Foundation** - Comprehensive design tokens
2. **Modern Component Library** - Button, Card, Input components
3. **Modernized Welcome Page** - Complete rebuild with industry standards

## 📦 New Files Created

```
Frontend/src/
├── styles/
│   └── design-tokens.css          # Comprehensive design system
├── components/ui/
│   ├── Button.tsx                 # Modern button component
│   ├── Button.css                 # Button styles
│   ├── Card.tsx                   # Modern card component
│   ├── Card.css                   # Card styles
│   ├── Input.tsx                  # Modern input component
│   ├── Input.css                  # Input styles
│   └── index.ts                   # Updated barrel exports
├── pages/
│   ├── WelcomeModern.tsx          # Rebuilt welcome page
│   └── WelcomeModern.css          # Welcome page styles
└── index.css                      # Updated to import design tokens
```

## 🎯 How to Use the New Components

### Button Component

```tsx
import { Button } from '@/components/ui';
import { FaCheck, FaArrowRight } from 'react-icons/fa';

// Primary button
<Button variant="primary" size="lg" onClick={handleSubmit}>
  Submit Order
</Button>

// Button with icon
<Button variant="success" leftIcon={<FaCheck />}>
  Confirm
</Button>

// Loading state
<Button variant="primary" isLoading>
  Processing...
</Button>

// Full width
<Button variant="primary" isFullWidth>
  Continue
</Button>

// As a link
<Button as="a" href="/order" variant="secondary">
  Book Now
</Button>
```

**Available Props:**
- `variant`: 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success'
- `size`: 'sm' | 'base' | 'lg' | 'xl'
- `isLoading`: boolean
- `isFullWidth`: boolean
- `leftIcon`: React.ReactNode
- `rightIcon`: React.ReactNode
- `as`: 'button' | 'a'
- All standard button/anchor attributes

### Card Component

```tsx
import { Card, CardHeader, CardBody, CardFooter } from '@/components/ui';
import { Button } from '@/components/ui';

// Basic card
<Card variant="elevated" padding="lg">
  <h3>Card Title</h3>
  <p>Card content goes here</p>
</Card>

// Card with sections
<Card variant="default" padding="base">
  <CardHeader>
    <h2>Order Summary</h2>
    <p>Review your order details</p>
  </CardHeader>
  <CardBody>
    <div>Item 1: R100</div>
    <div>Item 2: R50</div>
  </CardBody>
  <CardFooter>
    <Button variant="ghost">Cancel</Button>
    <Button variant="primary">Confirm</Button>
  </CardFooter>
</Card>

// Interactive card
<Card 
  variant="outlined" 
  isInteractive 
  onClick={() => navigate('/details')}
>
  <h3>Click me!</h3>
</Card>

// Loading card
<Card isLoading padding="lg" />
```

**Available Props:**
- `variant`: 'default' | 'elevated' | 'outlined' | 'ghost'
- `padding`: 'none' | 'sm' | 'base' | 'lg'
- `isInteractive`: boolean
- `isLoading`: boolean
- `as`: 'div' | 'article' | 'section'

### Input Component

```tsx
import { Input } from '@/components/ui';
import { FaEnvelope, FaLock } from 'react-icons/fa';

// Basic input
<Input
  label="Email Address"
  type="email"
  placeholder="Enter your email"
  required
/>

// Input with icons
<Input
  label="Email"
  type="email"
  leftIcon={<FaEnvelope />}
  placeholder="you@example.com"
/>

// Password with toggle
<Input
  label="Password"
  type="password"
  required
/>

// Input with error
<Input
  label="Phone"
  type="tel"
  status="error"
  errorText="Please enter a valid phone number"
/>

// Input with helper text
<Input
  label="Username"
  type="text"
  helperText="Choose a unique username"
/>
```

**Available Props:**
- `label`: string
- `size`: 'sm' | 'base' | 'lg'
- `status`: 'default' | 'error' | 'success' | 'warning'
- `helperText`: string
- `errorText`: string
- `leftIcon`: React.ReactNode
- `rightIcon`: React.ReactNode
- `isFullWidth`: boolean
- All standard input attributes

## 🎨 Using Design Tokens

### In CSS Files

```css
.my-component {
  /* Colors */
  background: var(--color-surface);
  color: var(--color-text-primary);
  border: 1px solid var(--color-border);
  
  /* Spacing */
  padding: var(--spacing-4);
  margin-bottom: var(--spacing-6);
  gap: var(--spacing-3);
  
  /* Typography */
  font-size: var(--font-size-base);
  font-weight: var(--font-weight-semibold);
  line-height: var(--line-height-normal);
  
  /* Border Radius */
  border-radius: var(--radius-lg);
  
  /* Shadows */
  box-shadow: var(--shadow-md);
  
  /* Transitions */
  transition: all var(--transition-base);
}

.my-component:hover {
  box-shadow: var(--shadow-lg);
  transform: translateY(-2px);
}
```

### Available Token Categories

1. **Colors**: 
   - Primary, Success, Warning, Error, Info (50-900 shades)
   - Neutral/Gray (50-900)
   - Semantic (background, surface, text, border)

2. **Typography**:
   - Font families (base, display, mono)
   - Font weights (light to extrabold)
   - Font sizes (xs to 5xl with fluid scaling)
   - Line heights (tight to loose)
   - Letter spacing (tighter to widest)

3. **Spacing**: 
   - 0, 1-6, 8, 10, 12, 16, 20, 24, 32 (4px base grid)

4. **Border Radius**: 
   - none, sm, base, md, lg, xl, 2xl, 3xl, full

5. **Shadows**: 
   - xs, sm, base, md, lg, xl, 2xl, inner
   - Colored shadows (primary, success, error)

6. **Transitions**:
   - Durations: fast, base, slow, slower
   - Easing functions: ease-in, ease-out, ease-in-out, spring

7. **Z-Index**:
   - dropdown, sticky, fixed, modal-backdrop, modal, popover, tooltip

## 🎯 Migrating Existing Pages

### Step 1: Import New Components

```tsx
// Old
import Button from '../components/Button';

// New
import { Button, Card, Input } from '@/components/ui';
```

### Step 2: Update Button Usage

```tsx
// Old
<button className="btn btn-primary" onClick={handleClick}>
  Click Me
</button>

// New
<Button variant="primary" onClick={handleClick}>
  Click Me
</Button>
```

### Step 3: Replace Card Layouts

```tsx
// Old
<div className="card">
  <div className="card-body">
    <h3>Title</h3>
    <p>Content</p>
  </div>
</div>

// New
<Card variant="elevated">
  <CardBody>
    <h3>Title</h3>
    <p>Content</p>
  </CardBody>
</Card>
```

### Step 4: Update Form Inputs

```tsx
// Old
<div className="form-group">
  <label>Email</label>
  <input type="email" className="form-control" />
</div>

// New
<Input
  label="Email"
  type="email"
/>
```

## 🏗️ Building New Pages

### Template Structure

```tsx
import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardBody, Button, Input } from '@/components/ui';
import './MyPage.css';

const MyPage: React.FC = () => {
  const [isLoading, setIsLoading] = useState(true);

  return (
    <div className="my-page">
      {/* Hero Section */}
      <motion.section
        className="my-page__hero"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1>Page Title</h1>
        <p>Page description</p>
      </motion.section>

      {/* Content Cards */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      >
        <Card variant="elevated" padding="lg">
          <CardBody>
            {isLoading ? (
              <Card isLoading />
            ) : (
              <div>Your content here</div>
            )}
          </CardBody>
        </Card>
      </motion.div>
    </div>
  );
};

export default MyPage;
```

### Corresponding CSS

```css
.my-page {
  max-width: var(--container-lg);
  margin: 0 auto;
  padding: var(--spacing-6) var(--spacing-4);
  display: flex;
  flex-direction: column;
  gap: var(--spacing-6);
}

.my-page__hero {
  text-align: center;
}

.my-page__hero h1 {
  font-size: var(--font-size-3xl);
  font-weight: var(--font-weight-bold);
  color: var(--color-text-primary);
  margin-bottom: var(--spacing-2);
}

.my-page__hero p {
  font-size: var(--font-size-lg);
  color: var(--color-text-secondary);
}

@media (max-width: 768px) {
  .my-page {
    padding: var(--spacing-4) var(--spacing-3);
  }
}
```

## 🧪 Testing Your Implementation

### Accessibility Checklist
- [ ] All interactive elements are keyboard accessible
- [ ] Focus indicators are visible
- [ ] Color contrast meets WCAG AA (4.5:1)
- [ ] All images have alt text
- [ ] Forms have proper labels
- [ ] ARIA attributes are correctly used

### Responsive Checklist
- [ ] Works on mobile (320px)
- [ ] Works on tablet (768px)
- [ ] Works on desktop (1024px+)
- [ ] Touch targets are at least 44x44px
- [ ] Text is readable on all sizes

### Performance Checklist
- [ ] Images are optimized
- [ ] Components lazy load when appropriate
- [ ] Animations run at 60fps
- [ ] No layout shifts on load

## 📞 Need Help?

Reference the comprehensive documentation:
- `/workspaces/SMB-Loyalty-Program/END_USER_UI_REBUILD.md`
- Component source files for detailed prop types
- Design tokens file for all available variables

## 🎉 Next Steps

1. Test the new Welcome page (`/pages/WelcomeModern.tsx`)
2. Start migrating other pages using the component library
3. Continue with Phase 2: Order Form, Loyalty, Past Orders pages
4. Build additional components as needed (Modal, Toast, Badge, etc.)

---

**Pro Tip**: Use the design tokens everywhere! They make your UI consistent and easy to update globally.
