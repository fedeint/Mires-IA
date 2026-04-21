export const APP_META = {
  name: "MiRest con IA",
  envLabel: "estructura colaborativa del frontend",
};

export const MODULES = [
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
    description: "Base de clientes, historial y experiencias de fidelización.",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de Clientes.",
    handoff: [
      "Construir el módulo de clientes sin duplicar estilos globales.",
      "Mantener nomenclatura clara para futuras vistas y componentes.",
      "Elevar al root solo mejoras que beneficien a todos los módulos.",
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
    key: "delivery-afiliados",
    label: "Delivery",
    short: "DA",
    icon: "truck",
    path: "Delivery/delivery.html",
    description: "Operación de delivery, marketplaces y afiliados externos.",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de DeliveryAfiliados.",
    handoff: [
      "Separar claramente estados de delivery, afiliados y marketplaces.",
      "Mantener consistencia visual con badges y tarjetas compartidas.",
      "Evitar lógica de negocio dentro del shell global del proyecto.",
    ],
  },
  {
    key: "facturacion",
    label: "Facturacion",
    short: "FC",
    icon: "file-text",
    path: "Facturacion/facturacion.html",
    description: "Comprobantes, emisión, control tributario y estados de venta.",
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
    path: "Pedidos/implementacion/pedidos.html",
    description: "Pedidos de salón, delivery y coordinación operativa central.",
    owner:
      "Este entry point queda reservado para el frontend definitivo del equipo de Pedidos.",
    handoff: [
      "Preparar vistas internas orientadas a velocidad y trazabilidad.",
      "Reutilizar estados, chips y estructura visual compartida.",
      "Evitar dependencias innecesarias con otros módulos en esta fase.",
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

const ADMIN_MODULE_KEYS = MODULES
  .filter((item) => item.key !== "accesos")
  .map((item) => item.key);

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

export const FEATURE_ACCESS_ITEMS = [
  {
    key: FEATURE_CAJA_MESEROS,
    label: "Caja: meseros y ranking",
    description: "Muestra el panel de meseros y el ranking del día dentro de Caja.",
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
  admin: ADMIN_MODULE_KEYS,
  caja: ["caja", "pedidos", "soporte"],
  chef: ["cocina", "recetas", "soporte"],
  pedidos: ["pedidos", "delivery-afiliados", "soporte"],
  almacen: ["almacen", "soporte"],
  marketing: ["clientes", "reportes", "ia", "soporte"],
  demo: [
    "pedidos",
    "caja",
    "cocina",
    "productos",
    "recetas",
    "clientes",
    "almacen",
    "ia",
    "soporte",
  ],
};

export const DEMO_EMAILS = new Set(["a@a.com"]);

export function resolveUserRole(user) {
  if (!user) return "demo";
  const email = (user.email || "").toLowerCase();
  if (DEMO_EMAILS.has(email)) return "demo";

  const metaRole =
    (typeof user.app_metadata?.role === "string" && user.app_metadata.role.trim()) ||
    (typeof user.user_metadata?.role === "string" && user.user_metadata.role.trim()) ||
    "";
  if (metaRole && ROLE_PERMISSIONS[metaRole]) return metaRole;

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

export function getModulesByRole(role, permissions) {
  const perms = Array.isArray(permissions) && permissions.length > 0
    ? permissions
    : ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.demo;
  if (perms.includes("*")) {
    return NAV_ITEMS;
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
    
    // Si el botón tiene texto (estilo antiguo), lo limpiamos si es un FAB
    if (button.classList.contains('theme-fab')) {
      button.textContent = ""; 
    } else if (button.textContent && !button.querySelector('i')) {
      button.textContent = isDark ? "Modo claro" : "Modo oscuro";
    }
    
    // Asegurar que el icono sea el correcto
    let icon = button.querySelector('[data-lucide]');
    if (!icon && button.classList.contains('theme-fab')) {
      button.innerHTML = `<i data-lucide="${isDark ? 'sun' : 'moon'}"></i>`;
      icon = button.querySelector('[data-lucide]');
    }

    if (icon) {
      icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
      if (window.lucide) {
        window.lucide.createIcons();
      }
    }

    button.setAttribute("aria-pressed", String(isDark));
  }
}
