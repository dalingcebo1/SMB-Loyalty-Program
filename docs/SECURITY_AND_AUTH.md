# Security & Authentication Guide

## Authentication Overview

The platform uses **JWT-based authentication** with optional **Firebase social login** (Google + phone OTP). All tenant context and capability checks are enforced server-side.

```
User → Login (email/pass OR Google) → JWT Token → API requests with Bearer token
                                         ↓
                              Firebase ID Token (social login)
                                         ↓
                          Backend verifies with Firebase Admin SDK
                                         ↓
                              Issues platform JWT + session
```

---

## Authentication Flows

### 1. Traditional Email/Password

```
POST /api/auth/register  →  user created (onboarded=false)
   ↓
Frontend navigates to /onboarding  →  user enters first name, last name, phone
   ↓
/onboarding/verify  →  user enters phone OTP
   ↓
onboarded=true, JWT issued  →  navigate to dashboard
```

### 2. Traditional Login

```
POST /api/auth/login  →  check credentials + onboarding status
   ↓  onboarding_required=true  →  redirect to /onboarding (continue from last step)
   ↓  complete  →  return JWT + user data  →  navigate to role-based dashboard
```

### 3. Social Login (Google via Firebase)

```
User clicks "Continue with Google"
   ↓
Firebase popup/redirect handles Google OAuth
   ↓
Frontend receives Firebase ID Token
   ↓
Backend: POST /api/auth/social/google  →  verifies token with Firebase Admin SDK
   ↓
Backend finds or creates user
   ↓
If profile data missing (no phone)  →  onboarding_required=true  →  /onboarding
   ↓
If complete  →  platform JWT issued  →  navigate to dashboard
```

**Key invariant:** All users — regardless of signup method — must complete phone verification before accessing the full dashboard. Social login does **not** bypass onboarding.

### 4. Phone OTP Verification

Phone OTP is handled via Firebase Authentication (phone provider):

```
Frontend sends phone number to Firebase
   ↓
Firebase sends SMS OTP to user
   ↓
User enters OTP  →  Firebase confirms  →  frontend gets Firebase phone credential
   ↓
Backend validates phone is verified  →  sets onboarded=true
```

### 5. Token Refresh

```
POST /api/auth/refresh  →  validates existing JWT  →  returns new JWT
```

Tokens should be refreshed before expiry. Expired tokens return `401 Unauthorized`.

---

## JWT Configuration

All JWT signing uses secrets injected as environment variables — never hardcoded.

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Signs access tokens |
| `RESET_SECRET` | Signs password reset tokens |
| `SECRET_KEY` | General app signing key (32+ characters) |

### Token Payload Structure

```json
{
  "sub": "user_id",
  "email": "user@example.com",
  "role": "user|staff|admin",
  "tenant_id": "tenant-slug",
  "onboarded": true,
  "exp": 1735689600
}
```

### Backend Dependency Injection

All protected routes use FastAPI dependency injection:

```python
@router.get("/protected")
async def protected_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    ...
```

`get_current_user` validates the JWT, resolves tenant context, and checks `onboarded` status. Never bypass this dependency when adding new routes.

---

## Firebase Setup

### Backend (Admin SDK)

The backend uses Firebase Admin SDK for server-side token verification and user management.

#### Strategy 1: JSON Secret (Recommended for CI/CD)

1. Download service account key from Firebase Console → Project Settings → Service Accounts → Generate new private key
2. Add GitHub repository secret `CA_FIREBASE_CREDENTIALS_JSON` containing the raw JSON content
3. Run the "Configure Container App Env" workflow with `firebase_mode: json-secret`
4. The backend writes a secure temp file at startup and sets `GOOGLE_APPLICATION_CREDENTIALS` automatically

#### Strategy 2: File Path (for volume mounts)

1. Mount or bake the JSON file into the container at a known path
2. Run workflow with `firebase_mode: path` and `firebase_path: /app/firebase.json`

#### Startup Resolution Order

```
1. GOOGLE_APPLICATION_CREDENTIALS already set? → use as-is
2. FIREBASE_CREDENTIALS_JSON env var set? → write temp file → set GOOGLE_APPLICATION_CREDENTIALS
3. google_application_credentials in config.py set? → use as path
4. Firebase features unavailable
```

#### Verifying Firebase Credentials in Azure

```bash
az containerapp exec -g <RG> -n <APP_NAME> --command "python - <<'PY'
import os
path = os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
print('Path:', path)
print('Exists:', os.path.exists(path))
print('First 80 chars:', open(path).read(80))
PY"
```

#### Quick Local Test

```bash
export FIREBASE_CREDENTIALS_JSON="$(cat firebase-credentials.json)"
# Then start the backend — watch for: "Materialized Firebase credentials JSON to temp file"
```

#### Security Notes for Firebase Admin Credentials

- Rotate service account keys periodically via Firebase Console, then update the GitHub secret
- Never embed the key file directly in the container image for long-term deployments
- Keep `ENABLE_DEV_DANGEROUS=false` in production to prevent dev endpoints from leaking env vars
- The backend only writes credentials to a temp path at startup — not accessible via API

### Frontend (Web SDK)

Firebase Web SDK enables Google sign-in and phone OTP on the frontend. These are public client configuration values (safe to expose in the built JS bundle).

#### Required Environment Variables

```
VITE_FIREBASE_API_KEY=<apiKey>
VITE_FIREBASE_AUTH_DOMAIN=<project>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<projectId>
VITE_FIREBASE_STORAGE_BUCKET=<project>.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=<senderId>
VITE_FIREBASE_APP_ID=<appId>
```

Set these in GitHub **Settings → Secrets and variables → Actions** as Repository Variables.

The SWA deploy workflow reads them as:
```yaml
env:
  VITE_FIREBASE_API_KEY: ${{ vars.VITE_FIREBASE_API_KEY || secrets.VITE_FIREBASE_API_KEY }}
  # ... (same pattern for all VITE_FIREBASE_* vars)
```

#### Authorized Domains

In Firebase Console → Authentication → Settings → Authorized domains, add:
- Your production domain (e.g., `chaosx.co.za`)
- Your SWA default domain (e.g., `orange-pond-06eea490f.3.azurestaticapps.net`)
- `localhost` for local dev

If login fails with `auth/unauthorized-domain`, add the domain here.

#### Verifying Frontend Firebase Config

1. Deploy and visit `/debug/firebase` — shows whether `VITE_FIREBASE_*` vars were compiled in
2. Login page should show Google button (not greyed out with a warning)
3. Google login should work without `auth/unauthorized-domain` errors

#### Firebase Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `GOOGLE_APPLICATION_CREDENTIALS` not set | Workflow not run after adding secret | Re-run "Configure Container App Env" |
| Firebase Admin auth errors | Malformed JSON (extra whitespace/quoting) | Re-copy raw JSON exactly |
| `auth/unauthorized-domain` | Domain not in Firebase Authorized domains | Add domain in Firebase Console |
| Wrong Firebase project | Service account from different project | Generate key in correct Firebase project |

---

## Multi-Tenant Security

### Tenant Context Enforcement

Every request is scoped to a tenant. The `get_current_user` dependency resolves tenant context via:

1. `X-Tenant-ID` header (explicit override)
2. `tenant_domains` table lookup (domain → tenant)
3. `primary_domain` field (legacy)
4. `DEFAULT_TENANT` env var (dev/staging fallback only)

**Cross-tenant data access is prevented at the database query layer** — all queries filter by `tenant_id` from the resolved context.

### Capability-Based Authorization

User roles map to capabilities via `ROLE_CAPABILITIES`. Frontend and backend both enforce these:

**Backend:** use `require_capability("capability-name")` dependency  
**Frontend:** use `useCapabilities().has("capability-name")`

When adding new features requiring permissions:
1. Define the capability name in `ROLE_CAPABILITIES`
2. Add the backend dependency to protected routes
3. Guard the frontend action/UI with `useCapabilities().has(...)`

### Admin-Only Endpoints

All tenant domain management endpoints require `manage_tenants` capability:
- `GET/POST /api/admin/tenant-domains/`
- `PATCH/DELETE /api/admin/tenant-domains/{id}`
- `GET /api/admin/tenant-domains/lookup/{domain}`

---

## Rate Limiting

Token bucket rate limiting is implemented in `app/core/rate_limit.py`.

| Scope | Limit |
|-------|-------|
| Unauthenticated / IP | 100 req/min |
| Authenticated user | 300 req/min |
| Premium subscriber | 1000 req/min |

Rate limiting is applied per endpoint category. The middleware uses Redis (if configured) for distributed rate limiting, or falls back to in-memory. Rate limit headers are included in responses.

---

## Security Hardening

### Settings Normalization

`Settings.normalise()` strips a single layer of surrounding quotes from `DATABASE_URL`, `SECRET_KEY`, `ALLOWED_ORIGINS`, and `FRONTEND_URL`. This prevents deploy failures from accidentally quoted secrets in Azure Portal or CI.

### CORS Configuration

The `ALLOWED_ORIGINS` env var accepts a comma-separated list of allowed origins. If it is missing or set to `*`, the backend derives a safe fallback from `FRONTEND_URL` and logs a warning. Set explicitly for production:

```
ALLOWED_ORIGINS=https://www.chaosx.co.za,https://orange-pond-06eea490f.3.azurestaticapps.net
```

### Content Security Policy

Set `CSP_POLICY` environment variable to enable the `Content-Security-Policy` header. A warning is logged in production if absent.

### Input Validation

All API inputs are validated via Pydantic models before entering business logic. SQL injection is prevented by SQLAlchemy ORM parameterization.

### Webhook Verification

Payment webhooks from Yoco include a signature. The backend verifies `YOCO_WEBHOOK_SECRET` against the request signature before processing any webhook payload.

### Dev Endpoints Protection

`ENABLE_DEV_DANGEROUS=false` must be set in production. Dev endpoints (`/api/dev/*`) expose internal state and should never be accessible in production.

---

## Security Checklist

### Pre-Launch

- [ ] `SECRET_KEY` is 32+ characters, randomly generated
- [ ] `JWT_SECRET` and `RESET_SECRET` are set and unique
- [ ] `DATABASE_URL` uses a least-privilege database user
- [ ] `ALLOWED_ORIGINS` explicitly lists only known frontend domains
- [ ] `CSP_POLICY` is configured
- [ ] `ENABLE_DEV_DANGEROUS=false` in production Container App env
- [ ] Firebase service account key uploaded as `CA_FIREBASE_CREDENTIALS_JSON` secret
- [ ] Yoco webhook secret configured and matches production webhook endpoint
- [ ] SSL/TLS certificates valid on all domains

### Ongoing

- [ ] Rotate service account keys and application secrets quarterly
- [ ] Run `pip-audit -r Backend/requirements.txt` monthly
- [ ] Review access logs for unusual patterns
- [ ] Keep dependencies up to date (Dependabot PRs reviewed weekly)
- [ ] Regularly review user roles and capabilities

---

## Password Reset Flow

```
POST /api/auth/forgot-password  →  sends reset link to email
   ↓
User clicks link  →  POST /api/auth/reset-password  →  validates RESET_SECRET token
   ↓
Password updated  →  existing sessions optionally invalidated
```

Reset tokens are signed with `RESET_SECRET` and are short-lived.

---

## Session Management

- JWT access tokens are short-lived (configured via `JWT_SECRET`)
- `POST /api/auth/refresh` issues a new token before expiry
- `POST /api/auth/logout` invalidates the current token server-side
- Frontend clears stored token on logout and navigates to `/login`

The `confirmationRef` pattern used in phone OTP flows stores transient Firebase confirmation results. These are not persisted — if the page is reloaded mid-OTP, the user restarts the phone verification step.
