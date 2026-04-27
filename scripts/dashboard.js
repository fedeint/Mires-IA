import { getModulesByRole, toHref } from "./navigation.js";
import { fetchDashboardSnapshot } from "./dashboard-metrics.js";
import { supabase } from "./supabase.js";
import { renderAdminOnboardingPanel } from "./mirest-onboarding.js";

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPen(value) {
  const n = Number(value) || 0;
  return `S/ ${n.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function salesDeltaText(salesToday, salesYesterday) {
  if (salesToday === 0 && salesYesterday === 0) return "Sin cobros registrados hoy";
  if (salesYesterday <= 0) return salesToday > 0 ? "Sin cobros de referencia ayer" : "Sin cobros hoy";
  const pct = Math.round(((salesToday - salesYesterday) / salesYesterday) * 1000) / 10;
  const sign = pct >= 0 ? "+" : "";
  return `${sign}${pct}% vs ayer (cobros)`;
}

function ticketDeltaText(avgToday, avgYesterday) {
  if (avgToday === 0 && avgYesterday === 0) return "Sin tickets calculados hoy";
  if (avgYesterday <= 0) return avgToday > 0 ? "Sin ticket de referencia ayer" : "Sin datos";
  const diff = Math.round((avgToday - avgYesterday) * 100) / 100;
  const sign = diff >= 0 ? "+" : "";
  return `${sign}${formatPen(diff)} vs ayer (promedio)`;
}

function buildHeroMetrics(snapshot) {
  const ordersDeltaParts = [
    snapshot.activeDelivery ? `${snapshot.activeDelivery} delivery` : null,
    snapshot.activeSalon ? `${snapshot.activeSalon} salón` : null,
    snapshot.activeTakeaway ? `${snapshot.activeTakeaway} para llevar` : null,
  ].filter(Boolean);
  const ordersDelta =
    ordersDeltaParts.length > 0 ? ordersDeltaParts.join(" · ") : "Sin pedidos activos en este momento";

  const stockDelta =
    snapshot.atRiskStockCount > 0
      ? `${snapshot.atRiskStockCount} ítem(s) bajo mínimo o crítico`
      : "Sin ítems de inventario en alerta";

  return [
    {
      value: formatPen(snapshot.salesToday),
      label: "Ventas de hoy (cobros)",
      delta: salesDeltaText(snapshot.salesToday, snapshot.salesYesterday),
      icon: "banknote",
      tone: "accent",
    },
    {
      value: String(snapshot.activeOrders),
      label: "Pedidos en curso",
      delta: ordersDelta,
      icon: "shopping-bag",
      tone: "info",
    },
    {
      value: formatPen(snapshot.avgTicketToday),
      label: "Ticket promedio (hoy)",
      delta: ticketDeltaText(snapshot.avgTicketToday, snapshot.avgTicketYesterday),
      icon: "receipt",
      tone: "success",
    },
    {
      value: String(snapshot.atRiskStockCount),
      label: "Insumos en riesgo",
      delta: stockDelta,
      icon: "package-open",
      tone: "warning",
    },
  ];
}

function buildOperationsCards(snapshot) {
  const pctOccupancy =
    snapshot.tablesTotal > 0
      ? Math.round((snapshot.tablesOccupied / snapshot.tablesTotal) * 1000) / 10
      : 0;

  return [
    {
      label: "Mesas ocupadas",
      value: snapshot.tablesTotal > 0 ? `${snapshot.tablesOccupied}/${snapshot.tablesTotal}` : "0/0",
      hint: snapshot.tablesTotal > 0 ? `Ocupación ${pctOccupancy}%` : "Sin mesas configuradas",
      icon: "utensils-crossed",
      tone: "accent",
      progress: snapshot.tablesTotal > 0 ? pctOccupancy : null,
      delta: snapshot.tablesTotal > 0 ? "Datos de comedor en tiempo real" : "Alta de mesas en el módulo Pedidos",
      trend: "neutral",
    },
    {
      label: "Delivery activo",
      value: String(snapshot.deliveryActive),
      hint: "Pedidos canal delivery no cerrados",
      icon: "bike",
      tone: "info",
      progress: null,
      delta: snapshot.deliveryActive > 0 ? "Pedidos en flujo delivery" : "Sin pedidos delivery activos",
      trend: "neutral",
    },
    {
      label: "Pedidos en cocina",
      value: String(snapshot.kitchenOrders),
      hint: "Órdenes en estado «en cocina»",
      icon: "timer",
      tone: "success",
      progress: null,
      delta: snapshot.kitchenOrders > 0 ? "En preparación ahora" : "Sin pedidos en cocina",
      trend: "neutral",
    },
  ];
}

function buildChecklistItems(snapshot) {
  /** @type {{ text: string; href: string; icon: string; priority: string }[]} */
  const items = [];

  if (snapshot.activeOrders > 0) {
    items.push({
      text: `${snapshot.activeOrders} pedido(s) activo(s)`,
      href: toHref("Pedidos/implementacion/Pedidos.html?module=pedidos"),
      icon: "list-checks",
      priority: snapshot.activeOrders >= 8 ? "alta" : "media",
    });
  }

  if (snapshot.atRiskStockCount > 0) {
    items.push({
      text: `${snapshot.atRiskStockCount} insumo(s) en alerta de stock`,
      href: toHref("Almacen/almacen.html"),
      icon: "package",
      priority: "alta",
    });
  }

  if (snapshot.openCashSessions > 0) {
    items.push({
      text: `Caja abierta (${snapshot.openCashSessions}) cerrar al fin del turno`,
      href: toHref("Caja/caja.html"),
      icon: "receipt",
      priority: "media",
    });
  }

  return items;
}

export async function initializeDashboard(profile, authUser) {
  const activeProfile = profile || window.currentUserProfile || {
    role: window.currentUserRole || "demo",
    isDemo: true,
    firstName: "Invitado",
  };

  const snapshot = await fetchDashboardSnapshot(supabase);

  renderDemoBanner(activeProfile);
  const onboardingHost = document.getElementById("adminOnboardingHost");
  renderAdminOnboardingPanel(onboardingHost, authUser || null, activeProfile);
  renderHeroMetrics(snapshot);
  renderOperationsSummary(snapshot);
  renderModuleGrid(activeProfile);
  renderInsights(snapshot, activeProfile);
  renderChecklist(snapshot);

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
      <p>Las métricas y tareas se calculan con datos reales de tu tenant; si aún no hay operación, verás ceros. Configuración y Accesos siguen restringidos según rol.</p>
    </div>
    <a class="btn btn--secondary" href="${toHref("login.html")}">
      <i data-lucide="user-plus"></i>
      Solicitar acceso real
    </a>
  `;
  host.prepend(banner);
}

function renderHeroMetrics(snapshot) {
  const target = document.getElementById("dashboardMetrics");
  if (!target) return;

  const rows = buildHeroMetrics(snapshot);
  const warnText =
    snapshot.warnings && snapshot.warnings.length > 0
      ? snapshot.warnings.slice(0, 2).join(" · ")
      : snapshot.loadError || "";
  const note = warnText
    ? `<p class="dashboard-metrics-note" style="grid-column: 1 / -1; font-size: 12px; color: var(--color-text-muted); margin: 0;">${escapeHtml(warnText)}</p>`
    : "";

  target.innerHTML =
    note +
    rows
      .map(
        (metric) => `
    <article class="stat-card stat-card--${metric.tone}">
      <span class="stat-card__icon" aria-hidden="true">
        <i data-lucide="${metric.icon}"></i>
      </span>
      <strong>${metric.value}</strong>
      <span>${metric.label}</span>
      <small class="stat-card__delta">${metric.delta}</small>
    </article>
  `,
      )
      .join("");
}

function renderOperationsSummary(snapshot) {
  const target = document.getElementById("systemHighlights");
  if (!target) return;

  const trendIcon = {
    up: "trending-up",
    down: "trending-down",
    neutral: "minus",
  };

  const items = buildOperationsCards(snapshot);

  target.innerHTML = items
    .map((item) => {
      const progressBar =
        typeof item.progress === "number"
          ? `<div class="ops-card__progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${item.progress}">
           <div class="ops-card__progress-bar" style="width: ${Math.min(100, Math.max(0, item.progress))}%;"></div>
         </div>`
          : `<div class="ops-card__progress ops-card__progress--empty"></div>`;

      return `
      <article class="ops-card ops-card--${item.tone}">
        <div class="ops-card__head">
          <span class="ops-card__icon" aria-hidden="true">
            <i data-lucide="${item.icon}"></i>
          </span>
          <span class="ops-card__trend ops-card__trend--${item.trend}">
            <i data-lucide="${trendIcon[item.trend] || "minus"}"></i>
          </span>
        </div>
        <div class="ops-card__body">
          <span class="ops-card__label">${item.label}</span>
          <strong class="ops-card__value">${item.value}</strong>
          <span class="ops-card__hint">${item.hint}</span>
        </div>
        ${progressBar}
        <small class="ops-card__delta">${item.delta}</small>
      </article>
    `;
    })
    .join("");
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

  target.innerHTML = allowed
    .map((module) => {
      const iconName = module.icon || "circle";
      return `
      <a class="module-card" href="${toHref(module.path)}">
        <div class="module-card__header">
          <span class="module-card__token">
            <i data-lucide="${iconName}" style="width:28px;height:28px;color:var(--color-accent)"></i>
          </span>
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
    })
    .join("");
}

function renderInsights(snapshot, profile) {
  const target = document.getElementById("insightsList");
  if (!target) return;

  const lines = [];

  if (snapshot.warnings && snapshot.warnings.length > 0) {
    lines.push({
      icon: "alert-triangle",
      tag: "Conexión parcial",
      text: snapshot.warnings.slice(0, 3).join(" · "),
    });
  } else if (snapshot.loadError) {
    lines.push({
      icon: "alert-circle",
      tag: "Sistema",
      text: `No se pudo completar la lectura de métricas: ${snapshot.loadError}`,
    });
  }

  lines.push({
    icon: "activity",
    tag: "Resumen",
    text: `Pedidos activos ${snapshot.activeOrders} · Cobros del día ${formatPen(snapshot.salesToday)}`,
  });

  if (profile?.isDemo) {
    lines.push({
      icon: "info",
      tag: "Demo",
      text: "Las cifras salen de tu base con RLS por tenant sin valores fijos en el front",
    });
  }

  target.innerHTML = lines
    .map(
      (item) => `
      <li class="insight-chip">
        <span class="insight-chip__icon" aria-hidden="true">
          <i data-lucide="${item.icon || "sparkles"}"></i>
        </span>
        <div class="insight-chip__body">
          ${item.tag ? `<span class="insight-chip__tag">${escapeHtml(item.tag)}</span>` : ""}
          <p>${escapeHtml(item.text)}</p>
        </div>
      </li>
    `,
    )
    .join("");
}

function renderChecklist(snapshot) {
  const target = document.getElementById("operationalChecklist");
  if (!target) return;

  const items = buildChecklistItems(snapshot);
  const total = items.length;
  const percent = 0;

  const progressHost = document.getElementById("checklistProgress");
  if (progressHost) {
    if (total === 0) {
      progressHost.innerHTML = `
      <div class="checklist-progress__meta">
        <span>Sin tareas operativas pendientes</span>
        <span class="checklist-progress__percent">—</span>
      </div>
      <div class="checklist-progress__bar checklist-progress__bar--empty" role="presentation">
        <div class="checklist-progress__fill" style="width:0%;"></div>
      </div>
    `;
    } else {
      progressHost.innerHTML = `
      <div class="checklist-progress__meta">
        <span><strong>${total}</strong> acción(es) sugerida(s) por datos reales</span>
        <span class="checklist-progress__percent">Pendiente</span>
      </div>
      <div class="checklist-progress__bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
        <div class="checklist-progress__fill" style="width:${percent}%;"></div>
      </div>
    `;
    }
  }

  if (items.length === 0) {
    target.innerHTML = `
      <li class="action-row action-row--informational" data-priority="baja">
        <span class="action-row__icon" aria-hidden="true"><i data-lucide="check-circle-2"></i></span>
        <div class="action-row__body">
          <p>Sin alertas pedidos inventario y caja en calma</p>
        </div>
      </li>
    `;
    return;
  }

  target.innerHTML = items
    .map(
      (item) => `
      <li class="action-row" data-priority="${escapeHtml(item.priority)}">
        <span class="action-row__icon" aria-hidden="true">
          <i data-lucide="${escapeHtml(item.icon)}"></i>
        </span>
        <div class="action-row__body">
          <p><a href="${escapeHtml(item.href)}" style="color: inherit; font-weight: 600;">${escapeHtml(item.text)}</a></p>
          <span class="action-row__priority action-row__priority--${escapeHtml(item.priority)}">
            Prioridad ${escapeHtml(item.priority)}
          </span>
        </div>
      </li>
    `,
    )
    .join("");
}
