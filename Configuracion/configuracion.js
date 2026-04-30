import { supabase } from "../scripts/supabase.js";
import { loadMirestUserContext } from "../scripts/mirest-user-context.js";
import {
  applyRemoteConfigFragments,
  buildRemotePayload,
  fetchRestaurantAppConfig,
  resolveDefaultRestaurantId,
  saveRestaurantAppConfig,
} from "../scripts/mirest-app-config.js";
import {
  getModuleOnboardingKeys,
  startMirestModuleOnboarding,
} from "../scripts/mirest-module-onboarding-runner.js";
import {
  ALERTA_TIPOS,
  coalesceAlertasByTipo,
  fetchAlertas,
  fetchTenantRow,
  fetchTenantModulos,
  fetchTenantHorarios,
  mapHorariosToShell,
  registrarSolicitudPruebaAlerta,
  saveAlertaConfigForTipo,
  saveTenantPatch,
  syncHorariosFromShell,
  updateTenantModulo,
} from "../scripts/mirest-config-service.js";
import { MIREST_MODULE_ONBOARDING } from "../scripts/mirest-module-onboarding-registry.js";

const DEFAULT_CONFIG = {
  dallIA: {
    nombre: "DallIA",
    trato: "Tú",
    personalidad: "Amigable",
    /** @type {Record<string, boolean>} — `false` = ocultar DallA en el módulo; ausente o `true` = visible. */
    activoPorModulo: {},
    capacidades: {
      chat: true,
      voice: true,
      alerts: true,
      daily: false
    }
  },
  /** Mapa lógica por clave = `alerta_tipo` (relleno al cargar desde `alertas_config` o al guardar). */
  alertas: {
    tipos: /** @type {Record<string, { activo: boolean, canal: string, destinatario: string, umbral_stock: number | null, hora_reporte: string | null }>} */ ({}),
  },
  modulos: {
    pedidosMesas: true,
    cocinaKDS: true,
    paraLlevar: true,
    delivery: false,
    descuentosPromos: true,
    cortesias: true,
    productosCarta: true,
    almacenInventario: true,
    recetasCostos: true,
    clientesFidelidad: false,
    administracionGeneral: true,
    facturacionSUNAT: true,
    sunatIGV: true,
    reportes: true,
    whatsappBusiness: false,
    impresoraTicket: false,
    accesoAudioVoz: false,
    accesoFotosCamara: false,
    pedidosYaRappi: false,
    pagosYapePlin: false,
    usuarios: true,
    configuracion: true,
    soporte: true
  },
  horarios: {
    lunes: { cerrado: false, apertura: "08:00", cierre: "22:00" },
    martes: { cerrado: false, apertura: "08:00", cierre: "22:00" },
    miercoles: { cerrado: false, apertura: "08:00", cierre: "22:00" },
    jueves: { cerrado: false, apertura: "08:00", cierre: "22:00" },
    viernes: { cerrado: false, apertura: "08:00", cierre: "22:00" },
    sabado: { cerrado: true, apertura: "08:00", cierre: "22:00" },
    domingo: { cerrado: true, apertura: "08:00", cierre: "22:00" }
  },
  tour: {
    completado: false,
    /** Desactiva todos los tours automáticos (PWA Pedidos y spotlight por módulo). */
    modulosHabilitado: true,
    /** Puede desactivar módulos puntuales; clave = id del tour (caja, pedidos, clientes, …). */
    activoPorModulo: /** @type {Record<string, boolean>} */ ({}),
    pasos: {
      dashboard: { label: "Dashboard y KPIs", estado: "Pendiente" },
      mesas: { label: "Mesas y Pedidos", estado: "Pendiente" },
      dallia: { label: "Chat con DallIA", estado: "Pendiente" },
      cocina: { label: "Módulo Cocina", estado: "Pendiente" },
      caja: { label: "Módulo Caja", estado: "Pendiente" },
      almacen: { label: "Módulo Almacén", estado: "Pendiente" },
      configuracion: { label: "Configuración del Sistema", estado: "Pendiente" }
    }
  },
  usuarios: [
    {
      id: "usr_superadmin_default",
      nombre: "Super Admin",
      email: "admin@mirest.pe",
      rol: "Super Admin",
      activo: true,
      pin: "0000"
    }
  ],
  restaurante: {
    nombre: "",
    direccion: "",
    ruc: "",
    logo: "",
    moneda: "PEN",
    zonaHoraria: "America/Lima"
  }
};

const LEGACY_TO_TENANT_MOD = {
  pedidosMesas: "pedidos",
  cocinaKDS: "cocina",
  delivery: "delivery",
  almacenInventario: "almacen",
  clientesFidelidad: "clientes",
  facturacionSUNAT: "facturacion",
};

/** Asegura claves nuevas de `tour` en estados guardados antes de la migración. */
function normalizeTourInState(st) {
  if (!st || typeof st !== "object") return;
  if (!st.tour || typeof st.tour !== "object") {
    st.tour = structuredClone(DEFAULT_CONFIG.tour);
    return;
  }
  if (st.tour.modulosHabilitado === undefined) st.tour.modulosHabilitado = true;
  if (st.tour.activoPorModulo == null || typeof st.tour.activoPorModulo !== "object")
    st.tour.activoPorModulo = {};
}

/** Alineado con public.config_modulo_key — controla public.tenants.dalla_activo_por_modulo. */
const DALLA_MODULO_LIST = [
  { key: "pedidos", label: "Pedidos y mesas" },
  { key: "cocina", label: "Cocina (KDS)" },
  { key: "caja", label: "Caja" },
  { key: "almacen", label: "Almacén" },
  { key: "productos", label: "Productos" },
  { key: "recetas", label: "Recetas" },
  { key: "proveedores", label: "Proveedores" },
  { key: "delivery", label: "Delivery" },
  { key: "clientes", label: "Clientes" },
  { key: "facturacion", label: "Facturación" },
  { key: "reportes", label: "Reportes" },
  { key: "dalla", label: "DallA / asistente" },
];

const ALERTA_LABELS = {
  stock_critico: { titulo: "Stock crítico (almacén)", desc: "Aviso cuando un ítem está por agotarse según el umbral." },
  caja_cerrada: { titulo: "Caja sin cierre de turno", desc: "Recordatorio o alerta de operación de caja." },
  pedido_cobrado: { titulo: "Pedido cobrado", desc: "Notificación al liquidar o cobrar un pedido." },
  reporte_diario: { titulo: "Reporte diario automático", desc: "Envía un resumen a la hora programada." },
  stock_agotado: { titulo: "Stock agotado", desc: "Cuando un producto pasa a cero o no disponible." },
};

function tratoToUi(t) {
  if (t === "tuteo") return "Tú";
  if (t === "usted") return "Usted";
  return t || "Tú";
}

function tratoToDb(etiqueta) {
  if (etiqueta === "Tú" || etiqueta === "Tú / informal") return "tuteo";
  return "usted";
}

function personUiToDb(label) {
  const m = {
    Profesional: "formal",
    Amigable: "amigable",
    Directo: "directo",
  };
  return m[label] || "amigable";
}

function personDbToUi(v) {
  const m = { formal: "Profesional", amigable: "Amigable", directo: "Directo" };
  return m[v] || "Amigable";
}

const ConfigStore = {
  STORAGE_KEY: "mirest_config",
  state: null,
  /** @type {string | null} */
  tenantId: null,
  /** @type {string | null} */
  restaurantId: null,
  remoteEnabled: false,

  load() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.state = JSON.parse(stored);
        normalizeTourInState(this.state);
      } else {
        this.state = structuredClone(DEFAULT_CONFIG);
        this.persistLocalOnly();
      }
    } catch (e) {
      console.error("Error parsing config:", e);
      this.state = structuredClone(DEFAULT_CONFIG);
    }
  },

  /** Caché en el navegador (y base para mezclar con Supabase al iniciar). */
  persistLocalOnly() {
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.state));
    } catch (e) {
      console.error("QuotaExceededError o fallo de guardado:", e);
      alert("Error guardando la configuración. Espacio insuficiente en localStorage.");
    }
  },

  /**
   * Tras sesión: aplica `restaurant_settings` (clave mirest_shell_v1) si existe;
   * no pisa `usuarios` (lista local de demostración).
   */
  async hydrateFromServer() {
    this.tenantId = null;
    this.restaurantId = null;
    this.remoteEnabled = false;
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.user) return;
    const ctx = await loadMirestUserContext(session.user);
    const profile = ctx.profile;
    if (!profile?.tenant_id) return;
    this.tenantId = String(profile.tenant_id);
    const rid = await resolveDefaultRestaurantId(
      supabase,
      this.tenantId,
      profile.restaurant_id
    );
    if (!rid) {
      console.warn("[config] Sin restaurante asignado: solo caché local");
      return;
    }
    this.restaurantId = rid;
    this.remoteEnabled = true;
    const remote = await fetchRestaurantAppConfig(supabase, rid);
    if (remote) {
      applyRemoteConfigFragments(DEFAULT_CONFIG, this.state, remote);
      normalizeTourInState(this.state);
      this.persistLocalOnly();
    }
  },

  /** Guarda caché local y, si hay local + sesión, sube a Supabase. */
  persist() {
    this.persistLocalOnly();
    this.syncToRemote();
  },

  syncToRemote() {
    if (!this.remoteEnabled || !this.restaurantId || !this.tenantId) return;
    const payload = buildRemotePayload(this.state);
    saveRestaurantAppConfig(
      supabase,
      this.tenantId,
      this.restaurantId,
      payload
    )
      .then(({ error }) => {
        if (error) console.error("[config] No se pudo guardar en la nube:", error);
      })
      .catch((e) => console.error("[config] red:", e));
  }
};

const ConfigUI = {
  role: "demo",
  sectionAccess: {},
  sectionMap: {
    dallia: "cfg-sect-dallia",
    alertas: "cfg-sect-alertas",
    modulos: "cfg-sect-modulos",
    horarios: "cfg-sect-horarios",
    tour: "cfg-sect-tour",
    usuarios: "cfg-sect-usuarios",
    restaurante: "cfg-sect-restaurante",
  },

  resolveSectionAccess(role) {
    if (role === "superadmin") {
      return {
        "cfg-sect-dallia": "edit",
        "cfg-sect-alertas": "edit",
        "cfg-sect-modulos": "edit",
        "cfg-sect-horarios": "edit",
        "cfg-sect-tour": "edit",
        "cfg-sect-usuarios": "edit",
        "cfg-sect-restaurante": "edit",
      };
    }
    if (role === "admin") {
      return {
        "cfg-sect-dallia": "none",
        "cfg-sect-alertas": "edit",
        "cfg-sect-modulos": "edit",
        "cfg-sect-horarios": "read",
        "cfg-sect-tour": "edit",
        "cfg-sect-usuarios": "edit",
        "cfg-sect-restaurante": "read",
      };
    }
    return {
      "cfg-sect-dallia": "none",
      "cfg-sect-alertas": "none",
      "cfg-sect-modulos": "none",
      "cfg-sect-horarios": "none",
      "cfg-sect-tour": "none",
      "cfg-sect-usuarios": "none",
      "cfg-sect-restaurante": "none",
    };
  },

  modeForSection(sectionId) {
    return this.sectionAccess[sectionId] || "none";
  },

  sectionGuard(sectionId) {
    const mode = this.modeForSection(sectionId);
    if (mode === "edit") return true;
    this.cfgToast(
      mode === "read"
        ? "Sección en modo lectura para tu rol."
        : "No tienes permiso para esta sección."
    );
    return false;
  },

  applySectionMode(sectionId) {
    const sec = document.getElementById(sectionId);
    if (!sec) return;
    const mode = this.modeForSection(sectionId);
    sec.dataset.cfgMode = mode;
    sec.querySelectorAll(".cfg-role-hint").forEach((n) => n.remove());
    if (mode === "none") {
      sec.classList.remove("active");
      sec.hidden = true;
      return;
    }
    sec.hidden = false;
    if (mode === "read") {
      const hint = document.createElement("div");
      hint.className = "cfg-role-hint";
      hint.style.cssText =
        "margin:0 0 10px 0;padding:8px 10px;border-radius:10px;border:1px solid var(--color-border);background:var(--color-surface-muted);font-size:12px;color:var(--color-text-muted);font-weight:600;";
      hint.textContent = "Modo lectura para tu rol";
      sec.prepend(hint);
    }
    const lock = mode === "read";
    sec.querySelectorAll("input, select, textarea, button").forEach((el) => {
      const id = el.id || "";
      if (id === "btnModuleOnbList") return;
      if (id === "btnModuleOnbConfig" && mode !== "none") return;
      const shouldLock =
        lock &&
        (id.startsWith("btn") ||
          id.startsWith("cfg-alt-prueba-") ||
          el.matches("input,select,textarea"));
      if (shouldLock) {
        el.setAttribute("disabled", "true");
        el.setAttribute("aria-disabled", "true");
        if (id.startsWith("btn")) {
          el.style.opacity = "0.55";
          el.style.pointerEvents = "none";
        }
      } else {
        el.removeAttribute("disabled");
        el.removeAttribute("aria-disabled");
        if (id.startsWith("btn")) {
          el.style.opacity = "";
          el.style.pointerEvents = "";
        }
      }
    });
  },

  applyRoleAccess() {
    const role =
      (window.currentUserRole && String(window.currentUserRole).toLowerCase()) ||
      document.body.dataset.userRole ||
      "demo";
    this.role = role;
    this.sectionAccess = this.resolveSectionAccess(role);
    const navItems = document.querySelectorAll(".cfg-nav-item");
    navItems.forEach((btn) => {
      const target = btn.dataset.target;
      const secId = this.sectionMap[target];
      btn.style.display = this.modeForSection(secId) === "none" ? "none" : "";
    });
    Object.values(this.sectionMap).forEach((sectionId) =>
      this.applySectionMode(sectionId)
    );
    const active = document.querySelector(".cfg-nav-item.active");
    if (!active || active.style.display === "none") {
      const firstVisible = Array.from(document.querySelectorAll(".cfg-nav-item")).find(
        (n) => n.style.display !== "none"
      );
      if (firstVisible) {
        navItems.forEach((n) => n.classList.remove("active"));
        firstVisible.classList.add("active");
        const tgt = firstVisible.dataset.target;
        document.querySelectorAll(".cfg-section").forEach((s) => s.classList.remove("active"));
        document.getElementById(`cfg-sect-${tgt}`)?.classList.add("active");
      }
    }
  },
  updatePersistStatus() {
    const el = document.getElementById("cfg-persist-status");
    if (!el) return;
    if (ConfigStore.remoteEnabled) {
      el.textContent =
        "DallIA, alertas, módulos, horarios, tour e info del local se guardan en la base (mismo caché en este navegador). Varios dispositivos con la misma sesión de local comparten ajustes.";
      el.style.color = "var(--color-text, #18181b)";
    } else {
      el.textContent =
        "Inicia sesión y deja asignado un local al usuario para que esta configuración se guarde en la nube; mientras, solo se guarda en este navegador.";
    }
  },

  async init() {
    ConfigStore.load();
    await ConfigStore.hydrateFromServer();
    await this.loadTenantMaster();
    this.updatePersistStatus();
    this.hydrate();
    this.setupNavigation();
    this.setupDallIAHandlers();
    this.setupAlertsHandlers();
    this.setupModulesHandlers();
    this.setupHorariosHandlers();
    this.setupTourHandlers();
    this.setupUsuariosHandlers();
    this.setupRestauranteHandlers();
    this.setupModuleOnboarding();
    this.applyRoleAccess();
  },

  /**
   * Fuentes de verdad: public.tenants (DallA + ficha) y tenant_* recién migrados.
   * Sobreescribe el caché local / restaurant_settings con datos de tenants cuando existen.
   */
  async loadTenantMaster() {
    const { tenant } = await fetchTenantRow();
    if (!tenant) return;
    const t = /** @type {Record<string, unknown>} */ (tenant);
    if (t.dalla_nombre != null && String(t.dalla_nombre).trim() !== "")
      ConfigStore.state.dallIA.nombre = String(t.dalla_nombre);
    if (t.dalla_tono) ConfigStore.state.dallIA.trato = tratoToUi(/** @type {string} */(t.dalla_tono));
    if (t.dalla_personalidad) {
      ConfigStore.state.dallIA.personalidad = personDbToUi(
        String(t.dalla_personalidad)
      );
    }
    if (t.name != null && String(t.name).trim() !== "")
      ConfigStore.state.restaurante.nombre = String(t.name);
    if (t.direccion != null) ConfigStore.state.restaurante.direccion = String(t.direccion || "");
    if (t.ruc != null) ConfigStore.state.restaurante.ruc = String(t.ruc || "");
    if (t.moneda != null) ConfigStore.state.restaurante.moneda = String(t.moneda || "PEN");
    if (t.zona_horaria != null) ConfigStore.state.restaurante.zonaHoraria = String(t.zona_horaria);
    if (t.logo_url != null) ConfigStore.state.restaurante.logo = String(t.logo_url);

    if (t.dalla_activo_por_modulo && typeof t.dalla_activo_por_modulo === "object") {
      ConfigStore.state.dallIA.activoPorModulo = {
        ...ConfigStore.state.dallIA.activoPorModulo,
        .../** @type {Record<string, boolean>} */ (t.dalla_activo_por_modulo),
      };
    }

    const rowsA = await fetchAlertas();
    ConfigStore.state.alertas = {
      tipos: coalesceAlertasByTipo(rowsA),
    };

    const rowsH = await fetchTenantHorarios();
    if (rowsH.length > 0) {
      ConfigStore.state.horarios = mapHorariosToShell(rowsH);
    }
    const rowsM = await fetchTenantModulos();
    if (rowsM.length > 0) {
      const byM = new Map(rowsM.map((r) => [r.modulo, r]));
      for (const [legacy, key] of Object.entries(LEGACY_TO_TENANT_MOD)) {
        const r = byM.get(key);
        if (r) ConfigStore.state.modulos[legacy] = !!r.activo;
      }
    }
    ConfigStore.persistLocalOnly();
  },

  cfgToast(msg) {
    const t = document.createElement("div");
    t.setAttribute("role", "status");
    t.className = "puff-in-center";
    t.style.cssText =
      "position:fixed;bottom:24px;right:24px;z-index:5000;max-width:min(360px,92vw);padding:12px 16px;border-radius:12px;background:var(--color-surface);border:1px solid var(--color-border);box-shadow:var(--shadow-elevated);font-size:14px;";
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 4000);
  },

  /** Botón DallA por módulo (public.tenants.dalla_activo_por_modulo). */
  renderDallAVisibilidadModulos() {
    const cont = document.getElementById("cfg-dallia-modvis-list");
    if (!cont) return;
    const m = ConfigStore.state.dallIA.activoPorModulo || {};
    cont.innerHTML = DALLA_MODULO_LIST.map(({ key, label }) => {
      const on = m[key] !== false;
      return `<div class="cfg-row" style="align-items:center; justify-content:space-between;">
        <div class="cfg-row-label" style="font-weight:600;">${label}</div>
        <input type="checkbox" class="cfg-toggle" data-cfg-dalla-mod="${key}" id="cfg-dallamod-${key}" ${
        on ? "checked" : ""
      } title="Mostrar el acceso a DallA en este módulo">
      </div>`;
    }).join("");
    if (window.lucide) window.lucide.createIcons();
  },

  renderSeccionAlertasSupabase() {
    const root = document.getElementById("cfg-alertas-tipo-root");
    if (!root) return;
    const tipos = ConfigStore.state.alertas?.tipos || {};
    const html = ALERTA_TIPOS.map((tipo) => {
      const lab = ALERTA_LABELS[tipo] || { titulo: tipo, desc: "" };
      const row = tipos[tipo] || {
        activo: false,
        canal: "email",
        destinatario: "",
        umbral_stock: null,
        hora_reporte: null,
      };
      const hora = row.hora_reporte && String(row.hora_reporte).slice(0, 5);
      const umNum =
        row.umbral_stock != null && !Number.isNaN(Number(row.umbral_stock)) ? String(row.umbral_stock) : "";
      const extraStock =
        tipo === "stock_critico"
          ? `<div class="cfg-time-col" style="min-width:120px;">
          <label>Umbral (unid. o % según lógica en almacén)</label>
          <input type="number" class="cfg-input" min="0" step="1" id="cfg-alt-umbral-${tipo}" value="${umNum}" placeholder="Ej. 5" style="max-width:100px;">
        </div>`
          : "";
      const extraHora =
        tipo === "reporte_diario"
          ? `<div class="cfg-time-col">
          <label>Hora del reporte</label>
          <input type="time" class="cfg-input" id="cfg-alt-hora-${tipo}" value="${hora || ""}">
        </div>`
          : "";
      return `<div class="cfg-card" data-cfg-alerta-tipo="${tipo}" style="margin-bottom:12px;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px; flex-wrap:wrap;">
          <div>
            <h3 class="cfg-card-title">${lab.titulo}</h3>
            <p class="cfg-card-description" style="margin:0 0 8px 0;">${lab.desc}</p>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:12px; color:var(--color-text-muted);">Enviar alerta</span>
            <input type="checkbox" class="cfg-toggle" id="cfg-alt-activo-${tipo}" ${
        row.activo ? "checked" : ""
      }>
          </div>
        </div>
        <div class="cfg-time-inputs" style="flex-wrap:wrap; align-items:flex-end; gap:12px; margin-top:12px;">
          <div class="cfg-time-col" style="min-width:120px;">
            <label>Canal</label>
            <select class="cfg-input" id="cfg-alt-canal-${tipo}" style="min-width:120px;">
              <option value="email" ${row.canal === "email" ? "selected" : ""}>Email</option>
              <option value="whatsapp" ${row.canal === "whatsapp" ? "selected" : ""}>WhatsApp</option>
              <option value="push" ${row.canal === "push" ? "selected" : ""}>Push</option>
            </select>
          </div>
          <div class="cfg-time-col" style="flex:1; min-width:180px;">
            <label>Destinatario</label>
            <input type="text" class="cfg-input" id="cfg-alt-dest-${tipo}" value="" placeholder="Correo o +51…">
          </div>
          ${extraStock}
          ${extraHora}
          <div class="cfg-time-col" style="min-width:120px;">
            <label>&nbsp;</label>
            <button type="button" class="cfg-btn-save" id="cfg-alt-prueba-${tipo}" style="background:var(--color-surface); color:var(--color-text); border:1px solid var(--color-border); box-shadow:none; font-size:12px; padding:8px 12px; white-space:nowrap;">Enviar prueba</button>
          </div>
        </div>
      </div>`;
    }).join("");
    root.innerHTML = html;
    for (const tipo of ALERTA_TIPOS) {
      const d = document.getElementById(`cfg-alt-dest-${tipo}`);
      if (d) d.value = tipos[tipo]?.destinatario || "";
    }
    for (const tipo of ALERTA_TIPOS) {
      const b = document.getElementById(`cfg-alt-prueba-${tipo}`);
      if (!b) continue;
      b.addEventListener("click", async () => {
        const canal = document.getElementById(`cfg-alt-canal-${tipo}`)?.value || "email";
        const dest = document.getElementById(`cfg-alt-dest-${tipo}`)?.value?.trim() || "";
        try {
          await registrarSolicitudPruebaAlerta(tipo, canal, dest);
          this.cfgToast("Prueba registrada en auditoría. El envío en vivo aún conecta al servicio de notificaciones.");
        } catch (e) {
          console.error(e);
          this.cfgToast("No se pudo registrar la prueba. Revisa la consola o permisos.");
        }
        if (window.lucide) window.lucide.createIcons();
      });
    }
    if (window.lucide) window.lucide.createIcons();
    this.applySectionMode("cfg-sect-alertas");
  },

  setupModuleOnboarding() {
    document.getElementById("btnModuleOnbConfig")?.addEventListener("click", () => {
      startMirestModuleOnboarding("configuracion", { force: true });
    });
    document.getElementById("btnModuleOnbList")?.addEventListener("click", () => {
      console.log("[Mirest] Módulos de onboarding:", getModuleOnboardingKeys().join(", "));
    });
    if (window.lucide) window.lucide.createIcons();
  },

  updateTopbarName(name) {
    const el = document.getElementById("cfgTopbarAssitantName");
    if (el) el.textContent = name || "DallIA";
  },

  updateTopbarRestaurante(name) {
    const el = document.getElementById("pageSubtitle");
    if (el && name) {
      el.textContent = name;
    }
  },

  setupNavigation() {
    const navItems = document.querySelectorAll(".cfg-nav-item");
    navItems.forEach(btn => {
      btn.addEventListener("click", () => {
        if (btn.style.display === "none") return;
        navItems.forEach(n => n.classList.remove("active"));
        btn.classList.add("active");

        const target = btn.dataset.target;
        document.querySelectorAll(".cfg-section").forEach(s => s.classList.remove("active"));
        const sec = document.getElementById(`cfg-sect-${target}`);
        if (sec && this.modeForSection(sec.id) !== "none") sec.classList.add("active");
      });
    });
  },

  hydrate() {
    const st = ConfigStore.state;
    normalizeTourInState(st);
    // DallIA
    document.getElementById("cfg-ia-name").value = st.dallIA.nombre;
    this.updateTopbarName(st.dallIA.nombre);

    document.querySelectorAll("#cfg-ia-trato .cfg-segmented-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.val === st.dallIA.trato);
    });
    document.querySelectorAll("#cfg-ia-person .cfg-segmented-btn").forEach(b => {
      b.classList.toggle("active", b.dataset.val === st.dallIA.personalidad);
    });

    document.getElementById("cfg-ia-cap-chat").checked = st.dallIA.capacidades.chat;
    document.getElementById("cfg-ia-cap-voice").checked = st.dallIA.capacidades.voice;
    document.getElementById("cfg-ia-cap-alerts").checked = st.dallIA.capacidades.alerts;
    document.getElementById("cfg-ia-cap-daily").checked = st.dallIA.capacidades.daily;

    this.renderDallAVisibilidadModulos();

    this.renderSeccionAlertasSupabase();

    // Módulos
    document.querySelectorAll(".cfg-mod-toggle").forEach(cb => {
      cb.checked = !!st.modulos[cb.dataset.mod];
    });

    // Restaurante
    document.getElementById("cfg-rest-nombre").value = st.restaurante.nombre;
    document.getElementById("cfg-rest-dir").value = st.restaurante.direccion;
    document.getElementById("cfg-rest-ruc").value = st.restaurante.ruc;
    this.updateTopbarRestaurante(st.restaurante.nombre);

    // Render dynamically sections
    this.renderHorarios();
    this.renderTour();
    this.renderToursInteractivosModulos();
    this.renderUsuarios();
    this.applySectionMode("cfg-sect-dallia");
    this.applySectionMode("cfg-sect-restaurante");
  },

  // ── DALL IA HANDLERS
  setupDallIAHandlers() {
    // Segmented selection
    const attachSeg = (id) => {
      document.querySelectorAll(`#${id} .cfg-segmented-btn`).forEach(btn => {
        btn.addEventListener("click", (e) => {
          document.querySelectorAll(`#${id} .cfg-segmented-btn`).forEach(b => b.classList.remove("active"));
          e.target.classList.add("active");
        });
      });
    };
    attachSeg("cfg-ia-trato");
    attachSeg("cfg-ia-person");

    document.getElementById("btnSaveDallia").addEventListener("click", async () => {
      if (!this.sectionGuard("cfg-sect-dallia")) return;
      const name = document.getElementById("cfg-ia-name").value.trim();
      if (!name) {
        document.getElementById("err-ia-name").style.display = "block";
        return;
      }
      document.getElementById("err-ia-name").style.display = "none";

      const tratoUi = document.querySelector("#cfg-ia-trato .active")?.dataset.val || "Tú";
      const persoUi = document.querySelector("#cfg-ia-person .active")?.dataset.val || "Amigable";
      ConfigStore.state.dallIA.nombre = name;
      ConfigStore.state.dallIA.trato = tratoUi;
      ConfigStore.state.dallIA.personalidad = persoUi;
      ConfigStore.state.dallIA.capacidades.chat = document.getElementById("cfg-ia-cap-chat").checked;
      ConfigStore.state.dallIA.capacidades.voice = document.getElementById("cfg-ia-cap-voice").checked;
      ConfigStore.state.dallIA.capacidades.alerts = document.getElementById("cfg-ia-cap-alerts").checked;
      ConfigStore.state.dallIA.capacidades.daily = document.getElementById("cfg-ia-cap-daily").checked;
      const modMap = {};
      for (const { key } of DALLA_MODULO_LIST) {
        const el = document.querySelector(`[data-cfg-dalla-mod="${key}"]`);
        modMap[key] = !!(el && el instanceof HTMLInputElement && el.checked);
      }
      ConfigStore.state.dallIA.activoPorModulo = { ...modMap };
      try {
        await saveTenantPatch({
          dalla_nombre: name,
          dalla_tono: tratoToDb(tratoUi),
          dalla_personalidad: personUiToDb(persoUi),
          dalla_activo_por_modulo: modMap,
        });
        this.cfgToast("DallA guardada en el tenant (Supabase).");
      } catch (e) {
        console.error(e);
        this.cfgToast("No se pudo guardar en el servidor; solo caché local.");
      }
      ConfigStore.persist();
      this.updateTopbarName(name);

      const btn = document.getElementById("btnSaveDallia");
      const html = btn.innerHTML;
      btn.innerHTML = `<i data-lucide="check"></i> Guardado`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = html;
      }, 1500);
    });
  },

  // ── ALERTAS (alertas_config en Supabase)
  setupAlertsHandlers() {
    const btn = document.getElementById("btnSaveAlertas");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      if (!this.sectionGuard("cfg-sect-alertas")) return;
      const errs = [];
      for (const tipo of ALERTA_TIPOS) {
        const activo = !!document.getElementById(`cfg-alt-activo-${tipo}`)?.checked;
        const canal = document.getElementById(`cfg-alt-canal-${tipo}`)?.value || "email";
        const destinatario =
          document.getElementById(`cfg-alt-dest-${tipo}`)?.value?.trim() || "";
        const umbralEl = document.getElementById(`cfg-alt-umbral-${tipo}`);
        const horaEl = document.getElementById(`cfg-alt-hora-${tipo}`);
        const umbral_stock =
          umbralEl && umbralEl.value !== "" ? umbralEl.value : null;
        const hora_reporte =
          horaEl && horaEl.value ? horaEl.value : null;
        try {
          await saveAlertaConfigForTipo(tipo, {
            activo,
            canal,
            destinatario,
            umbral_stock,
            hora_reporte,
          });
        } catch (e) {
          console.error(e);
          errs.push(tipo);
        }
      }
      const nrows = await fetchAlertas();
      ConfigStore.state.alertas = { tipos: coalesceAlertasByTipo(nrows) };
      this.renderSeccionAlertasSupabase();
      this.cfgToast(
        errs.length
          ? `No se guardaron: ${errs.join(", ")}. Revisa caja, permisos o datos.`
          : "Todas las reglas de alerta se guardaron en la base (alertas_config)."
      );
      ConfigStore.persist();
      btn.innerHTML = `<i data-lucide="check"></i> Guardado`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = `<i data-lucide="save"></i> Guardar todo`;
      }, 1500);
    });
  },

  // ── Modulos
  setupModulesHandlers() {
    document.getElementById("btnSaveModulos").addEventListener("click", async () => {
      if (!this.sectionGuard("cfg-sect-modulos")) return;
      const btn = document.getElementById("btnSaveModulos");
      document.querySelectorAll(".cfg-mod-toggle").forEach((cb) => {
        if (cb instanceof HTMLInputElement) {
          ConfigStore.state.modulos[cb.dataset.mod] = cb.checked;
        }
      });
      const err = [];
      for (const [legacy, tmod] of Object.entries(LEGACY_TO_TENANT_MOD)) {
        const on = !!ConfigStore.state.modulos[legacy];
        try {
          await updateTenantModulo(tmod, { activo: on, visible_en_menu: on });
        } catch (e) {
          err.push(legacy);
          console.warn(e);
        }
      }
      this.cfgToast(
        err.length
          ? "Algunos módulos no se actualizaron (¿caja abierta o permisos?). Caché guardada."
          : "Módulos del sistema actualizados en Supabase (tenant_modulos)."
      );
      ConfigStore.persist();
      btn.innerHTML = `<i data-lucide="check"></i> Guardado`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = `<i data-lucide="save"></i> Guardar`;
      }, 1500);
    });
  },

  // ── Horarios
  renderHorarios() {
    const list = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
    const container = document.getElementById("horarios-container");
    container.innerHTML = "";

    list.forEach(day => {
      const dData = ConfigStore.state.horarios[day];
      const row = document.createElement("div");
      row.className = "cfg-horario-row";
      row.innerHTML = `
        <div class="cfg-horario-day">${day}</div>
        <div>
          <label style="display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--color-text-muted);">
            Cerrado <input type="checkbox" class="cfg-toggle" id="cfg-hr-t-${day}" style="transform:scale(0.8);" ${dData.cerrado ? 'checked' : ''}>
          </label>
        </div>
        <div class="cfg-time-col" style="${dData.cerrado ? 'opacity:0.3;pointer-events:none;' : ''}" id="hr-grp-apertura-${day}">
          <label>Apertura</label>
          <input type="time" class="cfg-input" id="cfg-hr-ap-${day}" value="${dData.apertura}">
        </div>
        <div class="cfg-time-col" style="${dData.cerrado ? 'opacity:0.3;pointer-events:none;' : ''}" id="hr-grp-cierre-${day}">
          <label>Cierre</label>
          <input type="time" class="cfg-input" id="cfg-hr-cl-${day}" value="${dData.cierre}">
        </div>
      `;
      container.appendChild(row);

      row.querySelector(`#cfg-hr-t-${day}`).addEventListener("change", (e) => {
        const checked = e.target.checked;
        document.getElementById(`hr-grp-apertura-${day}`).style.opacity = checked ? "0.3" : "1";
        document.getElementById(`hr-grp-apertura-${day}`).style.pointerEvents = checked ? "none" : "auto";
        document.getElementById(`hr-grp-cierre-${day}`).style.opacity = checked ? "0.3" : "1";
        document.getElementById(`hr-grp-cierre-${day}`).style.pointerEvents = checked ? "none" : "auto";
      });
    });
    this.applySectionMode("cfg-sect-horarios");
  },

  setupHorariosHandlers() {
    document.getElementById("btnSaveHorarios").addEventListener("click", async () => {
      if (!this.sectionGuard("cfg-sect-horarios")) return;
      const list = ["lunes", "martes", "miercoles", "jueves", "viernes", "sabado", "domingo"];
      list.forEach((day) => {
        const c = document.getElementById(`cfg-hr-t-${day}`)?.checked;
        const ap = document.getElementById(`cfg-hr-ap-${day}`)?.value;
        const cl = document.getElementById(`cfg-hr-cl-${day}`)?.value;
        if (ConfigStore.state.horarios[day]) {
          ConfigStore.state.horarios[day].cerrado = !!c;
          ConfigStore.state.horarios[day].apertura = ap || "08:00";
          ConfigStore.state.horarios[day].cierre = cl || "22:00";
        }
      });
      const btn = document.getElementById("btnSaveHorarios");
      try {
        await syncHorariosFromShell(ConfigStore.state.horarios);
        this.cfgToast("Horarios guardados (tenant_horarios) y caché local.");
      } catch (e) {
        console.error(e);
        this.cfgToast("Solo caché local: no se pudo escribir horarios en la nube.");
      }
      ConfigStore.persist();
      btn.innerHTML = `<i data-lucide="check"></i> Guardado`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = `<i data-lucide="save"></i> Guardar`;
      }, 1500);
    });
  },

  // ── Tour / Onboarding
  renderTour() {
    const st = ConfigStore.state.tour.pasos;
    const entries = Object.entries(st);
    let completed = 0;
    const cont = document.getElementById("tourStepsContainer");
    cont.innerHTML = "";

    entries.forEach(([key, val]) => {
      if(val.estado === "Completado") completed++;
      const el = document.createElement("div");
      el.style.display = "flex";
      el.style.justifyContent = "space-between";
      el.style.alignItems = "center";
      el.style.padding = "12px 0";
      el.style.borderBottom = "1px solid var(--cfg-border)";
      
      const isOk = val.estado === "Completado";
      el.innerHTML = `
        <div style="font-weight:600; color:var(--color-text);"><i data-lucide="${isOk ? 'check-circle-2':'circle'}" style="color:${isOk? 'var(--color-success)' : 'var(--color-text-muted)'}; margin-right:8px; vertical-align:middle; width:20px;height:20px;"></i> ${val.label}</div>
        <button class="cfg-btn-save" style="background:var(--color-surface);color:var(--color-text);box-shadow:none;border:1px solid var(--cfg-border);font-size:12px;padding:6px 12px;" onclick="window.cfgTouchTourStepComplete('${key}')">${isOk ? 'Rehacer' : 'Hacer Tour'}</button>
      `;
      cont.appendChild(el);
    });

    const percent = Math.round((completed / entries.length) * 100);
    document.getElementById("tourProgressFill").style.width = percent + "%";
    document.getElementById("tourProgressText").textContent = percent + "% Completado";
    if (window.lucide) window.lucide.createIcons();
    this.applySectionMode("cfg-sect-tour");
  },

  /** Toggles de tours con verificación (módulo shell + PWA Pedidos), persistidos en `tour` / Supabase. */
  renderToursInteractivosModulos() {
    const st = ConfigStore.state;
    const master = document.getElementById("tourModulosHabilitado");
    if (master) {
      master.checked = st.tour?.modulosHabilitado !== false;
    }
    const host = document.getElementById("tourPerModuloContainer");
    if (!host) return;
    host.innerHTML = "";
    const defByKey = MIREST_MODULE_ONBOARDING;
    const keys = Object.keys(defByKey).sort((a, b) =>
      (defByKey[a].label || a).localeCompare(defByKey[b].label || b, "es")
    );
    const per = st.tour?.activoPorModulo && typeof st.tour.activoPorModulo === "object" ? st.tour.activoPorModulo : {};
    keys.forEach((k) => {
      const d = defByKey[k];
      const id = `tour-mod-${k}`;
      const on = per[k] === false ? false : true;
      const row = document.createElement("label");
      row.className = "cfg-tour-mod";
      row.style.cssText =
        "display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--cfg-border);cursor:pointer;font-size:14px";
      row.innerHTML = `<input type="checkbox" id="${id}" data-tour-mod="${k}" ${on ? "checked" : ""} style="width:18px;height:18px" />
        <span style="font-weight:600">${d.icon || ""} ${d.label || k}</span>`;
      host.appendChild(row);
    });
    this.applySectionMode("cfg-sect-tour");
  },

  setupTourHandlers() {
    document.getElementById("btnRestartTour")?.addEventListener("click", () => {
       if (!this.sectionGuard("cfg-sect-tour")) return;
       const pasos = ConfigStore.state.tour.pasos;
       Object.values(pasos).forEach(p => p.estado = "Pendiente");
       ConfigStore.persist();
       this.renderTour();
    });
    
    window.cfgTouchTourStepComplete = (key) => {
       if (!this.sectionGuard("cfg-sect-tour")) return;
       ConfigStore.state.tour.pasos[key].estado = "Completado";
       ConfigStore.persist();
       this.renderTour();
    };

    document.getElementById("btnSaveToursInteractivos")?.addEventListener("click", () => {
      if (!this.sectionGuard("cfg-sect-tour")) return;
      if (!ConfigStore.state.tour) return;
      const master = document.getElementById("tourModulosHabilitado");
      if (master) ConfigStore.state.tour.modulosHabilitado = master.checked;
      const next = { ...ConfigStore.state.tour.activoPorModulo };
      document.querySelectorAll("[data-tour-mod]").forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        const k = el.getAttribute("data-tour-mod");
        if (k) next[k] = el.checked;
      });
      ConfigStore.state.tour.activoPorModulo = next;
      ConfigStore.persist();
      this.cfgToast("Ajustes de tutoriales guardados (caché y nube).");
    });
  },

  // ── Usuarios
  renderUsuarios() {
    const list = ConfigStore.state.usuarios;
    const cont = document.getElementById("usersListContainer");
    cont.innerHTML = "";

    list.forEach(usr => {
      const row = document.createElement("div");
      row.style.background = "var(--color-surface-muted)";
      row.style.border = "1px solid var(--cfg-border)";
      row.style.borderRadius = "12px";
      row.style.padding = "16px";
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      
      row.innerHTML = `
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--color-accent-soft);color:var(--color-accent-dark);display:grid;place-items:center;font-weight:700;">
            ${usr.nombre.charAt(0)}${usr.nombre.split(' ').length>1 ? usr.nombre.split(' ')[1].charAt(0) : ''}
          </div>
          <div>
            <div style="font-weight:700;color:var(--color-text)">${usr.nombre} <span style="font-size:10px;background:var(--color-border-strong);color:var(--color-text-muted);padding:2px 6px;border-radius:10px;margin-left:6px;">${usr.rol}</span></div>
            <div style="font-size:12px;color:var(--color-text-muted)">${usr.email} • PIN: ****</div>
          </div>
        </div>
        <button class="cfg-btn-save" style="background:transparent;color:var(--color-red);box-shadow:none;padding:5px;" onclick="window.cfgRemoveLocalUser('${usr.id}')"><i data-lucide="trash"></i></button>
      `;
      cont.appendChild(row);
    });
    if (window.lucide) window.lucide.createIcons();
    this.applySectionMode("cfg-sect-usuarios");
  },

  setupUsuariosHandlers() {
    document.getElementById("btnAddUser").addEventListener("click", () => {
       if (!this.sectionGuard("cfg-sect-usuarios")) return;
       const u = prompt("Nombre del nuevo administrador:");
       if(u) {
          ConfigStore.state.usuarios.push({
             id: 'usr_' + Date.now().toString(36),
             nombre: u,
             email: u.toLowerCase().replace(' ','') + "@mirest.pe",
             rol: "Admin",
             activo: true,
             pin: "1234"
          });
          ConfigStore.persist();
          this.renderUsuarios();
      }
    });

    window.cfgRemoveLocalUser = (id) => {
       if (!this.sectionGuard("cfg-sect-usuarios")) return;
       if(ConfigStore.state.usuarios.length <= 1) {
          alert("No puedes eliminar al único administrador del sistema.");
          return;
       }
       ConfigStore.state.usuarios = ConfigStore.state.usuarios.filter(u => u.id !== id);
       ConfigStore.persist();
       this.renderUsuarios();
    };
  },

  // ── Restaurante
  setupRestauranteHandlers() {
    document.getElementById("btnSaveRest").addEventListener("click", async () => {
      if (!this.sectionGuard("cfg-sect-restaurante")) return;
      const ruc = document.getElementById("cfg-rest-ruc").value.trim();
      const errRuc = document.getElementById("err-rest-ruc");

      if (ruc && ruc.length !== 11) {
        errRuc.style.display = "block";
        return;
      }
      errRuc.style.display = "none";

      const nombre = document.getElementById("cfg-rest-nombre").value.trim();
      const dir = document.getElementById("cfg-rest-dir").value.trim();
      ConfigStore.state.restaurante.nombre = nombre;
      ConfigStore.state.restaurante.direccion = dir;
      ConfigStore.state.restaurante.ruc = ruc;
      const btn = document.getElementById("btnSaveRest");
      try {
        await saveTenantPatch({
          name: nombre,
          direccion: dir,
          ruc: ruc || null,
        });
        this.cfgToast("Datos del restaurante guardados (tenants).");
      } catch (e) {
        console.error(e);
        this.cfgToast("No se pudo guardar en el servidor; solo caché local.");
      }
      ConfigStore.persist();
      this.updateTopbarRestaurante(ConfigStore.state.restaurante.nombre);
      btn.innerHTML = `<i data-lucide="check"></i> Guardado`;
      if (window.lucide) window.lucide.createIcons();
      setTimeout(() => {
        btn.innerHTML = `<i data-lucide="save"></i> Guardar`;
      }, 1500);
    });
  },

};

document.addEventListener("DOMContentLoaded", () => {
  ConfigUI.init().catch((e) => {
    console.error("[config] init", e);
    const el = document.getElementById("cfg-persist-status");
    if (el) {
      el.textContent = "Error al cargar la configuración. Revisa la consola.";
      el.style.color = "var(--color-destructive, #dc2626)";
    }
  });
});
