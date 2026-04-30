/**
 * caja.js — Módulo Caja
 * Lógica de negocio y eventos específicos de Caja
 */

import { render } from './render.js';
import { showToast, openModal, closeModal } from '../scripts/ui-utils.js';
import {
  resolveUserRole,
  resolveUserPermissions,
  hasFeaturePermission,
  FEATURE_CAJA_MESEROS,
} from '../scripts/navigation.js';
import { supabase } from '../scripts/supabase.js';
import { listOperationalStaffForCaja } from '../scripts/operational-staff.js';
import { recordModuloBloqueo, resolveTenantIdForUser } from '../scripts/module-conditions.js';

/* ── Estado ── */
let cajaOpen = false;
let openedAt = null;
/** @type {string | null} id en public.cash_sessions si hay sesión persistida */
let activeCashSessionId = null;
let transactions = [];
/** @type {Array<{ name: string, mesa: string, products: number, status: string, role?: string, hasLiveStatus?: boolean }>} */
let cajaTeamMeseros = [];
let cajaTeamMessage = null;
let cajaTeamOnboardingStep = null;

function meserosForSession() {
  if (!window.__mirestCajaMeserosEnabled) return [];
  return cajaTeamMeseros;
}

async function refreshOperationalTeam() {
  if (!window.__mirestCajaMeserosEnabled) {
    cajaTeamMeseros = [];
    cajaTeamMessage = null;
    cajaTeamOnboardingStep = null;
    return;
  }
  const res = await listOperationalStaffForCaja();
  if (!res.ok) {
    cajaTeamMeseros = [];
    cajaTeamMessage = res.errorMessage || 'No se pudo cargar el personal.';
    cajaTeamOnboardingStep = null;
    return;
  }
  if (res.empty) {
    cajaTeamMeseros = [];
    cajaTeamMessage = res.emptyMessage || 'Sin datos aún.';
    cajaTeamOnboardingStep = res.onboardingStep != null ? res.onboardingStep : null;
    return;
  }
  cajaTeamMeseros = res.meseros || [];
  cajaTeamMessage = null;
  cajaTeamOnboardingStep = null;
}

async function initCajaMeserosVisibility() {
  const block = document.getElementById('cajaMeserosBlock');
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.__mirestCajaMeserosEnabled = false;
    } else {
      const role = resolveUserRole(user);
      const perms = resolveUserPermissions(user, role);
      window.__mirestCajaMeserosEnabled = hasFeaturePermission(perms, FEATURE_CAJA_MESEROS);
    }
  } catch {
    window.__mirestCajaMeserosEnabled = false;
  }
  if (block) {
    block.style.display = window.__mirestCajaMeserosEnabled ? '' : 'none';
  }
}

function cajaToastError(message) {
  showToast('welcomeToast', 'welcomeToastMsg', message, 'welcomeToastIcon', 'x-circle');
}

function applyCajaOpenUi() {
  cajaOpen = true;
  if (cajaBadge) {
    cajaBadge.textContent = 'Abierta';
    cajaBadge.className   = 'cj-badge cj-badge--green';
  }
  if (closedScreen) closedScreen.style.display = 'none';
  if (openContent) openContent.style.display  = 'block';
}

function applyCajaClosedUi() {
  cajaOpen = false;
  openedAt = null;
  activeCashSessionId = null;
  if (cajaBadge) {
    cajaBadge.textContent = 'Cerrada';
    cajaBadge.className   = 'cj-badge cj-badge--red';
  }
  if (cajaTimeEl) cajaTimeEl.textContent = '';
  if (openContent) openContent.style.display  = 'none';
  if (closedScreen) closedScreen.style.display = 'flex';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 * @param {string} tenantId
 */
async function resolveRestaurantIdForCaja(client, tenantId) {
  const { data: { user } } = await client.auth.getUser();
  if (!user) return null;
  const { data: prof } = await client
    .from('user_profiles')
    .select('restaurant_id')
    .eq('id', user.id)
    .maybeSingle();
  if (prof?.restaurant_id) return prof.restaurant_id;
  const { data: r } = await client
    .from('restaurants')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  return r?.id ?? null;
}

async function syncCajaStateFromServer() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const tid = await resolveTenantIdForUser(supabase, user.id);
  if (!tid) return;
  const { data: row, error } = await supabase
    .from('cash_sessions')
    .select('id, opened_at')
    .eq('tenant_id', tid)
    .is('closed_at', null)
    .order('opened_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !row) return;
  activeCashSessionId = row.id;
  openedAt = new Date(row.opened_at);
  applyCajaOpenUi();
}

/* ── Referencias DOM ── */
const closedScreen  = document.getElementById('cajaClosedScreen');
const openContent   = document.getElementById('cajaOpenContent');
const btnToggle     = document.getElementById('btnToggleCaja');   
const btnClose      = document.getElementById('btnCloseCaja');    
const btnIncome     = document.getElementById('btnIncome');
const btnExpense    = document.getElementById('btnExpense');
const cajaBadge     = document.getElementById('cajaBadge');
const cajaTimeEl    = document.getElementById('cajaTime');

/* ── Inicialización ── */
document.addEventListener('DOMContentLoaded', async () => {
  await initCajaMeserosVisibility();
  await syncCajaStateFromServer();
  await refreshOperationalTeam();
  if (cajaOpen) render(transactions, meserosForSession(), cajaTeamMessage, cajaTeamOnboardingStep);
  initSelectableButtons('incConceptGroup', 'incConcept');
  initSelectableButtons('incMethodGroup', 'incMethod');
  initSelectableButtons('expConceptGroup', 'expConcept');

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

/* Abrir / cerrar: RPC mirest_guard_caja_* + fila en cash_sessions (tenant vía JWT). */

/* ── Abrir Caja ── */
async function performOpenCaja() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    openedAt = new Date();
    applyCajaOpenUi();
    await finishOpenCajaUi();
    return;
  }
  const tid = await resolveTenantIdForUser(supabase, user.id);
  if (!tid) {
    cajaToastError('No hay restaurante/tenant en tu perfil. Revisa Accesos o inicia sesión de nuevo.');
    return;
  }
  const { data: gr, error: eGr } = await supabase.rpc('mirest_guard_caja_abrir', { p_tenant: tid });
  if (eGr) {
    console.warn('[caja] mirest_guard_caja_abrir', eGr);
    cajaToastError('No se pudo validar la apertura con el servidor. ¿Migraciones y JWT con tenant?');
    return;
  }
  if (!gr?.ok) {
    void recordModuloBloqueo(supabase, {
      tenantId: tid,
      modulo: 'caja',
      accion: 'abrir_sesion',
      condicion_faltante: String(gr?.codigo || 'caja.guard'),
      metadata: { rpc: 'mirest_guard_caja_abrir', response: gr },
    });
    cajaToastError(String(gr?.mensaje || 'No puedes abrir caja ahora.'));
    return;
  }
  const restId = await resolveRestaurantIdForCaja(supabase, tid);
  if (!restId) {
    cajaToastError('Falta un restaurante asociado. Completa el perfil o crea un local en Configuración.');
    return;
  }
  const { data: row, error: eIns } = await supabase
    .from('cash_sessions')
    .insert({
      tenant_id: tid,
      restaurant_id: restId,
      opening_float: 0,
      opened_by: user.id,
    })
    .select('id, opened_at')
    .single();
  if (eIns) {
    console.warn('[caja] insert cash_sessions', eIns);
    cajaToastError(eIns.message || 'No se pudo abrir la sesión en base de datos.');
    return;
  }
  activeCashSessionId = row.id;
  openedAt = new Date(row.opened_at);
  applyCajaOpenUi();
  await finishOpenCajaUi();
}

async function finishOpenCajaUi() {
  await refreshOperationalTeam();
  showToast('welcomeToast', 'welcomeToastMsg', '¡Bienvenido, Cajero! <strong>Turno iniciado</strong>', 'welcomeToastIcon', 'check-circle');
  render(transactions, meserosForSession(), cajaTeamMessage, cajaTeamOnboardingStep);
}

if (btnToggle) {
  btnToggle.addEventListener('click', () => {
    openModal('confirmOpenCajaModal');
  });
}

/* ── Cerrar Caja ── */
/**
 * @param {number} [montoCierre] monto de arqueo (requerido si hay sesión en BD)
 */
async function performCloseCaja(montoCierre) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !activeCashSessionId) {
    applyCajaClosedUi();
    render(transactions, meserosForSession(), cajaTeamMessage, cajaTeamOnboardingStep);
    return;
  }
  const tid = await resolveTenantIdForUser(supabase, user.id);
  if (!tid) {
    applyCajaClosedUi();
    return;
  }
  const { data: gr, error: eGr } = await supabase.rpc('mirest_guard_caja_cerrar', { p_tenant: tid });
  if (eGr) {
    console.warn('[caja] mirest_guard_caja_cerrar', eGr);
    cajaToastError('No se pudo validar el cierre con el servidor.');
    return;
  }
  if (!gr?.ok) {
    void recordModuloBloqueo(supabase, {
      tenantId: tid,
      modulo: 'caja',
      accion: 'cerrar_sesion',
      condicion_faltante: String(gr?.codigo || 'caja.cerrar.guard'),
      metadata: { rpc: 'mirest_guard_caja_cerrar', response: gr },
    });
    cajaToastError(String(gr?.mensaje || 'No puedes cerrar caja ahora.'));
    return;
  }
  const { error: eUp } = await supabase
    .from('cash_sessions')
    .update({
      closed_at: new Date().toISOString(),
      closing_count: montoCierre != null && !Number.isNaN(montoCierre) ? montoCierre : null,
      closed_by: user.id,
    })
    .eq('id', activeCashSessionId);
  if (eUp) {
    cajaToastError(eUp.message || 'No se pudo guardar el cierre de sesión.');
    return;
  }
  applyCajaClosedUi();
  render(transactions, meserosForSession(), cajaTeamMessage, cajaTeamOnboardingStep);
  showToast('welcomeToast', 'welcomeToastMsg', 'Caja cerrada correctamente.', 'welcomeToastIcon', 'check-circle');
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    const m = document.getElementById('cierreMontoCaja');
    if (m) m.value = '';
    openModal('confirmCloseCajaModal');
  });
}

const btnConfirmOpenCaja = document.getElementById('btnConfirmOpenCaja');
const btnCancelOpenCaja = document.getElementById('btnCancelOpenCaja');
if (btnConfirmOpenCaja) {
  btnConfirmOpenCaja.addEventListener('click', () => {
    closeModal('confirmOpenCajaModal');
    void performOpenCaja();
  });
}
if (btnCancelOpenCaja) {
  btnCancelOpenCaja.addEventListener('click', () => closeModal('confirmOpenCajaModal'));
}

const btnConfirmCloseCaja = document.getElementById('btnConfirmCloseCaja');
const btnCancelCloseCaja = document.getElementById('btnCancelCloseCaja');
if (btnConfirmCloseCaja) {
  btnConfirmCloseCaja.addEventListener('click', () => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const montoEl = document.getElementById('cierreMontoCaja');
      const monto = parseFloat(montoEl?.value || '');
      if (user && activeCashSessionId) {
        if (!monto || monto <= 0) {
          cajaToastError('Ingresa el monto contado del arqueo para cerrar la sesión.');
          return;
        }
      }
      closeModal('confirmCloseCajaModal');
      await performCloseCaja(monto);
      if (montoEl) montoEl.value = '';
    })();
  });
}
if (btnCancelCloseCaja) {
  btnCancelCloseCaja.addEventListener('click', () => closeModal('confirmCloseCajaModal'));
}

document.querySelectorAll('[data-cj-close-modal]').forEach((btn) => {
  const id = btn.getAttribute('data-cj-close-modal');
  if (!id) return;
  btn.addEventListener('click', () => closeModal(id));
});

/* ── Chip de tiempo en vivo ── */
setInterval(() => {
  if (cajaOpen && openedAt && cajaTimeEl) {
    cajaTimeEl.textContent = 'Abierta: ' + openedAt.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }
}, 1000);

/* ── Modales ── */
window.closeAllModals = function () {
  document.querySelectorAll('.cj-modal-overlay.open').forEach(m => closeModal(m.id));
};

if (btnIncome) btnIncome.addEventListener('click',  () => openModal('incomeModal'));
if (btnExpense) btnExpense.addEventListener('click', () => openModal('expenseModal'));

document.querySelectorAll('.cj-modal-overlay').forEach(m => {
  m.addEventListener('click', e => { if (e.target === m) closeModal(m.id); });
});

/* ── Selectable Buttons ── */
function initSelectableButtons(groupId, inputId) {
  const group = document.getElementById(groupId);
  const input = document.getElementById(inputId);
  if (!group || !input) return;

  group.querySelectorAll('.cj-selectable-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      group.querySelectorAll('.cj-selectable-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      input.value = btn.dataset.value;
    });
  });
}

/* ── Registrar Ingreso ── */
const submitIncome = document.getElementById('submitIncome');
if (submitIncome) {
  submitIncome.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('incAmount').value);
    if (!amount || amount <= 0) { alert('Ingresa un monto válido'); return; }

    transactions.push({
      type:    'income',
      amount,
      concept: document.getElementById('incConcept').value || 'Ingreso',
      method:  document.getElementById('incMethod').value || 'Efectivo',
      note:    document.getElementById('incNote').value,
      time:    new Date(),
    });

    document.getElementById('incAmount').value = '';
    document.getElementById('incNote').value   = '';
    closeAllModals();
    render(transactions, meserosForSession(), cajaTeamMessage, cajaTeamOnboardingStep);
  });
}

/* ── Registrar Egreso ── */
const submitExpense = document.getElementById('submitExpense');
if (submitExpense) {
  submitExpense.addEventListener('click', () => {
    const amount = parseFloat(document.getElementById('expAmount').value);
    if (!amount || amount <= 0) { alert('Ingresa un monto válido'); return; }

    transactions.push({
      type:    'expense',
      amount,
      concept: document.getElementById('expConcept').value || 'Egreso',
      note:    document.getElementById('expNote').value,
      time:    new Date(),
    });

    document.getElementById('expAmount').value = '';
    document.getElementById('expNote').value   = '';
    closeAllModals();
    render(transactions, meserosForSession(), cajaTeamMessage, cajaTeamOnboardingStep);
  });
}
