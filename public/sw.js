function broadcastShown(id) {
  if (!id) return Promise.resolve();

  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((list) => {
      list.forEach((client) => {
        try {
          client.postMessage({ type: 'bawaslu-push-shown', id: String(id) });
        } catch {
          /* abaikan */
        }
      });
    })
    .catch(() => {});
}

self.addEventListener('push', (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Pengingat jadwal';
  const options = {
    body: payload.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: payload.tag || payload.id || 'bawaslu-reminder',
    renotify: true,
    // Service worker tidak bisa memutar audio, jadi suara hanya bisa dari OS.
    // Ditulis eksplisit supaya tidak pernah ikut diam kalau setelan sistem
    // sebelumnya menyalakan mode senyap untuk notifikasi ini.
    silent: false,
    requireInteraction: false,
    vibrate: [180, 90, 180],
    data: { url: payload.url || '/' },
  };

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      broadcastShown(payload.id),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const target = (event.notification.data && event.notification.data.url) || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
