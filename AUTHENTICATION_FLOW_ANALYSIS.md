# Authentication Flow Analysis & Recommendations (moved)

The canonical authentication summary now lives at `docs/authentication/summary.md`.
Detailed analysis retained here for reference during migration.

# Authentication Flow Analysis & Recommendations

## Current Authentication Flow Map

### 1. Traditional Signup Flow
```
1. User visits /signup
2. Enters email + password
3. Backend creates user with onboarded=false
4. Frontend navigates to /onboarding with state {email, password}
5. User enters first name, last name, phone
6. Frontend navigates to /onboarding/verify with all data
7. User enters phone number, gets SMS OTP
8. User enters OTP, backend verifies and updates user with onboarded=true
9. User gets JWT token and navigates to dashboard
```

### 2. Traditional Login Flow  
```
1. User visits /login
2. Enters email + password
3. Backend checks credentials and onboarding status
4. If onboarding_required=true → redirect to /onboarding
5. If complete → return JWT token and user data
6. Frontend navigates to appropriate dashboard based on role
```

### 3. Social Login Flow (Google)
```
1. User clicks "Continue with Google" 
2. Firebase popup/redirect handles Google OAuth
3. Frontend gets Firebase ID token
4. Backend verifies token with Firebase Admin SDK
5. Backend finds/creates user with onboarded=true automatically
6. Backend checks if profile data missing → onboarding_required=true
7. If onboarding needed → redirect to /onboarding
8. If complete → return JWT token and navigate to dashboard
```

## Issues Identified

### 🚨 Critical Issues

1. **Inconsistent Onboarding Logic**
   - Traditional signup: Creates user with `onboarded=false`
   - Social login: Creates user with `onboarded=true` 
   - This causes confusion in flow determination

2. **Missing Profile Data Handling**
   - Social login users may lack first_name, last_name, phone
   - Current logic only checks name fields but phone verification still needed
   - No clear UX for completing missing social profile data

3. **Phone Verification Bypass in Social Login**
   - Social users get `onboarded=true` but may not have verified phone
   - Phone verification is critical for loyalty program features
   - Security risk: unverified phone numbers in system

4. **Inconsistent Navigation Logic**
   - Different paths for different user types
   - No clear "next step" guidance for partially completed profiles
   - Social users with incomplete profiles get confusing flow

### ⚠️ UX Issues

5. **Duplicate Onboarding Pages**
   - `/pages/Onboarding.tsx` and `/features/auth/pages/Onboarding.tsx`
   - Routes reference different files causing confusion
   - Code duplication and maintenance issues

6. **Session State Management**
   - OTP verification relies on global `confirmationRef`
   - localStorage fallback for onboarding data
   - Fragile state management across page reloads

7. **Error Handling Inconsistencies**
   - Different error messages for same scenarios
   - No retry mechanisms for network failures in all flows
   The authentication flow analysis has been moved to `docs/authentication/summary.md`.

   Please update any links to point to `docs/authentication/summary.md` (the original content is preserved there).
- [ ] Advanced session recovery mechanisms
- [ ] Performance optimizations for auth flows
- [ ] Enhanced security measures

## Test Scenarios Needed

1. **New Traditional User**
   - Signup → Profile → Phone → Complete → Dashboard

2. **New Social User** 
   - Google login → Profile completion → Phone verification → Dashboard

3. **Returning Incomplete User**
   - Login → Continue onboarding from last step → Complete

4. **Network Failure Recovery**
   - Test failures at each step with retry mechanisms

5. **Cross-Platform Consistency**
   - Ensure flow works on mobile and desktop
   - Test popup vs redirect OAuth flows

## Success Metrics

- [ ] 100% of users complete onboarding regardless of signup method
- [ ] Zero confusion about next steps in onboarding flow
- [ ] All users have verified phone numbers upon completion
- [ ] Consistent UX across traditional and social signup
- [ ] < 5% onboarding abandonment rate
- [ ] Zero authentication flow bugs in production
