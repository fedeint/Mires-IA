/**
 * render.js — Reportes
 * Funciones de renderizado: grid de tarjetas, estadísticas, reloj, helpers
 */

/* ── Helpers ── */
export function getIconForTipo(tipo) {
  const icons = {
    ventas: 'trending-up',
    productos: 'package',
    clientes: 'users',
    caja: 'banknote',
    inventario: 'warehouse'
  };
  return icons[tipo] || 'file-text';
}

export function getIconClassForTipo(tipo) {
  const classes = {
    ventas: 'green',
    productos: 'orange',
    clientes: 'blue',
    caja: 'yellow',
    inventario: 'red'
  };
  return classes[tipo] || 'orange';
}

/* ── Reloj en vivo ── */
export function initializeTime() {
  const rpTime = document.getElementById('rpTime');
  if (!rpTime) return;

  const actualizarHora = () => {
    const ahora = new Date();
    rpTime.textContent = ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  };

  actualizarHora();
  setInterval(actualizarHora, 1000);
}

/* ── Grid de tarjetas de reportes ── */
export function renderReportes(reportesData, filtro = 'todos', busqueda = '') {
  const rpGrid = document.getElementById('rpGrid');
  if (!rpGrid) return;

  let filtered = reportesData;

  if (filtro !== 'todos') {
    filtered = filtered.filter(r => r.tipo === filtro);
  }

  if (busqueda.trim()) {
    const term = busqueda.toLowerCase();
    filtered = filtered.filter(r =>
      r.nombre.toLowerCase().includes(term) ||
      r.descripcion.toLowerCase().includes(term)
    );
  }

  if (filtered.length === 0) {
    rpGrid.innerHTML = `
      <div class="rp-empty">
        <svg viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
        <p>No se encontraron reportes</p>
      </div>
    `;
    return;
  }

  rpGrid.innerHTML = filtered.map(reporte => `
    <div class="rp-card" data-id="${reporte.id}" data-tipo="${reporte.tipo}">
      <div class="rp-card__header">
        <div class="rp-card__icon rp-card__icon--${reporte.iconClass}">
          <i data-lucide="${reporte.icon}"></i>
        </div>
        <div class="rp-card__meta">
          <span class="rp-card__date">${reporte.fecha}</span>
          <span class="rp-card__badge">${reporte.formato}</span>
        </div>
      </div>
      <h3 class="rp-card__title">${reporte.nombre}</h3>
      <p class="rp-card__desc">${reporte.descripcion}</p>
      <div class="rp-card__footer">
        <span class="rp-card__size">${reporte.tamano} MB</span>
        <div class="rp-card__actions">
          <button class="rp-action-btn" title="Ver" onclick="verReporte(${reporte.id})">
            <i data-lucide="eye"></i>
          </button>
          <button class="rp-action-btn rp-action-btn--primary" title="Descargar" onclick="descargarReporte(${reporte.id})">
            <i data-lucide="download"></i>
          </button>
        </div>
      </div>
    </div>
  `).join('');

  lucide.createIcons();
}

/* ── Estadísticas ── */
export function initializeStats(reportesData) {
  const total = reportesData.length;
  const descargados = Math.floor(Math.random() * 10) + 5;
  const hoy = Math.floor(Math.random() * 5) + 1;
  const tamanoTotal = reportesData.reduce((acc, r) => acc + r.tamano, 0).toFixed(1);

  document.getElementById('totalReportes').textContent = total;
  document.getElementById('reportesDescargados').textContent = descargados;
  document.getElementById('reportesHoy').textContent = hoy;
  document.getElementById('tamanoTotal').textContent = tamanoTotal + ' MB';

  document.getElementById('countTodos').textContent = total;
  document.getElementById('countVentas').textContent = reportesData.filter(r => r.tipo === 'ventas').length;
  document.getElementById('countProductos').textContent = reportesData.filter(r => r.tipo === 'productos').length;
  document.getElementById('countClientes').textContent = reportesData.filter(r => r.tipo === 'clientes').length;
  document.getElementById('countCaja').textContent = reportesData.filter(r => r.tipo === 'caja').length;
  document.getElementById('countInventario').textContent = reportesData.filter(r => r.tipo === 'inventario').length;
}