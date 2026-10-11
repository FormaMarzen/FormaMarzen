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
    url = data.url || data.payload?.url || (data.data && data.data.url) || '/';
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
  const fullTargetUrl = new URL(targetUrl, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 1. Sprawdź, czy aplikacja jest już otwarta w jakiejkolwiek karcie/oknie PWA
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          // Jeśli jest otwarta: przejdź do wskazanego czatu i wysuń okno na wierzch
          if ('navigate' in client) {
            client.navigate(fullTargetUrl);
          }
          return client.focus();
        }
      }

      // 2. Jeśli aplikacja była całkowicie zamknięta: otwórz nowe okno z docelowym adresem
      if (clients.openWindow) {
        return clients.openWindow(fullTargetUrl);
      }
    })
  );
});
