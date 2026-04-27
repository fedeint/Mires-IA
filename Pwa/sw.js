const CACHE_VERSION = "mirest-pwa-v27";
const MAX_RUNTIME_ENTRIES = 80;

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/styles/tokens.css",
  "/styles/base.css",
  "/styles/layout.css",
  "/styles/components.css",
  "/styles/dashboard.css",
  "/styles/premium-modules.css",
  "/styles/mobile.css",
  "/Almacen/almacen-submodules-theme.css",
  "/Almacen/almacen-sublayout.css",
  "/scripts/app.js",
  "/scripts/pwa-install-widget.js",
  "/scripts/navigation.js",
  "/Pwa/pwa.js",
  "/Pwa/install.js",
  "/Pwa/manifest.webmanifest",
  "/Pedidos/implementacion/assets/icons/icon-192.svg",
  "/Pedidos/implementacion/assets/icons/icon-512.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_VERSION)
      .then(async (cache) => {
        for (const url of CORE_ASSETS) {
          try {
            await cache.add(url);
          } catch (e) {
            console.warn("[sw] precache skip", url, e?.message);
          }
        }
      })
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
    caches.open(CACHE_VERSION).then(async (cache) => {
      await cache.put(req, clone);
      await trimCache(cache, MAX_RUNTIME_ENTRIES);
    }).catch(() => null);
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

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

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
