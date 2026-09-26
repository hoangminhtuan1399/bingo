importScripts('config.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

// Trình duyệt bắt buộc mỗi push phải hiện noti (không thì Chrome tự hiện noti "đã cập nhật trong nền"),
// nên kì không hoa thì hiện noti im lặng rồi đóng ngay
async function dismissSilently() {
  await self.registration.showNotification('', { silent: true, tag: 'silent' });
  (await self.registration.getNotifications({ tag: 'silent' })).forEach((n) => n.close());
}

// Worker gửi push rỗng theo lịch, ở đây tự gọi API từ máy người dùng (IP Việt Nam)
// và chỉ hiện noti khi kì mới nhất là hoa
self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let draw = null;
    try {
      draw = await fetchLatestDraw();
    } catch (e) {
      console.error(e);
    }
    if (!draw || draw.hoa === null) return dismissSilently();
    await self.registration.showNotification(`Hoa ${draw.hoa}`, {
      body: formatDrawNotification(draw),
      icon: 'icon-192.png',
      tag: draw.drawAt // cùng kì thì thay noti cũ, không báo lại
    });
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
