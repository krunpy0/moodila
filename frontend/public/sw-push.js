/* Service Worker Push Notification Handler */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch (err) {
    data = { body: event.data.text() };
  }

  const title = data.title || 'Moodila';
  const options = {
    body: data.body || 'Новое уведомление',
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/pwa-192x192.png',
    tag: data.tag || 'moodila-notification',
    data: {
      url: data.url || '/feed',
    },
    vibrate: [100, 50, 100],
  };

  event.waitUntil(
    self.registration.showNotification(title, options).then(() => {
      return self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
        clients.forEach((client) => {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: data,
          });
        });
      });
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (client.navigate) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
