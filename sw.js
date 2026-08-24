/**
 * Skyport service worker — receives ISS pass-alert push notifications
 * sent by the SkyPortService backend (AWS Lambda, VAPID Web Push).
 */

self.addEventListener('push', (event) => {
  let data = { title: 'Skyport', body: 'ISS pass alert', url: 'https://skyport.space' };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch (_) {
    // non-JSON payload — use defaults
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/apple-icon.png',
      badge: '/icon-dark-32x32.png',
      tag: 'iss-pass',
      data: { url: data.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) return win.focus();
      }
      return clients.openWindow(url);
    })
  );
});
