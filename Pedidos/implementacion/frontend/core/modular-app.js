import {
  advanceDeliveryStatus,
  advanceTakeawayStatus,
  completeOrderPayment,
  ensureSafeNavigationState,
  getFilteredTables,
  getLastOperationalContext,
  getModulesByCurrentRole,
  getSelectedDeliveryOrder,
  getSelectedTable,
  getSelectedTakeawayOrder,
  getState,
  getTurnStats,
  issueInvoiceFromDraft,
  markSessionClosed,
  persistSession,
  prepareInvoiceDraftFromSource,
  refData,
  returnToLastOperationalContext,
  restoreSession,
  selectDeliveryOrder,
  selectRound,
  selectTable,
  selectTakeawayOrder,
  setActiveModule,
  setDashboardSection,
  setActiveZone,
  setMode,
  setSearchQuery,
  setUserName,
  setUserRole,
  togglePrinterStatus,
  updateInvoiceDraft,
  updatePaymentDraft,
  updateTableStatus,
  subscribe,
  loadOperationalCatalog,
} from './app-state.js';
import {
  escapeHtml,
  formatCurrency,
  getNextStatus,
  getOrderItemsCount,
  getOrderTotal,
} from './ui-helpers.js';
import { clearOnboardingCompleted, lsRemove, STORAGE_KEYS } from './storage.js';
import {
  initOnboarding,
  initOnboardingPOST,
  initOnboardingPRE,
  restartOnboardingPRO,
} from '../modules/pedidos/onboarding.js';
import { renderFacturasModule } from '../modules/facturas/index.js';
import { renderConfiguracionModule, renderPrinterCenter } from '../modules/configuracion/index.js';
import { renderCajaModule } from '../modules/caja/index.js';
import { renderMenuModule } from '../modules/menu/index.js';
import { renderCocinaModule } from '../modules/cocina/index.js';
import { renderVentasModule } from '../modules/ventas/index.js';
import { renderAlmacenModule } from '../modules/almacen/index.js';
import { renderSalonModule } from '../modules/pedidos/salon/index.js';
import { renderDeliveryModule } from '../modules/pedidos/delivery/index.js';
import { renderTakeawayModule } from '../modules/pedidos/takeaway/index.js';

const THEME_KEYS = ['mirest_theme', 'mirest-theme'];

const MODE_META = {
  salon: {
    eyebrow: 'Operación en salón',
    heroTitle: 'Salón en vivo',
    heroCopy: 'Controla mesas, ocupación y continuidad del servicio sin salir del workspace principal.',
    pill: 'Mesa + pedido + estado',
  },
  delivery: {
    eyebrow: 'Seguimiento de delivery',
    heroTitle: 'Despachos en curso',
    heroCopy: 'Monitorea tiempos, canales y entrega final en una sola pizarra operativa.',
    pill: 'Tiempo + canal + pago',
  },
  takeaway: {
    eyebrow: 'Recojos del turno',
    heroTitle: 'Para llevar ordenado',
    heroCopy: 'Agrupa pedidos por etapa para reducir retrasos y confirmar la salida correcta.',
    pill: 'Promesa + recojo + cobro',
  },
};

const MODULE_META = {
  pedidos: { title: 'Pedidos', eyebrow: 'Operación multicanal', heroTitle: 'Pedidos', heroCopy: 'Gestiona salón, delivery y recojo desde un solo flujo.' },
  facturas: { title: 'Facturas', eyebrow: 'SAT México', heroTitle: 'Facturas', heroCopy: 'Emite facturas y revisa historial tributario del día.' },
  configuracion: { title: 'Configuración', eyebrow: 'Ajustes del sistema', heroTitle: 'Configuración', heroCopy: 'Ticketera, facturadora, tutoriales y sesión.' },
  caja: { title: 'Caja', eyebrow: 'Atención rápida', heroTitle: 'Caja', heroCopy: 'Registra pedidos para llevar y monitorea notificaciones.' },
  menu: { title: 'Menú', eyebrow: 'Carta del día', heroTitle: 'Menú', heroCopy: 'Consulta productos disponibles y no disponibles.' },
  cocina: { title: 'Cocina', eyebrow: 'Producción', heroTitle: 'Cocina', heroCopy: 'Sigue pedidos en proceso y marca su salida.' },
  ventas: { title: 'Ventas', eyebrow: 'Indicadores', heroTitle: 'Ventas', heroCopy: 'Visualiza ingresos y utilidad estimada.' },
  almacen: { title: 'Almacén', eyebrow: 'Inventario', heroTitle: 'Almacén', heroCopy: 'Controla extras, recetas e insumos.' },
};

let refs;
let initialized = false;

function cacheRefs() {
  refs = {
    body: document.body,
    appShell: document.getElementById('appShell'),
    sidebar: document.getElementById('appSidebar'),
    sidebarBackdrop: document.getElementById('sidebarBackdrop'),
    sidebarToggle: document.getElementById('sidebarToggle'),
    topbarEyebrow: document.getElementById('topbarEyebrow'),
    topbarTitle: document.getElementById('topbarTitle'),
    modeSwitcher: document.getElementById('modeSwitcher'),
    themeToggle: document.getElementById('themeToggle'),
    modeHero: document.getElementById('modeHero'),
    summaryStats: document.getElementById('summaryStats'),
    workspaceHeader: document.getElementById('workspaceHeader'),
    workspaceToolbar: document.getElementById('workspaceToolbar'),
    workspaceContent: document.getElementById('workspaceContent'),
    managementPanel: document.getElementById('managementPanel'),
    workspaceLayout: document.getElementById('workspaceLayout'),
    userChip: document.getElementById('userChip'),
  };
}

function readTheme() {
  for (const key of THEME_KEYS) {
    const stored = localStorage.getItem(key);
    if (stored === 'light' || stored === 'dark') return stored;
  }
  return document.body.dataset.theme || 'light';
}

function persistTheme(theme) {
  THEME_KEYS.forEach((key) => localStorage.setItem(key, theme));
}

function applyTheme(theme) {
  refs.body.dataset.theme = theme;
  if (refs.themeToggle) refs.themeToggle.checked = theme === 'dark';
  persistTheme(theme);
}

function closeSidebar() {
  refs.body.classList.remove('sidebar-open');
  refs.sidebar?.classList.remove('sidebar--open');
  refs.sidebarToggle?.setAttribute('aria-expanded', 'false');
}

function openSidebar() {
  refs.body.classList.add('sidebar-open');
  refs.sidebar?.classList.add('sidebar--open');
  refs.sidebarToggle?.setAttribute('aria-expanded', 'true');
}

function openPrinterCenter() {
  document.getElementById('printerCenterOverlay')?.remove();
  document.getElementById('printerCenterModal')?.remove();

  const overlay = document.createElement('div');
  overlay.id = 'printerCenterOverlay';
  overlay.className = 'modal-overlay';

  const card = document.createElement('div');
  card.id = 'printerCenterModal';
  card.className = 'modal printer-center-modal';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'Centro de impresoras');
  card.innerHTML = renderPrinterCenter(getState());

  const close = () => {
    overlay.remove();
    card.remove();
    document.body.classList.remove('modal-open');
  };

  const modalRoot = document.getElementById('modalRoot') || document.body;
  modalRoot.appendChild(overlay);
  modalRoot.appendChild(card);
  document.body.classList.add('modal-open');

  overlay.addEventListener('click', close);
  card.querySelector('[data-close-printer-center]')?.addEventListener('click', close);
}

function showToast(title, message, tone = 'info') {
  if (typeof window._mirestShowToast === 'function') {
    window._mirestShowToast({ title, message, tone });
    return;
  }
  console.info(`[toast:${tone}] ${title} — ${message}`);
}

function performSessionLogout() {
  markSessionClosed();
  [
    STORAGE_KEYS.ONBOARDING_PRE,
    STORAGE_KEYS.ONBOARDING_SEEN,
    STORAGE_KEYS.LAST_SEEN,
    STORAGE_KEYS.SESSION,
    STORAGE_KEYS.APP_SESSION,
    'mirest_pedidos_session',
  ].forEach((key) => lsRemove(key));
  window.location.reload();
}

function openLogoutSessionGuide() {
  document.getElementById('logoutSessionOverlay')?.remove();
  document.getElementById('logoutSessionModal')?.remove();

  const state = getState();
  const stats = getTurnStats();
  const frontsActive = stats.ocupadas + stats.dlPending + stats.twPending;
  const userName = state.userName || 'Equipo';
  const checklist = [
    {
      id: 'handoff',
      title: 'Revise pendientes del turno',
      helper: 'Confirme si deja mesas, delivery o para llevar a otro compañero antes de salir.',
    },
    {
      id: 'cash',
      title: 'Deje claro cualquier cobro pendiente',
      helper: 'Si hubo efectivo o una factura por cerrar, ya lo comuniqué a caja o al siguiente turno.',
    },
    {
      id: 'station',
      title: 'Estación lista para el relevo',
      helper: 'La sesión se limpiará en este dispositivo y el siguiente ingreso volverá a empezar con nombre y checklist.',
    },
  ];

  const overlay = document.createElement('div');
  overlay.id = 'logoutSessionOverlay';
  overlay.className = 'modal-overlay';

  const card = document.createElement('div');
  card.id = 'logoutSessionModal';
  card.className = 'modal logout-session-modal';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'true');
  card.setAttribute('aria-label', 'Cerrar sesion de mesero');
  card.innerHTML = `
    <div class="modal__header">
      <div>
        <p class="eyebrow" style="margin-bottom:4px">Sesión</p>
        <h3 class="modal__title">Cerrar turno de ${escapeHtml(userName)}</h3>
      </div>
      <button type="button" class="icon-btn icon-btn--ghost" id="logoutSessionClose" aria-label="Cerrar">
        ×
      </button>
    </div>
    <div class="modal__body">
      <p class="logout-session-modal__intro">
        Antes de salir, revisa rápido el estado del turno. Esto funciona como un cierre corto de POS: validar pendientes, dejar la estación lista y luego limpiar la cuenta del dispositivo.
      </p>

      <div class="logout-session-modal__summary">
        <article class="logout-session-modal__metric">
          <strong>${stats.ocupadas}</strong>
          <span>Mesas ocupadas</span>
        </article>
        <article class="logout-session-modal__metric">
          <strong>${stats.dlPending}</strong>
          <span>Delivery activos</span>
        </article>
        <article class="logout-session-modal__metric">
          <strong>${stats.twPending}</strong>
          <span>Recojos pendientes</span>
        </article>
      </div>

      ${frontsActive > 0 ? `
        <div class="logout-session-modal__alert">
          Aun hay frentes activos en el local. Si otro companero seguira con la operacion, puedes cerrar tu cuenta despues de avisarle y dejar el relevo claro.
        </div>
      ` : ''}

      <div class="logout-session-modal__checklist">
        ${checklist.map((item) => `
          <label class="logout-session-modal__check" data-logout-check-row="${escapeHtml(item.id)}">
            <input type="checkbox" data-logout-check="${escapeHtml(item.id)}" />
            <span>
              <strong>${escapeHtml(item.title)}</strong>
              <small>${escapeHtml(item.helper)}</small>
            </span>
          </label>
        `).join('')}
      </div>

      <p class="logout-session-modal__note">
        Al confirmar, esta sesión operativa se limpiará y el siguiente ingreso volverá a mostrar el PRE y el recorrido PRO del mesero.
      </p>
    </div>
    <div class="modal__footer">
      <button type="button" class="btn btn--ghost" id="logoutSessionCancel">Volver al turno</button>
      <button type="button" class="btn btn--danger" id="logoutSessionConfirm" disabled>Cerrar sesión</button>
    </div>
  `;

  const close = () => {
    overlay.remove();
    card.remove();
    document.body.classList.remove('modal-open');
  };

  const syncConfirmState = () => {
    const checks = [...card.querySelectorAll('[data-logout-check]')].filter((input) => input instanceof HTMLInputElement);
    checks.forEach((input) => {
      const row = card.querySelector(`[data-logout-check-row="${input.dataset.logoutCheck || ''}"]`);
      row?.classList.toggle('is-complete', input.checked);
    });

    const allChecked = checks.length > 0 && checks.every((input) => input.checked);
    const confirmButton = card.querySelector('#logoutSessionConfirm');
    if (confirmButton instanceof HTMLButtonElement) {
      confirmButton.disabled = !allChecked;
    }
  };

  document.body.appendChild(overlay);
  document.body.appendChild(card);
  document.body.classList.add('modal-open');

  overlay.addEventListener('click', close);
  card.querySelector('#logoutSessionClose')?.addEventListener('click', close);
  card.querySelector('#logoutSessionCancel')?.addEventListener('click', close);
  card.querySelector('#logoutSessionConfirm')?.addEventListener('click', performSessionLogout);
  card.querySelectorAll('[data-logout-check]').forEach((input) => {
    input.addEventListener('change', syncConfirmState);
  });

  syncConfirmState();
}

function renderPwaModuleStrip(activeModule) {
  const ids = getModulesByCurrentRole();
  if (ids.length < 2) {
    return { html: '', show: false };
  }
  const html = ids
    .map((id) => {
      const meta = MODULE_META[id] || { title: id };
      const active = id === activeModule;
      return `<button type="button" class="pwa-module-pill${active ? " is-active" : ""}" data-open-module="${id}" data-nav-module="${id}"><span class="pwa-module-pill__t">${escapeHtml(
        meta.title,
      )}</span></button>`;
    })
    .join("");
  return { html, show: true };
}

function renderModeSwitcher(activeMode) {
  return `
    <div class="mode-switcher" role="tablist" aria-label="Selector de área operativa">
      ${['salon', 'delivery', 'takeaway'].map((mode) => `
        <button
          type="button"
          class="mode-switch ${activeMode === mode ? 'is-active' : ''}"
          data-set-mode="${mode}"
          role="tab"
          aria-selected="${String(activeMode === mode)}"
        >
          ${mode === 'salon' ? '🍽️ Salón' : mode === 'delivery' ? '🛵 Delivery' : '📦 Para llevar'}
        </button>
      `).join('')}
    </div>
  `;
}

function renderHero(mode, stats) {
  const meta = MODE_META[mode] || MODE_META.salon;
  return `
    <div class="mode-hero">
      <div>
        <p class="eyebrow">${meta.eyebrow}</p>
        <h2>${meta.heroTitle}</h2>
        <p>${meta.heroCopy}</p>
      </div>
      <div class="mode-hero__pills">
        <span class="mode-pill">${meta.pill}</span>
        <span class="mode-pill">${stats.ocupadas} mesas activas</span>
      </div>
    </div>
  `;
}

function renderSummary(stats, state) {
  const deliverySales = state.deliveryOrders
    .filter((order) => order.paymentConfirmed || order.documentIssued || order.status === 'entregado')
    .reduce((total, order) => total + (Number(order.total) || 0), 0);
  const takeawaySales = state.takeawayOrders
    .filter((order) => order.paymentConfirmed || order.documentIssued || order.status === 'entregado')
    .reduce((total, order) => total + (Number(order.total) || 0), 0);
  const salonSales = state.tables.reduce((total, table) => (
    total + getOrderTotal(table.order?.items || [], refData.products)
  ), 0);

  const cards = [
    { tone: 'accent', value: `${stats.ocupadas}/${state.tables.length}`, label: 'Mesas ocupadas', helper: `${stats.libres} libres` },
    { tone: 'info', value: String(stats.dlPending), label: 'Delivery en curso', helper: 'Pedidos pendientes y preparando' },
    { tone: 'warning', value: String(stats.twPending), label: 'Para llevar activos', helper: 'Recojos aún no entregados' },
    { tone: 'success', value: formatCurrency(salonSales + deliverySales + takeawaySales), label: 'Venta registrada', helper: 'Cobrados y consumo activo' },
  ];

  return cards.map((card) => `
    <article class="summary-card summary-card--${card.tone}">
      <div class="summary-card__body">
        <strong>${card.value}</strong>
        <p>${card.label}</p>
        <span>${card.helper}</span>
      </div>
    </article>
  `).join('');
}

function renderWorkspaceHeader(mode) {
  const meta = MODE_META[mode] || MODE_META.salon;
  return `
    <div class="workspace-heading">
      <h3>${meta.heroTitle}</h3>
      <p>${meta.eyebrow}</p>
    </div>
    <div class="workspace-heading__actions">
      <button type="button" class="btn btn--secondary btn--sm" data-open-guide>
        Guía rápida
      </button>
    </div>
  `;
}

function renderStandaloneHeader(moduleId) {
  const meta = MODULE_META[moduleId] || MODULE_META.pedidos;
  const operationalContext = getLastOperationalContext();
  const shouldShowBackToOrders = moduleId === 'facturas';
  return `
    <div class="workspace-heading">
      <h3>${meta.heroTitle}</h3>
      <p>${meta.eyebrow}</p>
    </div>
    ${shouldShowBackToOrders ? `
      <div class="workspace-heading__actions">
        <button type="button" class="btn btn--secondary btn--sm" data-return-operational>
          Volver a ${operationalContext.mode === 'delivery' ? 'Delivery' : operationalContext.mode === 'takeaway' ? 'Para llevar' : 'Salón'}
        </button>
      </div>
    ` : ''}
  `;
}

function renderFallbackWorkspace(error) {
  console.error('[render] Se aplicó fallback seguro:', error);
  return {
    toolbar: '',
    content: `
      <div class="empty-state" role="status">
        <div class="empty-state__icon" aria-hidden="true">🧭</div>
        <h3>No se pudo cargar la vista</h3>
        <p>Volvimos al inicio operativo para mantener el turno activo.</p>
      </div>
    `,
    panel: '',
    singleColumn: true,
    hideHero: false,
    hideSummary: false,
    workspaceHeader: renderWorkspaceHeader('salon'),
  };
}

function renderCurrentMode() {
  const state = getState();
  const stats = getTurnStats();
  const selectedTable = getSelectedTable();
  const selectedDeliveryOrder = getSelectedDeliveryOrder();
  const selectedTakeawayOrder = getSelectedTakeawayOrder();
  const filteredTables = getFilteredTables();

  if (state.activeModule === 'facturas') {
    return {
      toolbar: '',
      content: renderFacturasModule({ state }),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('facturas'),
    };
  }

  if (state.activeModule === 'configuracion') {
    return {
      toolbar: '',
      content: renderConfiguracionModule({ state }),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('configuracion'),
    };
  }

  if (state.activeModule === 'caja') {
    return {
      toolbar: '',
      content: renderCajaModule(),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('caja'),
    };
  }

  if (state.activeModule === 'menu') {
    return {
      toolbar: '',
      content: renderMenuModule({ refData }),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('menu'),
    };
  }

  if (state.activeModule === 'cocina') {
    return {
      toolbar: '',
      content: renderCocinaModule({ state }),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('cocina'),
    };
  }

  if (state.activeModule === 'ventas') {
    return {
      toolbar: '',
      content: renderVentasModule({ state }),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('ventas'),
    };
  }

  if (state.activeModule === 'almacen') {
    return {
      toolbar: '',
      content: renderAlmacenModule(),
      panel: '',
      singleColumn: true,
      hideHero: true,
      hideSummary: true,
      workspaceHeader: renderStandaloneHeader('almacen'),
    };
  }

  if (state.mode === 'delivery') {
    return renderDeliveryModule({
      state,
      selectedOrder: selectedDeliveryOrder,
      refData,
    });
  }

  if (state.mode === 'takeaway') {
    return renderTakeawayModule({
      state,
      selectedOrder: selectedTakeawayOrder,
      refData,
    });
  }

  return renderSalonModule({
    state,
    stats,
    tables: filteredTables,
    selectedTable,
    refData,
  });
}

function renderApp() {
  ensureSafeNavigationState();
  let state = getState();
  let stats = getTurnStats();
  let meta = state.activeModule === 'pedidos'
    ? (MODE_META[state.mode] || MODE_META.salon)
    : (MODULE_META[state.activeModule] || MODULE_META.pedidos);
  let currentView;
  try {
    currentView = renderCurrentMode();
  } catch (error) {
    setActiveModule('pedidos');
    setMode('salon');
    persistSession();
    currentView = renderFallbackWorkspace(error);
    state = getState();
    stats = getTurnStats();
    meta = state.activeModule === 'pedidos'
      ? (MODE_META[state.mode] || MODE_META.salon)
      : (MODULE_META[state.activeModule] || MODULE_META.pedidos);
  }
  if (!currentView || typeof currentView !== 'object') {
    currentView = renderFallbackWorkspace(new Error('Vista inválida'));
    state = getState();
    stats = getTurnStats();
    meta = state.activeModule === 'pedidos'
      ? (MODE_META[state.mode] || MODE_META.salon)
      : (MODULE_META[state.activeModule] || MODULE_META.pedidos);
  }
  const shouldHideModeHero = state.activeModule === 'pedidos' || Boolean(currentView.hideHero);

  refs.body.dataset.mode = state.mode;
  refs.body.dataset.module = state.activeModule;
  refs.appShell.dataset.mode = state.mode;
  refs.workspaceLayout.dataset.mode = state.mode;
  refs.topbarEyebrow.textContent = meta.eyebrow;
  refs.topbarTitle.textContent = meta.title;
  if (refs.modeSwitcher) refs.modeSwitcher.innerHTML = state.activeModule === 'pedidos' ? renderModeSwitcher(state.mode) : '';
  const pwaStrip = document.getElementById("pwaModuleStrip");
  if (pwaStrip) {
    const { html, show } = renderPwaModuleStrip(state.activeModule);
    pwaStrip.innerHTML = html;
    pwaStrip.toggleAttribute("hidden", !show);
  }
  refs.modeHero.style.display = shouldHideModeHero ? 'none' : '';
  refs.summaryStats.style.display = currentView.hideSummary ? 'none' : '';
  refs.modeHero.innerHTML = shouldHideModeHero ? '' : renderHero(state.mode, stats);
  refs.summaryStats.innerHTML = currentView.hideSummary ? '' : renderSummary(stats, state);
  refs.workspaceHeader.innerHTML = currentView.workspaceHeader || renderWorkspaceHeader(state.mode);
  refs.workspaceToolbar.innerHTML = currentView.toolbar;
  refs.workspaceContent.innerHTML = currentView.content;
  refs.managementPanel.innerHTML = currentView.panel;
  refs.workspaceLayout.classList.toggle('workspace-layout--single', Boolean(currentView.singleColumn));
  refs.managementPanel.classList.toggle('is-hidden', Boolean(currentView.singleColumn));
  document.title = `MiRest con IA · ${meta.heroTitle}`;

  // Transición suave de 200ms
  if (refs.workspaceLayout.animate) {
    refs.workspaceLayout.animate([
      { opacity: 0.4 },
      { opacity: 1 }
    ], { duration: 200, easing: 'ease-out' });
  }

  const isPedidosActive = document.querySelector('[data-nav-module="pedidos"]');
  if (isPedidosActive) isPedidosActive.setAttribute('aria-current', 'page');
}

function handleModeChange(mode) {
  setMode(mode);
  setActiveModule('pedidos');
  persistSession();
  renderApp();
  closeSidebar();
}

function openDashboardSection(section) {
  setDashboardSection(section);
  if (section === 'overview') {
    setActiveModule('pedidos');
  } else if (section === 'factura') {
    setActiveModule('facturas');
  } else if (section === 'configuracion') {
    setActiveModule('configuracion');
  }
  closeSidebar();
  persistSession();
  renderApp();
}

function openMenuPickerModal() {
  const state = getState();
  const selectedTable = getSelectedTable();
  const modalRoot = document.getElementById('modalRoot');
  if (!modalRoot) return;

  const selectedJourney = selectedTable ? state.tableJourneys?.[selectedTable.id] : null;
  const selectedRound = selectedJourney?.rounds?.find((round) => round.id === state.selectedRoundId)
    || selectedJourney?.rounds?.find((round) => round.id === selectedJourney?.activeRoundId)
    || selectedJourney?.rounds?.[selectedJourney.rounds.length - 1]
    || null;

  modalRoot.innerHTML = `
    <div class="modal-overlay" data-close-menu-picker></div>
    <div class="modal modal--menu-picker" role="dialog" aria-modal="true" aria-label="Menú disponible para añadir pedido">
      <div class="modal__header">
        <div>
          <p class="eyebrow" style="margin-bottom:4px">Añadir pedido</p>
          <h3 class="modal__title">${escapeHtml(selectedTable ? `Mesa ${selectedTable.number}` : 'Menú del día')}</h3>
        </div>
        <button type="button" class="icon-btn icon-btn--ghost" data-close-menu-picker aria-label="Cerrar">×</button>
      </div>
      <div class="modal__body">
        ${renderMenuModule({
          refData,
          embedded: true,
          selectedContext: {
            tableNumber: selectedTable?.number || null,
            roundLabel: selectedRound?.label || null,
          },
        })}
      </div>
    </div>
  `;
}

function closeMenuPickerModal() {
  const modalRoot = document.getElementById('modalRoot');
  if (modalRoot) modalRoot.innerHTML = '';
}

function handleTableStatus(tableId, status) {
  const table = getState().tables.find((item) => item.id === tableId);
  const itemsCount = getOrderItemsCount(table?.order?.items || []);
  const canReleasePaidTable = Boolean(table?.order?.paymentConfirmed || table?.order?.documentIssued);

  if (status === 'libre' && itemsCount > 0 && !canReleasePaidTable) {
    showToast('Acción bloqueada', 'No se puede liberar una mesa con ítems activos en esta versión modular.', 'warning');
    return;
  }

  updateTableStatus(tableId, status);
  showToast('Mesa actualizada', `La mesa cambió a ${status}.`, 'success');
  renderApp();
}

function handleDeliveryAdvance(orderId, nextStatus) {
  if (!nextStatus) return;
  advanceDeliveryStatus(orderId, nextStatus);
  showToast('Delivery actualizado', `El pedido pasó a ${nextStatus}.`, 'success');
  renderApp();
}

function handleTakeawayAdvance(orderId, nextStatus) {
  if (!nextStatus) return;
  advanceTakeawayStatus(orderId, nextStatus);
  showToast('Recojo actualizado', `El pedido pasó a ${nextStatus}.`, 'success');
  renderApp();
}

function bindEvents() {
  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const modeButton = target.closest('[data-set-mode]');
    if (modeButton instanceof HTMLElement) {
      handleModeChange(modeButton.dataset.setMode);
      return;
    }

    const dashboardSectionButton = target.closest('[data-dashboard-section]');
    if (dashboardSectionButton instanceof HTMLElement) {
      openDashboardSection(dashboardSectionButton.dataset.dashboardSection);
      return;
    }

    if (target.closest('[data-return-operational]')) {
      const context = returnToLastOperationalContext();
      closeSidebar();
      renderApp();
      showToast(
        'Pedidos',
        `Volviste a ${context.mode === 'delivery' ? 'Delivery' : context.mode === 'takeaway' ? 'Para llevar' : 'Salón'}.`,
        'info',
      );
      return;
    }

    const openModuleButton = target.closest('[data-open-module]');
    if (openModuleButton instanceof HTMLElement) {
      if (openModuleButton.dataset.openModule === 'menu' && getState().activeModule === 'pedidos') {
        openMenuPickerModal();
        return;
      }

      setActiveModule(openModuleButton.dataset.openModule);
      renderApp();
      closeSidebar();
      return;
    }

    const tableButton = target.closest('[data-select-table]');
    if (tableButton instanceof HTMLElement) {
      selectTable(tableButton.dataset.selectTable || null);
      renderApp();
      return;
    }

    const roundButton = target.closest('[data-select-round]');
    if (roundButton instanceof HTMLElement) {
      selectRound(roundButton.dataset.selectRound || null);
      renderApp();
      return;
    }

    const deliveryButton = target.closest('[data-select-delivery]');
    if (deliveryButton instanceof HTMLElement) {
      selectDeliveryOrder(deliveryButton.dataset.selectDelivery || null);
      renderApp();
      return;
    }

    const takeawayButton = target.closest('[data-select-takeaway]');
    if (takeawayButton instanceof HTMLElement) {
      selectTakeawayOrder(takeawayButton.dataset.selectTakeaway || null);
      renderApp();
      return;
    }

    const zoneButton = target.closest('[data-set-zone]');
    if (zoneButton instanceof HTMLElement) {
      setActiveZone(zoneButton.dataset.setZone || 'all');
      persistSession();
      renderApp();
      return;
    }

    const tableStatusButton = target.closest('[data-update-table-status]');
    if (tableStatusButton instanceof HTMLElement) {
      handleTableStatus(
        tableStatusButton.dataset.tableId,
        tableStatusButton.dataset.updateTableStatus,
      );
      return;
    }

    const smartCheckoutButton = target.closest('[data-smart-checkout]');
    if (smartCheckoutButton instanceof HTMLElement) {
      const sourceId = smartCheckoutButton.dataset.sourceId;
      const pendingRounds = (getState().tableJourneys?.[sourceId]?.rounds || []).filter((round) => round.status === 'enviada');
      if (pendingRounds.length) {
        showToast('Rondas en cocina', 'Confirma cocina antes de cerrar la cuenta. Puedes continuar desde el bloque de cobro.', 'warning');
      } else {
        showToast('Cuenta lista', 'Revisa propina, comprobante y método de pago para cobrar.', 'info');
      }
      return;
    }

    const paymentMethodButton = target.closest('[data-payment-method]');
    if (paymentMethodButton instanceof HTMLElement) {
      const kind = paymentMethodButton.dataset.paymentKind;
      const sourceId = paymentMethodButton.dataset.paymentId;
      const method = paymentMethodButton.dataset.paymentMethod;
      if (kind === 'invoice') updateInvoiceDraft({ paymentMethod: method });
      else updatePaymentDraft(kind, sourceId, { paymentMethod: method });
      renderApp();
      return;
    }

    const paymentTipButton = target.closest('[data-payment-tip]');
    if (paymentTipButton instanceof HTMLElement) {
      const kind = paymentTipButton.dataset.paymentKind;
      const sourceId = paymentTipButton.dataset.paymentId;
      const tipRate = Number(paymentTipButton.dataset.paymentTip) || 0;
      const journey = kind === 'salon' ? getState().tableJourneys?.[sourceId] : null;
      const baseAmount = Number(journey?.bill?.total) || 0;
      const amount = Math.round((baseAmount * (1 + (tipRate / 100))) * 100) / 100;
      updatePaymentDraft(kind, sourceId, { tipRate, amount });
      renderApp();
      return;
    }

    const documentTypeButton = target.closest('[data-document-type]');
    if (documentTypeButton instanceof HTMLElement) {
      const kind = documentTypeButton.dataset.paymentKind;
      const sourceId = documentTypeButton.dataset.paymentId;
      const documentType = documentTypeButton.dataset.documentType;
      updatePaymentDraft(kind, sourceId, { documentType });
      if (documentType === 'factura') {
        prepareInvoiceDraftFromSource(kind, sourceId);
        setActiveModule('facturas');
        openSidebar();
        showToast('Facturación requerida', 'Se abrió el apartado Facturación para completar la factura.', 'info');
      }
      renderApp();
      return;
    }

    const processPaymentButton = target.closest('[data-process-payment]');
    if (processPaymentButton instanceof HTMLElement) {
      const result = completeOrderPayment(
        processPaymentButton.dataset.processPayment,
        processPaymentButton.dataset.sourceId,
      );
      if (result.redirectedToInvoice) {
        setActiveModule('facturas');
        openDashboardSection('factura');
        showToast('Pago redirigido', 'Completa la factura desde el dashboard para terminar el cobro.', 'warning');
      } else if (result.success) {
        showToast('Pago registrado', 'Se generó el ticket del pedido y quedó listo para boletero.', 'success');
        renderApp();
      }
      return;
    }

    const issueInvoiceButton = target.closest('[data-issue-invoice]');
    if (issueInvoiceButton instanceof HTMLElement) {
      const invoice = issueInvoiceFromDraft();
      if (invoice) {
        setActiveModule('facturas');
        openDashboardSection('factura');
        showToast('Factura emitida', `Se registró ${invoice.code} en el historial.`, 'success');
      }
      return;
    }

    const printInvoiceButton = target.closest('[data-print-invoice]');
    if (printInvoiceButton instanceof HTMLElement) {
      const invoiceId = printInvoiceButton.dataset.printInvoice;
      const invoice = getState().invoiceHistory.find((item) => item.id === invoiceId);
      const printer = getState().printers.factura;
      if (!invoice) {
        showToast('Factura no encontrada', 'No se pudo ubicar la factura seleccionada para impresión.', 'warning');
        return;
      }

      if (printer?.status !== 'connected') {
        showToast('Facturero desconectado', `Conecta ${printer?.name || 'la impresora de factura'} antes de imprimir ${invoice.code}.`, 'warning');
        return;
      }

      showToast('Enviado a impresión', `${invoice.code} fue enviado a ${printer.name}.`, 'success');
      return;
    }

    if (target.closest('[data-open-printer-center]')) {
      openPrinterCenter();
      return;
    }

    const togglePrinterButton = target.closest('[data-toggle-printer]');
    if (togglePrinterButton instanceof HTMLElement) {
      togglePrinterStatus(togglePrinterButton.dataset.togglePrinter);
      renderApp();
      if (document.getElementById('printerCenterModal')) openPrinterCenter();
      return;
    }

    const deliveryAdvanceButton = target.closest('[data-advance-delivery]');
    if (deliveryAdvanceButton instanceof HTMLElement) {
      handleDeliveryAdvance(
        deliveryAdvanceButton.dataset.advanceDelivery,
        deliveryAdvanceButton.dataset.nextStatus || getNextStatus(
          getState().deliveryOrders.find((order) => order.id === deliveryAdvanceButton.dataset.advanceDelivery)?.status,
          refData.deliveryStatusFlow,
        ),
      );
      return;
    }

    const takeawayAdvanceButton = target.closest('[data-advance-takeaway]');
    if (takeawayAdvanceButton instanceof HTMLElement) {
      handleTakeawayAdvance(
        takeawayAdvanceButton.dataset.advanceTakeaway,
        takeawayAdvanceButton.dataset.nextStatus || getNextStatus(
          getState().takeawayOrders.find((order) => order.id === takeawayAdvanceButton.dataset.advanceTakeaway)?.status,
          refData.takeawayStatusFlow,
        ),
      );
      return;
    }

    if (target.closest('[data-open-guide]')) {
      restartOnboardingPRO();
      return;
    }

    const relaunchOnboardingButton = target.closest('[data-relaunch-onboarding]');
    if (relaunchOnboardingButton instanceof HTMLElement) {
      const flow = relaunchOnboardingButton.dataset.relaunchOnboarding;
      if (flow === 'pre') {
        lsRemove(STORAGE_KEYS.ONBOARDING_PRE);
        clearOnboardingCompleted();
        initOnboardingPRE();
      }
      if (flow === 'pro') restartOnboardingPRO();
      if (flow === 'post') initOnboardingPOST();
      return;
    }

    if (target.closest('[data-start-salon-tutorial]')) {
      setActiveModule('pedidos');
      setMode('salon');
      persistSession();
      renderApp();
      closeSidebar();
      requestAnimationFrame(() => {
        requestAnimationFrame(() => restartOnboardingPRO());
      });
      return;
    }

    if (target.closest('[data-logout-session]')) {
      openLogoutSessionGuide();
      return;
    }

    if (target.closest('[data-close-menu-picker]')) {
      closeMenuPickerModal();
      return;
    }

    if (target.closest('#userChip')) {
      const nextTheme = refs.body.dataset.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
      showToast('Tema actualizado', `La interfaz cambió a modo ${nextTheme}.`, 'info');
    }
  });

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;

    if (target.id === 'salonSearch') {
      setSearchQuery(target.value);
      renderApp();
      return;
    }

    if (target.dataset.invoiceField) {
      updateInvoiceDraft({ [target.dataset.invoiceField]: target.value });
      return;
    }
  });

  window.addEventListener('mirest:set-mode', (event) => {
    handleModeChange(event.detail || 'salon');
  });

  window.addEventListener('mirest:onboarding-complete', (event) => {
    const detail = event.detail || {};
    setUserRole(detail.role || 'mesero');
    setUserName(detail.name || 'Equipo');
    setActiveModule(getModulesByCurrentRole()[0] || 'pedidos');
    renderApp();
  });

  refs.themeToggle?.addEventListener('change', () => {
    applyTheme(refs.themeToggle.checked ? 'dark' : 'light');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && refs.body.classList.contains('sidebar-open')) {
      closeSidebar();
    }
  });

  window.addEventListener('beforeunload', persistSession);

  document.addEventListener('scroll', () => {
    document.body.classList.toggle('has-scrolled', window.scrollY > 8);
  }, { passive: true });
}

export function initModularApp() {
  if (initialized) return;
  console.info('[modular-app] Inicializando runtime modular...');
  cacheRefs();
  console.debug('[modular-app] Referencias DOM cacheadas', refs);
  applyTheme(readTheme());
  console.debug('[modular-app] Tema aplicado', refs.body.dataset.theme);
  restoreSession();
  console.debug('[modular-app] Sesión restaurada', getState());
  bindEvents();
  console.debug('[modular-app] Eventos enlazados');
  renderApp();
  console.debug('[modular-app] Render inicial completado');
  initOnboarding();
  console.debug('[modular-app] Onboarding inicializado');
  subscribe('catalog', () => {
    try {
      renderApp();
    } catch (e) {
      console.warn('[modular-app] Re-render post-catálogo', e);
    }
  });
  void loadOperationalCatalog();
  initialized = true;
  console.info('[modular-app] Runtime modular activo ✓');
}
