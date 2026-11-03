// Offline support: keeps a copy of the site so it opens without a connection.
// Each request is answered from that copy right away and refreshed from the network in the background,
// so a new version shows up on the visit after it is published.
'use strict';

const CACHE = 'bts-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/vendor/qrcode.js', 'js/data.js', 'js/ballistics.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE)
    .then(c => c.addAll(FILES.map(f => new Request(f, { cache: 'reload' }))))
    .then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Only this site's own files; the test pages always load fresh.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/tests/')) return;
  // Every page visit (with or without a settings code or query) is the one page.
  const key = req.mode === 'navigate' ? new URL('index.html', self.registration.scope).href : url.origin + url.pathname;
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(key, { ignoreSearch: true });
    const fresh = fetch(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => { if (res.ok) cache.put(key, res.clone()); return res; })
      .catch(() => null);
    if (cached) { e.waitUntil(fresh); return cached; }
    return (await fresh) || Response.error();
  }));
});
