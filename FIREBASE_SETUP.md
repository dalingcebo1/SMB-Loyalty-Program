# Firebase Admin Credentials Integration

This project supports two strategies for providing Firebase service account credentials to the backend (FastAPI) for server-side operations (e.g., verifying ID tokens, managing users, sending messages):

## 1. Strategies

| Strategy | When to Use | How It Works | Pros | Cons |
|----------|-------------|--------------|------|------|
| Inline JSON Secret (`json-secret`) | Easiest in CI/CD / Container Apps | Store full JSON (compressed or exact) in secret `CA_FIREBASE_CREDENTIALS_JSON`; backend writes a temp file at startup | No file mounting; single secret | Large secret; rotation requires re‑encoding JSON |
| File Path (`path`) | You can mount a file (volume / baked into image) | Provide `GOOGLE_APPLICATION_CREDENTIALS` pointing to a JSON file in the container | Smaller secret set (just path) | Requires baking or mounting file |

## 2. Backend Behavior

In `main.py` startup:
1. If `GOOGLE_APPLICATION_CREDENTIALS` already set, it is used as-is.
2. Else if `firebase_credentials_json` (env `FIREBASE_CREDENTIALS_JSON`) exists, a secure temporary file is written and `GOOGLE_APPLICATION_CREDENTIALS` is set to that path.
3. Else if `google_application_credentials` from `config.py` is set, that value becomes `GOOGLE_APPLICATION_CREDENTIALS`.

## 3. Configuring via GitHub + Container App

1. Add a new repository secret `CA_FIREBASE_CREDENTIALS_JSON` containing the raw JSON of the Firebase service account.
   - Open the downloaded service account file (from Firebase Console > Project Settings > Service Accounts > Generate new private key) and copy the entire JSON content into the secret value.
2. Run the workflow: `Configure Container App Env` and provide:
   - `firebase_mode`: `json-secret`
   - Leave `firebase_path` blank.
3. The workflow will set the environment variable `FIREBASE_CREDENTIALS_JSON` on the Container App.
4. On next container revision start, backend writes a temporary file and sets `GOOGLE_APPLICATION_CREDENTIALS` automatically.

### Alternate: File Path Mode
If you prefer path mode:
1. Bake the JSON into the image (NOT recommended for production) or mount via volume/secret mechanism.
2. Run the workflow with:
   - `firebase_mode`: `path`
   - `firebase_path`: `/app/firebase.json`
3. Ensure the file actually exists at that path inside the container image / mount.

## 4. Verifying Deployment
After deploying with `json-secret` mode:
```bash
# Exec into container (Azure CLI):
az containerapp exec -g <RG> -n <APP_NAME> --command "python - <<'PY'
import os, json
path=os.environ.get('GOOGLE_APPLICATION_CREDENTIALS')
print('GOOGLE_APPLICATION_CREDENTIALS =', path)
print('Exists:', os.path.exists(path))
print('First 80 chars:', open(path).read(80))
PY"
```
(Do not print the whole file in logs if sensitive.)

## 5. Security Notes
- Rotate service account keys periodically via Firebase console and update the secret.
- Keep `ENABLE_DEV_DANGEROUS=false` in production so no dev endpoints can leak env variables.
- Avoid embedding the file directly in the container image for long-term security; prefer secret injection.

## 6. Troubleshooting
| Symptom | Possible Cause | Fix |
|---------|----------------|-----|
| `GOOGLE_APPLICATION_CREDENTIALS` not set | Workflow not run after adding secret | Re-run `Configure Container App Env` |
| Firebase Admin auth errors | Malformed JSON secret (extra whitespace / quoting) | Re-copy raw JSON exactly |
| Permission denied reading temp file | Unusual base image umask | Manually chmod path or adjust startup logic |
| Wrong project used | Service account file from different Firebase project | Generate new key in correct project |

## 7. Quick Local Test (Inline Mode Simulation)
```bash
export FIREBASE_CREDENTIALS_JSON="$(cat firebase-credentials.json)"
uvicorn main:app --reload
```
Check logs for: `Materialized Firebase credentials JSON to temp file`.

---
This file should evolve if additional Firebase features (messaging, multi-project) are added.

---

# Frontend (Web SDK) Configuration

For Google sign-in and optional phone verification on the frontend, Vite expects Firebase Web SDK values at build time via `VITE_FIREBASE_*` env vars. These values are public client configuration and can be safely exposed in the built site.

## Required Web Config Keys

Map your Firebase web app settings to the following variables:

- VITE_FIREBASE_API_KEY → apiKey
- VITE_FIREBASE_AUTH_DOMAIN → authDomain (e.g. your-project.firebaseapp.com)
- VITE_FIREBASE_PROJECT_ID → projectId
- VITE_FIREBASE_STORAGE_BUCKET → storageBucket
- VITE_FIREBASE_MESSAGING_SENDER_ID → messagingSenderId
- VITE_FIREBASE_APP_ID → appId

Add them in one of these ways:
- Local dev: copy `Frontend/.env.example` to `.env.local` and fill values.
- Production (Azure Static Web Apps): set repository Variables (preferred) or Secrets with the same names; the SWA workflow passes them to the Vite build.

## Azure Static Web Apps Workflow

The workflow `azure-static-web-apps-*.yml` now includes:

```
env:
   VITE_FIREBASE_API_KEY: ${{ vars.VITE_FIREBASE_API_KEY || secrets.VITE_FIREBASE_API_KEY }}
   VITE_FIREBASE_AUTH_DOMAIN: ${{ vars.VITE_FIREBASE_AUTH_DOMAIN || secrets.VITE_FIREBASE_AUTH_DOMAIN }}
   VITE_FIREBASE_PROJECT_ID: ${{ vars.VITE_FIREBASE_PROJECT_ID || secrets.VITE_FIREBASE_PROJECT_ID }}
   VITE_FIREBASE_STORAGE_BUCKET: ${{ vars.VITE_FIREBASE_STORAGE_BUCKET || secrets.VITE_FIREBASE_STORAGE_BUCKET }}
   VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ vars.VITE_FIREBASE_MESSAGING_SENDER_ID || secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
   VITE_FIREBASE_APP_ID: ${{ vars.VITE_FIREBASE_APP_ID || secrets.VITE_FIREBASE_APP_ID }}
```

Set those Variables/Secrets under GitHub → Settings → Secrets and variables → Actions.

## Authorized Domains

In Firebase Console → Authentication → Settings → Authorized domains, add your production domain(s):
- your SWA default domain (e.g. gray-river-01eda360f.z01.web.core.windows.net)
- your custom domain (e.g. chaosx.co.za)
- localhost for dev as needed

## Verifying in Production

After deploy, visit:
- `/debug/firebase` to see whether `VITE_FIREBASE_*` were compiled in.
- Login page should show Google button enabled (no red warning).
- Attempt Google login; if you see `auth/unauthorized-domain`, update Authorized domains above.

### Helper: Configure Frontend Variables via Actions

Use the workflow "Configure Frontend Variables" in the Actions tab to set `VITE_*` repository variables without leaving GitHub. Provide the values (API base URL, Firebase, Yoco public key) as inputs and run the workflow; subsequent frontend builds will pick them up automatically.
