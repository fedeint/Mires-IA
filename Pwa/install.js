let deferredPrompt = null;
const deferredListeners = new Set();
let installListenerAttached = false;

function emitDeferred() {
  for (const fn of deferredListeners) {
    try {
      fn(deferredPrompt);
    } catch {
      /* noop */
    }
  }
}

/** Suscripción al evento aplazado (null tras instalar o descartar). */
export function onInstallPromptAvailable(fn) {
  if (typeof fn !== "function") return () => {};
  deferredListeners.add(fn);
  if (deferredPrompt) fn(deferredPrompt);
  return () => deferredListeners.delete(fn);
}

export function initInstallPrompt() {
  if (installListenerAttached) return;
  installListenerAttached = true;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    emitDeferred();
  });
}

export function hasDeferredInstallPrompt() {
  return deferredPrompt != null;
}

export async function showInstallPrompt() {
  if (!deferredPrompt) return { shown: false };
  const promptEvent = deferredPrompt;
  deferredPrompt = null;
  emitDeferred();
  await promptEvent.prompt();
  const choice = await promptEvent.userChoice;
  return { shown: true, outcome: choice?.outcome };
}
