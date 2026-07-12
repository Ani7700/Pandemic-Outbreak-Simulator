// Service Worker — Vaccination & Outbreak Risk app
// Strategy:
//   - HTML + app data (.json/.geojson): NETWORK-FIRST  → always fresh when online,
//     falls back to cache only when offline. (This is why a normal refresh now
//     shows the latest deploy instead of a stale cached copy.)
//   - Icons / CDN libraries: cache-first (they rarely change).
//   - External APIs (postcodes.io, nominatim, the simulator API): network only.
//
// Bump CACHE (v2 -> v3 …) any time you want to force-drop the old cache.

const CACHE = 'vax-risk-v14';

const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './utla_data.json',
  './utla.geojson',
  './measles_cases.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

// Install: pre-cache what we can, then take over immediately
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.allSettled(PRECACHE.map(url => cache.add(url).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

// Activate: delete any older caches, then control open pages
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function networkFirst(request) {
  return fetch(request)
    .then(resp => {
      if (request.method === 'GET' && resp && resp.status === 200) {
        const clone = resp.clone();
        caches.open(CACHE).then(c => c.put(request, clone));
      }
      return resp;
    })
    .catch(() => caches.match(request));
}

function cacheFirst(request) {
  return caches.match(request).then(cached => cached || fetch(request).then(resp => {
    if (request.method === 'GET' && resp && resp.status === 200) {
      const clone = resp.clone();
      caches.open(CACHE).then(c => c.put(request, clone));
    }
    return resp;
  }));
}

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // External services: always network (never cache)
  const externalNetworkOnly =
    url.hostname === 'api.postcodes.io' ||
    url.hostname === 'nominatim.openstreetmap.org' ||
    url.hostname.endsWith('onrender.com');
  if (externalNetworkOnly) {
    event.respondWith(
      fetch(req).catch(() =>
        new Response(JSON.stringify({ status: 503, error: 'Offline' }),
          { headers: { 'Content-Type': 'application/json' } })
      )
    );
    return;
  }

  // HTML documents + app data → network-first (fresh on every online refresh)
  const isDocument = req.mode === 'navigate' ||
    url.pathname === '/' || url.pathname.endsWith('/') || url.pathname.endsWith('.html');
  const isData = /\.(json|geojson)$/.test(url.pathname);
  if (isDocument || isData) {
    event.respondWith(networkFirst(req));
    return;
  }

  // Everything else (icons, CDN scripts) → cache-first
  event.respondWith(cacheFirst(req));
});
