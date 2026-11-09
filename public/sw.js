// Nutrolix Service Worker for Web Push & Order Updates
self.addEventListener('install', event => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (_) {
      data = { title: 'Nutrolix Order Update', body: event.data.text() };
    }
  } else {
    data = { title: 'Nutrolix Order Update', body: 'New update on your order status.' };
  }

  const title = data.title || 'Nutrolix Functional Nutrition';
  const options = {
    body: data.body || data.message || '',
    icon: 'assets/nutrolix-logo.png',
    badge: 'assets/nutrolix-logo.png',
    vibrate: [200, 100, 200],
    data: {
      url: data.url || (data.orderId ? `orders.html?orderId=${data.orderId}` : 'orders.html')
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : 'orders.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes('orders.html') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
