/**
 * pwa.js — MiRest con IA
 * Gestión completa de la experiencia PWA:
 *   - Detección de entorno (instalada / browser / iOS)
 *   - Shell PWA (bottom-nav, FAB, overrides de layout)
 *   - Screen Wake Lock (pantalla siempre encendida en servicio)
 *   - Install banner (Android beforeinstallprompt)
 *   - iOS install hint (instrucciones manuales)
 *   - Badging API (pedidos pendientes en el ícono)
 *   - Service Worker
 */

// ── Detección de entorno ──────────────────────────────────────────

/** ¿La app está instalada como PWA o se está forzando para pruebas? */
export const isPWA =
  window.matchMedia('(display-mode: standalone)').matches ||
  /** @type {any} */ (navigator).standalone === true ||
  new URLSearchParams(window.location.search).get('forcePwa') === 'true';

/** ¿Es iOS/iPadOS? */
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

/** ¿Es Android? */
export const isAndroid = /android/i.test(navigator.userAgent);

/** ¿Soporta vibración? */
export const canVibrate = 'vibrate' in navigator;

let _pwaInitialized = false;

// ── Activar shell PWA ─────────────────────────────────────────────

/**
 * Aplica la clase pwa-shell al body cuando la app está instalada.
 * Esto activa bottom-nav, FAB, y los overrides de layout mobile.
 */
function activatePWAShell() {
  if (!isPWA) return;
  document.body.classList.add('pwa-shell');
  document.body.classList.add(isIOS ? 'pwa-ios' : 'pwa-android');

  // El selector de modo en topbar se oculta vía CSS (.pwa-shell .topbar__center);
  // no usar estilo inline: evita chocar con media queries y con bottom-nav / chips.

  console.info('[PWA] Shell activada —', isIOS ? 'iOS' : 'Android');
}

// ── Bottom Navigation ─────────────────────────────────────────────

/**
 * Inyecta la bottom navigation (solo en pwa-shell).
 * Se conecta con el mismo sistema de modos que el mode-switcher del topbar.
 */
function injectBottomNav() {
  if (!isPWA) return;
  if (document.getElementById('bottomNav')) return;

  const nav = document.createElement('nav');
  nav.id = 'bottomNav';
  nav.className = 'bottom-nav';
  nav.setAttribute('aria-label', 'Navegación principal');
  nav.innerHTML = `
    <button class="bottom-nav__item is-active" data-set-mode="salon" id="bnSalon">
      <span class="bottom-nav__icon" aria-hidden="true">🍽️</span>
      <span class="bottom-nav__label">Salón</span>
    </button>
    <button class="bottom-nav__item" data-set-mode="delivery" id="bnDelivery">
      <span class="bottom-nav__icon" aria-hidden="true">🛵</span>
      <span class="bottom-nav__label">Delivery</span>
    </button>
    <button class="bottom-nav__item" data-set-mode="takeaway" id="bnTakeaway">
      <span class="bottom-nav__icon" aria-hidden="true">📦</span>
      <span class="bottom-nav__label">Para llevar</span>
    </button>
    <button class="bottom-nav__item" id="bnAlerts" aria-label="Alertas de cocina">
      <span class="bottom-nav__icon" aria-hidden="true">🔔</span>
      <span class="bottom-nav__label">Alertas</span>
      <span class="bottom-nav__badge badge-dot" id="kitchenAlertBadge" hidden>0</span>
    </button>
  `;

  document.body.appendChild(nav);

  // Sincronizar estado activo con el modo actual del body
  function syncBottomNavActive() {
    const mode = document.body.dataset.mode || 'salon';
    const moduleId = document.body.dataset.module || 'pedidos';
    const pedSec = document.body.dataset.pedidosSection || '';
    const opsActive = moduleId === 'pedidos' && pedSec === 'operacion';
    nav.querySelectorAll('.bottom-nav__item[data-set-mode]').forEach(btn => {
      btn.classList.toggle('is-active', opsActive && btn.dataset.setMode === mode);
    });
  }

  // Observer para cuando cambia data-mode/data-module en body
  new MutationObserver(syncBottomNavActive).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-module', 'data-pedidos-section'],
  });

  syncBottomNavActive();
}

// ── PWA Mode Chips (debajo del topbar en mobile) ──────────────────

function injectPWAModeChips() {
  if (!isPWA) return;
  if (document.getElementById('pwaModeChips')) return;

  const existing = document.querySelector('.pwa-mode-chips');
  if (existing) return;

  const chips = document.createElement('div');
  chips.id = 'pwaModeChips';
  chips.className = 'pwa-mode-chips';
  chips.innerHTML = `
    <button class="chip is-active" data-set-mode="salon">🍽️ Salón</button>
    <button class="chip" data-set-mode="delivery">🛵 Delivery</button>
    <button class="chip" data-set-mode="takeaway">📦 Para llevar</button>
  `;

  // Insertar después del topbar
  const topbar = document.querySelector('.topbar');
  if (topbar?.parentNode) {
    topbar.insertAdjacentElement('afterend', chips);
  }

  function syncChips() {
    const mode = document.body.dataset.mode || 'salon';
    const pedSec = document.body.dataset.pedidosSection || '';
    const ops = (document.body.dataset.module || 'pedidos') === 'pedidos' && pedSec === 'operacion';
    chips.querySelectorAll('.chip[data-set-mode]').forEach(c => {
      c.classList.toggle('is-active', ops && c.dataset.setMode === mode);
    });
  }

  new MutationObserver(syncChips).observe(document.body, {
    attributes: true,
    attributeFilter: ['data-mode', 'data-module', 'data-pedidos-section'],
  });

  syncChips();
}

// ── FAB de pedido activo ──────────────────────────────────────────

let _fabEl = null;

function injectOrderFAB() {
  if (!isPWA) return;
  if (document.getElementById('orderFAB')) return;

  const fab = document.createElement('button');
  fab.id = 'orderFAB';
  fab.className = 'pwa-fab';
  fab.setAttribute('aria-label', 'Ver pedido activo');
  fab.hidden = true;
  fab.innerHTML = `
    <span aria-hidden="true">📋</span>
    <span id="orderFABLabel">Ver pedido</span>
  `;

  document.body.appendChild(fab);
  _fabEl = fab;
}

/**
 * Actualizar visibilidad y texto del FAB.
 * Llamar desde la lógica de pedidos cuando hay un pedido activo.
 * @param {{ visible: boolean, label?: string }} opts
 */
export function updateOrderFAB({ visible, label = 'Ver pedido' }) {
  if (!_fabEl) return;
  _fabEl.hidden = !visible;
  const labelEl = _fabEl.querySelector('#orderFABLabel');
  if (labelEl) labelEl.textContent = label;
}

// ── Screen Wake Lock ──────────────────────────────────────────────

let _wakeLock = null;

/**
 * Solicitar Wake Lock (pantalla siempre encendida).
 * CRÍTICO: usado en vista de cocina y tablero de mesas.
 */
export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) {
    console.info('[PWA] WakeLock no soportado en este dispositivo.');
    return;
  }
  try {
    _wakeLock = await navigator.wakeLock.request('screen');
    console.info('[PWA] WakeLock activado ✓');

    // Re-adquirir si la app vuelve al frente (iOS lo libera al hacer background)
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && !_wakeLock) {
        try {
          _wakeLock = await navigator.wakeLock.request('screen');
          console.info('[PWA] WakeLock re-adquirido ✓');
        } catch (err) {
          console.warn('[PWA] WakeLock no se pudo re-adquirir:', err);
        }
      }
    });
  } catch (err) {
    console.warn('[PWA] WakeLock denegado:', err);
  }
}

/** Liberar Wake Lock (cuando el turno termina o el usuario sale). */
export async function releaseWakeLock() {
  if (_wakeLock) {
    await _wakeLock.release();
    _wakeLock = null;
    console.info('[PWA] WakeLock liberado.');
  }
}

// ── Badging API ───────────────────────────────────────────────────

/**
 * Actualizar el badge del ícono de la app.
 * @param {number} count — 0 para limpiar el badge.
 */
export async function updateAppBadge(count) {
  if (!('setAppBadge' in navigator)) return;
  try {
    if (count > 0) {
      await navigator.setAppBadge(count);
    } else {
      await navigator.clearAppBadge();
    }
  } catch (err) {
    console.warn('[PWA] Badge API error:', err);
  }
}

/**
 * Actualizar badge visual en el bottom-nav item de Alertas.
 * @param {number} count
 */
export function updateKitchenAlertBadge(count) {
  const badge = document.getElementById('kitchenAlertBadge');
  if (!badge) return;
  badge.hidden = count === 0;
  badge.textContent = String(count);
  updateAppBadge(count);
}

// ── Web Share ─────────────────────────────────────────────────────

/**
 * Compartir recibo por WhatsApp / email / nativo.
 * @param {{ title: string, text: string, url?: string }} data
 */
export async function shareReceipt(data) {
  if (!navigator.share) {
    // Fallback: copiar al clipboard
    try {
      await navigator.clipboard.writeText(`${data.title}\n${data.text}`);
      console.info('[PWA] Texto copiado al portapapeles (fallback share).');
    } catch {
      console.warn('[PWA] No se pudo compartir ni copiar al portapapeles.');
    }
    return;
  }
  try {
    await navigator.share(data);
  } catch (err) {
    if (err.name !== 'AbortError') {
      console.warn('[PWA] Share cancelado o error:', err);
    }
  }
}

// ── Vibración (Android) ───────────────────────────────────────────

/**
 * Feedback háptico corto (confirmación).
 * Solo disponible en Android.
 */
export function hapticFeedback(pattern = 50) {
  if (canVibrate) navigator.vibrate(pattern);
}

/**
 * Patrón de alerta urgente (ej: nuevo pedido en cocina).
 */
export function hapticAlert() {
  if (canVibrate) navigator.vibrate([100, 50, 100, 50, 300]);
}

// ── Install Banner (Android) ──────────────────────────────────────

const INSTALL_BANNER_ID = 'pwaInstallBanner';
const INSTALL_DISMISSED_KEY = 'mirest_install_dismissed';
let _deferredPrompt = null;
let _firstOrderDone = false;

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  _deferredPrompt = event;

  // No mostrar si el usuario ya lo rechazó antes
  if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;

  // Mostrar después del primer pedido exitoso (llamar [`triggerInstallBanner()`](frontend/core/pwa.js:309) desde el runtime modular)
  console.info('[PWA] Install prompt capturado. Esperando primer pedido...');
});

/** Llamar desde el runtime modular después del primer pedido exitoso. */
export function triggerInstallBanner() {
  if (!_deferredPrompt) return;
  if (localStorage.getItem(INSTALL_DISMISSED_KEY)) return;
  if (isPWA) return;
  renderInstallBanner(_deferredPrompt);
}

/** Marcar que el primer pedido está completo (para trigger del banner). */
export function markFirstOrderComplete() {
  if (_firstOrderDone) return;
  _firstOrderDone = true;
  triggerInstallBanner();
}

function renderInstallBanner(promptEvent) {
  if (document.getElementById(INSTALL_BANNER_ID)) return;

  const banner = document.createElement('section');
  banner.id = INSTALL_BANNER_ID;
  banner.className = 'install-banner';
  banner.setAttribute('role', 'complementary');
  banner.setAttribute('aria-label', 'Instalar aplicación');
  banner.innerHTML = `
    <div>
      <strong>🍽️ Instala MiRest Pedidos</strong>
      <p>Acceso rápido desde tu celular, sin abrir el navegador.</p>
    </div>
    <div class="install-banner__actions">
      <button type="button" class="btn btn--ghost btn--sm" data-install-dismiss>Ahora no</button>
      <button type="button" class="btn btn--primary btn--sm" data-install-confirm>Instalar</button>
    </div>
  `;

  banner.addEventListener('click', async event => {
    const target = /** @type {HTMLElement} */ (event.target);
    if (target.closest('[data-install-dismiss]')) {
      banner.remove();
      localStorage.setItem(INSTALL_DISMISSED_KEY, '1');
      return;
    }
    if (target.closest('[data-install-confirm]')) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice.catch(() => ({ outcome: 'dismissed' }));
      if (outcome === 'accepted') {
        console.info('[PWA] App instalada ✓');
      }
      banner.remove();
      _deferredPrompt = null;
    }
  });

  document.body.appendChild(banner);
}

// ── iOS Install Hint ──────────────────────────────────────────────

const IOS_HINT_KEY = 'mirest_ios_hint_seen';

function showIOSInstallHint() {
  if (!isIOS) return;
  if (isPWA) return;
  if (document.getElementById('iosInstallHint')) return;

  const visits = parseInt(localStorage.getItem('mirest_visits') || '0', 10) + 1;
  localStorage.setItem('mirest_visits', String(visits));

  // Mostrar solo en la 3ra visita
  if (visits < 3) return;
  if (localStorage.getItem(IOS_HINT_KEY)) return;

  const hint = document.createElement('div');
  hint.id = 'iosInstallHint';
  hint.className = 'ios-install-hint';
  hint.setAttribute('role', 'tooltip');
  hint.innerHTML = `
    Toca <strong>Compartir</strong> (⎙) y luego <strong>"Añadir a inicio"</strong><br>
    para usar MiRest como app nativa.
    <button type="button" style="
      display:block;margin:8px auto 0;padding:4px 12px;
      border-radius:999px;background:rgba(255,255,255,0.2);
      border:1px solid rgba(255,255,255,0.3);color:#fff;
      font-size:11px;cursor:pointer;
    " id="iosHintClose">OK, ¡gracias!</button>
  `;

  document.body.appendChild(hint);

  const closeBtn = hint.querySelector('#iosHintClose');
  closeBtn?.addEventListener('click', () => {
    hint.remove();
    localStorage.setItem(IOS_HINT_KEY, '1');
  });

  // Auto-ocultar después de 8 segundos
  setTimeout(() => {
    if (hint.isConnected) hint.remove();
  }, 8000);
}

// ── Service Worker ────────────────────────────────────────────────

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (isLocalhost) {
    navigator.serviceWorker.getRegistrations()
      .then((registrations) => Promise.all(registrations.map((registration) => registration.unregister())))
      .then(() => {
        console.info('[PWA] Service Worker desactivado en localhost para evitar caché obsoleta durante desarrollo.');
      })
      .catch((err) => {
        console.warn('[PWA] No se pudo limpiar Service Workers en localhost:', err);
      });
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('./service-worker.js', { scope: './' })
      .then(reg => {
        console.info('[PWA] Service Worker registrado ✓', reg.scope);
      })
      .catch(err => {
        console.warn('[PWA] Service Worker falló:', err);
      });
  });
}

// ── Init ──────────────────────────────────────────────────────────

/**
 * Punto de entrada principal. Se llama desde bootstrap.js automáticamente.
 */
export function initPWA() {
  if (_pwaInitialized) return;
  _pwaInitialized = true;

  registerServiceWorker();
  activatePWAShell();

  if (isPWA) {
    injectBottomNav();
    injectOrderFAB();
    // Activar wake lock al inicio de la sesión de trabajo
    requestWakeLock();
  } else {
    // Intentar mostrar hint iOS en browser
    showIOSInstallHint();
  }

  console.info('[PWA] Init completo — isPWA:', isPWA, '| isIOS:', isIOS);
}

// Auto-inicializar
initPWA();
