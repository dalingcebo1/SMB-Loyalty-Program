```markdown
# Authentication Flow Improvements Summary

This document moved into `docs/authentication/improvements.md` during the docs consolidation.

## ✅ Fixes Implemented

### 1. Standardized User Creation Logic
**Problem**: Social login users were created with `onboarded=true` while traditional signup users got `onboarded=false`, creating inconsistent flows.

**Solution**: 
- All new users (traditional and social) now start with `onboarded=false`
- All users must complete the same onboarding steps: Profile Info → Phone Verification
- Consistent experience regardless of signup method

... (content preserved)

``` 
