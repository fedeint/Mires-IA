/**
 * Widget móvil para instalar la PWA (Android: beforeinstallprompt; iOS: instrucciones Safari).
 * @see pwa-apis-premium.md — timing, standalone, snooze.
 */
import {
  hasDeferredInstallPrompt,
  initInstallPrompt,
  onInstallPromptAvailable,
  showInstallPrompt,
} from "../Pwa/install.js";

const STORAGE_SNOOZE = "mirest-pwa-install-snooze-until";
const STORAGE_DISMISS = "mirest-pwa-install-dismissed-v1";
const SNOOZE_MS = 30 * 24 * 60 * 60 * 1000;
const IOS_DELAY_MS = 10_000;
const ANDROID_DELAY_MS = 1800;

function isStandalone() {
  const nav = /** @type {Navigator & { standalone?: boolean }} */ (navigator);
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    nav.standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isIosNonSafari() {
  return isIos() && /CriOS|FxiOS|EdgiOS/i.test(navigator.userAgent);
}

function shouldSuppress() {
  if (localStorage.getItem(STORAGE_DISMISS) === "1") return true;
  const until = parseInt(localStorage.getItem(STORAGE_SNOOZE) || "0", 10);
  return until > Date.now();
}

function snooze() {
  localStorage.setItem(STORAGE_SNOOZE, String(Date.now() + SNOOZE_MS));
}

function dismissForever() {
  localStorage.setItem(STORAGE_DISMISS, "1");
}

function resolveIconSrc(rootPath) {
  const raw = (rootPath || ".").trim().replace(/\/+$/, "") || ".";
  if (raw === "." || raw === "./") return "./IA/DalIA.png";
  return `${raw}/IA/DalIA.png`.replace(/\/+/g, "/");
}

function isMobileUi() {
  return window.matchMedia("(max-width: 640px)").matches;
}

export function initPwaInstallWidget({ rootPath = "" } = {}) {
  if (!("serviceWorker" in navigator)) return;
  if (isStandalone()) return;
  if (shouldSuppress()) return;

  initInstallPrompt();

  let root = null;
  let androidTimer = null;
  let iosTimer = null;
  let visible = false;

  const hide = () => {
    if (!root) return;
    root.hidden = true;
    visible = false;
  };

  const tryRevealAndroid = () => {
    if (visible || shouldSuppress() || !isMobileUi() || isIos()) return;
    window.clearTimeout(androidTimer);
    androidTimer = window.setTimeout(() => {
      if (shouldSuppress() || !isMobileUi() || isStandalone()) return;
      if (!hasDeferredInstallPrompt()) return;
      showPanel("android");
    }, ANDROID_DELAY_MS);
  };

  const tryRevealIos = () => {
    if (visible || shouldSuppress() || !isMobileUi() || !isIos() || isStandalone()) return;
    window.clearTimeout(iosTimer);
    iosTimer = window.setTimeout(() => {
      if (shouldSuppress() || !isMobileUi() || isStandalone()) return;
      showPanel("ios");
    }, IOS_DELAY_MS);
  };

  const wireCloseActions = () => {
    if (!root) return;
    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-pwa-snooze]")) {
        snooze();
        hide();
        return;
      }
      if (e.target.closest("[data-pwa-dismiss]")) {
        dismissForever();
        hide();
        return;
      }
      const installEl = e.target.closest("[data-pwa-install]");
      if (installEl) {
        e.preventDefault();
        void showInstallPrompt().then(({ outcome }) => {
          if (outcome === "accepted") dismissForever();
          hide();
        });
      }
    });
  };

  const showPanel = (mode) => {
    if (visible || shouldSuppress() || isStandalone()) return;
    if (!root) {
      const iconSrc = resolveIconSrc(rootPath);
      root = document.createElement("div");
      root.id = "pwa-install-widget";
      root.className = "pwa-install-widget";
      root.setAttribute("role", "region");
      root.setAttribute("aria-label", "Instalar aplicación");
      root.innerHTML = `
        <div class="pwa-install-widget__card card">
          <button type="button" class="icon-button pwa-install-widget__x" data-pwa-snooze aria-label="Cerrar y recordar más tarde">
            <i data-lucide="x"></i>
          </button>
          <div class="pwa-install-widget__head">
            <img class="pwa-install-widget__mascot" src="${iconSrc}" width="40" height="40" alt="" decoding="async" />
            <div>
              <p class="pwa-install-widget__eyebrow">App en tu teléfono</p>
              <h3 class="pwa-install-widget__title">Instala MiRest</h3>
            </div>
          </div>
          <p class="pwa-install-widget__copy" data-pwa-android-copy hidden>
            Acceso rápido desde inicio, modo pantalla completa y mejor rendimiento.
          </p>
          <p class="pwa-install-widget__copy" data-pwa-ios-copy hidden></p>
          <div class="pwa-install-widget__actions">
            <button type="button" class="btn btn--primary pwa-install-widget__install" data-pwa-install hidden>
              <i data-lucide="download"></i>
              Instalar
            </button>
            <button type="button" class="btn btn--secondary pwa-install-widget__later" data-pwa-snooze>
              Ahora no
            </button>
          </div>
          <button type="button" class="pwa-install-widget__never" data-pwa-dismiss>No volver a mostrar</button>
        </div>
      `;
      document.body.appendChild(root);
      wireCloseActions();
    }

    const androidCopy = root.querySelector("[data-pwa-android-copy]");
    const iosCopy = root.querySelector("[data-pwa-ios-copy]");
    const installBtn = root.querySelector("[data-pwa-install]");

    if (mode === "android") {
      androidCopy.hidden = false;
      iosCopy.hidden = true;
      installBtn.hidden = false;
      iosCopy.textContent = "";
    } else {
      androidCopy.hidden = true;
      installBtn.hidden = true;
      iosCopy.hidden = false;
      if (isIosNonSafari()) {
        iosCopy.textContent =
          "Para añadir MiRest al inicio, abre esta página en Safari (Compartir → Añadir a inicio de pantalla).";
      } else {
        iosCopy.textContent =
          "En Safari: toca Compartir y luego «Añadir a inicio de pantalla».";
      }
    }

    root.hidden = false;
    visible = true;
    window.lucide?.createIcons?.();
  };

  onInstallPromptAvailable((dep) => {
    if (dep) tryRevealAndroid();
    else if (visible) hide();
  });

  const mql = window.matchMedia("(max-width: 640px)");
  const onViewport = () => {
    if (!mql.matches) {
      window.clearTimeout(androidTimer);
      window.clearTimeout(iosTimer);
      hide();
      return;
    }
    if (hasDeferredInstallPrompt()) tryRevealAndroid();
    tryRevealIos();
  };

  mql.addEventListener("change", onViewport);
  onViewport();

  window.addEventListener("appinstalled", () => {
    dismissForever();
    hide();
  });
}
