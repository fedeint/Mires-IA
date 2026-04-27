/**
 * service-worker.js — MiRest con IA
 * Estrategia de caché offline-first para el módulo Pedidos.
 *
 * Estrategias:
 *   - App shell (HTML/CSS/JS): Cache First → siempre disponible offline
 *   - Fuentes (Google Fonts): Cache First con expiración larga
 *   - Imágenes: Stale While Revalidate
 *   - API/datos: Network First con fallback a caché
 */

const CACHE_VERSION   = 'v6-pwa-android-light';
const MAX_SHELL_CACHE_ENTRIES = 90;
const MAX_IMAGE_CACHE_ENTRIES = 60;
const MAX_DATA_CACHE_ENTRIES = 50;
const CACHE_SHELL     = `mirest-shell-${CACHE_VERSION}`;
const CACHE_FONTS     = `mirest-fonts-${CACHE_VERSION}`;
const CACHE_IMAGES    = `mirest-images-${CACHE_VERSION}`;
const CACHE_DATA      = `mirest-data-${CACHE_VERSION}`;

// Recursos del app shell (siempre en caché)
const SHELL_ASSETS = [
  './Pedidos.html',
  './styles.css',
  './frontend/core/operational-ui-config.js',
  './frontend/core/order-entity-factories.js',
  './manifest.json',
  './frontend/styles/tokens.css',
  './frontend/styles/base.css',
  './frontend/styles/components.css',
  './frontend/styles/modules.css',
  './frontend/core/bootstrap.js',
  './frontend/core/app-state.js',
  './frontend/core/modular-app.js',
  './frontend/core/storage.js',
  './frontend/core/pwa.js',
  './frontend/core/ui-helpers.js',
  './frontend/modules/dashboard/home.js',
  './frontend/modules/dashboard/index.js',
  './frontend/modules/pedidos/onboarding.js',
  './frontend/modules/pedidos/salon/index.js',
  './frontend/modules/pedidos/delivery/index.js',
  './frontend/modules/pedidos/takeaway/index.js',
];

// Recursos de fuentes (externos)
const FONT_ORIGINS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

// ── Install: pre-cachear el shell ─────────────────────────────────
self.addEventListener('install', event => {
  console.info('[SW] Instalando v' + CACHE_VERSION);
  event.waitUntil(
    caches.open(CACHE_SHELL)
      .then(cache => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting()) // Activar inmediatamente
      .catch(err => console.warn('[SW] Pre-caché parcial:', err))
  );
});

// ── Activate: limpiar cachés antiguas ─────────────────────────────
self.addEventListener('activate', event => {
  const validCaches = [CACHE_SHELL, CACHE_FONTS, CACHE_IMAGES, CACHE_DATA];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => !validCaches.includes(k))
          .map(k => {
            console.info('[SW] Eliminando caché obsoleta:', k);
            return caches.delete(k);
          })
      ))
      .then(() => self.clients.claim()) // Tomar control sin recargar
  );
});

// ── Fetch: estrategia según tipo de recurso ───────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorar requests no-GET y extensiones de navegador
  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  // ── 1. Fuentes → Cache First (vida larga) ──────────────────────
  if (FONT_ORIGINS.some(o => url.hostname.includes(o))) {
    event.respondWith(cacheFirst(request, CACHE_FONTS));
    return;
  }

  // ── 2. Imágenes locales → Stale While Revalidate ───────────────
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, CACHE_IMAGES));
    return;
  }

  // ── 3. API / datos externos → Network First ─────────────────────
  if (url.pathname.startsWith('/api/') || url.hostname !== location.hostname) {
    event.respondWith(networkFirst(request, CACHE_DATA));
    return;
  }

  // ── 4. App shell y assets → Cache First ─────────────────────────
  event.respondWith(cacheFirst(request, CACHE_SHELL));
});

// ── Background Sync: pedidos en cola offline ──────────────────────
self.addEventListener('sync', event => {
  if (event.tag === 'sync-pedidos') {
    console.info('[SW] Background Sync: sincronizando pedidos...');
    event.waitUntil(syncPendingOrders());
  }
});

async function syncPendingOrders() {
  // Abrir IDB y leer la cola de sync
  let db;
  try {
    db = await openIDB();
  } catch {
    console.warn('[SW] IDB no disponible para sync.');
    return;
  }

  const pending = await getAllFromStore(db, 'pending-sync');
  if (!pending.length) {
    console.info('[SW] No hay pedidos pendientes de sync.');
    return;
  }

  const succeeded = [];
  for (const item of pending) {
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.order),
      });
      if (res.ok) {
        succeeded.push(item.id);
        console.info('[SW] Pedido sincronizado:', item.id);
      }
    } catch {
      console.warn('[SW] Pedido no sincronizado (sin red):', item.id);
    }
  }

  // Eliminar solo los exitosos
  if (succeeded.length) {
    const tx = db.transaction('pending-sync', 'readwrite');
    const store = tx.objectStore('pending-sync');
    for (const id of succeeded) store.delete(id);
    console.info(`[SW] ${succeeded.length} pedido(s) sincronizados y removidos de la cola.`);
  }
}

// ── Push Notifications ────────────────────────────────────────────
self.addEventListener('push', event => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'MiRest Pedidos', body: event.data.text() };
  }

  const options = {
    body:    data.body || 'Tienes una actualización en el sistema.',
    icon:    './assets/icons/icon-192.svg',
    badge:   './assets/icons/icon-192.svg',
    tag:     data.tag || 'mirest-notif',
    renotify: true,
    data:    data,
    actions: data.actions || [],
    vibrate: [200, 100, 200],
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'MiRest con IA', options)
  );
});

// Manejar clic en notificación push
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || './Pedidos.html';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        const existing = clientList.find(c => /Pedidos\.html/i.test(c.url));
        if (existing) {
          existing.focus();
          if (url) existing.navigate(url);
        } else {
          clients.openWindow(url);
        }
      })
  );
});

// ── Share Target Handler ──────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.pathname === '/share-handler' && event.request.method === 'POST') {
    event.respondWith(
      (async () => {
        const formData = await event.request.formData();
        const title = formData.get('title') || '';
        const text  = formData.get('text')  || '';
        const shareUrl = formData.get('url') || '';

        // Redirigir a la app con los datos en query params
        const redirectUrl = new URL('./Pedidos.html', self.registration.scope);
        redirectUrl.searchParams.set('share_title', title);
        redirectUrl.searchParams.set('share_text',  text);
        if (shareUrl) redirectUrl.searchParams.set('share_url', shareUrl);

        return Response.redirect(redirectUrl.href, 303);
      })()
    );
  }
});

// ═══════════════════════════════════════════════════════════════
// HELPERS DE ESTRATEGIAS DE CACHÉ
// ═══════════════════════════════════════════════════════════════

/**
 * Cache First: sirve desde caché, actualiza en background.
 */
async function cacheFirst(request, cacheName) {
  const cache    = await caches.open(cacheName);
  const cached   = await cache.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).then(() => trimCache(cacheName, MAX_SHELL_CACHE_ENTRIES));
    return response;
  } catch {
    return new Response('Offline — recurso no disponible.', { status: 503 });
  }
}

/**
 * Network First: intenta red, cae a caché si falla.
 */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone()).then(() => trimCache(cacheName, MAX_DATA_CACHE_ENTRIES));
    return response;
  } catch {
    const cached = await cache.match(request);
    return cached || new Response(JSON.stringify({ offline: true }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Stale While Revalidate: sirve caché inmediatamente, actualiza en background.
 */
async function staleWhileRevalidate(request, cacheName) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then(response => {
      if (response.ok) cache.put(request, response.clone()).then(() => trimCache(cacheName, MAX_IMAGE_CACHE_ENTRIES));
      return response;
    })
    .catch(() => null);

  return cached || networkPromise;
}

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

// ═══════════════════════════════════════════════════════════════
// HELPERS IDB (para background sync en SW, sin módulos ES)
// ═══════════════════════════════════════════════════════════════

function openIDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('mirest-pedidos-v1', 1);
    req.onsuccess = e => resolve(e.target.result);
    req.onerror   = e => reject(e.target.error);
  });
}

function getAllFromStore(db, storeName) {
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(storeName, 'readonly');
    const req = tx.objectStore(storeName).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror   = () => reject(req.error);
  });
}
