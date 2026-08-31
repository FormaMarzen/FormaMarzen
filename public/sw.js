self.addEventListener('push', function (event) {
  if (!event.data) return;

  let title = 'FORMA MARZEŃ';
  let body = '';
  let url = '/';
  let icon = '/icon-192x192.png';
  let badge = '/icon-192x192.png';

  try {
    const data = event.data.json();
    title = data.title || title;
    body = data.body || data.message || '';
    url = data.url || (data.data && data.data.url) || '/';
    icon = data.icon || icon;
    badge = data.badge || badge;
  } catch (err) {
    body = event.data.text();
  }

  const options = {
    body: body,
    icon: icon,
    badge: badge,
    data: { url: url },
    tag: 'forma-marzen-' + Date.now(),
    renotify: true
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
