import { renderDashboardHome } from './home.js';
import {
  escapeHtml,
  formatCurrency,
  formatDateTime,
  getPrinterStatusLabel,
  renderEmptyState,
  renderPaymentMethodButtons,
} from '../../core/ui-helpers.js';

export function buildDashboardSummary({ state, stats }) {
  const deliveryPending = state.deliveryOrders.filter((order) => order.status !== 'entregado').length;
  const takeawayPending = state.takeawayOrders.filter((order) => order.status !== 'entregado').length;
  const occupiedTables = state.tables.filter((table) => table.status === 'ocupada').length;

  return {
    greeting: 'Turno en curso',
    restaurantLabel: 'Resumen rápido de operación.',
    pendingCards: [
      {
        label: `${occupiedTables} mesas activas`,
        helper: 'Revisa atención en salón.',
        cta: 'Abrir salón',
        jumpMode: 'salon',
      },
      {
        label: `${deliveryPending} delivery pendientes`,
        helper: 'Monitorea despachos.',
        cta: 'Abrir delivery',
        jumpMode: 'delivery',
      },
      {
        label: `${takeawayPending} recojos activos`,
        helper: 'Controla salidas.',
        cta: 'Abrir para llevar',
        jumpMode: 'takeaway',
      },
    ],
    quickStats: {
      sales: `${stats.ocupadas + stats.dlPending + stats.twPending} frentes activos`,
      tables: `${stats.ocupadas} ocupadas / ${state.tables.length} totales`,
      delivery: `${stats.dlPending} operativos`,
      takeaway: `${stats.twPending} pendientes`,
    },
  };
}

export function renderDashboardPanel(payload) {
  return renderDashboardHome(buildDashboardSummary(payload));
}

export function renderDashboardNav({ state }) {
  if (state.activeModule !== 'pedidos') {
    return '';
  }

  const baseSections = [
    { id: 'overview', label: 'Resumen global', helper: 'Cifras y atajos', kind: 'section', target: 'overview' },
    { id: 'operacion', label: 'Operación', helper: 'Salón · Delivery · Recojo', kind: 'section', target: 'operacion' },
  ];
  const moduleItems = [
    { id: 'factura', label: 'Facturación', helper: `${state.invoiceHistory.length} emitidas`, kind: 'module', target: 'facturas' },
    { id: 'configuracion', label: 'Configuración', helper: 'Impresoras y sesión', kind: 'module', target: 'configuracion' },
  ];
  const items = [
    ...baseSections,
    ...moduleItems.filter((item) => state.visibleModules.includes(item.target)),
  ];

  return `
    <div class="sidebar__group dashboard-nav-shell" id="pedidosInModuleNav">
      <p class="sidebar__label">Pedidos — vistas</p>
      <nav class="sidebar__nav dashboard-nav-list" aria-label="Resumen y operación">
        ${items.map((item) => {
          const isActive = item.kind === 'section'
            ? state.activeModule === 'pedidos' && state.dashboardSection === item.target
            : state.activeModule === item.target;

          return `
          <button
            type="button"
            class="sidebar__item dashboard-nav__item ${isActive ? 'is-active' : ''}"
            ${item.kind === 'section'
              ? `data-dashboard-section="${escapeHtml(item.target)}"`
              : `data-open-module="${escapeHtml(item.target)}"`}
          >
            <div class="nav-icon" aria-hidden="true">${item.id === 'overview' ? 'RS' : item.id === 'operacion' ? 'OP' : item.id === 'factura' ? 'FC' : 'CF'}</div>
            <span>
              <strong>${escapeHtml(item.label)}</strong>
              <small>${escapeHtml(item.helper)}</small>
            </span>
          </button>
        `;
        }).join('')}
      </nav>
    </div>
  `;
}

function renderInvoiceSection({ state, refData }) {
  const draft = state.invoiceDraft;
  const printer = state.printers.factura;

  return `
    <section class="dashboard-section-card invoice-form-shell">
      <header class="dashboard-section-card__header">
        <div>
          <p class="sidebar__label">Factura</p>
          <h3>Emitir factura</h3>
        </div>
        <span class="badge badge--${printer.status === 'connected' ? 'success' : 'danger'}">${escapeHtml(getPrinterStatusLabel(printer.status))}</span>
      </header>

      <div class="invoice-form-grid">
        <label>
          <span class="field-label">Pedido origen</span>
          <input class="input" type="text" value="${escapeHtml(draft.orderCode || 'Pendiente de selección')}" data-invoice-field="orderCode" placeholder="Código del pedido">
        </label>
        <label>
          <span class="field-label">Cliente</span>
          <input class="input" type="text" value="${escapeHtml(draft.customer || '')}" data-invoice-field="customer" placeholder="Nombre o cliente">
        </label>
        <label>
          <span class="field-label">RUC / DNI</span>
          <input class="input" type="text" value="${escapeHtml(draft.documentNumber || '')}" data-invoice-field="documentNumber" placeholder="20123456789">
        </label>
        <label>
          <span class="field-label">Razón social</span>
          <input class="input" type="text" value="${escapeHtml(draft.businessName || '')}" data-invoice-field="businessName" placeholder="Razón social">
        </label>
        <label>
          <span class="field-label">Total</span>
          <input class="input" type="number" value="${escapeHtml(draft.total || 0)}" data-invoice-field="total" min="0" step="0.01">
        </label>
      </div>

      <div class="panel-stack">
        <div class="detail-row"><span>Impresora de factura</span><strong>${escapeHtml(printer.name)} · ${escapeHtml(getPrinterStatusLabel(printer.status))}</strong></div>
        <div>
          <span class="field-label">Método de pago asociado</span>
          ${renderPaymentMethodButtons({ methods: refData.desktopPaymentMethods, selectedId: draft.paymentMethod, kind: 'invoice', sourceId: 'invoice-draft' })}
        </div>
      </div>

      <button type="button" class="btn btn--primary" data-issue-invoice>
        Emitir factura y registrar pago
      </button>
    </section>
  `;
}

function renderInvoiceHistory(state) {
  if (!state.invoiceHistory.length) {
    return renderEmptyState({
      icon: '🧾',
      title: 'No hay facturas emitidas aún',
      description: 'Cuando registres una factura desde cualquier pedido, aparecerá aquí con sus datos clave.',
    });
  }

  return `
    <section class="dashboard-section-card invoice-history-shell">
      <header class="dashboard-section-card__header">
        <div>
          <p class="sidebar__label">Historial</p>
          <h3>Facturas emitidas</h3>
        </div>
        <strong>${state.invoiceHistory.length}</strong>
      </header>
      <div class="invoice-history-list">
        ${state.invoiceHistory.map((invoice) => `
          <article class="invoice-history-item">
            <div class="invoice-history-item__header">
              <strong>${escapeHtml(invoice.code)}</strong>
              <span class="badge badge--${invoice.printerStatus === 'Conectado' ? 'success' : 'warning'}">${escapeHtml(invoice.status)}</span>
            </div>
            <div class="detail-row"><span>Cliente</span><strong>${escapeHtml(invoice.customer)}</strong></div>
            <div class="detail-row"><span>Documento</span><strong>${escapeHtml(invoice.documentNumber)}</strong></div>
            <div class="detail-row"><span>Origen</span><strong>${escapeHtml(invoice.sourceLabel)}</strong></div>
            <div class="detail-row"><span>Total</span><strong>${formatCurrency(invoice.total)}</strong></div>
            <div class="detail-row"><span>Pago</span><strong>${escapeHtml(invoice.paymentMethod)}</strong></div>
            <div class="detail-row"><span>Impresora</span><strong>${escapeHtml(invoice.printerName)} · ${escapeHtml(invoice.printerStatus)}</strong></div>
            <div class="detail-row"><span>Fecha</span><strong>${escapeHtml(formatDateTime(invoice.issuedAt))}</strong></div>
          </article>
        `).join('')}
      </div>
    </section>
  `;
}

function renderSettingsSection(state) {
  const printerCards = Object.values(state.printers).map((printer) => `
    <article class="dashboard-section-card settings-card">
      <div class="settings-card__header">
        <div>
          <p class="sidebar__label">${escapeHtml(printer.role)}</p>
          <h3>${escapeHtml(printer.name)}</h3>
        </div>
        <span class="badge badge--${printer.status === 'connected' ? 'success' : 'danger'}">${escapeHtml(getPrinterStatusLabel(printer.status))}</span>
      </div>
      <div class="panel-stack">
        <div class="detail-row"><span>Modelo</span><strong>${escapeHtml(printer.model)}</strong></div>
        <div class="detail-row"><span>Ubicación</span><strong>${escapeHtml(printer.location)}</strong></div>
      </div>
      <button type="button" class="btn btn--secondary btn--sm" data-toggle-printer="${escapeHtml(printer.role)}">
        ${printer.status === 'connected' ? 'Marcar desconectada' : 'Marcar conectada'}
      </button>
    </article>
  `).join('');

  return `
    <section class="dashboard-section-card settings-shell">
      <header class="dashboard-section-card__header">
        <div>
          <p class="sidebar__label">Configuración</p>
          <h3>Impresoras y sesión</h3>
        </div>
      </header>

      <div class="settings-grid">
        ${printerCards}
      </div>

      <div class="dashboard-section-card settings-card">
        <div class="settings-card__header">
          <div>
            <p class="sidebar__label">Onboarding</p>
            <h3>Ayuda al usuario</h3>
          </div>
        </div>
        <div class="settings-actions">
          <button type="button" class="btn btn--ghost btn--sm" data-relaunch-onboarding="pre">Repetir PRE</button>
          <button type="button" class="btn btn--ghost btn--sm" data-relaunch-onboarding="pro">Repetir PRO</button>
          <button type="button" class="btn btn--ghost btn--sm" data-relaunch-onboarding="post">Repetir POST</button>
        </div>
      </div>

      <div class="dashboard-section-card settings-card settings-card--danger">
        <div class="settings-card__header">
          <div>
            <p class="sidebar__label">Sesión</p>
            <h3>Cerrar sesión</h3>
          </div>
        </div>
        <p class="workspace-note">Esto limpiará la sesión operativa y reabrirá el onboarding del usuario.</p>
        <button type="button" class="btn btn--danger" data-logout-session>Cerrar sesión</button>
      </div>
    </section>
  `;
}

export function renderDashboardContent({ state, stats, refData }) {
  if (state.activeModule === 'facturas' || state.dashboardSection === 'factura') {
    return `${renderInvoiceSection({ state, refData })}${renderInvoiceHistory(state)}`;
  }

  if (state.activeModule === 'configuracion' || state.dashboardSection === 'configuracion') {
    return renderSettingsSection(state);
  }

  if (state.activeModule === 'pedidos' && state.dashboardSection === 'operacion') {
    return '';
  }

  if (state.activeModule === 'pedidos' && state.dashboardSection === 'overview') {
    return renderDashboardPanel({ state, stats });
  }

  return renderDashboardPanel({ state, stats });
}
