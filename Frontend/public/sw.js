// public/sw.js
/**
 * Service Worker for SMB Loyalty PWA
 *
 * Provides offline-first experience by caching:
 * - Static assets (JS, CSS, fonts, images) — cache-first
 * - API responses for loyalty / order data — network-first with cache fallback
 * - Offline fallback page when navigation fails
 *
 * VitePWA generates its own service worker during production builds.
 * This file acts as the development / static fallback SW registered
 * in `main.tsx`.
 */

const CACHE_VERSION = 'v2';
const CACHE_NAME = `smb-loyalty-${CACHE_VERSION}`;
const OFFLINE_URL = '/offline.html';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  OFFLINE_URL,
  '/favicon.svg',
];

// API paths whose responses should be cached for offline use
const CACHEABLE_API_PATTERNS = [
  '/api/loyalty/',
  '/api/orders/',
  '/api/catalog/',
  '/api/public/tenant-manifest',
  '/api/public/tenant-meta',
  '/api/public/tenant-theme',
];

// ── Install ────────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// ── Activate ───────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

// ── Fetch ──────────────────────────────────────────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (!url.protocol.startsWith('http')) return;

  // Navigation requests → network with offline fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cached = await caches.match(OFFLINE_URL);
        return cached || new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } });
      })
    );
    return;
  }

  // API calls → network-first with cache fallback
  if (isCacheableAPI(url)) {
    event.respondWith(networkFirstStrategy(request));
    return;
  }

  // Static / image assets → cache-first
  if (isStaticAsset(url) || isImage(url)) {
    event.respondWith(cacheFirstStrategy(request));
    return;
  }

  // Default: network-only
  event.respondWith(fetch(request));
});

// ── Strategies ─────────────────────────────────────────────────
async function networkFirstStrategy(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(
      JSON.stringify({ error: 'Offline', message: 'No cached data available' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

async function cacheFirstStrategy(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return new Response('Offline', { status: 503 });
  }
}

// ── Helpers ────────────────────────────────────────────────────
function isCacheableAPI(url) {
  return CACHEABLE_API_PATTERNS.some((p) => url.pathname.startsWith(p));
}

function isStaticAsset(url) {
  return /\.(js|css|woff2?|ttf|eot)$/.test(url.pathname);
}

function isImage(url) {
  return /\.(png|jpe?g|gif|svg|webp|ico)$/.test(url.pathname);
}

// ── Messages ───────────────────────────────────────────────────
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
  if (event.data?.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.delete(CACHE_NAME).then(() => caches.open(CACHE_NAME))
    );
  }
});

