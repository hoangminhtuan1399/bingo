self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Worker chỉ gửi push khi có hoa, kèm sẵn nội dung { title, body, tag }
self.addEventListener('push', (event) => {
  let message = { title: 'Có hoa', body: '' };
  try {
    message = event.data.json();
  } catch (e) {
    console.error(e);
  }
  event.waitUntil(self.registration.showNotification(message.title, {
    body: message.body,
    icon: 'icon-192.png',
    tag: message.tag // cùng kì thì thay noti cũ, không báo lại
  }));
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
