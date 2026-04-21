let wakeLockHandle = null;

export async function registerServiceWorker(rootPath = "") {
  if (!("serviceWorker" in navigator)) return null;

  const scope = `${rootPath}/`;
  const swUrl = `${rootPath}/sw.js?v=20260426-pwa-v23`.replace(/\\+/g, "/");
  const registrations = await navigator.serviceWorker.getRegistrations();

  await Promise.all(
    registrations.map(async (registration) => {
      const activeScript = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
      if (registration.scope.endsWith(scope) && activeScript && !activeScript.includes("20260426-pwa-v23")) {
        await registration.unregister();
      }
    })
  );

  if ("caches" in self) {
    try {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== "mirest-pwa-v23").map((key) => caches.delete(key))
      );
    } catch {}
  }

  const reg = await navigator.serviceWorker.register(swUrl, {
    scope,
    updateViaCache: "none",
  });
  reg.update().catch(() => null);
  return reg;
}

export async function setBadge(count) {
  if (!("setAppBadge" in navigator)) return;
  if (typeof count !== "number" || count <= 0) {
    await navigator.clearAppBadge();
    return;
  }
  await navigator.setAppBadge(count);
}

export async function requestWakeLock() {
  if (!("wakeLock" in navigator)) return null;
  try {
    wakeLockHandle = await navigator.wakeLock.request("screen");
    return wakeLockHandle;
  } catch {
    wakeLockHandle = null;
    return null;
  }
}

export async function releaseWakeLock() {
  if (!wakeLockHandle) return;
  try {
    await wakeLockHandle.release();
  } finally {
    wakeLockHandle = null;
  }
}

export function enableWakeLockAutoReacquire() {
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && wakeLockHandle == null) {
      await requestWakeLock();
    }
  });
}

export async function share({ title, text, url, files } = {}) {
  if (!navigator.share) return false;
  try {
    const payload = {};
    if (title) payload.title = title;
    if (text) payload.text = text;
    if (url) payload.url = url;
    if (Array.isArray(files) && files.length && navigator.canShare?.({ files })) {
      payload.files = files;
    }
    await navigator.share(payload);
    return true;
  } catch {
    return false;
  }
}

export function vibrate(pattern) {
  if (!navigator.vibrate) return false;
  return navigator.vibrate(pattern);
}

export function startViewTransition(run) {
  if (document.startViewTransition) {
    return document.startViewTransition(run);
  }
  run();
  return null;
}
