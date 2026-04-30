// Estado de la aplicación
let historialCompleto = [];
let historialFiltrado = [];
let moduloSeleccionado = '';

// Elementos del DOM
const contenidoHistorial = document.getElementById('contenidoHistorial');
const listaHistorial = document.getElementById('listaHistorial');
const totalEncontrados = document.getElementById('totalEncontrados');
const montoFiltrado = document.getElementById('montoFiltrado');

const filtroModulo = document.createElement('select');
filtroModulo.id = 'filtroModulo';
filtroModulo.innerHTML = `
    <option value="">Seleccione un módulo</option>
    <option value="entrada">Entrada</option>
    <option value="salida">Salida</option>
    <option value="proveedores">Proveedores</option>
    <option value="que comprar">Qué Comprar</option>
`;

const busquedaGlobal = document.getElementById('busquedaInsumo');
busquedaGlobal.placeholder = "Buscador global (insumo, usuario, proveedor, etc)...";

const btnFiltrar = document.getElementById('btnFiltrar');
const btnLimpiar = document.getElementById('btnLimpiar');

// Inicialización
function init() {
    const filtrosGrid = document.querySelector('.filtros-grid');
    if (filtrosGrid) {
        const firstGroup = filtrosGrid.querySelector('.form-group');
        const moduloGroup = document.createElement('div');
        moduloGroup.className = 'form-group';
        moduloGroup.innerHTML = '<label>Módulo Principal *</label>';
        moduloGroup.appendChild(filtroModulo);
        filtrosGrid.insertBefore(moduloGroup, firstGroup);
    }

    listaHistorial.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem; color: var(--muted-foreground);">Seleccione un módulo para ver los datos</td></tr>';

    configurarEventos();
}

async function cargarDatosModulo(modulo) {
    moduloSeleccionado = modulo;
    listaHistorial.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:var(--muted-foreground);">⏳ Cargando...</td></tr>';

    let datos = [];

    try {
        if (modulo === 'entrada') {
            const entradas = await window.AlmacenDB.getEntradas();
            datos = entradas.map(e => ({
                ...e,
                modulo: 'entrada',
                movimiento: e.movimiento || 'ENTRADA',
                monto: e.costo_total_movimiento || e.costoTotalMovimiento || 0,
                detalle: e.detalle || e.ingredientes || []
            }));
        } else if (modulo === 'salida') {
            const salidas = await window.AlmacenDB.getSalidas();
            datos = salidas.map(s => ({
                ...s,
                modulo: 'salida',
                movimiento: 'SALIDA',
                monto: s.costo_total_movimiento || s.costoTotalMovimiento || 0,
                detalle: s.detalle || s.ingredientes || []
            }));
        } else if (modulo === 'proveedores') {
            datos = [];
        } else if (modulo === 'que comprar') {
            const inventario = await window.AlmacenDB.getInsumos();
            datos = inventario
                .filter(i => i.stockActual <= i.stockMinimo)
                .map(i => ({
                    id: i.codigo,
                    fecha: new Date().toLocaleDateString("es-PE"),
                    hora: "--:--",
                    tipo: 'sugerencia',
                    movimiento: 'COMPRA',
                    usuario: 'sistema',
                    monto: i.costoTotal || 0,
                    detalle: [{ nombre: i.nombre, cantidad: i.stockMinimo - i.stockActual, costoUnitario: i.costoUnitario, costoTotal: i.costoTotal }],
                    proveedorNombre: i.proveedor
                }));
        }
    } catch (err) {
        console.error('[historial] Error al cargar módulo', modulo, err);
        listaHistorial.innerHTML = '<tr><td colspan="9" style="text-align:center; padding:2rem; color:#ef4444;">❌ Error al cargar datos. Verifique la conexión.</td></tr>';
        return;
    }

    historialCompleto = datos.sort((a, b) => {
        const dateA = parseFechaHora(a.fecha, a.hora);
        const dateB = parseFechaHora(b.fecha, b.hora);
        return dateB - dateA;
    });

    historialFiltrado = [...historialCompleto];
    renderizarHistorial(historialFiltrado);
}

function parseFechaHora(fechaStr, horaStr) {
    if (!fechaStr) return new Date(0);
    let d, m, y;
    if (fechaStr.includes('/')) {
        [d, m, y] = fechaStr.split('/').map(Number);
    } else {
        [y, m, d] = fechaStr.split('-').map(Number);
    }
    const [h, min] = (horaStr || "00:00").split(':').map(Number);
    return new Date(y, m - 1, d, h, min);
}

function renderizarHistorial(datos) {
    listaHistorial.innerHTML = '';
    if (datos.length === 0) {
        listaHistorial.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">No se encontraron registros</td></tr>';
        totalEncontrados.textContent = '0';
        montoFiltrado.textContent = 'S/ 0.00';
        return;
    }

    let totalMonto = 0;
    datos.forEach(item => {
        if (item.tipo !== 'no-valido') totalMonto += (item.monto || 0);

        const row = document.createElement('tr');
        if (item.tipo === 'no-valido') row.style.opacity = '0.5';

        let detalleHTML = '<div class="detalle-list">';
        const items = item.detalle || [];
        items.forEach(ins => {
            detalleHTML += `
                <div style="margin-bottom: 0.5rem; border-bottom: 1px solid var(--muted); padding-bottom: 0.25rem; font-size: 0.85rem; display: grid; grid-template-columns: 2fr 1fr 1.5fr 1.5fr; gap: 8px;">
                    <span title="Insumo">${ins.nombre}</span>
                    <span title="Cantidad">${ins.cantidad}</span>
                    <span title="Costo Unitario">S/ ${(ins.costoUnitario || 0).toFixed(2)}</span>
                    <span title="Costo Total">S/ ${(ins.costoTotal || 0).toFixed(2)}</span>
                </div>
            `;
        });
        detalleHTML += '</div>';

        let adjuntosHTML = '';
        if (item.archivos && item.archivos.length > 0) {
            adjuntosHTML += '<div style="display:flex; flex-wrap:wrap; gap:5px; margin-bottom: 5px;">';
            item.archivos.forEach(file => {
                adjuntosHTML += `<a href="${file.data}" download="${file.name}" title="Descargar ${file.name}" style="background: var(--secondary); padding: 4px; border-radius: 4px; font-size: 0.7rem; text-decoration: none; color: var(--primary);">💾 ${file.name}</a>`;
            });
            adjuntosHTML += '</div>';
        }
        if (item.notas) adjuntosHTML += `<div style="font-size: 0.65rem; color: var(--muted-foreground); font-style: italic;">"${item.notas}"</div>`;

        let proveedoresSet = new Set();
        if (item.proveedorNombre && item.proveedorNombre !== "Varios (según inventario)") proveedoresSet.add(item.proveedorNombre);
        items.forEach(ins => { if (ins.proveedor && ins.proveedor !== "-") proveedoresSet.add(ins.proveedor); });
        const proveedoresStr = Array.from(proveedoresSet).join(', ') || '-';

        row.innerHTML = `
            <td>
                <div style="font-weight: 600;">${item.fecha}</div>
                <div style="color: var(--muted-foreground); font-size: 0.7rem;">${item.hora}</div>
            </td>
            <td>${item.id}</td>
            <td><span class="badge-tipo badge-${item.tipo}">${item.tipo}</span></td>
            <td style="font-weight: 700; font-size: 0.65rem;">${item.movimiento}</td>
            <td>${detalleHTML}</td>
            <td style="font-size: 0.7rem;">${proveedoresStr}</td>
            <td style="font-weight: 700; color: var(--primary);">S/ ${(item.monto || 0).toFixed(2)}</td>
            <td>${item.usuario || 'admin'}</td>
            <td>${adjuntosHTML || '-'}</td>
        `;
        listaHistorial.appendChild(row);
    });

    totalEncontrados.textContent = datos.length;
    montoFiltrado.textContent = `S/ ${totalMonto.toFixed(2)}`;
}

function configurarEventos() {
    filtroModulo.addEventListener('change', (e) => {
        if (e.target.value) {
            cargarDatosModulo(e.target.value);
        } else {
            listaHistorial.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">Seleccione un módulo</td></tr>';
            totalEncontrados.textContent = '0';
            montoFiltrado.textContent = 'S/ 0.00';
        }
    });

    btnFiltrar.addEventListener('click', () => {
        if (!moduloSeleccionado) {
            alert("Debe seleccionar un módulo primero");
            return;
        }

        const desde = document.getElementById('filtroDesde').value;
        const hasta = document.getElementById('filtroHasta').value;
        const busqueda = busquedaGlobal.value.toLowerCase();

        historialFiltrado = historialCompleto.filter(item => {
            if (desde || hasta) {
                const itemDate = parseFechaHora(item.fecha, "00:00");
                if (desde && itemDate < new Date(desde + "T00:00:00")) return false;
                if (hasta && itemDate > new Date(hasta + "T23:59:59")) return false;
            }

            if (busqueda) {
                const inDetalle = item.detalle.some(d => d.nombre.toLowerCase().includes(busqueda));
                const inUsuario = (item.usuario || "").toLowerCase().includes(busqueda);
                const inProveedor = (item.proveedorNombre || "").toLowerCase().includes(busqueda);
                const inId = (item.id || "").toLowerCase().includes(busqueda);
                const inNotas = (item.notas || "").toLowerCase().includes(busqueda);

                if (!inDetalle && !inUsuario && !inProveedor && !inId && !inNotas) return false;
            }

            return true;
        });

        renderizarHistorial(historialFiltrado);
    });

    btnLimpiar.addEventListener('click', () => {
        document.getElementById('filtroDesde').value = '';
        document.getElementById('filtroHasta').value = '';
        busquedaGlobal.value = '';
        filtroModulo.value = '';
        moduloSeleccionado = '';
        listaHistorial.innerHTML = '<tr><td colspan="9" style="text-align:center; padding: 2rem;">Seleccione un módulo</td></tr>';
        totalEncontrados.textContent = '0';
        montoFiltrado.textContent = 'S/ 0.00';
    });
}

init();
