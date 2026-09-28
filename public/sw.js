// Offline shell and notifications for Our Kahani. Caches only the app's own files: never the backend, never
// /media, never anything with a room's data in it. Room data stays encrypted in IndexedDB.
//
// - /assets/* (hashed, immutable): cache first.
// - Page loads: network first, falling back to the cached app shell when offline.

const SHELL = 'ok-shell-v2';
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

// Notifications. A push never carries anything (no payload): whatever woke us, the phone shows
// the same line, so nothing about the room can appear on a lock screen.
self.addEventListener('push', (event) => {
  event.waitUntil(
    self.registration.showNotification('Our Kahani', {
      body: 'Your room needs attention',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: 'room',
      renotify: false,
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      const open = wins.find((w) => new URL(w.url).origin === self.location.origin);
      return open ? open.focus() : self.clients.openWindow('/');
    }),
  );
});
