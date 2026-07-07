/* =============================================================================
   Service worker for DoseTracker.

   This file makes the app work offline. The first time the app loads, the
   browser downloads everything into a local cache. From then on, every load
   is served from that cache first — instantly, and with no internet needed.

   HOW TO SHIP AN UPDATE:
   Whenever you change index.html (or any other file), set CACHE_VERSION
   below to today's date, adding a letter for repeat deploys on the same
   day ('2026-07-03a' -> '2026-07-03b' -> '2026-07-04a' ...). This is an
   internal cache label, not a public version number — the only thing that
   matters is that the string CHANGES on every deploy. Browsers re-read
   this file on each visit; a changed label creates a fresh cache and
   deletes the old one, so nobody gets stuck on stale code.
   ============================================================================= */

const CACHE_VERSION = '2026-07-07e';
const CACHE_NAME = `med-tracker-${CACHE_VERSION}`;

// Files the app cannot run without. If any of these fail to download,
// installation is retried on the next visit.
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon.svg'
];

// Nice-to-have files (the PNG icons). Cached if available, but their absence
// must not block installation — e.g. before you've generated them.
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
      // Optional files are added one by one so a missing icon can't break install
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

  // Navigations (opening or reloading the app) always get index.html,
  // from cache if possible — this is the offline fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(
        (cached) => cached || fetch(request).catch(() => caches.match('./index.html'))
      )
    );
    return;
  }

  // Everything else (manifest, icons): cache first, then network.
  // Anything fetched from the network gets stored for next time.
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
