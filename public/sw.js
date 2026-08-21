/* Service worker de Chevruta — habilita instalación, uso offline básico y
   notificaciones push reales (a través de Firebase Cloud Messaging). */

importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyA1M3X06uAT6nd3OIMEStdAGZTYTkaQN8c",
  authDomain: "app-encuentro-596c8.firebaseapp.com",
  projectId: "app-encuentro-596c8",
  storageBucket: "app-encuentro-596c8.firebasestorage.app",
  messagingSenderId: "1087083216601",
  appId: "1:1087083216601:web:a3eeb433afe93d150348c8",
});

const messaging = firebase.messaging();

// Notificación push recibida mientras la app está cerrada o en 2do plano
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Chevruta";
  const body = payload.notification?.body || "Tenés novedades";
  self.registration.showNotification(title, {
    body,
    icon: "icons/icon-192.png",
    badge: "icons/icon-192.png",
    data: payload.data || {},
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clientsArr) => {
      const url = "./";
      const existing = clientsArr.find((c) => c.url.includes(self.registration.scope));
      if (existing) return existing.focus();
      return self.clients.openWindow(url);
    })
  );
});

// Cache mínimo del cascarón de la app para que abra aunque no haya señal
const CACHE_NAME = "chevruta-shell-v1";
const SHELL_FILES = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES).catch(() => {})));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  // Firestore/Auth y llamadas a Google nunca se cachean — solo el cascarón estático
  if (event.request.url.includes("firestore") || event.request.url.includes("googleapis")) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
