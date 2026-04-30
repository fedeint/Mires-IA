// Almacen/almacen-db.js — Capa de datos compartida para el módulo Almacén
(function () {

  // ── CSS del toast de error (inline) ──────────────────────────────────────
  (function _inyectarCSS() {
    if (document.getElementById('almacen-toast-style')) return;
    const style = document.createElement('style');
    style.id = 'almacen-toast-style';
    style.textContent = `
.almacen-error-toast {
  position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%);
  background: #ef4444; color: #fff; padding: 12px 24px; border-radius: 10px;
  font-size: 14px; font-family: sans-serif; z-index: 9999;
  box-shadow: 0 4px 20px rgba(0,0,0,.3); animation: almacen-toast-in .2s ease;
}
@keyframes almacen-toast-in {
  from { opacity:0; transform: translateX(-50%) translateY(10px); }
  to   { opacity:1; transform: translateX(-50%) translateY(0); }
}`;
    document.head.appendChild(style);
  })();

  // ── Helpers privados ─────────────────────────────────────────────────────

  function _getConfig() {
    return window.ALMACEN_SUPABASE; // { url, anonKey }
  }

  // Task 2.4
  function _mostrarError(mensaje) {
    const toast = document.createElement('div');
    toast.className = 'almacen-error-toast';
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // Task 2.1
  async function _fetch(endpoint, opts) {
    const cfg = _getConfig();
    const url = cfg.url + '/rest/v1/' + endpoint;

    const isWrite = opts && (opts.method === 'POST' || opts.method === 'PATCH');

    const headers = {
      'apikey': cfg.anonKey,
      'Authorization': 'Bearer ' + cfg.anonKey,
      'Content-Type': 'application/json',
    };
    if (isWrite) {
      headers['Prefer'] = 'return=minimal';
    }

    const fetchOpts = Object.assign({}, opts, { headers });

    const response = await fetch(url, fetchOpts);

    if (!response.ok) {
      let errorText = '';
      try { errorText = await response.text(); } catch (_) {}
      console.error('[AlmacenDB]', endpoint, response.status, errorText);
      _mostrarError('Error ' + response.status + ': ' + (errorText || 'Error al conectar con el servidor'));
      throw new Error('[AlmacenDB] ' + endpoint + ' ' + response.status + ' ' + errorText);
    }

    if (isWrite) {
      return null; // Prefer: return=minimal — no body expected
    }

    return response.json();
  }

  // ── Mapeo snake_case → camelCase ─────────────────────────────────────────

  function _mapInsumo(row) {
    const stockActual = Number(row.stock_actual) || 0;
    const stockMinimo = Number(row.stock_minimo) || 0;
    const costoUnitario = Number(row.costo_unitario) || 0;

    let estado;
    if (stockActual === 0 || stockActual <= stockMinimo) {
      estado = 'critico';
    } else if (stockActual <= stockMinimo * 2) {
      estado = 'bajo';
    } else {
      estado = 'ok';
    }

    return Object.assign({}, row, {
      stockActual,
      stockMinimo,
      costoUnitario,
      ultimoIngreso: row.ultimo_ingreso,
      costoTotal: stockActual * costoUnitario,
      estado,
    });
  }

  // ── Métodos públicos ─────────────────────────────────────────────────────

  // Task 2.5 — Insumos

  async function getInsumos() {
    const rows = await _fetch('insumos?order=nombre.asc');
    const mapped = rows.map(_mapInsumo);
    try {
      localStorage.setItem('inventario_mirest', JSON.stringify(mapped));
    } catch (_) {}
    return mapped;
  }

  async function getInsumoByCodigo(codigo) {
    const rows = await _fetch('insumos?codigo=eq.' + encodeURIComponent(codigo) + '&limit=1');
    return rows && rows.length ? _mapInsumo(rows[0]) : null;
  }

  async function updateStockInsumo(codigo, nuevoStock) {
    return _fetch('insumos?codigo=eq.' + encodeURIComponent(codigo), {
      method: 'PATCH',
      body: JSON.stringify({
        stock_actual: nuevoStock,
        updated_at: new Date().toISOString(),
      }),
    });
  }

  // Task 2.6 — Entradas

  async function getEntradas() {
    return _fetch('entradas_insumos?order=created_at.desc');
  }

  async function insertEntrada(entrada) {
    return _fetch('entradas_insumos', {
      method: 'POST',
      body: JSON.stringify(entrada),
    });
  }

  // Task 2.7 — Salidas

  async function getSalidas() {
    return _fetch('salidas_insumos?order=created_at.desc');
  }

  async function insertSalida(salida) {
    return _fetch('salidas_insumos', {
      method: 'POST',
      body: JSON.stringify(salida),
    });
  }

  // Task 2.8 — Proveedores

  async function getProveedores() {
    return _fetch('proveedores?order=nombre.asc');
  }

  async function insertProveedor(proveedor) {
    return _fetch('proveedores', {
      method: 'POST',
      body: JSON.stringify(proveedor),
    });
  }

  async function updateProveedor(id, datos) {
    return _fetch('proveedores?id=eq.' + id, {
      method: 'PATCH',
      body: JSON.stringify(datos),
    });
  }

  // Task 2.9 — Compatibilidad

  async function getInventarioSupabase() {
    return getInsumos();
  }

  // ── Exposición pública ───────────────────────────────────────────────────

  window.AlmacenDB = {
    // Insumos (Task 2.5)
    getInsumos,
    getInsumoByCodigo,
    updateStockInsumo,

    // Entradas (Task 2.6)
    getEntradas,
    insertEntrada,

    // Salidas (Task 2.7)
    getSalidas,
    insertSalida,

    // Proveedores (Task 2.8)
    getProveedores,
    insertProveedor,
    updateProveedor,

    // Compatibilidad (Task 2.9)
    getInventarioSupabase,
  };

  // Global shortcut for dependent modules
  window.getInventarioSupabase = () => window.AlmacenDB.getInventarioSupabase();

})();
