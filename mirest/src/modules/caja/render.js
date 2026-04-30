/**
 * render.js — Caja
 * Stats, meseros, ranking y tabla de movimientos (2 columnas: Ingreso / Egreso)
 */

export function fmt(n) {
  return 'S/ ' + n.toFixed(2);
}

/* ── Icono profesional Lucide ── */
const iconUser = `<i data-lucide="user" style="width:40px;height:40px;color:var(--cj-orange)"></i>`;

/**
 * @param {any[]} transactions
 * @param {any[]} meseros
 * @param {string} [emptyMessage] — copy cuando no hay personal (Accesos / tenant).
 * @param {number} [onboardingStep] — paso del guión 1–9.
 */
export function render(transactions, meseros, emptyMessage, onboardingStep) {
  renderStats(transactions);
  renderMeseros(meseros, emptyMessage, onboardingStep);
  renderRanking(meseros);
  renderTransactions(transactions);
  if (typeof lucide !== 'undefined') lucide.createIcons();
}

function renderStats(transactions) {
  const totalIn  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  document.getElementById('totalIncome').textContent  = fmt(totalIn);
  document.getElementById('totalExpense').textContent = fmt(totalOut);
  document.getElementById('totalCash').textContent    = fmt(Math.max(0, totalIn - totalOut));
}

function renderMeseros(meseros, emptyMessage, onboardingStep) {
  const el = document.getElementById('meserosGrid');
  if (!el) return;
  if (!meseros.length) {
    const step = onboardingStep != null ? ` (onboarding: paso ${onboardingStep})` : '';
    const msg = (emptyMessage || 'Sin datos aún.').replace(/</g, '&lt;');
    el.innerHTML = `
      <div class="cj-mesero" style="grid-column:1/-1;padding:1rem 1.25rem;border:1px dashed var(--color-border);border-radius:12px;max-width:100%">
        <p style="margin:0 0 8px 0;font-weight:600;color:var(--color-text)">Sin datos aún</p>
        <p style="margin:0;font-size:13px;line-height:1.45;color:var(--color-text-muted)">${msg}${step}</p>
      </div>`;
    return;
  }
  el.innerHTML = meseros.map(m => {
    const live = m.hasLiveStatus === true;
    const isBusy = m.status === 'busy';
    let statusLabel = 'Sin carga en vivo (Pedidos → cobros)';
    let statusClass = 'cj-badge' + (m.status === 'unknown' || !live ? '' : isBusy ? ' cj-badge--red' : ' cj-badge--green');
    if (live) {
      statusLabel = isBusy ? 'No disponible' : 'Disponible';
      if (!m.status || m.status === 'unknown') statusClass = 'cj-badge';
    }
    const roleTag = m.role && m.role !== 'unknown' ? `<div style="font-size:11px;color:var(--color-text-muted)">${m.role}</div>` : '';
    return `
      <div class="cj-mesero">
        <div class="cj-mesero__avatar">${iconUser}</div>
        <div class="cj-mesero__name">${m.name.replace(/</g, '&lt;')}</div>
        ${roleTag}
        <div class="cj-mesero__table">${String(m.mesa).replace(/</g, '&lt;')}</div>
        <div style="margin-bottom: 8px;">
          <span class="${statusClass}">${statusLabel}</span>
        </div>
        <span class="cj-mesero__tag">${m.products} ítems (pedidos reales en Pedidos/Caja)</span>
      </div>
    `;
  }).join('');
}

function renderRanking(meseros) {
  const list = document.getElementById('rankingList');
  if (!list) return;
  if (!meseros.length) {
    list.innerHTML = '<p class="cj-table__empty" style="padding:8px 0">Sin ranking: primero carga al equipo (Accesos).</p>';
    return;
  }
  const withSales = meseros.some(m => m.products > 0);
  if (!withSales) {
    list.innerHTML = `
      <p class="cj-table__empty" style="padding:8px 0;margin:0;line-height:1.5">
        El top por ventas aparecerá cuando existan pedidos cobrados vinculados al personal (paso 9: Pedidos y Caja con datos reales). No se muestran posiciones con ceros.
      </p>`;
    return;
  }
  const medals = [
    '<i data-lucide="award" style="width:20px;height:20px;color:#f1c40f"></i>',
    '<i data-lucide="award" style="width:20px;height:20px;color:#bdc3c7"></i>',
    '<i data-lucide="award" style="width:20px;height:20px;color:#cd7f32"></i>'
  ];
  const sorted = [...meseros].filter(m => m.products > 0).sort((a, b) => b.products - a.products);
  list.innerHTML = sorted.map((m, i) => {
    const mesaShort = String(m.mesa).replace(/^Mesa\s*/i, '');
    return `
    <div class="cj-ranking-item">
      <div class="cj-ranking-item__pos">
        ${medals[i] || i + 1}
      </div>
      <div class="cj-ranking-item__avatar">${iconUser}</div>
      <div class="cj-ranking-item__name">${m.name.replace(/</g, '&lt;')}</div>
      <div class="cj-ranking-item__stats">
        <div><span>Mesa</span><strong>${mesaShort.replace(/</g, '&lt;')}</strong></div>
        <div><span>Ítems</span><strong>${m.products}</strong></div>
      </div>
    </div>`;
  }).join('');
}

function renderTransactions(transactions) {
  const incBody = document.getElementById('incBody');
  const expBody = document.getElementById('expBody');

  const incomes = transactions.filter(t => t.type === 'income').reverse();
  const expenses = transactions.filter(t => t.type === 'expense').reverse();

  const methodIcons = {
    'Yape': '<img src="./icon/Yape_idk9LVt308_1.svg" style="width:14px;height:14px;vertical-align:middle">',
    'Plin': '<img src="./icon/plin-seeklogo.png" style="width:14px;height:14px;vertical-align:middle">',
    'Efectivo': '<i data-lucide="banknote" style="width:14px;height:14px;color:#f1c40f"></i>',
    'Tarjeta': '<img src="./icon/tarjeta.png" style="width:14px;height:14px;vertical-align:middle">'
  };

  if (incomes.length === 0) {
    incBody.innerHTML = '<tr><td colspan="3" class="cj-table__empty">No hay ingresos</td></tr>';
  } else {
    incBody.innerHTML = incomes.map(t => {
      const time = t.time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      const methodIcon = methodIcons[t.method] || '';
      return `
        <tr>
          <td style="width:80px; font-weight:600; color:var(--color-text-muted)">${time}</td>
          <td>
            <div style="font-weight:700; color:var(--color-text); margin-bottom:2px">${t.concept}</div>
            <div class="cj-method-badge">
              ${methodIcon} ${t.method} ${t.note ? ' · ' + t.note : ''}
            </div>
          </td>
          <td style="text-align:right">
            <div class="cj-tx-amount cj-tx-income">+ ${fmt(t.amount)}</div>
          </td>
        </tr>`;
    }).join('');
  }

  if (expenses.length === 0) {
    expBody.innerHTML = '<tr><td colspan="3" class="cj-table__empty">No hay egresos</td></tr>';
  } else {
    expBody.innerHTML = expenses.map(t => {
      const time = t.time.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
      return `
        <tr>
          <td style="width:80px; font-weight:600; color:var(--color-text-muted)">${time}</td>
          <td>
            <div style="font-weight:700; color:var(--color-text); margin-bottom:2px">${t.concept}</div>
            ${t.note ? '<div style="font-size:11px; color:var(--color-text-muted)">' + t.note + '</div>' : ''}
          </td>
          <td style="text-align:right">
            <div class="cj-tx-amount cj-tx-expense">- ${fmt(t.amount)}</div>
          </td>
        </tr>`;
    }).join('');
  }
}
