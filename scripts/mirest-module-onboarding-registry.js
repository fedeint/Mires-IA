/**
 * Onboarding interactivo por módulo — definiciones y verificación (Supabase + local).
 * Los textos alinean al spec de producto; las condiciones usan el esquema real (vistas en español).
 */
import { supabase } from "./supabase.js";
import { loadMirestUserContext } from "./mirest-user-context.js";
import { MIREST_SHELL_CONFIG_KEY, resolveDefaultRestaurantId } from "./mirest-app-config.js";
import { isAccesosManagerRole } from "./navigation.js";

/**
 * Resuelve tenant como el resto del ecosistema: `usuarios` (preferido) y, si no hay
 * tenant, `user_profiles` (misma lógica que resolveTenantIdForUser en module-conditions).
 * Sin eso, el superadmin con sesión Auth “válida” seguía sin contexto y el tour
 * mostraba “Inicia sesión…” aunque estuvieras logueado.
 * @returns {Promise<import('./mirest-module-onboarding-runner.js').MirestOnboardingContext | null>}
 */
export async function createMirestOnboardingContext() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  let user = session?.user ?? null;
  if (!user) {
    const { data: gu } = await supabase.auth.getUser();
    user = gu.user ?? null;
  }
  if (!user) return null;

  const ctxM = await loadMirestUserContext(user);
  let profile = ctxM.profile;
  let tid = profile?.tenant_id != null ? String(profile.tenant_id) : "";

  if (!tid) {
    const { data: up, error: eUp } = await supabase
      .from("user_profiles")
      .select("id, tenant_id, restaurant_id")
      .eq("id", user.id)
      .maybeSingle();
    if (eUp) {
      console.warn("[onb] user_profiles (fallback tenant):", eUp);
    }
    if (up?.tenant_id != null) {
      tid = String(up.tenant_id);
      profile = { ...(profile && typeof profile === "object" ? profile : {}), ...up, tenant_id: up.tenant_id };
    }
  }

  /** @param {import('@supabase/auth-js').User} u */
  function tenantIdFromMetadata(u) {
    const am = u.app_metadata && typeof u.app_metadata === "object" ? u.app_metadata : {};
    const um = u.user_metadata && typeof u.user_metadata === "object" ? u.user_metadata : {};
    const v = am.tenant_id ?? am.tenantId ?? am.tid ?? um.tenant_id ?? um.tenantId ?? um.tid;
    return v != null && String(v).trim() !== "" ? String(v) : "";
  }
  if (!tid) {
    const fromMeta = tenantIdFromMetadata(user);
    if (fromMeta) tid = fromMeta;
  }

  /** superadmin / admin: a veces operan sin fila con tenant en perfiles, pero con acceso a la plataforma.
   * Usamos el primer tenant accesible por RLS para verificación (no sustituye asignar local en producción). */
  if (!tid) {
    const role = (ctxM.shellRole || "demo").toLowerCase();
    if (isAccesosManagerRole(role)) {
      const { data: t0, error: tErr } = await supabase
        .from("tenants")
        .select("id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (tErr) {
        console.warn("[onb] tenants (rol administrativo):", tErr);
      }
      if (t0?.id != null) {
        tid = String(t0.id);
        const base = profile && typeof profile === "object" ? { ...profile } : {};
        profile = { ...base, tenant_id: t0.id };
      }
    }
  }

  /** Sesión ok pero imposible resolver local: RLS, perfil inexistente o aún no importado. El tour abre en modo “solo guía” (verificación nube desactivada). */
  if (!tid) {
    return {
      supabase,
      tenantId: null,
      restaurantId: null,
      user,
      profile: profile && typeof profile === "object" ? profile : null,
      guiaSinTenant: true,
    };
  }
  const restaurantId = await resolveDefaultRestaurantId(
    supabase,
    tid,
    profile && typeof profile === "object" ? /** @type {{ restaurant_id?: unknown }} */(profile).restaurant_id : null
  );
  return {
    supabase,
    tenantId: tid,
    restaurantId: restaurantId ? String(restaurantId) : null,
    user,
    profile: profile && typeof profile === "object" ? profile : null,
    guiaSinTenant: false,
  };
}

async function shellValue(ctx) {
  if (!ctx.restaurantId) return null;
  const { data, error } = await ctx.supabase
    .from("restaurant_settings")
    .select("value")
    .eq("restaurant_id", ctx.restaurantId)
    .eq("key", MIREST_SHELL_CONFIG_KEY)
    .maybeSingle();
  if (error) {
    console.warn("[onb] restaurant_settings", error);
    return null;
  }
  return data?.value && typeof data.value === "object" ? data.value : null;
}

async function tenantNameOk(ctx) {
  const { data, error } = await ctx.supabase
    .from("tenants")
    .select("id, name")
    .eq("id", ctx.tenantId)
    .maybeSingle();
  if (error || !data?.name) return false;
  return String(data.name).trim().length > 0;
}

export const verifyHandlers = {
  /** Config 1: nombre + RUC en settings shell o al menos tenant con nombre y RUC en restaurante. */
  async configIdentidad(ctx) {
    const s = await shellValue(ctx);
    const rn = s?.restaurante && typeof s.restaurante === "object" ? s.restaurante : {};
    const nombre = String(rn.nombre || "").trim();
    const ruc = String(rn.ruc || "").replace(/\D/g, "");
    if (nombre.length > 0 && ruc.length === 11) return true;
    const tn = await tenantNameOk(ctx);
    if (!tn) return false;
    if (!ctx.restaurantId) return ruc.length === 11;
    const { data: r } = await ctx.supabase
      .from("restaurants")
      .select("name, metadata")
      .eq("id", ctx.restaurantId)
      .maybeSingle();
    if (!r) return false;
    return String(r.name || "").trim().length > 0;
  },
  async configHorarios(ctx) {
    const s = await shellValue(ctx);
    const h = s?.horarios;
    if (!h || typeof h !== "object") return false;
    return Object.values(h).some(
      (d) => d && !d.cerrado && d.apertura && d.cierre
    );
  },
  async configDallA(ctx) {
    const s = await shellValue(ctx);
    const n = s?.dallIA?.nombre;
    return typeof n === "string" && n.trim().length > 0;
  },
  async configTresModulos(ctx) {
    const s = await shellValue(ctx);
    const m = s?.modulos;
    if (!m || typeof m !== "object") return false;
    return Object.values(m).filter((v) => v === true).length >= 3;
  },
  alwaysTrue: async () => true,
  localAccesosPerfiles: async () => {
    try {
      return localStorage.getItem("mirest_onb_accesos_perfiles") === "1";
    } catch {
      return false;
    }
  },
  localCajaEgreso: async () => {
    try {
      return localStorage.getItem("mirest_onb_caja_egreso") === "1";
    } catch {
      return false;
    }
  },
  localReportesCfg: async () => {
    try {
      return (
        localStorage.getItem("mirest_onb_reportes_destinatario") != null ||
        localStorage.getItem("mirest_onb_reportes_dest") != null
      );
    } catch {
      return false;
    }
  },
  localReporteGen: async () => {
    try {
      return localStorage.getItem("mirest_onb_reporte_visto") === "1";
    } catch {
      return false;
    }
  },
  localDallaPregunta: async () => {
    try {
      return localStorage.getItem("mirest_onb_dalla_mensaje") === "1";
    } catch {
      return false;
    }
  },
  localIaPregunta: async () => {
    try {
      return localStorage.getItem("mirest_onb_ia_pregunta") === "1";
    } catch {
      return false;
    }
  },

  async accesosUsuarioOperativo(ctx) {
    const { data: rows, error } = await ctx.supabase
      .from("usuarios")
      .select("id, role")
      .eq("tenant_id", ctx.tenantId);
    if (error) return false;
    return (rows || []).some(
      (u) => u?.role && !/^(admin|superadmin)$/i.test(String(u.role).trim())
    );
  },

  async accesosCajeroYchef(ctx) {
    const { data, error } = await ctx.supabase
      .from("usuarios")
      .select("role")
      .eq("tenant_id", ctx.tenantId);
    if (error || !data?.length) return false;
    const roles = new Set(
      data.map((r) => String(r.role || "").toLowerCase().trim())
    );
    const hasCaja = [...roles].some(
      (x) => x === "caja" || x.includes("caj")
    );
    const hasChef = [...roles].some(
      (x) => x === "chef" || x.includes("chef")
    );
    return hasCaja && hasChef;
  },

  async provUno(ctx) {
    const { count, error } = await ctx.supabase
      .from("proveedores")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);
    if (error) return false;
    return (count || 0) >= 1;
  },
  async provCredito(ctx) {
    const { count, error } = await ctx.supabase
      .from("proveedores")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .not("dias_credito", "is", null);
    if (error) return false;
    return (count || 0) >= 1;
  },
  async ins3(ctx) {
    const { count, error } = await ctx.supabase
      .from("insumos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);
    if (error) return false;
    return (count || 0) >= 3;
  },
  async insStockMin(ctx) {
    const { data, error } = await ctx.supabase
      .from("insumos")
      .select("id, stock_minimo")
      .eq("tenant_id", ctx.tenantId);
    if (error || !data?.length) return false;
    return !data.some(
      (i) => i.stock_minimo == null || Number(i.stock_minimo) === 0
    );
  },
  async almEntrada(ctx) {
    const { data, error } = await ctx.supabase
      .from("almacen_movimientos")
      .select("id, tipo")
      .eq("tenant_id", ctx.tenantId)
      .like("tipo", "entrada%")
      .limit(1);
    if (error) return false;
    return (data?.length || 0) > 0;
  },
  async insStockPos(ctx) {
    const { data, error } = await ctx.supabase
      .from("insumos")
      .select("stock_actual")
      .eq("tenant_id", ctx.tenantId);
    if (error || !data?.length) return false;
    return data.some((i) => Number(i.stock_actual) > 0);
  },
  async prodUnoActivo(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);
    if (error) return false;
    return (count || 0) >= 1;
  },
  async prodConCategoria(ctx) {
    const { data, error } = await ctx.supabase
      .from("productos")
      .select("category_id, is_active")
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);
    if (error || !data?.length) return false;
    return !data.some((p) => !p.category_id);
  },
  async prod3Activos(ctx) {
    const { count, error } = await ctx.supabase
      .from("productos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("is_active", true);
    if (error) return false;
    return (count || 0) >= 3;
  },
  async recUna(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("recetas")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);
    if (error) return false;
    return (count || 0) >= 1;
  },
  async recetaLineasPos(ctx) {
    if (!ctx.restaurantId) return false;
    const { data: rids, error: e0 } = await ctx.supabase
      .from("recetas")
      .select("id")
      .eq("tenant_id", ctx.tenantId);
    if (e0) return false;
    const idList = (rids || []).map((r) => r.id);
    if (!idList.length) return false;
    const { data, error } = await ctx.supabase
      .from("receta_insumos")
      .select("quantity, insumo_id, recipe_id")
      .in("recipe_id", idList);
    if (error) return false;
    const rows = data || [];
    if (rows.length === 0) return false;
    return !rows.some((r) => {
      if (r.insumo_id == null) return true;
      const q = r.quantity;
      return q == null || Number(q) === 0;
    });
  },
  async recetaCostoEfectivo(ctx) {
    if (!ctx.restaurantId) return false;
    const { data: rcp } = await ctx.supabase
      .from("recetas")
      .select("id, metadata")
      .eq("tenant_id", ctx.tenantId)
      .limit(5);
    if (rcp?.some((r) => {
      const m = r.metadata;
      if (m && typeof m === "object" && "costo_calculado" in m) {
        return Number(m.costo_calculado) > 0;
      }
      return false;
    }))
      return true;
    return false;
  },

  async cajaSesionAbierta(ctx) {
    if (!ctx.restaurantId) return false;
    const { data, error } = await ctx.supabase
      .from("sesiones_caja")
      .select("id, closed_at")
      .eq("tenant_id", ctx.tenantId)
      .is("closed_at", null)
      .limit(1);
    if (error) return false;
    return (data?.length || 0) > 0;
  },
  async cajaCobrado(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .in("status", ["closed", "served"]); // o cerrado
    if (error) return false;
    return (count || 0) >= 1;
  },
  async cajaCerradaAlguna(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("sesiones_caja")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .not("closed_at", "is", null);
    if (error) return false;
    return (count || 0) >= 1;
  },
  async cocPend(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("cocina_cola")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("estado", "pendiente");
    if (error) return false;
    return (count || 0) > 0;
  },
  async cocListo(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("cocina_cola")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("estado", "listo");
    if (error) return false;
    return (count || 0) > 0;
  },
  async deliveryActivo(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("restaurant_delivery_affiliations")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId);
    if (error) return false;
    return (count || 0) > 0;
  },
  async deliveryPed(ctx) {
    if (!ctx.restaurantId) return false;
    const { count, error } = await ctx.supabase
      .from("pedidos")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", ctx.tenantId)
      .eq("channel", "delivery");
    if (error) return false;
    return (count || 0) > 0;
  },
  async reporteVentas(ctx) {
    if (!ctx.restaurantId) return false;
    return verifyHandlers.cajaCobrado(ctx);
  },
};

/**
 * @param {string} id
 * @returns {(ctx: import('./mirest-module-onboarding-runner.js').MirestOnboardingContext) => Promise<boolean> | null}
 */
export function getVerifyHandler(id) {
  return verifyHandlers[/** @type {keyof typeof verifyHandlers} */ (id)] || null;
}

/** Definición de módulos y pasos (spotlight + handler de verificación). */
export const MIREST_MODULE_ONBOARDING = {
  configuracion: {
    id: "configuracion",
    label: "Configuración",
    icon: "⚙️",
    storageKey: "mirest_onb_done_configuracion",
    steps: [
      { paso: 1, titulo: "Dale identidad a tu restaurante", descripcion: "Ingresa el nombre, dirección y RUC de tu negocio en Info Restaurante.", accion: "Completar nombre, dirección, RUC (11 dígitos) y guardar.", completado_cuando: "Shell JSON con restaurante.nombre y RUC válido; o tenant + local con RUC", element: "#cfg-sect-restaurante", verifyId: "configIdentidad" },
      { paso: 2, titulo: "¿Cuándo abres?", descripcion: "Configura tus horarios de atención por día en Horarios de operación.", accion: "Ajusta días activos y horario de apertura/cierre y guarda.", completado_cuando: "Al menos un día abierto con rango de hora en `restaurant_settings` (mirest_shell_v1.horarios)", element: "#cfg-sect-horarios", verifyId: "configHorarios" },
      { paso: 3, titulo: "Personaliza a DallA", descripcion: "En Personalizar DallIA elige el nombre y tono del asistente.", accion: "Escribe un nombre, elige trato y personalidad; guarda.", completado_cuando: "dallIA.nombre no vacío en shell config", element: "#cfg-sect-dallia", verifyId: "configDallA" },
      { paso: 4, titulo: "¿Qué módulos usarás?", descripcion: "En Módulos del sistema activa al menos lo que vayas a operar. Puedes volver a cambiarlos.", accion: "Activa 3 o más módulos y guarda.", completado_cuando: "≥3 toggles en `true` en `modulos` (JSON en Supabase).", element: "#cfg-sect-modulos", verifyId: "configTresModulos" },
      { paso: 5, titulo: "¡Configuración lista!", descripcion: "El siguiente paso natural es crear tu equipo en Accesos (usuarios reales y roles).", accion: "Botón: Ir a Accesos o cierra y abre el menú > Accesos.", completado_cuando: "Completar paso 4; este paso es cierre (sin condición adicional de BD).", element: "body", verifyId: "alwaysTrue" },
    ],
  },
  accesos: {
    id: "accesos",
    label: "Accesos",
    icon: "🔐",
    storageKey: "mirest_onb_done_accesos",
    steps: [
      { paso: 1, titulo: "Crea tu primer usuario", descripcion: "Invita a un colaborador que no sea el administrador (rol operativo: cajero, mesa, etc.).", accion: "Flujo de invitación o alta; evita dejar solo admin/superadmin en el local.", completado_cuando: "Existe al menos 1 `usuarios` con rol distinto de admin/superadmin en el tenant.", element: "main, .accesos-header, body", verifyId: "accesosUsuarioOperativo" },
      { paso: 2, titulo: "Entiende los perfiles", descripcion: "Cada perfil abre módulos distintos. Después podrás ajustarlos en `roles_modulos` para el local.", accion: "Haz una interacción en perfiles. Si la UI aún no lista, usa «Marcar como visto» (local).", completado_cuando: "localStorage `mirest_onb_accesos_perfiles=1`", element: "main, body", verifyId: "localAccesosPerfiles" },
      { paso: 3, titulo: "Asigna tu equipo", descripcion: "Un ideal mínimo: al menos alguien de caja y alguien de cocina.", accion: "Crea/invita a usuarios con perfiles caja y chef (o sinónimos).", completado_cuando: "Existe al menos 1 `role` caja* y 1 con chef en el tenant.", element: "main, body", verifyId: "accesosCajeroYchef" },
      { paso: 4, titulo: "¡Equipo listo!", descripcion: "El siguiente módulo típico: proveedores (catálogo de abastecimiento) y luego Almacén.", accion: "Navega a Clientes/Proveedores o Almacén según tu ruta operativa.", completado_cuando: "Paso 3 completado.", element: "body", verifyId: "alwaysTrue" },
    ],
  },
  proveedores: { id: "proveedores", label: "Proveedores", icon: "🚚", storageKey: "mirest_onb_done_proveedores", steps: [
    { paso: 1, titulo: "Primer proveedor", descripcion: "Un contacto frecuente en la lista", accion: "Nuevo registro nombre y tel o RUC", completado_cuando: "1 o más filas proveedores del tenant", element: "main, #proveedoresRoot, body", verifyId: "provUno" },
    { paso: 2, titulo: "Crédito y contacto", descripcion: "Días de crédito y dato de contacto", accion: "Editar ficha y marcar crédito aunque sea 0", completado_cuando: "1 proveedor con dias_credito no nulo", element: "body", verifyId: "provCredito" },
    { paso: 3, titulo: "Listo para insumos", descripcion: "Sigue en Almacén con entradas", accion: "Abrir Almacén inventario o entradas", completado_cuando: "Paso 2 ok cierre", element: "body", verifyId: "alwaysTrue" },
  ]},
  almacen: { id: "almacen", label: "Almacén", icon: "📦", storageKey: "mirest_onb_done_almacen", steps: [
    { paso: 1, titulo: "Insumos tipo despacho Yaurí", descripcion: "Altas rápidas unidad costo mínimo", accion: "Crear 3 insumos o más", completado_cuando: "3 o más insumos del tenant", element: "main, body", verifyId: "ins3" },
    { paso: 2, titulo: "Stock mínimo", descripcion: "Alertas solo si cada fila tiene mínimo", accion: "Completar stock mínimo en catálogo", completado_cuando: "Sin insumos con mínimo vacío o 0", element: "body", verifyId: "insStockMin" },
    { paso: 3, titulo: "Primera entrada", descripcion: "Movimiento entrada en almacén", accion: "Registrar compra o apertura", completado_cuando: "1 movimiento tipo entrada del tenant", element: "body", verifyId: "almEntrada" },
    { paso: 4, titulo: "Saldo positivo", descripcion: "Al menos un insumo con stock", accion: "Ajustar entradas hasta ver saldo", completado_cuando: "1 insumo con stock_actual mayor que 0", element: "body", verifyId: "insStockPos" },
    { paso: 5, titulo: "Siguiente carta", descripcion: "Productos y recetas", accion: "Ir a Productos", completado_cuando: "Paso 4 ok cierre", element: "body", verifyId: "alwaysTrue" },
  ]},
  productos: { id: "productos", label: "Productos", icon: "🍽️", storageKey: "mirest_onb_done_productos", steps: [
    { paso: 1, titulo: "Crea tu carta", descripcion: "Productos = lo que toma un pedido. Activa y precia al menos 1 plato visible.", accion: "Crear 1+ producto activo con precio (vista `productos`).", completado_cuando: "≥1 `productos` activo por tenant (is_active = true).", element: "main, body", verifyId: "prodUnoActivo" },
    { paso: 2, titulo: "Organiza por categorías", descripcion: "Cada plato con categoría evita nulos y ordena PWA/Pedidos.", accion: "Vincula un `category_id` de `categorias_producto` a los activos.", completado_cuando: "No hay productos `is_active` sin `category_id`.", element: "body", verifyId: "prodConCategoria" },
    { paso: 3, titulo: "Nivel de oferta mínima", descripcion: "Asegúrate de tener 3+ platos activos para probar comandas reales.", accion: "Activa al menos 3 productos.", completado_cuando: "≥3 platos con `is_active` true (tenant).", element: "body", verifyId: "prod3Activos" },
    { paso: 4, titulo: "¡Carta lista!", descripcion: "Ahora mapea ingredientes: Recetas (por plato) → cocina baja almacén.", accion: "Abrir Recetas.", completado_cuando: "Cierre: paso 3 ok.", element: "body", verifyId: "alwaysTrue" },
  ]},
  recetas: { id: "recetas", label: "Recetas", icon: "📋", storageKey: "mirest_onb_done_recetas", steps: [
    { paso: 1, titulo: "¿Qué lleva cada plato?", descripcion: "Crea 1+ receta asociada al plato/tenant.", accion: "Crear `receta` mínima con ítems `receta_insumos`.", completado_cuando: "≥1 fila en `recetas` del local.", element: "main, body", verifyId: "recUna" },
    { paso: 2, titulo: "Sé exacto con las cantidades", descripcion: "Todas las filas con cantidad e insumo definidos y >0.", accion: "Revisa editor de `receta_insumos` en UI.", completado_cuando: "Cada `receta_insumos` devuelve quantity >0 e insumo_id (datos reales: limita query).", element: "body", verifyId: "recetaLineasPos" },
    { paso: 3, titulo: "Comprueba el costo", descripcion: "En metadata de receta, costo_calculado >0 si rellenaste costos de insumos; si el UI no persiste, usa aproximación manual o ignora requisito.", accion: "O revisa cálculo en listado; si 0, costea insumos y recarga.", completado_cuando: "Cualquier `recetas.metadata.costo_calculado` >0 (o falla a manual).", element: "body", verifyId: "recetaCostoEfectivo" },
    { paso: 4, titulo: "¡Recetas listas!", descripcion: "Cocina podrá bajar almacén al terminar; Caja toma el cobro.", accion: "Prueba flujo: Pedidos → cocina `listo`", completado_cuando: "Cierre: paso 2 ok.", element: "body", verifyId: "alwaysTrue" },
  ]},
  caja: { id: "caja", label: "Caja", icon: "💰", storageKey: "mirest_onb_done_caja", steps: [
    { paso: 1, titulo: "Abre tu primera sesión", descripcion: "Caja = pedidos y cobro con sesión; `sesiones_caja` con `closed_at` null = abierta.", accion: "Abrir caja con arqueo inicial (UI Caja PWA o shell).", completado_cuando: "Existe 1+ `sesiones_caja` abierta del tenant+local (sin cerrar).", element: "main, body", verifyId: "cajaSesionAbierta" },
    { paso: 2, titulo: "Registra un egreso (opcional)", descripcion: "Gastos del turno; requiere UI. Usa señal local o implementa carga en Caja hacia `caja_movimientos`.", accion: "Nuevo egreso en UI, o toca el botón «Egreso registrado» (local) para progresar.", completado_cuando: "localStorage mirest_onb_caja_egreso=1 o futura traza de egresos", element: "body", verifyId: "localCajaEgreso" },
    { paso: 3, titulo: "Cobrar un pedido (pedido con fin de ciclo)", descripcion: "Cobra un flujo: pedido `closed`/`served` con pago o cierre lógico.", accion: "Caja/ Pedidos: cobro que deje `status` cerrado o servido (según esquema).", completado_cuando: "≥1 `pedidos` en estado de flujo de salida (closed/served).", element: "body", verifyId: "cajaCobrado" },
    { paso: 4, titulo: "Cierre de caja", descripcion: "Cierra sesión: `closed_at` rellenado, arqueo verificado en UI.", accion: "Cerrar caja; confirma arqueo.", completado_cuando: "Existe 1+ `sesiones_caja` con `closed_at` (históricamente).", element: "body", verifyId: "cajaCerradaAlguna" },
  ]},
  cocina: { id: "cocina", label: "Cocina", icon: "👨‍🍳", storageKey: "mirest_onb_done_cocina", steps: [
    { paso: 1, titulo: "Así llegan los pedidos", descripcion: "La cola (cocina_cola) se alimenta por comandas. Debe existir 1+ pendiente para ver flujo en vivo (crea comanda o usa staging).", accion: "Observar o crear pedido; items pasan a cocina con estado `pendiente`.", completado_cuando: "≥1 `cocina_cola` pendiente del tenant.", element: "main, body", verifyId: "cocPend" },
    { paso: 2, titulo: "Marca como listo", descripcion: "Al poner en `listo` gatilla salida de almacén / stock.", accion: "Cambia estado de un ítem a `listo`.", completado_cuando: "≥1 `cocina_cola` con estado `listo`.", element: "body", verifyId: "cocListo" },
    { paso: 3, titulo: "Flujo conectado", descripcion: "Cocina es el cierre hacia caja, clientes e inventario.", accion: "Mantén preparados listos; servicio/ mostrador los cierra luego en pedidos o kiosco.", completado_cuando: "Cierre: paso 2 ok (sin más BD forzada).", element: "body", verifyId: "alwaysTrue" },
  ]},
  delivery: { id: "delivery", label: "Delivery", icon: "🛵", storageKey: "mirest_onb_done_delivery", steps: [
    { paso: 1, titulo: "Conecta canales (afiliaciones)", descripcion: "Crea 1+ afiliación a proveedores (Rappi, directo) en el modelo `restaurant_delivery_affiliations`.", accion: "Panel: Delivery / afiliaciones; confirmar inserción.", completado_cuando: "≥1 `restaurant_delivery_affiliations` del tenant.", element: "main, body", verifyId: "deliveryActivo" },
    { paso: 2, titulo: "Primer pedido delivery", descripcion: "Canal = delivery, mismo `orders` y carta; valida con `channel = 'delivery'`.", accion: "Toma 1+ pedido delivery o inserta vía módulo.", completado_cuando: "≥1 `pedidos` con channel delivery.", element: "body", verifyId: "deliveryPed" },
    { paso: 3, titulo: "¡Delivery listo!", descripcion: "Reportes y dashboard segmentan por canal.", accion: "Cierre.", completado_cuando: "Cierre: paso 2 ok.", element: "body", verifyId: "alwaysTrue" },
  ]},
  reportes: { id: "reportes", label: "Reportes", icon: "📊", storageKey: "mirest_onb_done_reportes", steps: [
    { paso: 1, titulo: "Necesitas actividad real", descripcion: "Los reportes leen caja, pedidos y módulos. Sin cobros, las métricas son cero (comprueba 1+ pedido cerrado/servido).", accion: "Asegurar 1+ pedido `closed`/`served` en el local.", completado_cuando: "Misma lógica que caja «cobrado» / ventas: ≥1 `pedidos` closed/served.", element: "main, body", verifyId: "reporteVentas" },
    { paso: 2, titulo: "Configura envío (cuando exista módulo)", descripcion: "Aún no hay `reportes_config` en el esquema. Usa destinatario (local) como proxy hasta migración.", accion: "Guarda email/pref. en UI o mira señal local; `localStorage` mirest_onb_reportes_destinatario.", completado_cuando: "Cualquier string en clave `mirest_onb_reportes_dest` (o flag local).", element: "body", verifyId: "localReportesCfg" },
    { paso: 3, titulo: "Vista o export", descripcion: "Abre reporte; marca en local (no hay tabla todavía de reportes_generados en repo).", accion: "Botón «Visto» en UI; `mirest_onb_reporte_visto=1`.", completado_cuando: "localStorage o futura `reportes_generados`.", element: "body", verifyId: "localReporteGen" },
  ]},
  clientes: { id: "clientes", label: "Clientes CRM", icon: "👥", storageKey: "mirest_onb_done_clientes", steps: [
    { paso: 1, titulo: "Contactos", descripcion: "Base viva de leads e inbox", accion: "Crear o importar 1 contacto", completado_cuando: "Listado con al menos 1 fila o marcar visto en plantilla", element: "main, body", verifyId: "alwaysTrue" },
    { paso: 2, titulo: "Canales", descripcion: "Campañas o inbox para contexto", accion: "Abrir campañas o inbox y volver al listado", completado_cuando: "Paso 1 listo", element: "body", verifyId: "alwaysTrue" },
  ]},
  facturacion: { id: "facturacion", label: "Facturación", icon: "🧾", storageKey: "mirest_onb_done_facturacion", steps: [
    { paso: 1, titulo: "Panel de comprobantes", descripcion: "Cola y estados del día", accion: "Revisar pantalla y RUC en Configuración", completado_cuando: "Recorrido mínimo o siguiente si aún sin tráfico", element: "main, body", verifyId: "alwaysTrue" },
    { paso: 2, titulo: "Conciliación", descripcion: "Alinea con caja y reportes", accion: "Ir a Caja o Reportes", completado_cuando: "Paso 1 ok cierre", element: "body", verifyId: "alwaysTrue" },
  ]},
  soporte: { id: "soporte", label: "Soporte", icon: "🛟", storageKey: "mirest_onb_done_soporte", steps: [
    { paso: 1, titulo: "Centro de ayuda", descripcion: "Desde aquí accedes a recursos, tickets o documentación del producto (según lo que tengas conectado).", accion: "Localiza el canal de contacto o la base de artículos en esta pantalla.", completado_cuando: "Vista reconocida; o pulsa «Siguiente» si aún no hay integración de tickets.", element: "main, body", verifyId: "alwaysTrue" },
  ]},
  pedidos: { id: "pedidos", label: "Pedidos — PWA operación (PRE/PRO/POST) + shell", icon: "🍴", storageKey: "mirest_onb_done_pedidos", steps: [
    { paso: 1, titulo: "Operación multicanal", descripcion: "El módulo de Pedidos concentra salón, delivery y para llevar. El PWA abre con PRE/PRO/POST y tours internos.", accion: "Usa el recorrido interno de la PWA; aquí en shell solo señalamos el arranque coordinado con Configuración.", completado_cuando: "Ajusta en Configuración el interruptor «Pedidos» bajo tutoriales; y completa el PRO en la PWA si aplica.", element: "body, #onboardingRoot, main", verifyId: "alwaysTrue" },
  ]},
  ia: { id: "ia", label: "Módulo IA", icon: "🤖", storageKey: "mirest_onb_done_ia", steps: [
    { paso: 1, titulo: "Asistente y contexto", descripcion: "DallA usa el menú, pedidos y permisos de tu rol. Mantén la carta y horarios al día en Configuración.", accion: "Haz al menos una pregunta o usa el widget; o pulsa «Marcar visto» si la IA aún no está cableada en esta ruta.", completado_cuando: "`mirest_onb_ia_pregunta=1` en localStorage o cierre con Siguiente.", element: "body, #dalia-widget-root, .dalia-widget", verifyId: "localIaPregunta" },
  ]},
  dalla: { id: "dalla", label: "DallA (IA)", icon: "🤖", storageKey: "mirest_onb_done_dalla", steps: [
    { paso: 1, titulo: "DallA necesita datos reales", descripcion: "Pregunta mientras tengas sesión; no hay aún `dalla_conversaciones` en el repo, usamos señal local o futura tabla de logs de chat.", accion: "Abre DallA y manda 1+ mensaje; o pulsa “Ya pregunté”.", completado_cuando: "`mirest_onb_dalla_mensaje=1` en localStorage o futura fila de conversación.", element: "body, #dalia-widget-root, .dalia-widget, body", verifyId: "localDallaPregunta" },
    { paso: 2, titulo: "¡DallA en marcha!", descripcion: "La IA toma contexto de módulos a los que tu rol tenga acceso; amplía `roles_modulos` y datos para mejores respuestas.", accion: "Cierre.", completado_cuando: "Cierre: paso 1 ok (siempre con alwaysTrue o dep).", element: "body", verifyId: "alwaysTrue" },
  ]},
};
