# Frontend Integration Guide for Launch Features

This guide covers integrating the subscription billing system and business onboarding features with the frontend.

## 1. Subscription Billing Integration

### Backend API Endpoints
The subscription billing service provides these endpoints:

```
POST /api/subscriptions/setup-subscription
POST /api/subscriptions/cancel-subscription  
POST /api/subscriptions/webhook/yoco-subscription
GET /api/subscriptions/subscription-status
```

### Frontend Integration Steps

#### A. Subscription Setup Page
Create a subscription setup form that collects:
- Selected subscription plan (from existing plans endpoint)
- Customer billing details
- Payment method information

```typescript
// Example subscription setup request
const setupSubscription = async (planId: string, customerData: any) => {
  const response = await fetch('/api/subscriptions/setup-subscription', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      plan_id: planId,
      customer: {
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        email: customerData.email,
        phone: customerData.phone
      }
    })
  });
  
  const result = await response.json();
  if (result.data?.redirect_url) {
    // Redirect to Yoco payment page
    window.location.href = result.data.redirect_url;
  }
};
```

#### B. Subscription Status Display
Show current subscription status in the dashboard:

```typescript
const getSubscriptionStatus = async () => {
  const response = await fetch('/api/subscriptions/subscription-status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  return response.json();
};

// Use this to display:
// - Current plan name and billing amount
// - Next billing date
// - Subscription status (active/cancelled/past_due)
// - Cancel subscription button
```

#### C. Cancel Subscription Flow
Add a cancel subscription button with confirmation:

```typescript
const cancelSubscription = async () => {
  const confirmed = confirm('Are you sure you want to cancel your subscription?');
  if (!confirmed) return;
  
  const response = await fetch('/api/subscriptions/cancel-subscription', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  // Refresh subscription status
  await refreshSubscriptionStatus();
};
```

## 2. Business Onboarding Integration

### Backend API Endpoints
The business onboarding service provides:

```
POST /api/onboarding/create-business
GET /api/onboarding/status
POST /api/onboarding/complete-step
```

### Frontend Integration Steps

#### A. Business Registration Form
Create a multi-step registration form:

```typescript
const createBusiness = async (businessData: any) => {
  const response = await fetch('/api/onboarding/create-business', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      business_name: businessData.name,
      vertical_type: businessData.vertical,
      owner_email: businessData.email,
      owner_first_name: businessData.firstName,
      owner_last_name: businessData.lastName,
      owner_phone: businessData.phone,
      primary_domain: businessData.domain
    })
  });
  
  return response.json();
};
```

#### B. Onboarding Progress Tracker
Display onboarding steps and completion status:

```typescript
const getOnboardingStatus = async () => {
  const response = await fetch('/api/onboarding/status', {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });
  
  const result = await response.json();
  return result.data;
};

// Use this to display:
// - Current step in onboarding
// - Completed steps with checkmarks
// - Next steps to complete
// - Trial status and days remaining
```

#### C. Step Completion Flow
Mark onboarding steps as complete:

```typescript
const completeOnboardingStep = async (step: string, data: any) => {
  const response = await fetch('/api/onboarding/complete-step', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      step: step,
      data: data
    })
  });
  
  return response.json();
};

// Example: Complete business info step
await completeOnboardingStep('business_info', {
  business_name: 'Updated Name',
  vertical_type: 'beauty',
  primary_domain: 'example.com'
});
```

### Onboarding Step Implementation

#### Step 1: Business Information
- Business name input
- Vertical type selector (carwash, padel, beauty, flowershop, dispensary)
- Primary domain input (optional)
- Complete step when form is submitted

#### Step 2: Services Setup  
- Redirect to catalog management
- Show pre-populated services for the vertical
- Allow editing/adding services
- Complete step when services are configured

#### Step 3: Subscription Setup
- Show available subscription plans
- Integrate with subscription billing flow
- Complete step when subscription is active

#### Step 4: Customization
- Business branding configuration
- Logo upload
- Color scheme selection
- Complete step when branding is saved

## 3. Health Check Integration

### Backend Endpoints
Health check endpoints for monitoring:

```
GET /health/              # Basic health check
GET /health/detailed      # Detailed system status
GET /health/ready        # Kubernetes readiness
GET /health/live         # Kubernetes liveness
GET /health/metrics      # Application metrics
```

### Frontend Integration
Add a system status page for administrators:

```typescript
const getSystemHealth = async () => {
  const response = await fetch('/health/detailed');
  return response.json();
};

// Display:
// - Overall system status
// - Database connectivity
// - Environment configuration
// - Resource usage warnings
```

## 4. Error Handling

### Subscription Errors
Handle common subscription errors:
- Payment failures → Show retry option
- Invalid plans → Redirect to plan selection
- Webhook verification failures → Log for investigation

### Onboarding Errors
Handle onboarding flow errors:
- Validation errors → Show field-specific messages
- Step completion failures → Allow retry
- Missing permissions → Show admin-only message

## 5. Testing Integration

### Test Scenarios
1. **Subscription Flow**:
   - Plan selection and payment
   - Subscription cancellation
   - Payment failure handling

2. **Onboarding Flow**:
   - New business registration
   - Step-by-step completion
   - Trial expiration warnings

3. **Health Monitoring**:
   - System status display
   - Error state handling

### Mock Data
For development, create mock implementations that return realistic data without hitting the actual payment APIs.

## 6. Environment Configuration

### Frontend Environment Variables
Add these to your frontend environment:

```
VITE_API_BASE_URL=http://localhost:8000
VITE_YOCO_PUBLIC_KEY=pk_test_your_public_key
VITE_ENVIRONMENT=development
```

### Production Considerations
- Use HTTPS for all payment-related flows
- Implement proper error boundaries
- Add loading states for all async operations
- Include retry mechanisms for failed requests
- Log important events for debugging

## Next Steps

1. Implement subscription setup UI with Yoco integration
2. Create onboarding wizard component
3. Add system status dashboard for admins
4. Implement error handling and loading states
5. Add end-to-end tests for critical flows
