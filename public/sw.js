const CACHE_NAME = 'rg-timesheet-v1';
const STATIC_ASSETS = ['/', '/employee', '/login'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)).catch(() => {}),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests; pass everything else through
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Network-first for API routes
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => cached ?? fetch(event.request)),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data?.json() ?? {};
  } catch {
    data = { title: 'Royal Glass Timesheet', body: event.data?.text() ?? '' };
  }

  const title = data.title ?? 'Royal Glass Timesheet';
  const options = {
    body: data.body ?? '',
    icon: '/icon-192x192.png',
    badge: '/icon-192x192.png',
    data: { url: data.url ?? '/employee' },
    requireInteraction: false,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const rawUrl = event.notification.data?.url ?? '/employee';
  // Guard against open-redirect: only navigate to same-origin paths
  let url;
  try {
    const parsed = new URL(rawUrl, self.location.origin);
    url = parsed.origin === self.location.origin ? parsed.href : `${self.location.origin}/employee`;
  } catch {
    url = `${self.location.origin}/employee`;
  }
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      }),
  );
});
