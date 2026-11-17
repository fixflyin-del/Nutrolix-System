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

  const uniqueTag = data.dedupKey || (orderId ? `nutrolix_order_${orderId}_${data.status || Date.now()}` : `nutrolix_update_${Date.now()}`);

  const options = {
    body,
    icon: '/assets/nutrolix-logo.png',
    badge: '/assets/nutrolix-logo.png',
    vibrate: [250, 100, 250, 100, 250],
    silent: false,
    requireInteraction: true,
    timestamp: Date.now(),
    tag: uniqueTag,
    renotify: true,
    data: {
      orderId,
      status: data.status || raw.status || '',
      url: targetUrl
    }
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientsList => {
        clientsList.forEach(client => {
          try {
            client.postMessage({
              type: 'NUTROLIX_PUSH_RECEIVED',
              data: {
                title,
                body,
                orderId,
                status: data.status || raw.status || '',
                url: targetUrl,
                dedupKey: uniqueTag
              }
            });
          } catch (_) {}
        });
      }).catch(() => {})
    ])
  );
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil((async () => {
    try {
      const kRes = await fetch('/api/notifications/vapid-key', { cache: 'no-store' });
      const kd = kRes.ok ? await kRes.json() : {};
      const vapidPublicKey = kd.publicKey || 'BNKixC3ZCYx27sN2fDJcsDhc1NVZEBQJ_-NkX9Xa1CuHB0xz9tyvCk582_j0bPaCBzn8LUeswFAZigMzzlSj5gY';
      const padding = '='.repeat((4 - vapidPublicKey.length % 4) % 4);
      const base64 = (vapidPublicKey + padding).replace(/-/g, '+').replace(/_/g, '/');
      const rawData = self.atob(base64);
      const keyArray = new Uint8Array(rawData.length);
      for (let i = 0; i < rawData.length; ++i) keyArray[i] = rawData.charCodeAt(i);
      const newSub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyArray
      });
      if (newSub && event.oldSubscription) {
        const subJson = newSub.toJSON();
        const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientsList) {
          client.postMessage({ type: 'NUTROLIX_PUSH_SUBSCRIPTION_CHANGED', subscription: subJson });
        }
      }
    } catch (_) {}
  })());
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const rawUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/orders.html';
  let resolvedUrl = '/orders.html';
  try {
    resolvedUrl = new URL(rawUrl.startsWith('http') ? rawUrl : (rawUrl.startsWith('/') ? rawUrl : '/' + rawUrl), self.location.origin).href;
  } catch (_) {
    resolvedUrl = self.location.origin + '/orders.html';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url && client.url.startsWith(self.location.origin) && 'navigate' in client && 'focus' in client) {
          return client.navigate(resolvedUrl).then(() => client.focus()).catch(() => clients.openWindow(resolvedUrl));
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(resolvedUrl);
      }
    })
  );
});
