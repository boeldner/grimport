// Grimport app-shell service worker. Vanilla, no build step, no deps.
// Registered from app.js. Bump CACHE to force old caches out on deploy.
const CACHE = 'grimport-shell-v2';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/style.css',
  '/app.js',
  '/manifest.webmanifest',
  '/offline.html',
  '/icons/icon-192.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(SHELL_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle same-origin GET requests; everything else passes through.
  if (req.method !== 'GET' || url.origin !== self.location.origin) return;

  // Never cache the API or the MCP/OAuth endpoints — live data only.
  if (url.pathname.startsWith('/api/') || url.pathname === '/mcp' || url.pathname.startsWith('/.well-known/')) return;

  // Page navigations: network-first so users get fresh HTML when online,
  // falling back to the cached shell (then the offline page) when not.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          caches.open(CACHE).then((cache) => cache.put(req, res.clone()));
          return res;
        })
        .catch(() =>
          caches.match('/index.html').then((cached) => cached || caches.match('/offline.html'))
        )
    );
    return;
  }

  // Shell assets: stale-while-revalidate — respond fast from cache, and
  // quietly refresh the cache in the background for next time.
  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => { cache.put(req, res.clone()); return res; })
            .catch(() => cached);
          return cached || network;
        })
      )
    );
  }
  // Everything else (icons, misc assets not in the shell list): pass through.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Web push ──────────────────────────────────────────────
// Payload comes from src/push.js: { title, body, type, url, tag, data }.
self.addEventListener('push', (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { title: 'Grimport', body: event.data ? event.data.text() : '' }; }
  const title = payload.title || 'Grimport';
  const options = {
    body: payload.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    data: { url: payload.url || '/', type: payload.type || null },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => c.url.startsWith(self.location.origin));
      if (open) {
        return open.focus().then((c) => (c && 'navigate' in c ? c.navigate(target) : c));
      }
      return self.clients.openWindow(target);
    })
  );
});
