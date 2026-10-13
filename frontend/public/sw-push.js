/* Service Worker Push Notification Handler */

function getCSRFFromIDB() {
  return new Promise((resolve) => {
    try {
      if (!('indexedDB' in self)) return resolve('');
      const req = indexedDB.open('moodila_push_db', 1);
      req.onupgradeneeded = (e) => {
        e.target.result.createObjectStore('config');
      };
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('config')) return resolve('');
        const tx = db.transaction('config', 'readonly');
        const getReq = tx.objectStore('config').get('csrf_token');
        getReq.onsuccess = () => resolve(getReq.result || '');
        getReq.onerror = () => resolve('');
      };
      req.onerror = () => resolve('');
    } catch (_) {
      resolve('');
    }
  });
}

async function handleMarkAsReadPush(notifData) {
  let body = {};
  if (notifData.notification_id) {
    body = { ids: [notifData.notification_id] };
  } else if (notifData.entry_id) {
    body = { entry_ids: [notifData.entry_id] };
  } else {
    body = { ids: [] };
  }

  let csrf = '';
  if ('cookieStore' in self) {
    try {
      const c = await self.cookieStore.get('csrf_token');
      if (c && c.value) csrf = c.value;
    } catch (_) {}
  }
  if (!csrf) {
    csrf = await getCSRFFromIDB();
  }

  try {
    await fetch('/notifications/mark-read', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...(csrf ? { 'X-CSRF-Token': csrf } : {}),
      },
      body: JSON.stringify(body),
    });

    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach((client) => {
      client.postMessage({
        type: 'PUSH_NOTIFICATION_READ',
        payload: notifData,
      });
    });
  } catch (err) {
    console.error('[sw] failed to mark push as read', err);
  }
}

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
      entry_id: data.entry_id || null,
      notification_id: data.notification_id || null,
    },
    actions: [
      { action: 'mark-read', title: 'Прочитать' },
    ],
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

  // If user clicked the "Прочитать" action on the push banner
  if (event.action === 'mark-read') {
    const notifData = (event.notification && event.notification.data) || {};
    event.waitUntil(handleMarkAsReadPush(notifData));
    return;
  }

  // Default notification body click: open / navigate to target URL
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
