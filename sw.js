/* =============================================================================
   Service worker for offline loading.

   Bump CACHE_VERSION for every deployed app change. The label is internal:
   changing it creates a fresh cache and removes older app caches.
   ============================================================================= */

const CACHE_VERSION = '2026-07-08f';
const CACHE_NAME = `med-tracker-${CACHE_VERSION}`;

// Files the app cannot run without.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

// Nice-to-have icons; missing ones must not block install.
const OPTIONAL_ASSETS = [
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  './apple-touch-icon-180.png'
];

// --- Install: download everything into the cache ---
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await cache.addAll(CORE_ASSETS);
      // Add optional files one by one so one miss cannot break install.
      await Promise.allSettled(OPTIONAL_ASSETS.map((url) => cache.add(url)));
    }).then(() => self.skipWaiting()) // activate the new version immediately
  );
});

// --- Activate: delete caches from older versions ---
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('med-tracker-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim()) // take control of open pages right away
  );
});

// --- Fetch: serve from cache first, network only as a fallback ---
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle normal page/file requests from our own site
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations always fall back to cached index.html.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(
        (cached) => cached || fetch(request).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // Other same-origin files: cache first, then store successful network hits.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    })
  );
});
