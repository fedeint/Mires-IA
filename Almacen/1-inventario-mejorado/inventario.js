// 1. Estado de la aplicación
let inventarioActual = [];
let sortConfig = { key: 'nombre', direction: 'asc' };

// 2. Elementos del DOM
const listaInventario = document.getElementById('listaInventario');
const totalInsumosLabel = document.getElementById('totalInsumos');
const stockOkLabel = document.getElementById('stockOk');
const stockBajoLabel = document.getElementById('stockBajo');
const stockCriticoLabel = document.getElementById('stockCritico');
const buscador = document.getElementById('buscador');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroEstado = document.getElementById('filtroEstado');
const btnAgregarInsumos = document.getElementById('btnAgregarInsumos');

// 3. Inicialización
async function init() {
    listaInventario.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:2rem; color:var(--muted-foreground);">⏳ Cargando inventario...</td></tr>';

    try {
        inventarioActual = await window.AlmacenDB.getInsumos();
        recalcularEstados();
        cargarFiltros();
        renderizarInventario();
        configurarEventos();
    } catch (err) {
        console.error('[inventario] Error al cargar:', err);
        listaInventario.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:2rem; color:#ef4444;">❌ Error al cargar el inventario. Verifique la conexión.</td></tr>';
    }
}

// 4. Lógica de Estado
function recalcularEstados() {
    inventarioActual = inventarioActual.map(item => {
        const stock = item.stockActual;
        const minimo = item.stockMinimo;
        const unitario = item.costoUnitario || 0;
        let estado = 'ok';

        if (stock === 0 || stock < minimo) {
            estado = 'critico';
        } else if (stock >= minimo && stock <= (2 * minimo)) {
            estado = 'bajo';
        } else if (stock > (2 * minimo)) {
            estado = 'ok';
        }

        if (!item.proveedoresList || item.proveedoresList.length === 0) {
            item.proveedoresList = [{
                nombre: item.proveedor || "Sin proveedor",
                costoUnitario: unitario,
                ubicacion: item.ubicacion || "Sin asignar",
                stock: stock
            }];
        }

        return {
            ...item,
            estado,
            costoTotal: stock * unitario
        };
    });
}

// 5. Interfaz de Usuario
function cargarFiltros() {
    const categorias = [...new Set(inventarioActual.map(i => i.categoria))].sort();
    filtroCategoria.innerHTML = '<option value="">Todas las categorías</option>';
    categorias.forEach(cat => {
        const option = document.createElement('option');
        option.value = cat;
        option.textContent = cat;
        filtroCategoria.appendChild(option);
    });
}

function renderizarInventario() {
    let filtrados = inventarioActual.filter(item => {
        const term = buscador.value.toLowerCase();
        const matchesSearch =
            item.nombre.toLowerCase().includes(term) ||
            item.codigo.toLowerCase().includes(term) ||
            item.categoria.toLowerCase().includes(term) ||
            (item.ubicacion || '').toLowerCase().includes(term);

        const matchesCat = !filtroCategoria.value || item.categoria === filtroCategoria.value;
        const matchesEstado = !filtroEstado.value || item.estado === filtroEstado.value;

        return matchesSearch && matchesCat && matchesEstado;
    });

    filtrados.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        if (typeof valA === 'string') valA = valA.toLowerCase();
        if (typeof valB === 'string') valB = valB.toLowerCase();
        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
    });

    listaInventario.innerHTML = '';
    filtrados.forEach(item => {
        const row = document.createElement('tr');

        let proveedoresHTML = '';
        if (item.proveedoresList && item.proveedoresList.length > 0) {
            proveedoresHTML = `
                <div class="multi-proveedores-toggle" onclick="toggleProveedores('${item.codigo}')" style="cursor: pointer; color: var(--primary); font-size: 0.75rem; font-weight: 600;">
                    Ver proveedores (${item.proveedoresList.length}) ▾
                </div>
                <div id="prov-${item.codigo}" class="proveedores-lista" style="display: none; margin-top: 0.5rem; border-top: 1px solid var(--border); padding-top: 0.5rem;">
                    ${item.proveedoresList.map(p => `
                        <div style="font-size: 0.7rem; margin-bottom: 0.4rem; padding-bottom: 0.2rem; border-bottom: 1px dashed var(--border);">
                            <div style="font-weight: 700; color: var(--foreground);">${p.nombre}</div>
                            <div style="color: var(--muted-foreground);">
                                S/ ${(p.costoUnitario || 0).toFixed(2)} | Stock: ${p.stock || 0}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        row.innerHTML = `
            <td>${item.codigo}</td>
            <td style="font-weight: 600;">[${item.nombre}]</td>
            <td>${item.categoria}</td>
            <td>
                ${proveedoresHTML || item.proveedor || '-'}
            </td>
            <td>[S/ ${(item.costoUnitario || 0).toFixed(2)}]</td>
            <td>[S/ ${(item.costoTotal || 0).toFixed(2)}]</td>
            <td>${item.ultimoIngreso || '-'}</td>
            <td><span class="badge-estado badge-${item.estado}">${item.estado}</span></td>
            <td>${item.ubicacion || '-'}</td>
            <td style="font-weight: 700;">[${item.stockActual} ${item.unidad}]</td>
            <td>[${item.stockMinimo} ${item.unidad}]</td>
        `;
        listaInventario.appendChild(row);
    });

    totalInsumosLabel.textContent = filtrados.length;
    stockOkLabel.textContent = filtrados.filter(i => i.estado === 'ok').length;
    stockBajoLabel.textContent = filtrados.filter(i => i.estado === 'bajo').length;
    stockCriticoLabel.textContent = filtrados.filter(i => i.estado === 'critico').length;
}

window.toggleProveedores = function(codigo) {
    const el = document.getElementById(`prov-${codigo}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
};

function configurarEventos() {
    buscador.addEventListener('input', renderizarInventario);
    filtroCategoria.addEventListener('change', renderizarInventario);
    filtroEstado.addEventListener('change', renderizarInventario);

    if (btnAgregarInsumos) {
        btnAgregarInsumos.addEventListener('click', () => {
            window.location.href = '../2-entrada-de-insumos-mejorado/entrada-de-insumos.html';
        });
    }

    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const key = th.dataset.sort;
            sortConfig.direction = (sortConfig.key === key && sortConfig.direction === 'asc') ? 'desc' : 'asc';
            sortConfig.key = key;
            renderizarInventario();
        });
    });
}

init();
