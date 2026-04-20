import { getModulesByRole, toHref } from "./navigation.js";

const DEMO_METRICS = [
  { value: "S/ 2,845", label: "Ventas de hoy", delta: "+12% vs ayer", icon: "banknote", tone: "accent" },
  { value: "18", label: "Pedidos en curso", delta: "8 delivery · 10 salón", icon: "shopping-bag", tone: "info" },
  { value: "S/ 42.10", label: "Ticket promedio", delta: "+S/ 3.40 vs ayer", icon: "receipt", tone: "success" },
  { value: "4", label: "Insumos en riesgo", delta: "Revisar almacén", icon: "package-open", tone: "warning" },
];

const DEMO_OPERATIONS = [
  { label: "Mesas activas", value: "12/18", hint: "Ocupación 67%" },
  { label: "Delivery en ruta", value: "6", hint: "Tiempo estimado 22 min" },
  { label: "Tiempo cocina", value: "14 min", hint: "Objetivo < 18 min" },
];

const DEMO_INSIGHTS = {
  admin: [
    "Activa el módulo de reportes para ver márgenes por categoría.",
    "Tu ticket promedio subió S/ 3.40. Revisa qué promociones ayudaron.",
    "Cuatro insumos bajaron del stock mínimo. Genera orden de compra.",
  ],
  caja: [
    "Cierra caja con el reporte Z antes de salir de turno.",
    "Reconcilia Yape/Plin con el total cobrado hoy.",
    "Registra las cortesías para no descuadrar el inventario.",
  ],
  chef: [
    "Prioriza pedidos con más de 12 minutos en cola.",
    "Revisa el stock de insumos antes del rush de la noche.",
    "Usa el módulo de recetas para mantener porciones estándar.",
  ],
  pedidos: [
    "Asigna delivery por zona para reducir tiempos de entrega.",
    "Actualiza el estado de los pedidos en cada fase operativa.",
    "Las rutas largas suman más de 35 min, considera redistribuirlas.",
  ],
  almacen: [
    "Revisa el reporte de insumos críticos antes de cerrar el día.",
    "Registra las mermas con motivo para mejorar la trazabilidad.",
    "Agenda el conteo cíclico cada lunes al abrir.",
  ],
  marketing: [
    "Los clientes frecuentes crecieron 8% esta semana.",
    "Lanza una promoción para el segundo turno de la noche.",
    "Activa el módulo de IA para segmentar campañas por historial.",
  ],
  demo: [
    "Estás viendo datos de demostración. Conecta tu punto de venta para ver datos reales.",
    "Explora los módulos: Pedidos, Caja, Cocina, Productos y más.",
    "Los módulos de Configuración y Accesos están reservados al administrador.",
  ],
};

const DEMO_CHECKLIST = {
  demo: [
    { text: "Solicita tu acceso real desde la pantalla de login", done: false },
    { text: "Explora Pedidos y Caja con datos de ejemplo", done: true },
    { text: "Prueba el asistente IA desde el botón de DalIA", done: false },
  ],
  default: [
    { text: "Revisar pedidos pendientes del turno", done: false },
    { text: "Reponer insumos marcados como críticos", done: false },
    { text: "Cuadrar caja antes del cierre", done: false },
    { text: "Actualizar carta de productos con novedades", done: true },
  ],
};

export function initializeDashboard(profile) {
  const activeProfile = profile || window.currentUserProfile || {
    role: window.currentUserRole || "demo",
    isDemo: true,
    firstName: "Invitado",
  };

  renderDemoBanner(activeProfile);
  renderHeroMetrics();
  renderOperationsSummary();
  renderModuleGrid(activeProfile);
  renderInsights(activeProfile);
  renderChecklist(activeProfile);

  if (window.lucide) window.lucide.createIcons();
}

function renderDemoBanner(profile) {
  const host = document.querySelector(".dashboard");
  if (!host) return;

  const existing = document.getElementById("demoBanner");
  if (!profile.isDemo) {
    existing?.remove();
    return;
  }

  if (existing) return;

  const banner = document.createElement("aside");
  banner.id = "demoBanner";
  banner.className = "demo-banner";
  banner.innerHTML = `
    <div class="demo-banner__icon" aria-hidden="true">
      <i data-lucide="sparkles"></i>
    </div>
    <div class="demo-banner__copy">
      <strong>Estás navegando como cuenta demo</strong>
      <p>Los datos que ves son de ejemplo. Configuración, Accesos, Facturación y Reportes están reservados para administradores con credenciales reales.</p>
    </div>
    <a class="btn btn--secondary" href="${toHref("login.html")}">
      <i data-lucide="user-plus"></i>
      Solicitar acceso real
    </a>
  `;
  host.prepend(banner);
}

function renderHeroMetrics() {
  const target = document.getElementById("dashboardMetrics");
  if (!target) return;

  target.innerHTML = DEMO_METRICS.map((metric) => `
    <article class="stat-card stat-card--${metric.tone}">
      <span class="stat-card__icon" aria-hidden="true">
        <i data-lucide="${metric.icon}"></i>
      </span>
      <strong>${metric.value}</strong>
      <span>${metric.label}</span>
      <small class="stat-card__delta">${metric.delta}</small>
    </article>
  `).join("");
}

function renderOperationsSummary() {
  const target = document.getElementById("systemHighlights");
  if (!target) return;

  target.innerHTML = DEMO_OPERATIONS.map((item) => `
    <article class="highlight-card">
      <strong>${item.value}</strong>
      <span>${item.label}</span>
      <small style="color: var(--color-text-muted); font-size: 12px;">${item.hint}</small>
    </article>
  `).join("");
}

function renderModuleGrid(profile) {
  const target = document.getElementById("moduleGrid");
  if (!target) return;

  const allowed = getModulesByRole(profile.role, profile.permissions).filter((item) => item.key !== "dashboard");

  if (allowed.length === 0) {
    target.innerHTML = `
      <article class="module-card module-card--empty">
        <h3>Sin módulos asignados</h3>
        <p>Tu rol actual no tiene módulos operativos visibles. Contacta al administrador para ajustar tus permisos.</p>
      </article>
    `;
    return;
  }

  target.innerHTML = allowed.map((module) => {
    const iconName = module.icon || "circle";
    return `
      <a class="module-card" href="${toHref(module.path)}">
        <div class="module-card__header">
          <span class="module-card__token">
            <i data-lucide="${iconName}" style="width:28px;height:28px;color:var(--color-accent)"></i>
          </span>
          <span class="chip chip--soft">Activo</span>
        </div>
        <h3>${module.label}</h3>
        <p style="font-size: 13px; color: var(--color-text-muted); line-height: 1.45; margin-top: 4px;">
          ${module.description}
        </p>
        <div class="module-card__footer" style="margin-top: 12px;">
          <span class="module-card__cta">Entrar al módulo →</span>
        </div>
      </a>
    `;
  }).join("");
}

function renderInsights(profile) {
  const target = document.getElementById("insightsList");
  if (!target) return;

  const insights = DEMO_INSIGHTS[profile.role] || DEMO_INSIGHTS.demo;
  target.innerHTML = insights.map((item) => `<li>${item}</li>`).join("");
}

function renderChecklist(profile) {
  const target = document.getElementById("operationalChecklist");
  if (!target) return;

  const items = profile.isDemo ? DEMO_CHECKLIST.demo : DEMO_CHECKLIST.default;
  target.innerHTML = items.map((item) => `
    <li class="${item.done ? "check-list__item--done" : ""}">${item.text}</li>
  `).join("");
}
