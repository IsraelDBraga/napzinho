/* Napzinho service worker — cache shell for offline PWA */
const CACHE = 'nest-v5';
const ASSETS = [
  './',
  './index.html',
  './assets/css/styles.css',
  './assets/js/config.js',
  './assets/js/state.js',
  './assets/js/time-engine.js',
  './assets/js/sleep-engine.js',
  './assets/js/predict-engine.js',
  './assets/js/stale-guard.js',
  './assets/js/storage.js',
  './assets/js/render-settings.js',
  './assets/js/render-home.js',
  './assets/js/render-stats.js',
  './assets/js/render-history.js',
  './assets/js/render-copilot.js',
  './assets/js/entries.js',
  './assets/js/backup.js',
  './assets/js/debug.js',
  './assets/js/tests.js',
  './assets/js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS).catch(() => cache.addAll(ASSETS.filter((u) => !u.startsWith('http')))))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;
  if (!url.includes(self.location.origin) && !url.includes('cdnjs.cloudflare.com')) return;
  const isAppShell = e.request.mode === 'navigate' || url.endsWith('/index.html') || url.endsWith('/sw.js');
  if (isAppShell) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok) caches.open(CACHE).then((cache) => cache.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request).then((c) => c || caches.match('./index.html')))
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;
      return fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          if (res.ok && res.type === 'basic') {
            caches.open(CACHE).then((cache) => cache.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match('./index.html'));
    })
  );
});
