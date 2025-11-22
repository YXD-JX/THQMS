/* global importScripts, firebase */
// Firebase Messaging SW (background notifications)
// This SW is loaded at /firebase-messaging-sw.js

importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

// NOTE: The following config will be overwritten from app via postMessage if desired.
// You may also hardcode a safe default here for dev.
let inited = false;
function ensureInit(cfg) {
  if (inited) return;
  if (!cfg || !cfg.apiKey) {
    // Not initialized until app provides config
    return;
  }
  firebase.initializeApp(cfg);
  // Register background handler once initialized
  try {
    firebase.messaging().onBackgroundMessage((payload) => {
      const title = payload.notification?.title || '通知';
      const options = {
        body: payload.notification?.body,
        icon: payload.notification?.icon || '/favicon.ico',
        data: payload.data || {},
      };
      self.registration.showNotification(title, options);
    });
  } catch (e) {
    // ignore
  }
  inited = true;
}

// allow app to pass config into SW (optional)
self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'INIT_FIREBASE' && data.config) {
    ensureInit(data.config);
  console.log('[SW] Firebase initialized');
  }
});

// Background handler will be attached inside ensureInit()

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification?.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const had = clientsArr.find((c) => c.url.includes(url));
      if (had && 'focus' in had) return had.focus();
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
