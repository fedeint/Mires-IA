/**
 * app-state.js — MiRest con IA
 * Estado global del módulo Pedidos.
 * Centraliza toda la data reactiva y sus mutaciones.
 * Catálogo: solo Supabase (loadOperationalCatalog). Sin data.js.
 */

import {
  documentTypeOptions,
  initialTables,
  initialDeliveryOrders,
  initialTakeawayOrders,
  deliveryStatusFlow,
  takeawayStatusFlow,
  categories as defaultCategories,
  desktopPaymentMethods,
  desktopTipOptions,
  desktopRoundStatusMeta,
  desktopTableJourneys,
  statusMeta,
  deliveryStatusMeta,
  takeawayStatusMeta,
  kitchenBoardSeed,
  takeawayChatFeed,
} from "./operational-ui-config.js";

const defaultProducts = [];
const defaultRecipeAvailability = {};
const defaultWaiters = [];
const defaultCouriers = [];
const defaultDeliveryPartners = [];
import {
  getPersistedUserName,
  getPersistedUserRole,
  restoreAppSession,
  saveAppSession,
} from './storage.js';
import {
  advanceOperationalStatus,
  normalizeOrderState,
} from './order-state.js';
import { fetchMenuCatalog, fetchOperationalWaiters } from './catalog-fetch.js';

// ── Estado base ───────────────────────────────────────────────────

/** @typedef {'salon' | 'delivery' | 'takeaway'} AppMode */
/** @typedef {'libre' | 'ocupada' | 'reservada'} TableStatus */

const VALID_APP_MODES = ['salon', 'delivery', 'takeaway'];
const SAFE_DEFAULT_MODE = 'salon';
const SAFE_OPERATIONAL_MODULE = 'pedidos';
const SAFE_DASHBOARD_SECTION = 'overview';
const VALID_DASHBOARD_SECTIONS = ['overview', 'operacion', 'factura', 'configuracion'];

const ROLE_MODULES = {
  /** Alineado con el shell: admin / superadmin → PWA con stack completo. */
  dueno: ['pedidos', 'facturas', 'configuracion', 'caja', 'ventas', 'cocina', 'menu', 'almacen'],
  cajero: ['caja', 'pedidos', 'menu', 'configuracion'],
  /** Pedidos / salón: mesas, delivery y para llevar en el módulo Pedidos. */
  mesero: ['pedidos', 'menu', 'facturas', 'configuracion'],
  cocina: ['cocina', 'almacen', 'menu', 'configuracion'],
  almacenero: ['almacen', 'menu', 'ventas', 'configuracion'],
  marketing: ['ventas', 'menu', 'configuracion'],
};

const DEFAULT_MODULE_BY_ROLE = {
  dueno: 'pedidos',
  cajero: 'caja',
  mesero: 'pedidos',
  cocina: 'cocina',
  almacenero: 'almacen',
  marketing: 'ventas',
};

const SHELL_ROLE_TO_PWA = {
  superadmin: 'dueno',
  admin: 'dueno',
  caja: 'cajero',
  pedidos: 'mesero',
  chef: 'cocina',
  almacen: 'almacenero',
  marketing: 'marketing',
};

const restoredAppSession = restoreAppSession();
const persistedUserRole = getPersistedUserRole();
const persistedUserName = getPersistedUserName();

function getModulesForRole(role = 'mesero') {
  return ROLE_MODULES[role] || ROLE_MODULES.mesero;
}

function getPwaAllowlist() {
  if (typeof globalThis === 'undefined') {
    return null;
  }
  const a = globalThis.__MIREST_PWA_ALLOWLIST__;
  if (a == null) {
    return null;
  }
  return Array.isArray(a) ? a : null;
}

/**
 * Intersección de módulos del rol con la allowlist PWA (sesión Supabase + roles_config).
 * @param {string} role
 * @returns {string[]}
 */
function getVisibleModuleIdsForRole(role) {
  const base = getModulesForRole(role);
  const allow = getPwaAllowlist();
  if (allow == null) {
    return base;
  }
  const filtered = base.filter((m) => allow.includes(m));
  if (filtered.length) {
    return filtered;
  }
  if (allow.length === 0) {
    return [];
  }
  return base;
}

function getDefaultModuleForRole(role = 'mesero') {
  return DEFAULT_MODULE_BY_ROLE[role] || 'pedidos';
}

function normalizeMode(mode) {
  return VALID_APP_MODES.includes(mode) ? mode : SAFE_DEFAULT_MODE;
}

const PWA_INTERNAL_ROLES = new Set(['dueno', 'mesero', 'cocina', 'cajero', 'almacenero', 'marketing']);

function mapShellRoleToPwaRole(role) {
  if (role == null) return 'mesero';
  const r = String(role).trim();
  if (SHELL_ROLE_TO_PWA[r]) {
    return SHELL_ROLE_TO_PWA[r];
  }
  if (PWA_INTERNAL_ROLES.has(r)) {
    return r;
  }
  return 'mesero';
}

function normalizeRole(role) {
  const mapped = mapShellRoleToPwaRole(role);
  return ROLE_MODULES[mapped] ? mapped : 'mesero';
}

function normalizeActiveModule(moduleId, role = 'mesero') {
  const r = normalizeRole(role);
  const visibleModules = getVisibleModuleIdsForRole(r);
  if (!visibleModules.length) {
    return 'pedidos';
  }
  if (moduleId && visibleModules.includes(moduleId)) {
    return moduleId;
  }
  const d = getDefaultModuleForRole(r);
  if (visibleModules.includes(d)) {
    return d;
  }
  return visibleModules[0] || 'pedidos';
}

function normalizeDashboardSection(section) {
  return VALID_DASHBOARD_SECTIONS.includes(section) ? section : SAFE_DASHBOARD_SECTION;
}

function normalizeOperationalContext(context, fallbackMode = SAFE_DEFAULT_MODE) {
  return {
    activeModule: SAFE_OPERATIONAL_MODULE,
    mode: normalizeMode(context?.mode || fallbackMode),
    dashboardSection: SAFE_DASHBOARD_SECTION,
    savedAt: Number(context?.savedAt) || Date.now(),
  };
}

const initialUserRole = normalizeRole(
  (typeof globalThis !== 'undefined' && globalThis.__MIREST_PWA_RESOLVED_PWA_ROLE__) ||
  restoredAppSession?.userRole ||
  persistedUserRole
);
const initialMode = normalizeMode(restoredAppSession?.mode || document.body.dataset.mode || SAFE_DEFAULT_MODE);
const initialVisibleModules = getVisibleModuleIdsForRole(initialUserRole);
const initialActiveModule = (() => {
  const m = restoredAppSession?.activeModule;
  if (m && initialVisibleModules.includes(m)) {
    return m;
  }
  if (initialVisibleModules.length) {
    return initialVisibleModules[0];
  }
  return normalizeActiveModule(restoredAppSession?.activeModule, initialUserRole);
})();
const initialDashboardSection = normalizeDashboardSection(restoredAppSession?.dashboardSection || SAFE_DASHBOARD_SECTION);

/**
 * Catálogo y operadores (hidrata solo desde Supabase en loadOperationalCatalog).
 * @type {{
 *  products: Array<Record<string, unknown>>,
 *  categories: Array<{ id: string, name: string }>,
 *  recipeAvailability: Record<string, unknown>,
 *  waiters: Array<{ id: string, name: string, shift?: string }>,
 *  couriers: Array<{ id: string, name: string, vehicle?: string }>,
 *  deliveryPartners: Array<{ id: string, name: string }>
 *  }}
 */
export const refData = {
  products: structuredClone(defaultProducts),
  categories: structuredClone(defaultCategories),
  recipeAvailability: { ...defaultRecipeAvailability },
  waiters: structuredClone(defaultWaiters),
  couriers: structuredClone(defaultCouriers),
  deliveryPartners: structuredClone(defaultDeliveryPartners),
  documentTypeOptions,
  deliveryStatusFlow,
  takeawayStatusFlow,
  desktopPaymentMethods,
  desktopTipOptions,
  desktopRoundStatusMeta,
  statusMeta,
  deliveryStatusMeta,
  takeawayStatusMeta,
  roleModules: ROLE_MODULES,
};

const PRODUCTS_MAP = new Map();
function rebuildProductsMap() {
  PRODUCTS_MAP.clear();
  for (const p of refData.products) {
    PRODUCTS_MAP.set(p.id, p);
  }
}
rebuildProductsMap();
const PAYMENT_METHOD_LABELS = Object.fromEntries(desktopPaymentMethods.map((method) => [method.id, method.label]));

function normalizeTableState(table) {
  return {
    ...table,
    order: normalizeOrderState(table.order || {}, 'salon'),
  };
}

const _state = {
  /** Modo operativo activo */
  mode: /** @type {AppMode} */ (initialMode),

  /** Mesas del salón */
  tables: structuredClone(initialTables).map(normalizeTableState),

  /** Pedidos de delivery */
  deliveryOrders: structuredClone(initialDeliveryOrders).map((order) => normalizeOrderState(order, 'delivery')),

  /** Pedidos para llevar */
  takeawayOrders: structuredClone(initialTakeawayOrders).map((order) => normalizeOrderState(order, 'takeaway')),

  /** Mesa seleccionada actualmente */
  selectedTableId: /** @type {string | null} */ (null),

  /** Ronda seleccionada dentro de la mesa activa */
  selectedRoundId: /** @type {string | null} */ (null),

  /** Pedido de delivery seleccionado */
  selectedDeliveryOrderId: /** @type {string | null} */ (null),

  /** Pedido para llevar seleccionado */
  selectedTakeawayOrderId: /** @type {string | null} */ (null),

  /** Pestaña de zona activa en salón */
  activeZone: 'all',

  /** Filtro de búsqueda activo */
  searchQuery: '',

  /** Historial de cambios para undo (hasta 20) */
  _history: /** @type {Array<{ action: string, payload: any }>} */ ([]),

  /** Viajes de mesa (rondas, cuentas, pagos) */
  tableJourneys: structuredClone(desktopTableJourneys),

  /** Tickets de cocina visibles desde Pedidos */
  kitchenTickets: structuredClone(kitchenBoardSeed),

  /** Chat feed de para llevar */
  chatFeed: structuredClone(takeawayChatFeed),

  /** Conteo de alertas de cocina pendientes */
  kitchenAlertCount: 0,

  /** Sección activa del dashboard */
  dashboardSection: initialDashboardSection,

  /** Módulo principal activo según rol */
  activeModule: initialActiveModule,

  /** Rol operativo del usuario */
  userRole: initialUserRole,

  /** Nombre del usuario */
  userName: restoredAppSession?.userName || persistedUserName,

  /** Módulos visibles según rol (y recorte PWA) */
  visibleModules: initialVisibleModules,

  /** Último contexto operativo seguro para volver desde facturación/configuración */
  lastOperationalContext: normalizeOperationalContext(restoredAppSession?.lastOperationalContext, initialMode),

  /** Draft de factura */
  invoiceDraft: {
    sourceType: '',
    sourceId: '',
    orderCode: '',
    customer: '',
    documentNumber: '',
    businessName: '',
    total: 0,
    paymentMethod: 'efectivo',
    notes: '',
  },

  /** Historial de facturas emitidas (se alimenta con flujos reales de caja / facturación) */
  invoiceHistory: [],

  /** Impresoras configuradas */
  printers: {
    boletero: {
      id: 'printer-boletero',
      role: 'boletero',
      name: 'Boletero Epson',
      model: 'Epson TM-T20III',
      status: 'connected',
      location: 'Caja principal',
    },
    factura: {
      id: 'printer-factura',
      role: 'factura',
      name: 'Facturador Epson',
      model: 'Epson L4260',
      status: 'disconnected',
      location: 'Back office',
    },
  },

  /** Tickets de pago generados */
  paymentReceipts: {
    salon: {},
    delivery: {},
    takeaway: {},
  },

  /** Sesión actual */
  session: {
    currentUserName: restoredAppSession?.userName || persistedUserName,
    role: restoredAppSession?.userRole || persistedUserRole,
    startedAt: Date.now(),
    status: 'active',
  },
};

// ── Suscriptores ──────────────────────────────────────────────────

/** @type {Map<string, Set<Function>>} */
const _subscribers = new Map();

/**
 * Recarga productos, categorías, resumen de recetas y meseros desde Supabase.
 */
export async function loadOperationalCatalog() {
  try {
    const menu = await fetchMenuCatalog();
    if (menu.ok) {
      refData.products = menu.products;
      refData.categories = menu.categories;
      refData.recipeAvailability = menu.recipeAvailability || {};
      rebuildProductsMap();
    }
    const team = await fetchOperationalWaiters();
    if (team.ok) {
      refData.waiters = team.waiters;
    }
  } catch (e) {
    console.warn('[mirest] Hidratación de catálogo operativo omitida', e);
  } finally {
    emit('catalog');
  }
}

/**
 * Suscribirse a cambios de una key del state.
 * @param {string} key
 * @param {Function} callback
 * @returns {() => void} unsubscribe
 */
export function subscribe(key, callback) {
  if (!_subscribers.has(key)) _subscribers.set(key, new Set());
  _subscribers.get(key).add(callback);
  return () => _subscribers.get(key)?.delete(callback);
}

/** Emitir un cambio a todos los suscriptores de una key. */
function emit(key) {
  _subscribers.get(key)?.forEach(cb => {
    try { cb(getState(key)); } catch (e) { console.error('[state] Error en subscriber:', e); }
  });
}

// ── Getters ───────────────────────────────────────────────────────

/**
 * Obtener el estado completo o una key específica.
 * @param {string} [key]
 */
export function getState(key) {
  if (!key) return _state;
  return _state[key];
}

/** Mesa seleccionada actualmente. */
export function getSelectedTable() {
  if (!_state.selectedTableId) return null;
  return _state.tables.find(t => t.id === _state.selectedTableId) ?? null;
}

/** Pedido de delivery seleccionado. */
export function getSelectedDeliveryOrder() {
  if (!_state.selectedDeliveryOrderId) return null;
  return _state.deliveryOrders.find(o => o.id === _state.selectedDeliveryOrderId) ?? null;
}

/** Pedido para llevar seleccionado. */
export function getSelectedTakeawayOrder() {
  if (!_state.selectedTakeawayOrderId) return null;
  return _state.takeawayOrders.find(o => o.id === _state.selectedTakeawayOrderId) ?? null;
}

/** Journey de la mesa (rondas, cuenta, pago). */
export function getTableJourney(tableId) {
  return _state.tableJourneys[tableId] ?? null;
}

/** Mesas filtradas por zona y búsqueda. */
export function getFilteredTables() {
  let tables = _state.tables;
  if (_state.activeZone && _state.activeZone !== 'all') {
    tables = tables.filter(t => t.zone === _state.activeZone);
  }
  if (_state.searchQuery) {
    const q = _state.searchQuery.toLowerCase();
    tables = tables.filter((t) => {
      const waiterName = refData.waiters.find((waiter) => waiter.id === t.waiterId)?.name || '';
      return [
        t.number,
        t.zone,
        t.description,
        t.status,
        waiterName,
      ].some((value) => String(value || '').toLowerCase().includes(q));
    });
  }
  return tables;
}

/** Estadísticas del turno calculadas desde el estado. */
export function getTurnStats() {
  const ocupadas = _state.tables.filter(t => t.status === 'ocupada').length;
  const libres   = _state.tables.filter(t => t.status === 'libre').length;
  const dlPending = _state.deliveryOrders.filter(
    o => o.status === 'pendiente' || o.status === 'preparando'
  ).length;
  const twPending = _state.takeawayOrders.filter(
    o => o.status !== 'entregado'
  ).length;

  return { ocupadas, libres, dlPending, twPending };
}

export function getModulesByCurrentRole() {
  return _state.visibleModules;
}

export function getLastOperationalContext() {
  return { ..._state.lastOperationalContext };
}

export function rememberOperationalContext(patch = {}) {
  _state.lastOperationalContext = normalizeOperationalContext({
    ..._state.lastOperationalContext,
    ...patch,
    mode: patch.mode || _state.mode,
    savedAt: Date.now(),
  }, _state.mode);
  emit('lastOperationalContext');
  return getLastOperationalContext();
}

export function returnToLastOperationalContext() {
  const context = normalizeOperationalContext(_state.lastOperationalContext, _state.mode);
  _state.activeModule = SAFE_OPERATIONAL_MODULE;
  _state.dashboardSection = 'operacion';
  setMode(context.mode);
  rememberOperationalContext(context);
  emit('activeModule');
  emit('dashboardSection');
  persistSession();
  return getLastOperationalContext();
}

export function ensureSafeNavigationState() {
  let repaired = false;
  if (_state.activeModule === "delivery-afiliados") {
    _state.activeModule = SAFE_OPERATIONAL_MODULE;
    setMode("delivery");
    repaired = true;
  }
  const safeMode = normalizeMode(_state.mode);
  const safeRole = normalizeRole(_state.userRole);
  const safeModules = getVisibleModuleIdsForRole(safeRole);
  const safeModule = normalizeActiveModule(_state.activeModule, safeRole);
  const safeSection = normalizeDashboardSection(_state.dashboardSection);

  if (_state.mode !== safeMode) {
    _state.mode = safeMode;
    document.body.dataset.mode = safeMode;
    emit('mode');
    repaired = true;
  }

  if (_state.userRole !== safeRole) {
    _state.userRole = safeRole;
    _state.session.role = safeRole;
    emit('userRole');
    repaired = true;
  }

  if (_state.visibleModules !== safeModules) {
    _state.visibleModules = safeModules;
    emit('visibleModules');
    repaired = true;
  }

  if (_state.activeModule !== safeModule) {
    _state.activeModule = safeModule;
    emit('activeModule');
    repaired = true;
  }

  if (_state.dashboardSection !== safeSection) {
    _state.dashboardSection = safeSection;
    emit('dashboardSection');
    repaired = true;
  }

  if (_state.activeModule === SAFE_OPERATIONAL_MODULE) {
    rememberOperationalContext({ mode: _state.mode });
  }

  return repaired;
}

function countItems(items = []) {
  return items.reduce((total, item) => total + (Number(item?.quantity) || 0), 0);
}

function calcItemsTotal(items = []) {
  return Math.round(items.reduce((total, item) => {
    const price = Number(PRODUCTS_MAP.get(item?.productId)?.price) || 0;
    const quantity = Number(item?.quantity) || 0;
    return total + (price * quantity);
  }, 0) * 100) / 100;
}

function normalizePaymentMethod(value = '') {
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return 'efectivo';
  if (normalized.includes('codi')) return 'yape';
  if (normalized.includes('spei')) return 'plin';
  if (normalized.includes('yape')) return 'yape';
  if (normalized.includes('plin')) return 'plin';
  if (normalized.includes('transfer')) return 'transferencia';
  if (normalized.includes('tarjeta')) return 'tarjeta';
  if (normalized.includes('efectivo')) return 'efectivo';
  return normalized;
}

function getPaymentMethodLabel(method = '') {
  const methodId = normalizePaymentMethod(method);
  return PAYMENT_METHOD_LABELS[methodId] || method || 'Pendiente';
}

function getPrinterStatusLabel(status = 'disconnected') {
  return status === 'connected' ? 'Conectado' : 'Desconectado';
}

function resolveOrderSource(kind, sourceId) {
  if (kind === 'salon') {
    const table = _state.tables.find((item) => item.id === sourceId);
    if (!table) return null;
    const journey = _state.tableJourneys[sourceId] ?? null;
    const order = table.order ?? { items: [] };
    return {
      kind,
      id: sourceId,
      table,
      journey,
      order,
      orderCode: `Mesa ${table.number}`,
      customer: `Mesa ${table.number}`,
      documentNumber: order.customerDocument || '',
      businessName: order.businessName || '',
      total: Number(journey?.paymentDraft?.amount) || Number(journey?.bill?.total) || calcItemsTotal(order.items || []),
      itemsCount: countItems(order.items || []),
      notes: table.description || '',
      paymentMethod: normalizePaymentMethod(journey?.paymentDraft?.method || order.paymentMethod || order.paymentLabel),
      documentType: journey?.paymentDraft?.documentType || order.documentType || 'boleta',
    };
  }

  if (kind === 'delivery') {
    const order = _state.deliveryOrders.find((item) => item.id === sourceId);
    if (!order) return null;
    return {
      kind,
      id: sourceId,
      order,
      orderCode: order.code || order.id,
      customer: order.customer,
      documentNumber: order.customerDocument || '',
      businessName: order.businessName || '',
      total: Number(order.total) || 0,
      itemsCount: Number(order.itemsCount) || 0,
      notes: order.note || '',
      paymentMethod: normalizePaymentMethod(order.paymentMethod || order.paymentLabel),
      documentType: order.documentType || 'boleta',
    };
  }

  if (kind === 'takeaway') {
    const order = _state.takeawayOrders.find((item) => item.id === sourceId);
    if (!order) return null;
    return {
      kind,
      id: sourceId,
      order,
      orderCode: order.code || order.id,
      customer: order.customer,
      documentNumber: order.customerDocument || '',
      businessName: order.businessName || '',
      total: Number(order.total) || 0,
      itemsCount: Number(order.itemsCount) || 0,
      notes: order.note || '',
      paymentMethod: normalizePaymentMethod(order.paymentMethod || order.paymentLabel),
      documentType: order.documentType || 'boleta',
    };
  }

  return null;
}

function buildTicketReceipt(kind, sourceId, invoiceCode = '') {
  const source = resolveOrderSource(kind, sourceId);
  if (!source) return null;

  const printer = _state.printers.boletero;
  return {
    id: `receipt-${kind}-${sourceId}-${Date.now()}`,
    orderCode: source.orderCode,
    customer: source.customer,
    methodLabel: getPaymentMethodLabel(source.paymentMethod),
    documentType: source.documentType,
    documentTypeLabel: source.documentType === 'factura' ? (invoiceCode || 'Factura') : 'Boleta',
    createdAt: Date.now(),
    printerName: printer.name,
    printerStatus: getPrinterStatusLabel(printer.status),
    lines: [
      { label: 'Origen', value: kind === 'salon' ? 'Salón' : kind === 'delivery' ? 'Delivery' : 'Para llevar' },
      { label: 'Ítems', value: String(source.itemsCount || 0) },
      { label: 'Total', value: `S/ ${(Number(source.total) || 0).toFixed(2)}` },
      { label: source.documentType === 'factura' ? 'Comprobante' : 'Estado', value: source.documentType === 'factura' ? (invoiceCode || 'Pendiente') : 'Pago registrado' },
    ],
  };
}

function syncSourcePayment(source, overrides = {}) {
  const paymentMethod = normalizePaymentMethod(overrides.paymentMethod || source.paymentMethod);
  const documentType = overrides.documentType || source.documentType || 'boleta';

  if (source.kind === 'salon') {
    source.order.paymentConfirmed = true;
    source.order.paymentStatus = 'paid';
    source.order.paymentMethod = paymentMethod;
    source.order.paymentLabel = getPaymentMethodLabel(paymentMethod);
    source.order.documentType = documentType;
    source.order.documentIssued = documentType === 'boleta' ? true : Boolean(overrides.documentIssued);
    source.order.invoiceStatus = source.order.documentIssued ? 'issued' : (documentType === 'factura' ? 'pending' : 'not_required');
    if (Array.isArray(source.journey?.rounds)) {
      source.journey.rounds = source.journey.rounds.map((round) => ({
        ...round,
        isPaid: true,
      }));
    }
    if (source.journey?.paymentDraft) {
      source.journey.paymentDraft.method = paymentMethod;
      source.journey.paymentDraft.documentType = documentType;
      source.journey.paymentDraft.amount = Number(source.total) || source.journey.paymentDraft.amount;
    }
    emit('tables');
    emit('tableJourneys');
    return;
  }

  source.order.paymentConfirmed = true;
  source.order.paymentStatus = 'paid';
  source.order.paymentMethod = paymentMethod;
  source.order.paymentLabel = getPaymentMethodLabel(paymentMethod);
  source.order.documentType = documentType;
  source.order.documentIssued = documentType === 'boleta' ? true : Boolean(overrides.documentIssued);
  source.order.invoiceStatus = source.order.documentIssued ? 'issued' : (documentType === 'factura' ? 'pending' : 'not_required');
  emit(source.kind === 'delivery' ? 'deliveryOrders' : 'takeawayOrders');
}

// ── Mutaciones ────────────────────────────────────────────────────

/**
 * Cambiar el modo operativo global.
 * @param {AppMode} mode
 */
export function setMode(mode) {
  const safeMode = normalizeMode(mode);
  _state.mode = safeMode;
  document.body.dataset.mode = safeMode;
  // Limpiar selecciones al cambiar de modo
  _state.selectedTableId = null;
  _state.selectedRoundId = null;
  _state.selectedDeliveryOrderId = null;
  _state.selectedTakeawayOrderId = null;
  if (_state.activeModule === SAFE_OPERATIONAL_MODULE) {
    rememberOperationalContext({ mode: safeMode });
  }
  emit('mode');
  emit('selectedTableId');
  emit('selectedRoundId');
  emit('selectedDeliveryOrderId');
  emit('selectedTakeawayOrderId');
}

export function setUserRole(role) {
  _state.userRole = normalizeRole(role || 'mesero');
  _state.visibleModules = getVisibleModuleIdsForRole(_state.userRole);
  _state.activeModule = normalizeActiveModule(_state.activeModule, _state.userRole);
  _state.session.role = _state.userRole;
  emit('userRole');
  emit('visibleModules');
  emit('activeModule');
  persistSession();
}

export function setUserName(name) {
  _state.userName = name || 'Equipo';
  _state.session.currentUserName = _state.userName;
  emit('userName');
  emit('session');
  persistSession();
}

/**
 * @param {string} moduleId
 * @param {{ preserveDashboard?: boolean }} [options] Al entrar a Pedidos desde otro módulo, si `true` no fuerza
 *  la sección a "Resumen" (mantiene overview u operación ya fijada por setDashboardSection).
 */
export function setActiveModule(moduleId, options = {}) {
  const { preserveDashboard = false } = options;
  if (_state.activeModule === SAFE_OPERATIONAL_MODULE) {
    rememberOperationalContext({ mode: _state.mode });
  }
  const previousModule = _state.activeModule;
  const safeModule = normalizeActiveModule(moduleId, _state.userRole);
  _state.activeModule = safeModule;
  if (safeModule === SAFE_OPERATIONAL_MODULE) {
    if (previousModule !== SAFE_OPERATIONAL_MODULE && !preserveDashboard) {
      _state.dashboardSection = SAFE_DASHBOARD_SECTION;
    }
    rememberOperationalContext({ mode: _state.mode });
    emit('dashboardSection');
  }
  emit('activeModule');
  persistSession();
}

export function setDashboardSection(section) {
  _state.dashboardSection = normalizeDashboardSection(section || SAFE_DASHBOARD_SECTION);
  emit('dashboardSection');
}

/**
 * Seleccionar mesa.
 * @param {string | null} tableId
 */
export function selectTable(tableId) {
  _state.selectedTableId = tableId;
  _state.selectedRoundId = null;
  emit('selectedTableId');
  emit('selectedRoundId');
}

/**
 * Seleccionar ronda de una mesa.
 * @param {string | null} roundId
 */
export function selectRound(roundId) {
  _state.selectedRoundId = roundId;
  emit('selectedRoundId');
}

/**
 * Seleccionar pedido de delivery.
 * @param {string | null} orderId
 */
export function selectDeliveryOrder(orderId) {
  _state.selectedDeliveryOrderId = orderId;
  emit('selectedDeliveryOrderId');
}

/**
 * Seleccionar pedido para llevar.
 * @param {string | null} orderId
 */
export function selectTakeawayOrder(orderId) {
  _state.selectedTakeawayOrderId = orderId;
  emit('selectedTakeawayOrderId');
}

/**
 * Cambiar el estado de una mesa.
 * @param {string} tableId
 * @param {TableStatus} status
 */
export function updateTableStatus(tableId, status) {
  const table = _state.tables.find(t => t.id === tableId);
  if (!table) return;
  _pushHistory({ action: 'updateTableStatus', payload: { tableId, prevStatus: table.status } });
  table.status = status;
  if (status === 'libre') {
    table.order = {
      ...(table.order || {}),
      orderType: 'salon',
      operationalStatus: 'completed',
      paymentStatus: 'unpaid',
      invoiceStatus: 'not_required',
      kitchenStatus: 'not_sent',
      sentToKitchen: false,
      items: [],
      paymentConfirmed: false,
      paymentMethod: '',
      paymentLabel: 'Pendiente',
      documentIssued: false,
      documentType: 'boleta',
    };
    delete _state.tableJourneys[tableId];
    _state.selectedRoundId = null;
    emit('tableJourneys');
    emit('selectedRoundId');
  }
  emit('tables');
}

/**
 * Avanzar el estado de un pedido de delivery.
 * @param {string} orderId
 * @param {string} newStatus
 */
export function advanceDeliveryStatus(orderId, newStatus) {
  const order = _state.deliveryOrders.find(o => o.id === orderId);
  if (!order) return { success: false, reason: 'Pedido delivery no encontrado.' };
  _pushHistory({ action: 'advanceDelivery', payload: { orderId, prevStatus: order.status } });
  const result = advanceOperationalStatus(order, 'delivery', newStatus);
  if (!result.success) return result;
  Object.assign(order, result.order);
  emit('deliveryOrders');
  return result;
}

/**
 * Avanzar el estado de un pedido para llevar.
 * @param {string} orderId
 * @param {string} newStatus
 */
export function advanceTakeawayStatus(orderId, newStatus) {
  const order = _state.takeawayOrders.find(o => o.id === orderId);
  if (!order) return { success: false, reason: 'Pedido para llevar no encontrado.' };
  _pushHistory({ action: 'advanceTakeaway', payload: { orderId, prevStatus: order.status } });
  const result = advanceOperationalStatus(order, 'takeaway', newStatus);
  if (!result.success) return result;
  Object.assign(order, result.order);
  emit('takeawayOrders');
  return result;
}

export function updatePaymentDraft(kind, sourceId, patch) {
  const source = resolveOrderSource(kind, sourceId);
  if (!source || !patch) return;

  if (kind === 'salon') {
    if (!source.journey) return;
    source.journey.paymentDraft = {
      ...source.journey.paymentDraft,
      ...patch,
      method: normalizePaymentMethod(patch.method || patch.paymentMethod || source.journey.paymentDraft?.method || 'efectivo'),
      documentType: patch.documentType || source.journey.paymentDraft?.documentType || 'boleta',
    };
    emit('tableJourneys');
    return;
  }

  if (patch.paymentMethod || patch.method) {
    source.order.paymentMethod = normalizePaymentMethod(patch.paymentMethod || patch.method);
    source.order.paymentLabel = getPaymentMethodLabel(source.order.paymentMethod);
  }

  if (patch.documentType) source.order.documentType = patch.documentType;
  if (Object.prototype.hasOwnProperty.call(patch, 'customerDocument')) source.order.customerDocument = patch.customerDocument;
  if (Object.prototype.hasOwnProperty.call(patch, 'businessName')) source.order.businessName = patch.businessName;
  emit(kind === 'delivery' ? 'deliveryOrders' : 'takeawayOrders');
}

export function prepareInvoiceDraftFromSource(kind, sourceId) {
  const source = resolveOrderSource(kind, sourceId);
  if (!source) return null;

  _state.invoiceDraft = {
    sourceType: kind,
    sourceId,
    orderCode: source.orderCode,
    customer: source.customer,
    documentNumber: source.documentNumber,
    businessName: source.businessName,
    total: source.total,
    paymentMethod: source.paymentMethod || 'efectivo',
    notes: source.notes || '',
  };
  _state.dashboardSection = 'factura';
  emit('invoiceDraft');
  emit('dashboardSection');
  return _state.invoiceDraft;
}

export function updateInvoiceDraft(patch) {
  _state.invoiceDraft = {
    ..._state.invoiceDraft,
    ...patch,
    paymentMethod: patch.paymentMethod ? normalizePaymentMethod(patch.paymentMethod) : _state.invoiceDraft.paymentMethod,
    total: Object.prototype.hasOwnProperty.call(patch, 'total') ? Number(patch.total) || 0 : _state.invoiceDraft.total,
  };
  emit('invoiceDraft');
}

export function issueInvoiceFromDraft() {
  const draft = _state.invoiceDraft;
  if (!draft.customer && !draft.sourceId) return null;

  const invoiceNumber = String(_state.invoiceHistory.length + 1).padStart(5, '0');
  const printer = _state.printers.factura;
  const source = draft.sourceType && draft.sourceId ? resolveOrderSource(draft.sourceType, draft.sourceId) : null;
  const invoice = {
    id: `invoice-${Date.now()}`,
    code: `F001-${invoiceNumber}`,
    sourceType: draft.sourceType || 'manual',
    sourceId: draft.sourceId || '',
    sourceLabel: draft.orderCode || 'Emisión manual',
    customer: draft.customer || 'Cliente',
    documentNumber: draft.documentNumber || 'Sin documento',
    businessName: draft.businessName || 'Sin razón social',
    total: Number(draft.total) || 0,
    paymentMethod: getPaymentMethodLabel(draft.paymentMethod),
    printerName: printer.name,
    printerStatus: getPrinterStatusLabel(printer.status),
    issuedAt: Date.now(),
    status: printer.status === 'connected' ? 'Emitida' : 'Pendiente de impresión',
  };

  _state.invoiceHistory.unshift(invoice);

  if (source) {
    syncSourcePayment(source, {
      paymentMethod: draft.paymentMethod,
      documentType: 'factura',
      documentIssued: true,
    });
    const ticket = buildTicketReceipt(source.kind, source.id, invoice.code);
    if (ticket) _state.paymentReceipts[source.kind][source.id] = ticket;
  }

  _state.invoiceDraft = {
    sourceType: '',
    sourceId: '',
    orderCode: '',
    customer: '',
    documentNumber: '',
    businessName: '',
    total: 0,
    paymentMethod: 'efectivo',
    notes: '',
  };
  emit('invoiceHistory');
  emit('invoiceDraft');
  emit('paymentReceipts');
  return invoice;
}

export function completeOrderPayment(kind, sourceId) {
  const source = resolveOrderSource(kind, sourceId);
  if (!source) return { success: false };

  if (source.documentType === 'factura') {
    prepareInvoiceDraftFromSource(kind, sourceId);
    return { success: true, redirectedToInvoice: true };
  }

  syncSourcePayment(source, {
    paymentMethod: source.paymentMethod,
    documentType: 'boleta',
    documentIssued: true,
  });
  const ticket = buildTicketReceipt(kind, sourceId);
  if (ticket) _state.paymentReceipts[kind][sourceId] = ticket;
  emit('paymentReceipts');
  return { success: true, redirectedToInvoice: false, ticket };
}

export function togglePrinterStatus(role) {
  const printer = _state.printers[role];
  if (!printer) return;
  printer.status = printer.status === 'connected' ? 'disconnected' : 'connected';
  emit('printers');
}

export function markSessionClosed() {
  _state.session.status = 'closed';
  emit('session');
}

/**
 * Actualizar zona activa del filtro de mesas.
 * @param {string} zone
 */
export function setActiveZone(zone) {
  _state.activeZone = zone;
  emit('activeZone');
  emit('tables'); // Disparar re-render del grid
}

/**
 * Actualizar query de búsqueda.
 * @param {string} query
 */
export function setSearchQuery(query) {
  _state.searchQuery = query;
  emit('searchQuery');
  emit('tables');
}

/**
 * Actualizar conteo de alertas de cocina.
 * @param {number} count
 */
export function setKitchenAlertCount(count) {
  _state.kitchenAlertCount = count;
  emit('kitchenAlertCount');

  // Sincronizar con badge PWA
  import('./pwa.js').then(({ updateKitchenAlertBadge }) => {
    updateKitchenAlertBadge(count);
  }).catch(() => {});
}

// ── Historial (mini undo) ─────────────────────────────────────────

function _pushHistory(entry) {
  _state._history.push(entry);
  if (_state._history.length > 20) _state._history.shift();
}

// ── CustomEvents (bus entre módulos) ─────────────────────────────

/**
 * Disparar evento inter-módulo.
 * @param {string} eventName
 * @param {any} detail
 */
export function dispatchModuleEvent(eventName, detail) {
  window.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: false }));
}

/**
 * Escuchar evento inter-módulo.
 * @param {string} eventName
 * @param {(detail: any) => void} callback
 * @returns {() => void} cleanup
 */
export function onModuleEvent(eventName, callback) {
  const handler = (/** @type {CustomEvent} */ e) => callback(e.detail);
  window.addEventListener(eventName, handler);
  return () => window.removeEventListener(eventName, handler);
}

// ── Persistencia ligera ───────────────────────────────────────────

const PERSIST_KEY = 'mirest_pedidos_session';

/** Guardar estado de sesión en localStorage. */
export function persistSession() {
  try {
    const snapshot = {
      mode: normalizeMode(_state.mode),
      activeZone: _state.activeZone,
      dashboardSection: normalizeDashboardSection(_state.dashboardSection),
      activeModule: normalizeActiveModule(_state.activeModule, _state.userRole),
      userRole: normalizeRole(_state.userRole),
      userName: _state.userName,
      lastOperationalContext: normalizeOperationalContext(_state.lastOperationalContext, _state.mode),
      savedAt: Date.now(),
    };
    localStorage.setItem(PERSIST_KEY, JSON.stringify(snapshot));
    saveAppSession(snapshot);
  } catch {
    // localStorage puede estar bloqueado en modo privado
  }
}

/** Restaurar estado de sesión desde localStorage. */
export function restoreSession() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    if (!raw) return;
    const snap = JSON.parse(raw);
    // Solo restaurar si la sesión tiene menos de 8 horas
    const eightHours = 8 * 60 * 60 * 1000;
    if (Date.now() - snap.savedAt > eightHours) {
      localStorage.removeItem(PERSIST_KEY);
      return;
    }
    if (snap.mode) setMode(normalizeMode(snap.mode));
    if (snap.activeZone) _state.activeZone = snap.activeZone;
    if (snap.dashboardSection) _state.dashboardSection = normalizeDashboardSection(snap.dashboardSection);
    if (snap.userRole) {
      _state.userRole = normalizeRole(snap.userRole);
      _state.visibleModules = getModulesForRole(_state.userRole);
      _state.session.role = _state.userRole;
    }
    if (snap.userName) {
      _state.userName = snap.userName;
      _state.session.currentUserName = snap.userName;
    }
    if (snap.activeModule) {
      _state.activeModule = normalizeActiveModule(snap.activeModule, _state.userRole);
    }
    if (snap.lastOperationalContext) {
      _state.lastOperationalContext = normalizeOperationalContext(snap.lastOperationalContext, _state.mode);
    }
    console.info('[state] Sesión restaurada:', snap.mode, snap.activeZone);
    if (typeof globalThis !== 'undefined' && globalThis.dispatchEvent) {
      globalThis.dispatchEvent(new CustomEvent('mirest:session-restore'));
    }
  } catch {
    console.warn('[state] No se pudo restaurar la sesión.');
  }
}
