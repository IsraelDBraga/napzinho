/* Napzinho service worker — cache shell for offline PWA */
const CACHE = 'nest-v4';
const ASSETS = [
  './',
  './index.html',
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
