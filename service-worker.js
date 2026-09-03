self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('push', event => {
  let data = {};
  try { data = event.data?.json() || {}; } catch { data = { title: 'Calendario', body: event.data?.text() || 'Tienes un aviso' }; }
  event.waitUntil(self.registration.showNotification(data.title || 'Calendario', { body: data.body || '', icon: 'icono-512x512.png', badge: 'image/icono-32x32.png', data: { url: data.url || './' } }));
});
self.addEventListener('notificationclick', event => { event.notification.close(); event.waitUntil(clients.openWindow(event.notification.data?.url || './')); });
