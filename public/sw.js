// YesOrNo Service Worker v3
const CACHE_NAME = 'yesorno-cache-v3';
const STATIC_ASSETS = [
  '/manifest.json',
  '/icons/icon.svg',
  '/og-image.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  // Force new service worker to activate immediately
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[SW] Purging outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Bypass local development environments entirely
  if (
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.port === '5173' ||
    url.port === '5174'
  ) {
    return;
  }

  // Avoid handling browser extensions, blob URLs, or data URLs
  if (
    url.protocol.startsWith('chrome-extension') ||
    url.protocol.startsWith('blob') ||
    url.protocol.startsWith('data')
  ) {
    return;
  }

  // NETWORK-ONLY for all dynamic API endpoints, PHP endpoints, and SQLite feeds
  // This guarantees mobile PWAs always see fresh live debates, votes, and user profiles!
  if (
    url.pathname.endsWith('.php') ||
    url.pathname.includes('/api-') ||
    url.pathname.includes('/ai-curator') ||
    url.searchParams.has('action') ||
    url.pathname.includes('/data/')
  ) {
    return; // Let standard browser fetch handle it with network
  }

  // NETWORK-FIRST for HTML page navigation
  // Ensures fresh index.html with latest JS bundle hashes is loaded when online,
  // falling back to cached index.html only if completely offline.
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // STALE-WHILE-REVALIDATE for static hashed assets (/assets/*, fonts, icons)
  if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return networkResponse;
        }).catch(() => {/* Offline fallback */});

        return cachedResponse || fetchPromise;
      })
    );
  }
});
