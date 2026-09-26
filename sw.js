importScripts('config.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Trình duyệt bắt buộc mỗi push phải hiện noti (không thì Chrome tự hiện noti "đã cập nhật trong nền"),
// nên kì không hoa thì hiện noti im lặng rồi đóng ngay
async function dismissSilently() {
  await self.registration.showNotification('', { silent: true, tag: 'silent' });
  (await self.registration.getNotifications({ tag: 'silent' })).forEach((n) => n.close());
}

// Worker gửi push rỗng theo lịch, ở đây lấy kết quả mới nhất rồi hiện noti
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let body = 'Có kết quả mới';
    let tag;
    try {
      const res = await fetch(`${WORKER_URL}/latest`);
      const draw = await res.json();
      if (draw.winningResult) {
        if (draw.hoa === null) return dismissSilently();
        body = formatDrawNotification(draw);
        tag = draw.drawAt; // cùng kì thì thay noti cũ, không báo lại
      }
    } catch (e) {
      console.error(e);
    }
    await self.registration.showNotification('Kết quả mới nhất', { body, icon: 'icon-192.png', tag });
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
