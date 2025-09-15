import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
};

const BASE = __ENV.API_BASE || 'http://localhost:8000';
const USER = __ENV.TEST_USER || 'demo@example.com';
const PASS = __ENV.TEST_PASS || 'password';

function login() {
  const payload = JSON.stringify({ username: USER, password: PASS });
  const res = http.post(`${BASE}/api/auth/login`, payload, { headers: { 'Content-Type': 'application/json' } });
  check(res, { 'login status 200': r => r.status === 200 });
  try {
    const data = res.json();
    return data.access_token || null;
  } catch (_) {
    return null;
  }
}

export default function () {
  // Public metadata (should be fast & cached)
  let res = http.get(`${BASE}/api/public/tenant-meta`);
  check(res, { 'tenant-meta 200': r => r.status === 200 });

  // Auth flow (optional if credentials valid)
  const token = login();
  if (token) {
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };
    res = http.get(`${BASE}/api/loyalty/points/balance`, authHeaders);
    check(res, { 'balance maybe 200/404': r => r.status === 200 || r.status === 404 });
  }

  sleep(1);
}
