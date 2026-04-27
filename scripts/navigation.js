import { APP_ROLE_TO_SHELL } from "./mirest-role-maps.js";

/** Solo luna/sol para el FAB de tema: evita cargar auth-inline-icons.js en todos los módulos. */
function iconThemeFab(isDark) {
  const moon =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="auth-icon" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>';
  const sun =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="auth-icon" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>';
  return isDark ? sun : moon;
}

export const APP_META = {
  name: "MiRest con IA",
  envLabel: "estructura colaborativa del frontend",
};

export const MODULES = [
  {
    key: "proveedores",
    label: "Proveedores",
    short: "PV",
    icon: "truck",
    path: "Clientes/proveedores.html",
    description: "Listado y gestión de proveedores vinculada a compras e inventario.",
    owner: "Gestionado con el CRM / Clientes.",
    handoff: [
      "Mantener ruta bajo Clientes/ coherente con almacén y recetas.",
      "Sincronizar con datos reales al integrar Supabase.",
    ],
  },
  {
    key: "almacen",
    label: "Almacen",
    short: "AL",
    icon: "package",
    path: "Almacen/almacen.html",
    description: "Control base de stock, insumos y movimientos internos.",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de Almacen.",
    handoff: [
      "Diseñar el layout interno del módulo dentro de la carpeta Almacen.",
      "Consumir tokens globales antes de crear estilos adicionales.",
      "Mantener el regreso al dashboard y respetar el shell visual compartido.",
    ],
  },
  {
    key: "caja",
    label: "Caja",
    short: "CJ",
    icon: "banknote",
    path: "Caja/caja.html",
    description: "Apertura, cierre y flujo operativo de caja para el POS.",
    owner: "Este entry point queda reservado para el frontend definitivo del equipo de Caja.",
    handoff: [
      "Implementar la vista operativa de caja sin tocar la navegación global.",
      "Usar componentes compartidos para botones, cards y badges.",
      "Mantener esta página como acceso directo desde el dashboard raíz.",
    ],
  },
  {
    key: "cocina",
    label: "Cocina",
    short: "CK",
    icon: "flame",
    path: "Cocina/cocina.html",
    description: "Vista operativa para producción, cola y estado de preparación.",
    owner: "Este entry point queda reservado para el frontend definitivo del equipo de Cocina.",
    handoff: [
      "Preparar una UI orientada a velocidad operativa y lectura rápida.",
      "Reutilizar el sistema de layout y tipografía compartido.",
      "Conservar breadcrumb y retorno al dashboard en toda vista nueva.",
    ],
  },
  {
    key: "clientes",
    label: "Clientes",
    short: "CL",
    icon: "users",
    path: "Clientes/clientes.html",
    description: "CRM: base de contactos, campañas, lead scoring, nurturing e inbox.",
    owner:
      "Entry point al submódulo de base de datos; el resto de pantallas vive bajo Clientes/.",
    handoff: [
      "Mantener data-root-path y módulo activo en subpáginas (dashboard CRM, campañas, etc.).",
      "Reutilizar tokens y componentes compartidos del root.",
      "Navegación a otras apps del ecosistema vía sidebar o enlaces cruzados coherentes.",
    ],
  },
  {
    key: "productos",
    label: "Productos",
    short: "PR",
    icon: "tag",
    path: "productos/productos.html",
    description: "Gestión detallada de la carta de productos y precios.",
    owner: "Módulo de gestión de productos.",
    handoff: [
      "Implementar la vista de productos usando el Design System.",
      "Asegurar la consistencia con la paleta de colores premium.",
    ],
  },
  {
    key: "facturacion",
    label: "Facturacion",
    short: "FC",
    icon: "file-text",
    path: "Facturacion/facturacion.html",
    description: "Comprobantes y control tributario",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de Facturacion.",
    handoff: [
      "Mantener el shell global sin duplicar estilos compartidos.",
      "Reutilizar tokens y componentes comunes para cards, badges y tablas.",
      "Mantener breadcrumb y retorno al dashboard en toda vista nueva.",
    ],
  },
  {
    key: "pedidos",
    label: "Pedidos",
    short: "PD",
    icon: "shopping-bag",
    path: "Pedidos/implementacion/Pedidos.html?module=pedidos",
    description: "PWA de operación: salón, delivery, para llevar, cocina y caja en un flujo unificado.",
    owner:
      "Código y assets en Pedidos/implementacion/; manifest PWA local en esa carpeta.",
    handoff: [
      "Preparar vistas internas orientadas a velocidad y trazabilidad.",
      "Reutilizar estados, chips y estructura visual del design system del módulo.",
      "Mantener bootstrap y contratos alineados con el backend/Supabase cuando el flujo unifique.",
    ],
  },
  {
    key: "recetas",
    label: "Recetas",
    short: "RC",
    icon: "book-open",
    path: "Recetas/recetas.html",
    description: "Recetas, costos, porciones y estandarización operativa.",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de Recetas.",
    handoff: [
      "Construir la base del módulo manteniendo consistencia con el shell global.",
      "Modelar jerarquías limpias para recetas, insumos y costos.",
      "Mantener las mejoras compartidas dentro de la capa global del proyecto.",
    ],
  },
  {
    key: "reportes",
    label: "Reportes",
    short: "RP",
    icon: "bar-chart-2",
    path: "Reportes/reportes.html",
    description: "Análisis detallado de ventas, costos y rendimiento operativo.",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de Reportes.",
    handoff: [
      "Implementar visualizaciones de datos y dashboards analíticos.",
      "Utilizar el sistema de tokens para gráficos y tablas.",
      "Asegurar la navegación fluida entre diferentes tipos de reportes.",
    ],
  },
  {
    key: "ia",
    label: "Asistente IA",
    short: "IA",
    icon: "zap",
    path: "IA/ia.html",
    description: "Inteligencia artificial centralizada para gestión y análisis.",
    owner: "Módulo de IA basado en Gemini Live para control total del proyecto.",
    handoff: [
      "Integrar WebSocket para comunicación multimodal en tiempo real.",
      "Implementar function calling para que la IA interactúe con otros módulos.",
      "Mantener la estética naranja/noche con efectos de audio visuales.",
    ],
  },
  {
    key: "soporte",
    label: "Soporte",
    short: "SP",
    icon: "life-buoy",
    path: "Soporte/soporte.html",
    description: "Ayuda, contacto y recursos para resolver incidencias.",
    owner: "Canal único de soporte para equipos operativos.",
    handoff: [
      "Centralizar FAQs y enlaces útiles.",
      "Mantener coherencia con el shell y tokens globales.",
    ],
  },
  {
    key: "configuracion",
    label: "Configuración",
    short: "CF",
    icon: "settings",
    path: "Configuracion/configuracion.html",
    description: "Centro de control del sistema, IA, alertas y permisos.",
    owner: "Administración global.",
    handoff: [
      "Permite activar/desactivar módulos",
      "Configuración de alertas e IA",
      "Gestión de Restaurante y horarios."
    ],
  },
  {
    key: "accesos",
    label: "Accesos",
    short: "AC",
    icon: "shieldCheck",
    path: "Accesos/accesos.html",
    description: "Gestión de roles y habilitación de usuarios en Supabase.",
    owner: "Módulo exclusivo de administrador.",
    handoff: [
      "Crear y suspender credenciales.",
      "Asignar roles a las nuevas cuentas.",
    ],
  },
];

export const NAV_ITEMS = [
  {
    key: "dashboard",
    label: "Inicio",
    short: "IN",
    icon: "layout-dashboard",
    path: "index.html",
    description: "Panel base del sistema",
  },
  ...MODULES,
];

const NAV_MODULE_KEYS = new Set(["dashboard", "accesos", ...MODULES.map((m) => m.key)]);

const ADMIN_MODULE_KEYS = MODULES
  .filter((item) => item.key !== "accesos")
  .map((item) => item.key);
/** Módulo Accesos: visible para quienes gestionen usuarios (incl. admin, no solo superadmin). */
const ADMIN_MODULE_KEYS_WITH_ACCESOS = [...ADMIN_MODULE_KEYS, "accesos"];

const STORAGE_KEY = "mirest-ui-theme";

export function getRootPath() {
  return document.body.dataset.rootPath || "./";
}

export function toHref(path) {
  return `${getRootPath()}${path}`;
}

export function getModuleByKey(key) {
  return NAV_ITEMS.find((item) => item.key === key) || NAV_ITEMS[0];
}

export function formatCurrentDate() {
  return new Intl.DateTimeFormat("es-PE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Buenos días";
  if (hour < 19) return "Buenas tardes";
  return "Buenas noches";
}

/** Permisos de función (no son entradas de menú); se marcan en Accesos junto a los módulos. */
export const FEATURE_CAJA_MESEROS = "caja_meseros";
/** Almacén en solo consulta (perfil Chef). */
export const FEATURE_ALMACEN_LECTURA = "almacen_lectura";
/** Productos en solo consulta (perfil Marketing). */
export const FEATURE_PRODUCTOS_LECTURA = "productos_lectura";

export const FEATURE_ACCESS_ITEMS = [
  {
    key: FEATURE_CAJA_MESEROS,
    label: "Caja: meseros y ranking",
    description: "Muestra el panel de meseros y el ranking del día dentro de Caja.",
  },
  {
    key: FEATURE_ALMACEN_LECTURA,
    label: "Almacén: solo lectura",
    description: "Consulta stock e insumos sin movimientos de ajuste (pensado para cocina).",
  },
  {
    key: FEATURE_PRODUCTOS_LECTURA,
    label: "Productos: solo lectura",
    description: "Consulta carta y precios sin editar (pensado para marketing).",
  },
];

export function getAssignablePermissionKeys() {
  return [...MODULES.map((m) => m.key), ...FEATURE_ACCESS_ITEMS.map((f) => f.key)];
}

/** Comprueba permisos extra o comodín * (superadmin). */
export function hasFeaturePermission(permissions, featureKey) {
  const perms = Array.isArray(permissions) ? permissions : [];
  if (perms.includes("*")) return true;
  return perms.includes(featureKey);
}

export const ROLE_PERMISSIONS = {
  superadmin: ["*"],
  admin: ADMIN_MODULE_KEYS_WITH_ACCESOS,
  /** Caja, Pedidos, Clientes (+ soporte). */
  caja: ["caja", "pedidos", "clientes", "soporte"],
  /** Cocina, Almacén, Recetas; almacén con lectura reforzada vía almacen_lectura. */
  chef: ["cocina", "almacen", "recetas", "soporte", "almacen_lectura"],
  /** PWA Pedidos: salón + delivery; mesas y canales van dentro de Pedidos. */
  pedidos: ["pedidos", "soporte"],
  almacen: ["almacen", "proveedores", "recetas", "soporte"],
  marketing: ["reportes", "clientes", "productos", "soporte", "productos_lectura"],
  demo: [
    "pedidos",
    "caja",
    "cocina",
    "productos",
    "recetas",
    "proveedores",
    "clientes",
    "almacen",
    "ia",
    "soporte",
  ],
};

export function resolveUserRole(user) {
  if (!user) return "demo";
  const raw =
    (typeof user.app_metadata?.role === "string" && user.app_metadata.role.trim()) ||
    (typeof user.user_metadata?.role === "string" && user.user_metadata.role.trim()) ||
    "";
  if (!raw) return "demo";
  const shell = APP_ROLE_TO_SHELL[raw] || raw;
  if (shell && ROLE_PERMISSIONS[shell]) return shell;
  if (ROLE_PERMISSIONS[raw]) return raw;
  return "demo";
}

export function resolveUserPermissions(user, role) {
  const metaPerms = user?.user_metadata?.permissions;
  if (Array.isArray(metaPerms) && metaPerms.length > 0) {
    return metaPerms;
  }
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.demo;
}

export function isDemoRole(role) {
  return role === "demo";
}

export function isSuperadminRole(role) {
  return role === "superadmin";
}

/** Puede abrir módulo Accesos (lista de usuarios, roles, módulos) — superadmin o admin. */
export function isAccesosManagerRole(role) {
  return role === "superadmin" || role === "admin";
}

/** Módulo Configuración: solo admin y superadmin; operativos se redirigen. */
export function canAccessConfiguracion(role) {
  return role === "superadmin" || role === "admin";
}

export function getModulesByRole(role, permissions) {
  let perms = Array.isArray(permissions) && permissions.length > 0
    ? permissions
    : ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.demo;
  if (perms.includes("*")) {
    return NAV_ITEMS;
  }
  const fromExplicitList = Array.isArray(permissions) && permissions.length > 0;
  if (fromExplicitList) {
    const hasMenuEntry = perms.some((p) => NAV_MODULE_KEYS.has(p) || p === "dashboard");
    if (!hasMenuEntry) {
      perms = ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.demo;
    }
  }
  return NAV_ITEMS.filter((item) => item.key === "dashboard" || perms.includes(item.key));
}

export function getAssignableModules() {
  return MODULES;
}

export function getRoleLabel(role) {
  switch (role) {
    case "superadmin": return "Super Admin";
    case "admin": return "Administrador";
    case "caja": return "Caja";
    case "chef": return "Chef / Cocina";
    case "pedidos": return "Pedidos";
    case "almacen": return "Almacén";
    case "marketing": return "Marketing";
    case "soporte": return "Soporte";
    case "demo": return "Cuenta demo";
    default: return "Invitado";
  }
}

export function renderSidebar(target, activeKey, userRole = "admin", permissions = null) {
  if (!target) return;

  const allowedItems = getModulesByRole(userRole, permissions);
  const dashboardItem = allowedItems.find(i => i.key === "dashboard");
  const moduleItems = allowedItems.filter(i => i.key !== "dashboard");

  target.innerHTML = `
    <section class="sidebar-group">
      <span class="sidebar-group__label">Menu principal</span>
      <div class="sidebar-list">
        ${dashboardItem ? renderNavItem(dashboardItem, activeKey) : ''}
      </div>
    </section>
    <section class="sidebar-group">
      <span class="sidebar-group__label">Módulos</span>
      <div class="sidebar-list">
        ${moduleItems.map((item) => renderNavItem(item, activeKey)).join("")}
      </div>
    </section>
    <section class="sidebar-group">
      <span class="sidebar-group__label">Cuenta</span>
      <div class="sidebar-list">
        <button type="button" class="nav-item nav-item--logout" id="sidebarLogoutBtn">
          <span class="nav-item__icon" aria-hidden="true">
            <i data-lucide="log-out" style="width:20px;height:20px;color:var(--color-accent)"></i>
          </span>
          <span class="nav-item__text">
            <strong>Cerrar sesión</strong>
          </span>
        </button>
      </div>
    </section>
  `;

  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function renderNavItem(item, activeKey) {
  const isActive = item.key === activeKey;
  const iconName = item.icon || "circle";

  return `
    <a class="nav-item ${isActive ? "nav-item--active" : ""}" href="${toHref(item.path)}">
      <span class="nav-item__icon" aria-hidden="true">
        <i data-lucide="${iconName}" style="width:20px;height:20px;color:${isActive ? "#ffffff" : "var(--color-accent)"}"></i>
      </span>
      <span class="nav-item__text">
        <strong>${item.label}</strong>
      </span>
      <span class="nav-item__arrow" aria-hidden="true">›</span>
    </a>
  `;
}

export function initializeThemeToggle(button) {
  const storedTheme = localStorage.getItem(STORAGE_KEY);
  const initialTheme = storedTheme || document.body.dataset.theme || "light";

  // Siempre aplicamos el tema al cargar, haya botón o no
  applyTheme(initialTheme, button);

  if (button) {
    button.addEventListener("click", () => {
      const nextTheme = document.body.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(nextTheme, button);
    });
  }
}

function applyTheme(theme, button) {
  document.documentElement.dataset.theme = theme;
  document.body.dataset.theme = theme;
  localStorage.setItem(STORAGE_KEY, theme);

  if (button) {
    const isDark = theme === "dark";

    if (button.classList.contains("theme-fab")) {
      button.innerHTML = iconThemeFab(isDark);
      button.setAttribute("aria-pressed", String(isDark));
      return;
    }

    if (button.textContent && !button.querySelector("i, svg")) {
      button.textContent = isDark ? "Modo claro" : "Modo oscuro";
    }

    const icon = button.querySelector("[data-lucide]");
    if (icon) {
      icon.setAttribute("data-lucide", isDark ? "sun" : "moon");
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    button.setAttribute("aria-pressed", String(isDark));
  }
}
