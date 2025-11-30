# Recent Critical Fixes (November 30, 2025)

## Overview
This document tracks critical bug fixes deployed to resolve production issues with Azure Static Web Apps routing and branding updates.

---

## Fix 1: Azure SWA Routing Configuration (404s on Direct Navigation)

### Problem
Users experienced intermittent 404 errors when:
- Navigating directly to `/admin/branding`, `/order`, `/staff/dashboard`, etc.
- Refreshing any non-root page
- Following bookmarks or shared links

### Root Cause
**Critical deployment configuration error:**
- `staticwebapp.config.json` was located in `Frontend/` root directory
- Vite only auto-copies files from `Frontend/public/` directory during build
- Azure SWA deployments built fresh without the routing configuration
- Without `navigationFallback` config, SWA returned 404 for any SPA route

### Why It Appeared "Random"
- ✅ **Worked**: Client-side navigation (React Router handled routing)
- ❌ **Failed**: Direct URL access, page refreshes, fresh deploys
- Local builds had manual copy in `dist/`, masking the issue

### Solution
**Commit: `43d4a1ff`** - Move `staticwebapp.config.json` to `Frontend/public/`

```bash
Frontend/
├── public/
│   └── staticwebapp.config.json  ← Now auto-copied by Vite
```

**Enhanced Configuration:**
```json
{
  "navigationFallback": {
    "rewrite": "index.html",
    "exclude": ["/assets/*", "/favicon.ico", "/robots.txt", "/api/*"]
  },
  "responseOverrides": {
    "404": {
      "rewrite": "/index.html",
      "statusCode": 200
    }
  }
}
```

### Impact
- ✅ All SPA routes now work consistently
- ✅ Direct navigation works
- ✅ Page refreshes work
- ✅ No more CDN-cached 404s

### Testing
```bash
# All these should now work:
https://orange-pond-06eea490f.3.azurestaticapps.net/admin/branding
https://orange-pond-06eea490f.3.azurestaticapps.net/order
https://orange-pond-06eea490f.3.azurestaticapps.net/staff/dashboard
```

---

## Fix 2: Branding Color Updates (Not Reflecting in Dev)

### Problem
After updating branding colors in `/admin/branding`:
- ✅ **Worked in Production**: Colors updated after navigation away
- ❌ **Failed in Dev**: Colors stayed cached, required manual refresh

### Root Cause
**React Query cache not being invalidated:**

`TenantConfigProvider` fetched tenant metadata with 5-minute `staleTime`:
```typescript
useQuery({
  queryKey: TENANT_META_QUERY_KEY,
  queryFn: fetchTenantMeta,
  staleTime: 5 * 60 * 1000,  // 5 minutes
});
```

`BrandingPage` dispatched `tenant-theme:refresh` event after saving, but `TenantConfigProvider` **wasn't listening** for it.

### Why Production "Worked"
Users typically navigated away from branding page → full component remount → fresh fetch

### Solution
**Commit: `16a87c82`** - Add event listener to `TenantConfigProvider`

```typescript
useEffect(() => {
  const handler = () => {
    console.log('[TenantConfigProvider] Received tenant-theme:refresh, invalidating cache...');
    queryClient.invalidateQueries({ queryKey: TENANT_META_QUERY_KEY });
  };
  window.addEventListener('tenant-theme:refresh', handler);
  return () => window.removeEventListener('tenant-theme:refresh', handler);
}, [queryClient]);
```

### Impact
- ✅ Branding colors update immediately without page refresh
- ✅ CSS variables (`--brand-primary`, `--brand-secondary`) updated in real-time
- ✅ Consistent behavior between dev and production

### Testing
```bash
1. Go to /admin/branding
2. Change primary/secondary colors
3. Click "Save Changes"
4. ✅ Colors should update immediately (no refresh needed)
5. Check console: "[TenantConfigProvider] Received tenant-theme:refresh..."
```

---

## Fix 3: Centralized Authentication & Logout

### Problem
- Inconsistent logout behavior across 401/403/manual logout
- Logout from 403 banner caused Azure SWA 404 pages
- Multiple copies of auth state clearing logic

### Root Cause
- Auth state clearing scattered across codebase
- Inline `onclick` handlers with incorrect globals (`window.apiClient`)
- Full page reloads (`window.location.href = '/login'`) bypassed SPA routing

### Solution
**Commits: `b386dba0`, `4ca13ead`**

1. **Created centralized auth utility** (`Frontend/src/utils/auth.ts`):
```typescript
export function logoutAndNavigateToLogin(
  navigate?: (path: string) => void,
  reason?: string
): void {
  // 1. Clear localStorage
  localStorage.removeItem('token');
  localStorage.removeItem('cachedRole');
  
  // 2. Clear axios headers
  delete api.defaults.headers.common['Authorization'];
  
  // 3. Navigate via React Router (SPA) or fallback
  if (navigate) {
    navigate('/login', { replace: true });
  } else {
    // History API for SPA navigation
    window.history.pushState({}, '', '/login');
    window.dispatchEvent(new PopStateEvent('popstate'));
  }
}
```

2. **Updated 403 banner** to use proper event listeners instead of inline `onclick`
3. **Updated AuthProvider.logout()** to use centralized utility

### Impact
- ✅ Single source of truth for logout logic
- ✅ No more SWA 404s on logout
- ✅ Consistent behavior across all logout paths
- ✅ Easier to maintain and debug

---

## Lessons Learned

### 1. Vite Build Process
- **Always put static assets in `public/` directory**
- Files in `public/` auto-copy to `dist/` during build
- Root-level files don't get included in production builds

### 2. Azure Static Web Apps
- Requires `staticwebapp.config.json` in build output
- `navigationFallback` is critical for SPA routing
- `responseOverrides` prevents CDN from caching 404s
- Always test direct URL navigation, not just client-side routing

### 3. React Query Caching
- `staleTime` prevents automatic refetches even with `refetch()`
- Must use `invalidateQueries()` to force fresh data
- Listen for custom events to sync state across components

### 4. Authentication Architecture
- Centralize auth state management in ONE place
- Use proper React hooks/context, not DOM manipulation
- SPA navigation (React Router) > History API > full reload

---

## Deployment Checklist

Before merging to `main`:

- [ ] Run `npm run build` locally and verify `dist/staticwebapp.config.json` exists
- [ ] Test all routes with direct URL navigation
- [ ] Test page refreshes on nested routes
- [ ] Verify branding updates without page refresh
- [ ] Test logout flow from various error states
- [ ] Check browser console for errors
- [ ] Verify Azure SWA deployment succeeds
- [ ] Smoke test production URL after deployment

---

## Related Documentation

- [DEPLOYMENT_GUIDE.md](../DEPLOYMENT_GUIDE.md) - Full deployment procedures
- [TENANT_DOMAINS.md](../TENANT_DOMAINS.md) - Multi-tenant domain configuration
- [docs/deployment/runbook.md](./deployment/runbook.md) - Operations runbook
- [Frontend/README-API_BASE_URL.md](../Frontend/README-API_BASE_URL.md) - API configuration

---

## Git History

```bash
# View these fixes
git log --oneline --grep="fix(swa)\|fix(frontend)\|fix(test)" develop

# Key commits:
43d4a1ff - fix(frontend): move staticwebapp.config.json to public/
c927d480 - fix(swa): improve routing config to prevent intermittent 404s
16a87c82 - fix(frontend): add tenant-theme:refresh listener to TenantConfigProvider
b386dba0 - Centralize logout and improve 403 error UX
7557df0b - fix(test): make PastOrders currency formatting test resilient
```
