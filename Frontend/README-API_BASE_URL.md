Direct API integration (Option A)

Overview
- The frontend calls the backend API directly via CORS using the build-time variable VITE_API_BASE_URL.
- A small fetch shim rewrites fetch('/api/...') to `${VITE_API_BASE_URL}/api/...` at runtime.
- Axios client in `src/api/api.ts` also uses `import.meta.env.VITE_API_BASE_URL || '/api'` as its base.

Setup
1) Configure the SWA app setting:
   - VITE_API_BASE_URL=https://api.chaosx.co.za (or your API domain)
2) Rebuild and redeploy SWA so the value is embedded into the app.

Code usage
- Prefer using the shared axios client from `src/api/api.ts` and prefix paths with `/api`.
- Existing fetch calls that use `/api/...` will be rewritten by `src/api/fetchShim.ts` automatically.

Examples
```
import api from './api/api';
const res = await api.get('/api/public/tenant-meta');
```

Troubleshooting
- If requests fail due to CORS, ensure backend ALLOWED_ORIGINS includes the SWA domain.
- Confirm the browser devtools show requests going to `https://api.<domain>/api/...`.
- For local dev, set `.env`:
  - VITE_API_BASE_URL=http://localhost:8000
