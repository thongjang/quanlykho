// Self-destroying Service Worker.
// App đã chuyển sang "bắt buộc dùng khi có mạng" — không còn cache offline.
// File này chỉ để DỌN các bản PWA cũ đã cài trên máy người dùng:
// tự huỷ đăng ký, xoá toàn bộ cache, rồi nạp lại tab để lấy bản mới từ mạng.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    try { await self.registration.unregister(); } catch (e) {}
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    } catch (e) {}
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach((c) => c.navigate(c.url));
  })());
});
