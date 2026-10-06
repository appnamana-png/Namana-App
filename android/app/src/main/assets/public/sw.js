// Namana Physiotherapy Clinic - Service Worker
// Enables offline APK app loading, asset caching, and background sync capabilities

const CACHE_NAME = 'namana-physio-v3';
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-192.png',
  '/icon-maskable-512.png',
  '/clinic_logo.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('Precache partial fallback:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Network-first strategy for navigation and assets so code updates appear immediately
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude external API / Webhook calls from service worker cache (always fresh network)
  if (
    url.hostname.includes('script.google.com') ||
    url.hostname.includes('script.googleusercontent.com') ||
    url.hostname.includes('google.com') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network First for HTML and dynamic resources
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Offline fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
      })
  );
});

// Background Sync (Android / PWA background sync)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-google-sheets') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'EXECUTE_BACKGROUND_SYNC' });
        });
      })
    );
  }
});

// Periodic Background Sync (if supported by Android WebView / OS)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'hourly-backup-sync') {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: 'EXECUTE_HOURLY_BACKUP' });
        });
      })
    );
  }
});
