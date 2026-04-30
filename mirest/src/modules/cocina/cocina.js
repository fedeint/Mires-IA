/**
 * cocina.js — Módulo Cocina
 * Estado, modal, filtros, búsqueda y acciones globales
 */

import { render, renderLive } from './render.js';
import { showToast, requestWakeLock, openModal, closeModal } from '../scripts/ui-utils.js';

/* ── Estado ── */
let dishes      = [];
let filter      = 'preparing';
let searchQuery = '';
let nextId      = 1;

const defaultImages = [
  'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?w=400&h=300&fit=crop',
  'https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=400&h=300&fit=crop',
];

function rerender() { render(dishes, filter, searchQuery); }

/* ── Inicialización ── */
document.addEventListener('DOMContentLoaded', () => {
  // PWA Wake Lock
  requestWakeLock();

  // Render inicial
  rerender();
  
  // Lucide icons para elementos estáticos
  if (typeof lucide !== 'undefined') lucide.createIcons();
});

/* ── Modal de Nuevo Plato ── */
const modal = document.getElementById('addDishModal');
const btnAddDish = document.getElementById('btnAddDish');
const closeModalBtn = document.getElementById('closeModal');

if (btnAddDish) btnAddDish.addEventListener('click', () => openModal('addDishModal'));
if (closeModalBtn) closeModalBtn.addEventListener('click', () => closeModal('addDishModal'));
if (modal) {
  modal.addEventListener('click', e => { if (e.target === modal) closeModal('addDishModal'); });
}

/* ── Activar IA ── */
const btnActivateIA = document.getElementById('btnActivateIA');
if (btnActivateIA) {
  btnActivateIA.addEventListener('click', () =>
    showToast('ckToast', 'ckToastMsg', 'La IA de Cocina está en fase beta y se activará en el próximo turno.', 'ckToastIcon', 'zap')
  );
}

/* ── Agregar pedido ── */
const submitDish = document.getElementById('submitDish');
if (submitDish) {
  submitDish.addEventListener('click', () => {
    const name  = document.getElementById('dishName').value.trim();
    const table = document.getElementById('dishTable').value;
    const qty   = parseInt(document.getElementById('dishQty').value) || 1;
    const notes = document.getElementById('dishNotes').value.trim();
    if (!name) { alert('Ingresa el nombre del plato'); return; }
    if (!table) { alert('Ingresa el número de mesa'); return; }

    dishes.push({
      id:            nextId++,
      name, table, qty, notes,
      status:        'preparing',
      createdAt:     Date.now(),
      estimatedTime: Math.floor(Math.random() * 11) + 15, // 15-25 min
      img:           defaultImages[Math.floor(Math.random() * defaultImages.length)],
    });

    document.getElementById('dishName').value  = '';
    document.getElementById('dishTable').value = '';
    document.getElementById('dishNotes').value = '';
    document.getElementById('dishQty').value   = '1';
    closeModal('addDishModal');
    rerender();
  });
}

/* ── Filtros ── */
document.querySelectorAll('.ck-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ck-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    filter = btn.dataset.filter;
    rerender();
  });
});

/* ── Búsqueda ── */
const searchInput = document.getElementById('searchInput');
if (searchInput) {
  searchInput.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    rerender();
  });
}

/* ── Acciones globales ── */
window.ckMarkDone = function (id) {
  const d = dishes.find(x => x.id === id);
  if (d) d.status = 'done';
  rerender();
};

window.ckDeliverDish = function (id) {
  const d = dishes.find(x => x.id === id);
  if (d) d.status = 'delivered';
  rerender();
};

window.ckRejectDish = function (id) {
  const d = dishes.find(x => x.id === id);
  if (d) d.status = 'rejected';
  rerender();
};

window.ckDeleteDish = function (id) {
  dishes = dishes.filter(x => x.id !== id);
  rerender();
};

window.ckSetImage = function (id) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      const d = dishes.find(x => x.id === id);
      if (d) { d.img = e.target.result; rerender(); }
    };
    reader.readAsDataURL(file);
  };
  input.click();
};

window.ckAddItem = function (id) {
  const extra = prompt('Agregar nota / platillo extra:');
  if (extra) {
    const d = dishes.find(x => x.id === id);
    if (d) { d.notes = d.notes ? d.notes + ' · ' + extra : extra; rerender(); }
  }
};

/* ── Live tick: solo timers + stats, SIN re-renderizar el grid ── */
setInterval(() => renderLive(dishes), 1000);
