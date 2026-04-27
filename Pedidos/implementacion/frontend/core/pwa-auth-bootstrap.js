/**
 * Hidrata contexto PWA (usuarios + roles_modulos por tenant) ANTES de importar app-state.
 * Prioridad: `modulos_acceso` (BD) > metadata > `roles_modulos` para el rol.
 * Debe ejecutarse en bootstrap.js con await, antes de initModularApp().
 */

import { markOnboardingCompleted, markOnboardingProSeen } from "./storage.js";

const SHELL_TO_PWA_MODULE = {
  pedidos: "pedidos",
  caja: "caja",
  cocina: "cocina",
  almacen: "almacen",
  recetas: "almacen",
  productos: "menu",
  facturacion: "facturas",
  facturas: "facturas",
  reportes: "ventas",
  ventas: "ventas",
  menu: "menu",
  ia: "configuracion",
  configuracion: "configuracion",
  soporte: "configuracion",
  clientes: "ventas",
  proveedores: "almacen",
  almacen_lectura: "almacen",
  productos_lectura: "menu",
};

const PWA_MODULE_ORDER = [
  "pedidos",
  "caja",
  "cocina",
  "almacen",
  "menu",
  "ventas",
  "facturas",
  "configuracion",
];

function uniqueShellKeys(keys) {
  return [...new Set((keys || []).map((k) => String(k).trim()).filter(Boolean))];
}

/**
 * @param {string[]} shellKeys
 * @returns {string[]}
 */
function shellKeysToPwaModuleIds(shellKeys) {
  const byImportance = (a, b) => {
    const ia = PWA_MODULE_ORDER.indexOf(a);
    const ib = PWA_MODULE_ORDER.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  };
  const out = new Set();
  for (const k of uniqueShellKeys(shellKeys)) {
    if (k === "accesos" || k === "dashboard") {
      continue;
    }
    const pwa = SHELL_TO_PWA_MODULE[k] || (PWA_MODULE_ORDER.includes(k) ? k : null);
    if (pwa) {
      out.add(pwa);
    }
  }
  return [...out].sort(byImportance);
}

/**
 * Alinea con `mapShellRoleToPwaRole` (app-state): mismos nombres internos.
 * @param {string} shellRole
 */
function shellRoleToPwaRole(shellRole) {
  const r = String(shellRole || "").trim();
  const m = {
    superadmin: "dueno",
    admin: "dueno",
    caja: "cajero",
    pedidos: "mesero",
    chef: "cocina",
    almacen: "almacenero",
    marketing: "marketing",
  };
  return m[r] || (r && ["dueno", "mesero", "cocina", "cajero", "almacenero", "marketing"].includes(r) ? r : "mesero");
}

/**
 * Aplica a globalThis flags leídos en app-state (evaluado al importar) y ajusta onboarding local
 * si el perfil indica on boarding ya completado en el servidor.
 */
function applyLocalOnboardingSyncFromServer(user) {
  const done = user?.user_metadata && user.user_metadata.mirest_pwa_onboarding_completado === true;
  globalThis.__MIREST_PWA_ONBOARDING_DONE__ = Boolean(done);
  if (!done) {
    return;
  }
  const name =
    (typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()) ||
    (typeof user.user_metadata?.name === "string" && user.user_metadata.name.trim()) ||
    (typeof user?.email === "string" && user.email.split("@")[0]) ||
    "Equipo";
  const pwaR = globalThis.__MIREST_PWA_RESOLVED_PWA_ROLE__ || "mesero";
  markOnboardingCompleted({ name, role: pwaR, completedAt: Date.now() });
  markOnboardingProSeen();
}

/**
 * Carga roles_modulos (tenant de la sesión) para un rol.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} role clave de rol (shell, ej. admin, caja)
 */
async function fetchRolesConfigRow(supabase, role) {
  let tid = null;
  try {
    const tmod = await import("../../../../scripts/tenant-session.js");
    tid = await tmod.getCurrentTenantId();
  } catch (e) {
    console.warn("[PWA] tenant", e);
  }
  if (!tid) {
    return null;
  }
  const { data, error } = await supabase
    .from("roles_modulos")
    .select("rol, modulos, usa_pwa")
    .eq("tenant_id", tid)
    .eq("rol", role)
    .maybeSingle();
  if (error) {
    console.warn("[PWA] roles_modulos:", error);
    return null;
  }
  return data;
}

/**
 * Limpia flags; llamar al inicio o si no hay sesión.
 */
function clearPwaFlags() {
  delete globalThis.__MIREST_PWA_ALLOWLIST__;
  delete globalThis.__MIREST_PWA_USA_PWA__;
  delete globalThis.__MIREST_PWA_BLOCK__;
  delete globalThis.__MIREST_PWA_ONBOARDING_DONE__;
  delete globalThis.__MIREST_PWA_RESOLVED_PWA_ROLE__;
  delete globalThis.__MIREST_PWA_NO_MODULES__;
}

/**
 * Asegura sesión; si el perfil no usa PWA, muestra pantalla.
 */
export async function hydratePwaFromAuth() {
  clearPwaFlags();
  if (typeof globalThis === "undefined") {
    return;
  }
  let supabase;
  let getCurrentUser;
  try {
    const mod = await import("../../../../scripts/supabase.js");
    supabase = mod.supabase;
    getCurrentUser = mod.getCurrentUser;
  } catch (e) {
    console.warn("[PWA] supabase no disponible, modo solo local", e);
    return;
  }

  const user = await getCurrentUser();
  if (!user) {
    return;
  }

  let ctx;
  try {
    const { loadMirestUserContext } = await import("../../../../scripts/mirest-user-context.js");
    ctx = await loadMirestUserContext(user);
  } catch (e) {
    console.warn("[PWA] mirest-user-context", e);
    ctx = null;
  }

  const appRole = typeof user.app_metadata?.role === "string" ? user.app_metadata.role.trim() : "";
  const userRole = typeof user.user_metadata?.role === "string" ? user.user_metadata.role.trim() : "";
  const metaShell = appRole || userRole || "pedidos";
  const effectiveShellRole = (ctx && ctx.shellRole) ? ctx.shellRole : metaShell;
  if (!ctx && !appRole && userRole && ["superadmin", "admin", "caja", "chef", "pedidos", "almacen", "marketing"].indexOf(effectiveShellRole) === -1) {
    console.warn("[PWA] metadata.role poco frecuente, usando pedidos", effectiveShellRole);
  }

  const pwaR = shellRoleToPwaRole(effectiveShellRole);
  globalThis.__MIREST_PWA_RESOLVED_PWA_ROLE__ = pwaR;
  applyLocalOnboardingSyncFromServer(user);

  const row = await fetchRolesConfigRow(supabase, effectiveShellRole);
  const hasProfile = ctx && ctx.profile != null;
  if (hasProfile && !ctx.usaPwa) {
    globalThis.__MIREST_PWA_USA_PWA__ = false;
    globalThis.__MIREST_PWA_BLOCK__ = "no_pwa";
    return;
  }
  if (!hasProfile && row && row.usa_pwa === false) {
    globalThis.__MIREST_PWA_USA_PWA__ = false;
    globalThis.__MIREST_PWA_BLOCK__ = "no_pwa";
    return;
  }
  globalThis.__MIREST_PWA_USA_PWA__ = true;

  const metaPerms = user.user_metadata?.permissions;
  const fromMeta = Array.isArray(metaPerms) && metaPerms.length > 0 ? uniqueShellKeys(metaPerms) : null;
  const fromDb = ctx && Array.isArray(ctx.permissions) && ctx.permissions.length > 0 ? uniqueShellKeys(ctx.permissions) : null;
  const fromConfig = row && Array.isArray(row.modulos) && row.modulos.length ? uniqueShellKeys(row.modulos) : null;
  const effectiveShell = fromDb || fromMeta || fromConfig;
  if (!effectiveShell) {
    globalThis.__MIREST_PWA_ALLOWLIST__ = null;
    return;
  }
  if (effectiveShell.includes("*")) {
    globalThis.__MIREST_PWA_ALLOWLIST__ = PWA_MODULE_ORDER.slice();
    return;
  }
  const pwa = shellKeysToPwaModuleIds(effectiveShell);
  globalThis.__MIREST_PWA_ALLOWLIST__ = pwa;
  if (pwa.length === 0) {
    globalThis.__MIREST_PWA_NO_MODULES__ = true;
  }
}

/**
 * Muestra overlay si PWA deshabilitada o sin módulos (tras hidratar).
 * @param {() => void} [onContinueLocal] reservado (modo local no implementado)
 * @returns {boolean} true = no cargar el runtime modular
 */
export function showPwaAccessGateIfNeeded(_onContinueLocal) {
  const g = globalThis;
  if (g.__MIREST_PWA_BLOCK__ === "no_pwa" && g.__MIREST_PWA_USA_PWA__ === false) {
    renderPwaBlockCard(
      "PWA no asignada",
      "Tu perfil no utiliza el módulo de operación Pedidos (PWA) en dispositivo. Sigue en el panel web o pide a tu administrador el acceso adecuado.",
      { showHome: true },
    );
    return true;
  }
  if (g.__MIREST_PWA_NO_MODULES__ === true) {
    const list = g.__MIREST_PWA_ALLOWLIST__;
    if (Array.isArray(list) && list.length === 0) {
      renderPwaBlockCard(
        "Sin módulos en PWA",
        "Tu cuenta aún no tiene módulos operativos mapeables para esta app. Pide a tu administrador en Accesos que habilite módulos (incl. Pedidos) para tu rol.",
        { showHome: true },
      );
      return true;
    }
  }
  return false;
}

function renderPwaBlockCard(title, body, { showHome } = {}) {
  const h = document.body;
  h.querySelector?.("[data-pwa-access-gate]")?.remove();
  const wrap = document.createElement("div");
  wrap.setAttribute("data-pwa-access-gate", "1");
  wrap.style.cssText = [
    "position:fixed",
    "inset:0",
    "z-index:200000",
    "background:rgba(15,23,42,0.92)",
    "color:#e2e8f0",
    "display:grid",
    "place-items:center",
    "padding:24px",
  ].join(";");
  const card = document.createElement("div");
  card.style.cssText = [
    "max-width:440px",
    "background:#0f172a",
    "border:1px solid rgba(148,163,184,0.35)",
    "border-radius:20px",
    "padding:28px 24px",
  ].join(";");
  const rootPath = (document.body.getAttribute("data-root-path") || "../../").replace(/\/?$/, "/");
  card.innerHTML = `
    <h2 style="margin:0 0 8px;font-size:1.35rem">${title}</h2>
    <p style="margin:0 0 20px;font-size:14px;line-height:1.5;color:#94a3b8">${body}</p>
    <div style="display:flex;flex-wrap:wrap;gap:10px">
      ${showHome
        ? `<a class="pwa-gate__btn" href="${rootPath}index.html" style="display:inline-flex;align-items:center;justify-content:center;min-height:40px;padding:0 16px;border-radius:12px;background:linear-gradient(135deg,#f07c2a,#d96a1a);color:#fff;font-weight:700;text-decoration:none">Volver al panel</a>`
        : ""}
    </div>
  `;
  wrap.appendChild(card);
  h.appendChild(wrap);
}
