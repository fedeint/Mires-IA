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

/* ── Estado ── */
let cajaOpen = false;
let openedAt = null;
let transactions = [];
let passwordAction = null; // 'open' o 'close'
const CAJA_PASSWORD = '9090';

const meserosMock = [
  { name: 'Carlos', mesa: 'Mesa 1', products: 0, status: 'available' },
  { name: 'Maria',  mesa: 'Mesa 2', products: 0, status: 'busy' },
  { name: 'Pedro',  mesa: 'Mesa 3', products: 0, status: 'available' },
];

function meserosForSession() {
  return window.__mirestCajaMeserosEnabled ? meserosMock : [];
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
  initSelectableButtons('incConceptGroup', 'incConcept');
  initSelectableButtons('incMethodGroup', 'incMethod');
  initSelectableButtons('expConceptGroup', 'expConcept');

  if (typeof lucide !== 'undefined') lucide.createIcons();
});

/* ── Lógica de Seguridad (Password) ── */
const passwordModal = document.getElementById('passwordModal');
const passwordInput = document.getElementById('cajaPassword');
const passwordError = document.getElementById('passwordError');
const btnConfirmPassword = document.getElementById('btnConfirmPassword');

function openPasswordModal(action) {
  passwordAction = action;
  if (passwordInput) passwordInput.value = '';
  if (passwordError) passwordError.style.display = 'none';
  openModal('passwordModal');
  setTimeout(() => { if (passwordInput) passwordInput.focus(); }, 100);
}

if (btnConfirmPassword) {
  btnConfirmPassword.addEventListener('click', () => {
    if (passwordInput.value === CAJA_PASSWORD) {
      closeModal('passwordModal');
      if (passwordAction === 'open') performOpenCaja();
      else if (passwordAction === 'close') performCloseCaja();
    } else {
      if (passwordError) passwordError.style.display = 'block';
      if (passwordInput) {
        passwordInput.value = '';
        passwordInput.focus();
      }
    }
  });
}

if (passwordInput) {
  passwordInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') btnConfirmPassword.click();
  });
}

/* ── Abrir Caja ── */
function performOpenCaja() {
  cajaOpen = true;
  openedAt = new Date();
  if (cajaBadge) {
    cajaBadge.textContent = 'Abierta';
    cajaBadge.className   = 'cj-badge cj-badge--green';
  }
  if (closedScreen) closedScreen.style.display = 'none';
  if (openContent) openContent.style.display  = 'block';

  showToast('welcomeToast', 'welcomeToastMsg', '¡Bienvenido, Cajero! <strong>Turno iniciado</strong>', 'welcomeToastIcon', 'check-circle');
  render(transactions, meserosForSession());
  
  // Iniciar onboarding si corresponde
  if (window.startCajaOnboarding) window.startCajaOnboarding();
}

if (btnToggle) {
  btnToggle.addEventListener('click', () => openPasswordModal('open'));
}

/* ── Cerrar Caja ── */
function performCloseCaja() {
  cajaOpen = false;
  openedAt = null;
  if (cajaBadge) {
    cajaBadge.textContent = 'Cerrada';
    cajaBadge.className   = 'cj-badge cj-badge--red';
  }
  if (cajaTimeEl) cajaTimeEl.textContent = '';
  if (openContent) openContent.style.display  = 'none';
  if (closedScreen) closedScreen.style.display = 'flex';
}

if (btnClose) {
  btnClose.addEventListener('click', () => {
    if (confirm('¿Confirmas el cierre de caja para este turno?')) {
      openPasswordModal('close');
    }
  });
}

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
    render(transactions, meserosForSession());
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
    render(transactions, meserosForSession());
  });
}
