// Offline support: keeps a copy of the site so it opens without a connection.
// Pages are answered from that copy right away. Each page visit checks the network for a new version in the
// background, and only once every file of the new version has downloaded does the copy switch to it, all at once,
// so a half-finished download can never mix new and old files. Open pages are then told a new version is ready.
'use strict';

const CACHE = 'bts-v3';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/styles.css',
  'js/vendor/qrcode.js', 'js/data.js', 'js/ballistics.js', 'js/app.js',
  'icons/icon.svg', 'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png'
];
const fileUrl = f => new URL(f, self.registration.scope).href;

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

const sameBytes = (a, b) => {
  if (a.byteLength !== b.byteLength) return false;
  const x = new Uint8Array(a), y = new Uint8Array(b);
  for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return false;
  return true;
};

// Downloads every file; if any failed, keeps the old copy as it is. If any changed, stores them all and tells open pages.
let checking = null;
function checkForUpdate() {
  if (checking) return checking;
  checking = (async () => {
    const cache = await caches.open(CACHE);
    const fresh = await Promise.all(FILES.map(f => fetch(new Request(fileUrl(f), { cache: 'no-cache', credentials: 'same-origin' }))
      .then(res => res.ok ? res : null).catch(() => null)));
    if (fresh.some(r => !r)) return;
    const bodies = await Promise.all(fresh.map(r => r.clone().arrayBuffer()));
    const changed = await Promise.all(FILES.map(async (f, i) => {
      const old = await cache.match(fileUrl(f), { ignoreSearch: true });
      return !old || !sameBytes(await old.arrayBuffer(), bodies[i]);
    }));
    if (!changed.some(Boolean)) return;
    await Promise.all(FILES.map((f, i) => cache.put(fileUrl(f), fresh[i])));
    (await self.clients.matchAll({ type: 'window' })).forEach(c => c.postMessage({ type: 'bts-updated' }));
  })().catch(() => {}).finally(() => { checking = null; });
  return checking;
}

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  // Only this site's own files; the test pages always load fresh.
  if (req.method !== 'GET' || url.origin !== location.origin || url.pathname.includes('/tests/')) return;
  // Every page visit (with or without a settings code or query) is the one page.
  const key = req.mode === 'navigate' ? fileUrl('index.html') : url.origin + url.pathname;
  if (req.mode === 'navigate') e.waitUntil(checkForUpdate());
  e.respondWith(caches.open(CACHE).then(async cache => {
    const cached = await cache.match(key, { ignoreSearch: true });
    if (cached) return cached;
    // Not in the copy yet (first visit, or a file outside FILES): from the network, kept for next time.
    const res = await fetch(new Request(url.href, { cache: 'no-cache', credentials: 'same-origin' })).catch(() => null);
    if (res && res.ok) cache.put(key, res.clone());
    return res || Response.error();
  }));
});
