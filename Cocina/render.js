/**
 * render.js — Cocina
 * Renderizado: stats, contadores de filtro, grilla de tarjetas rediseñadas
 *
 * CAMBIOS:
 *  - renderLive(): actualiza SOLO timers/progress en el DOM existente → sin parpadeo
 *  - renderGrid(): solo reemplaza innerHTML cuando la lista cambia de verdad
 *  - Card header rediseñado: Mesa + Nombre + Cantidad con tamaños prominentes
 */

export function formatTime(ms) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;
}

function progressInfo(elapsed, estimatedTime) {
  const pct = Math.min((elapsed / (estimatedTime * 60000)) * 100, 100);
  const cls = pct >= 100 ? 'danger' : pct >= 70 ? 'warn' : 'ok';
  return { pct, cls };
}

function timerColorClass(pct) {
  if (pct >= 100) return 'ck-dish-timer--danger';
  if (pct >= 70)  return 'ck-dish-timer--warn';
  return '';
}

/* ─── Clave para detectar cambios estructurales en la lista ─── */
let lastGridKey = '';

/* ─── Render principal (filtro / búsqueda / nuevo pedido) ─── */
export function render(dishes, filter, searchQuery) {
  renderStats(dishes);
  renderCounts(dishes);
  renderGrid(dishes, filter, searchQuery);
}

/* ─── Live: solo stats + timers/progress, sin tocar el grid ─── */
export function renderLive(dishes) {
  renderStats(dishes);

  const now = Date.now();
  dishes.forEach(d => {
    if (d.status !== 'preparing') return;

    const elapsed       = now - d.createdAt;
    const { pct, cls }  = progressInfo(elapsed, d.estimatedTime);

    const timerEl = document.querySelector(`[data-timer="${d.id}"]`);
    const fillEl  = document.querySelector(`[data-fill="${d.id}"]`);
    const cardEl  = document.querySelector(`[data-card="${d.id}"]`);

    if (timerEl) {
      timerEl.textContent = formatTime(elapsed);
      timerEl.className   = `ck-dish-timer ${timerColorClass(pct)}`;
    }
    if (fillEl) {
      fillEl.style.width = `${pct}%`;
      fillEl.className   = `ck-progress-fill ck-progress-fill--${cls}`;
    }
    if (cardEl) {
      const isUrgent = pct >= 100;
      if (isUrgent && !cardEl.classList.contains('ck-dish-card--urgent')) {
        if ('vibrate' in navigator) navigator.vibrate([100, 50, 100]);
      }
      cardEl.classList.toggle('ck-dish-card--urgent', isUrgent);
    }
  });
}

/* ─── Stats ─── */
function renderStats(dishes) {
  const preparing  = dishes.filter(d => d.status === 'preparing');
  const activeTbls = new Set(preparing.map(d => d.table)).size;
  const avgMs      = preparing.length
    ? preparing.reduce((a, d) => a + (Date.now() - d.createdAt), 0) / preparing.length
    : 0;
  const urgent    = preparing.filter(d => (Date.now() - d.createdAt) > d.estimatedTime * 60000).length;
  const delivered = dishes.filter(d => d.status === 'delivered').length;

  document.getElementById('statActiveTables').textContent = activeTbls;
  document.getElementById('statAvgTime').textContent      = `${Math.round(avgMs / 60000)} min`;
  document.getElementById('statUrgent').textContent       = urgent;
  document.getElementById('statDelivered').textContent    = delivered;
}

/* ─── Contadores de filtro ─── */
function renderCounts(dishes) {
  const pendingCount = dishes.filter(d => d.status === 'preparing').length;
  document.getElementById('countPreparing').textContent = pendingCount;
  document.getElementById('countDone').textContent      = dishes.filter(d => d.status === 'done').length;
  document.getElementById('countDelivered').textContent = dishes.filter(d => d.status === 'delivered').length;
  document.getElementById('countRejected').textContent  = dishes.filter(d => d.status === 'rejected').length;

  // Badging API
  if ('setAppBadge' in navigator) {
    if (pendingCount > 0) navigator.setAppBadge(pendingCount);
    else navigator.clearAppBadge();
  }
}

/* ─── Grid: solo re-renderiza cuando la composición cambia ─── */
function renderGrid(dishes, filter, searchQuery) {
  const grid = document.getElementById('dishGrid');
  let list   = dishes.filter(d => d.status === filter);

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    list = list.filter(d =>
      d.name.toLowerCase().includes(q) ||
      `mesa ${d.table}`.includes(q) ||
      (d.notes && d.notes.toLowerCase().includes(q))
    );
  }

  /* Clave estructural: cambia solo cuando se agrega, elimina o modifica un pedido */
  const key = list.map(d => `${d.id}:${d.status}:${d.notes}:${d.qty}:${d.name}:${d.img}`).join('|');
  if (key === lastGridKey) return;
  lastGridKey = key;

  if (list.length === 0) {
    grid.innerHTML = `
      <div class="ck-empty">
        <i data-lucide="package-open" style="width:64px;height:64px;color:var(--ck-orange);opacity:0.5"></i>
        <p>No hay pedidos${searchQuery ? ' que coincidan' : ''}</p>
      </div>`;
    return;
  }
  grid.innerHTML = list.map(renderCard).join('');
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

/* ─── Card ─── */
function renderCard(d) {
  const elapsed       = Date.now() - d.createdAt;
  const { pct, cls }  = progressInfo(elapsed, d.estimatedTime);
  const timerCls      = timerColorClass(pct);
  const isUrgent      = pct >= 100 && d.status === 'preparing';

  const imgContent = d.img
    ? `<img src="${d.img}" alt="${d.name}" onerror="this.style.display='none'">`
    : `<div class="ck-img-placeholder">
        <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
       </div>`;

  const actionBtns = d.status === 'preparing' ? `
    <button class="ck-action-btn ck-action-btn--done"    onclick="ckMarkDone(${d.id})">
      <i data-lucide="check" style="width:18px;height:18px"></i> Listo
    </button>
    <button class="ck-action-btn ck-action-btn--reject"  onclick="ckRejectDish(${d.id})">
      <i data-lucide="x-circle" style="width:18px;height:18px;color:var(--ck-red)"></i> Rechazar
    </button>` : d.status === 'done' ? `
    <button class="ck-action-btn ck-action-btn--deliver" onclick="ckDeliverDish(${d.id})">
      <i data-lucide="send" style="width:18px;height:18px"></i> Entregar
    </button>
    <button class="ck-action-btn ck-action-btn--reject"  onclick="ckRejectDish(${d.id})">
      <i data-lucide="x-circle" style="width:18px;height:18px;color:var(--ck-red)"></i> Rechazar
    </button>` : '';

  return `
    <div class="ck-dish-card${isUrgent ? ' ck-dish-card--urgent' : ''}" data-card="${d.id}">

      <!-- ── Cabecera prominente: Mesa · Nombre · Cantidad ── -->
      <div class="ck-dish-header">
        <span class="ck-mesa-tag">Mesa ${d.table}</span>
        <div class="ck-dish-name">${d.name}</div>
        <div class="ck-dish-qty">
          <span class="ck-qty-badge">×${d.qty}</span>
          ${d.notes ? `<span class="ck-dish-notes">${d.notes}</span>` : ''}
        </div>
      </div>

      <!-- ── Imagen compacta ── -->
      <div class="ck-dish-img-area">
        <div class="ck-dish-img-wrapper">
          ${imgContent}
        </div>
        <div class="ck-img-actions">
          <button class="ck-img-action-btn" onclick="ckSetImage(${d.id})">
            <i data-lucide="image" style="width:24px;height:24px;color:#15192c"></i>
            <span>Imagen</span>
          </button>
          <button class="ck-img-action-btn" onclick="ckAddItem(${d.id})">
            <i data-lucide="plus-square" style="width:24px;height:24px;color:#15192c"></i>
            <span>Platillo</span>
          </button>
          <button class="ck-img-action-btn ck-img-action-btn--danger" onclick="ckDeleteDish(${d.id})">
            <i data-lucide="trash-2" style="width:24px;height:24px;color:var(--ck-red)"></i>
            <span>Eliminar</span>
          </button>
        </div>
      </div>

      <!-- ── Timer + Progress ── -->
      <div class="ck-dish-info">
        <div class="ck-dish-timer-row">
          <span class="ck-dish-timer ${timerCls}" data-timer="${d.id}">${formatTime(elapsed)}</span>
          <span class="ck-dish-estimated">/ ${d.estimatedTime} min</span>
        </div>
        <div class="ck-progress-bar">
          <div class="ck-progress-fill ck-progress-fill--${cls}" data-fill="${d.id}" style="width:${pct}%"></div>
        </div>
      </div>

      ${actionBtns ? `<div class="ck-dish-actions">${actionBtns}</div>` : ''}
    </div>`;
}