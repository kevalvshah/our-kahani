// Offline shell for Our Kahani. Caches only the app's own files: never the backend, never
// /media, never anything with a room's data in it. Room data stays encrypted in IndexedDB.
//
// - /assets/* (hashed, immutable): cache first.
// - Page loads: network first, falling back to the cached app shell when offline.

const SHELL = 'ok-shell-v1';
const ASSETS = 'ok-assets-v1';
const MAX_ASSETS = 80;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(['/', '/manifest.webmanifest', '/icons/icon-192.png']))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== ASSETS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trim(cache) {
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - MAX_ASSETS))) await cache.delete(k);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // the backend is never cached
  if (url.pathname.startsWith('/media/') || url.pathname === '/version.txt') return;

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.open(ASSETS).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) {
          await cache.put(req, res.clone());
          void trim(cache);
        }
        return res;
      }),
    );
    return;
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(async (res) => {
          if (res.ok) await (await caches.open(SHELL)).put('/', res.clone());
          return res;
        })
        .catch(async () => (await caches.match('/')) ?? Response.error()),
    );
  }
});
