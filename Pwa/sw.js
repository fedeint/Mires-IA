const CACHE_VERSION = "mirest-pwa-v5";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles/tokens.css",
  "/styles/base.css",
  "/styles/layout.css",
  "/styles/components.css",
  "/styles/dashboard.css",
  "/styles/premium-modules.css",
  "/scripts/app.js",
  "/scripts/navigation.js",
  "/Pwa/manifest.webmanifest",
  "/Pedidos/assets/icons/icon-192.svg",
  "/Pedidos/assets/icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  const isDocument = req.mode === "navigate" || req.destination === "document";
  const isStaticAsset = ["script", "style", "worker"].includes(req.destination);
  const shouldUseNetworkFirst = isDocument || isStaticAsset || url.pathname === "/login.html";

  const cacheResponse = (response) => {
    const isCacheable =
      response &&
      response.ok &&
      response.status !== 206 &&
      !req.headers.has("range") &&
      !url.pathname.startsWith("/api/");

    if (!isCacheable) return response;

    const clone = response.clone();
    caches.open(CACHE_VERSION).then((cache) => cache.put(req, clone)).catch(() => null);
    return response;
  };

  if (shouldUseNetworkFirst) {
    event.respondWith(
      fetch(req)
        .then(cacheResponse)
        .catch(() => caches.match(req))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req)
        .then(cacheResponse)
        .catch(() => cached)
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/index.html";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientsArr) => {
        for (const client of clientsArr) {
          if (client.url && "focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
      })
  );
});
