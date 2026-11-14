// Nutrolix Service Worker for Web Push (VAPID) & FCM Background Order Updates
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let raw = {};
  if (event.data) {
    try {
      raw = event.data.json();
    } catch (_) {
      raw = { title: 'Nutrolix Order Update', body: event.data.text() };
    }
  }

  // Handle both RFC 8291 VAPID payload & Firebase FCM HTTP v1 webpush shape
  const notif = raw.notification || {};
  const data = raw.data || raw;
  const title = notif.title || raw.title || data.title || 'Nutrolix Order Update';
  const body = notif.body || raw.body || data.body || data.message || 'Your order status has been updated.';
  const orderId = data.orderId || raw.orderId || '';
  const targetUrl = (data.url || raw.url || (orderId ? `/orders.html?orderId=${encodeURIComponent(orderId)}` : '/orders.html'));

  const options = {
    body,
    icon: '/assets/nutrolix-logo.png',
    badge: '/assets/nutrolix-logo.png',
    vibrate: [200, 100, 200],
    tag: data.dedupKey || (orderId ? `nutrolix_order_${orderId}` : undefined),
    renotify: true,
    data: {
      orderId,
      url: targetUrl
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/orders.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if ('navigate' in client && 'focus' in client) {
          client.navigate(targetUrl).catch(() => {});
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
