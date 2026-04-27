/**
 * bootstrap.js — MiRest con IA
 * Punto de entrada del runtime modular.
 *
 * REGLAS IMPORTANTES:
 * - frontend/core/modular-app.js es la fuente oficial del runtime
 * - app.js y ui.js legacy ya no participan del arranque
 * - Este archivo monta la app modular y luego añade capacidades PWA
 */

try {
  console.info('[boot] Iniciando bootstrap modular...');
  const v = typeof window !== "undefined" && window.__MIREST_DEV_BUST__ ? String(window.__MIREST_DEV_BUST__) : "";
  const { hydratePwaFromAuth, showPwaAccessGateIfNeeded } = await import(
    /* webpackIgnore: true */ "./pwa-auth-bootstrap.js" + v
  );
  await hydratePwaFromAuth();
  if (showPwaAccessGateIfNeeded()) {
    document.body.classList.add("page-ready");
    return;
  }

  // ── 1. Arrancar runtime modular (tras hidratar sesión + roles_config) ─
  console.debug("[boot] Importando runtime modular: ./modular-app.js");
  const { initModularApp } = await import("./modular-app.js" + v);
  const { initGlobalAppShell } = await import("./global-app-shell.js" + v);
  console.debug("[boot] Runtime modular importado. Ejecutando initModularApp()");
  initModularApp();
  console.debug("[boot] initModularApp() completado");

  // ── 2. Inicializar storage (IDB en background, no bloquea) ──────
  console.debug('[boot] Inicializando storage en segundo plano');
  import("./storage.js" + v)
    .then(({ initStorage }) => initStorage())
    .then(() => console.debug("[boot] Storage inicializado"))
    .catch((error) => {
      console.warn("[boot] Storage no disponible en este entorno:", error);
    });

  // ── 3. PWA Shell + Wake Lock + Install Banner ───────────────────
  //   pwa.js se auto-inicia al importarse (llama initPWA() al final)
  console.debug("[boot] Importando PWA shell: ./pwa.js");
  await import("./pwa.js" + v);
  console.debug("[boot] PWA shell importado");
  await initGlobalAppShell();
  console.debug("[boot] Navegación del dashboard global (shell) en Pedidos");

  // ── 4. Bridge mobile: FAB ↔ runtime modular ─────────────────────
  console.debug("[boot] Importando bridge mobile: ./mesero-bridge.js");
  import("./mesero-bridge.js" + v);

  // base.css (módulo) exige `body.page-ready` para mostrar el shell; app.js del root la añade, aquí no.
  document.body.classList.add('page-ready');
  console.info('[boot] Bootstrap completado ✓');
} catch (error) {
  console.error('[boot] Error fatal al iniciar la app:', error);
  document.body.innerHTML = `
    <main style="min-height:100vh;display:grid;place-items:center;padding:24px;background:#0f172a;color:#e2e8f0;font-family:Inter,system-ui,sans-serif;">
      <section style="width:min(720px,100%);background:#111827;border:1px solid rgba(148,163,184,.24);border-radius:20px;padding:24px;box-shadow:0 24px 80px rgba(15,23,42,.45)">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#fb923c">Error de arranque</p>
        <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2">La app no pudo inicializarse</h1>
        <p style="margin:0 0 16px;color:#cbd5e1">Se bloqueó el render del runtime. Revisa la consola del navegador para ver el error exacto mientras trabajas con Live Server.</p>
        <pre style="margin:0;white-space:pre-wrap;word-break:break-word;background:#020617;border-radius:14px;padding:16px;color:#f8fafc;overflow:auto">${String(error?.stack || error?.message || error)}</pre>
      </section>
    </main>
  `;
}
