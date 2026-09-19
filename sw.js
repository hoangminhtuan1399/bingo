importScripts('config.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Worker gửi push rỗng theo lịch, ở đây lấy kết quả mới nhất rồi hiện noti
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let body = 'Có kết quả mới';
    try {
      const res = await fetch(`${WORKER_URL}/latest`);
      const draw = await res.json();
      if (draw.winningResult) body = String(draw.winningResult);
    } catch (e) {
      console.error(e);
    }
    await self.registration.showNotification('Kết quả mới nhất', { body, icon: 'icon-192.png' });
  })());
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return self.clients.openWindow('./');
    })
  );
});
