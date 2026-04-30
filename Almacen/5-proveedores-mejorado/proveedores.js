/**
 * MÓDULO PROVEEDORES - MiRest
 * Gestión de proveedores con clasificación automática por distancia y crédito.
 */

// --- CONFIGURACIÓN Y ESTADO ---
const PUNTO_BASE = { lat: -9.0743, lng: -78.5937 }; // Plaza de Armas de Chimbote
let proveedores = [];
let proveedoresFiltrados = [];
let editandoId = null;
let categoriasSistema = [];
let ubicacionTemporal = null;

// --- ELEMENTOS DEL DOM ---
const listaProveedores = document.getElementById('listaProveedores');
const formProveedor = document.getElementById('formProveedor');
const modalProveedor = document.getElementById('modalProveedor');
const modalTitulo = document.getElementById('modalTitulo');
const busquedaInput = document.getElementById('busquedaProveedor');
const filtroCategoria = document.getElementById('filtroTipo');
const countFiltrados = document.getElementById('countFiltrados');
const countTotal = document.getElementById('countTotal');
const mensajeVacio = document.getElementById('mensajeVacio');
const inputDireccion = document.getElementById('direccion');
const inputLatitud = document.getElementById('latitud');
const inputLongitud = document.getElementById('longitud');

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', async () => {
    await cargarCategoriasDesdeInventario();
    await cargarDatos();
    configurarEventos();
    renderizarTabla();
    actualizarFiltrosDinamicos();
});

async function cargarCategoriasDesdeInventario() {
    try {
        const inventario = await window.AlmacenDB.getInsumos();
        categoriasSistema = [...new Set(inventario.map(i => i.categoria))].sort();
    } catch (err) {
        console.error('[proveedores] Error al cargar categorías:', err);
        categoriasSistema = [];
    }
}

async function cargarDatos() {
    try {
        proveedores = await window.AlmacenDB.getProveedores();
        proveedoresFiltrados = [...proveedores];
    } catch (err) {
        console.error('[proveedores] Error al cargar proveedores:', err);
        proveedores = [];
        proveedoresFiltrados = [];
    }
}

// --- LÓGICA DE CLASIFICACIÓN ---
function calcularClasificacion(distanciaKm, diasCredito) {
    if (distanciaKm === null || distanciaKm === undefined) return 0;
    let scoreDistancia = 5 * (1 - (distanciaKm / 10));
    scoreDistancia = Math.max(0, Math.min(5, scoreDistancia));
    let scoreCredito = Math.min((diasCredito / 30) * 5, 5);
    const scoreTotal = scoreDistancia + scoreCredito;

    if (scoreTotal <= 2) return 1;
    if (scoreTotal <= 4) return 2;
    if (scoreTotal <= 6) return 3;
    if (scoreTotal <= 8) return 4;
    return 5;
}

// --- RENDERIZADO ---
function renderizarTabla() {
    listaProveedores.innerHTML = '';

    if (proveedoresFiltrados.length === 0) {
        mensajeVacio.style.display = 'block';
    } else {
        mensajeVacio.style.display = 'none';
        proveedoresFiltrados.forEach(p => {
            // Normalizar campos snake_case o camelCase
            const diasCredito = p.dias_credito !== undefined ? p.dias_credito : (p.diasCredito || 0);
            const distanciaKm = p.distancia_km !== undefined ? p.distancia_km : (p.distanciaKm || 0);
            const ultimoIngreso = p.ultimo_ingreso || p.ultimoIngreso || '---';

            const estrellas = calcularClasificacion(distanciaKm, diasCredito);
            const row = document.createElement('tr');
            if (p.estado === 'Inactivo') row.style.opacity = '0.6';

            const categoriasStr = Array.isArray(p.categoria) ? p.categoria.join(', ') : (p.categoria || '-');
            const direccionStr = typeof p.ubicacion === 'object' ? p.ubicacion.direccion : (p.ubicacion || '-');

            row.innerHTML = `
                <td>${p.id}</td>
                <td style="font-weight: 600;">${p.nombre}</td>
                <td style="font-family: monospace; font-size: 0.8rem;">${p.ruc || '-'}</td>
                <td><a href="tel:${p.telefono}" style="text-decoration:none; color:inherit;">📞 ${p.telefono || '-'}</a></td>
                <td style="font-size: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${categoriasStr}">${categoriasStr}</td>
                <td style="font-size: 0.75rem; max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${direccionStr}">${direccionStr}</td>
                <td style="font-weight: 500;">${diasCredito} días</td>
                <td style="font-size: 0.8rem;">${ultimoIngreso}</td>
                <td><span class="badge badge-${(p.estado || 'activo').toLowerCase()}">${p.estado || 'Activo'}</span></td>
                <td>
                    <div class="stars">
                        ${'⭐'.repeat(estrellas)}
                    </div>
                </td>
                <td>
                    <div class="actions-cell">
                        <button class="btn-icon" onclick="prepararEdicion(${p.id})" title="Editar">✏️</button>
                        <button class="btn-icon" onclick="cambiarEstado(${p.id})" title="${p.estado === 'Activo' ? 'Desactivar' : 'Activar'}">
                            ${p.estado === 'Activo' ? '🚫' : '✅'}
                        </button>
                    </div>
                </td>
            `;
            listaProveedores.appendChild(row);
        });
    }

    countFiltrados.textContent = proveedoresFiltrados.length;
    countTotal.textContent = proveedores.length;
}

function actualizarFiltrosDinamicos() {
    const categoriasExistentes = ['Todos', ...new Set(proveedores.flatMap(p => Array.isArray(p.categoria) ? p.categoria : [p.categoria]))].sort();
    const valorActual = filtroCategoria.value;
    filtroCategoria.innerHTML = '';
    categoriasExistentes.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c;
        opt.textContent = c === 'Todos' ? 'Todas las categorías' : c;
        filtroCategoria.appendChild(opt);
    });
    if (categoriasExistentes.includes(valorActual)) filtroCategoria.value = valorActual;
}

// --- EVENTOS Y CRUD ---
function configurarEventos() {
    document.getElementById('btnAbrirModal').onclick = () => {
        editandoId = null;
        modalTitulo.textContent = 'Nuevo Proveedor';
        formProveedor.reset();
        document.getElementById('proveedorId').value = '';
        renderizarSelectorCategorias();
        document.getElementById("mapFrame").src = "https://www.google.com/maps?q=Plaza+de+Armas+Lima&output=embed";
        modalProveedor.classList.add('active');
    };

    document.getElementById('btnCerrarModal').onclick = cerrarModal;
    document.getElementById('btnCancelar').onclick = cerrarModal;

    formProveedor.onsubmit = async (e) => {
        e.preventDefault();

        const id = document.getElementById('proveedorId').value;
        const nombre = document.getElementById('nombre').value;
        const direccion = inputDireccion.value;

        if (!direccion.trim()) {
            alert('Debe ingresar una dirección.');
            return;
        }

        const categoriasSeleccionadas = Array.from(document.querySelectorAll('.cat-checkbox:checked')).map(cb => cb.value);
        if (categoriasSeleccionadas.length === 0) {
            alert('Debe seleccionar al menos una categoría.');
            return;
        }

        const nuevoProv = {
            nombre: nombre,
            ruc: document.getElementById('ruc').value,
            telefono: document.getElementById('telefono').value,
            categoria: categoriasSeleccionadas,
            ubicacion: direccion,
            dias_credito: parseInt(document.getElementById('diasCredito').value) || 0,
            distancia_km: 0,
            estado: 'Activo',
            ultimo_ingreso: id ? (proveedores.find(p => p.id == id) || {}).ultimo_ingreso || new Date().toLocaleDateString("es-PE") : new Date().toLocaleDateString("es-PE")
        };

        try {
            if (id) {
                await window.AlmacenDB.updateProveedor(parseInt(id), nuevoProv);
            } else {
                nuevoProv.id = Date.now();
                await window.AlmacenDB.insertProveedor(nuevoProv);
            }
            // Recargar desde Supabase
            proveedores = await window.AlmacenDB.getProveedores();
            proveedoresFiltrados = [...proveedores];
        } catch (err) {
            console.error('[proveedores] Error al guardar proveedor:', err);
            alert('Error al guardar el proveedor.');
            return;
        }

        cerrarModal();
        filtrarProveedores();
        actualizarFiltrosDinamicos();
        alert('Proveedor guardado con éxito');
    };

    busquedaInput.oninput = filtrarProveedores;
    filtroCategoria.onchange = filtrarProveedores;
}

function renderizarSelectorCategorias(seleccionadas = []) {
    const contenedor = document.getElementById('categoriaSelectorContainer');
    if (!contenedor) return;

    contenedor.innerHTML = '';
    categoriasSistema.forEach(cat => {
        const div = document.createElement('div');
        div.style.display = 'flex';
        div.style.alignItems = 'center';
        div.style.gap = '0.5rem';
        div.style.fontSize = '0.85rem';

        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.className = 'cat-checkbox';
        cb.value = cat;
        cb.checked = seleccionadas.includes(cat);

        const label = document.createElement('label');
        label.textContent = cat;

        div.appendChild(cb);
        div.appendChild(label);
        contenedor.appendChild(div);
    });
}

function cerrarModal() {
    modalProveedor.classList.remove('active');
}

function filtrarProveedores() {
    const busqueda = busquedaInput.value.toLowerCase();
    const categoriaFiltro = filtroCategoria.value;

    proveedoresFiltrados = proveedores.filter(p => {
        const matchNombre = p.nombre.toLowerCase().includes(busqueda) || (p.ruc || '').includes(busqueda);
        const cats = Array.isArray(p.categoria) ? p.categoria : [p.categoria];
        const matchCategoria = categoriaFiltro === 'Todos' || cats.includes(categoriaFiltro);
        return matchNombre && matchCategoria;
    });

    renderizarTabla();
}

window.prepararEdicion = (id) => {
    const p = proveedores.find(prov => prov.id == id);
    if (!p) return;

    editandoId = id;
    modalTitulo.textContent = 'Editar Proveedor';
    document.getElementById('proveedorId').value = p.id;
    document.getElementById('nombre').value = p.nombre;
    document.getElementById('ruc').value = p.ruc || '';
    document.getElementById('telefono').value = p.telefono || '';
    document.getElementById('diasCredito').value = p.dias_credito !== undefined ? p.dias_credito : (p.diasCredito || 0);

    const direccion = typeof p.ubicacion === 'object' ? p.ubicacion.direccion : (p.ubicacion || '');
    inputDireccion.value = direccion;

    if (direccion) {
        const url = "https://www.google.com/maps?q=" + encodeURIComponent(direccion) + "&output=embed";
        document.getElementById("mapFrame").src = url;
    }

    const seleccionadas = Array.isArray(p.categoria) ? p.categoria : [p.categoria];
    renderizarSelectorCategorias(seleccionadas);

    modalProveedor.classList.add('active');
};

window.cambiarEstado = async (id) => {
    const p = proveedores.find(prov => prov.id == id);
    if (!p) return;
    const nuevoEstado = p.estado === 'Activo' ? 'Inactivo' : 'Activo';
    try {
        await window.AlmacenDB.updateProveedor(id, { estado: nuevoEstado });
        p.estado = nuevoEstado;
        filtrarProveedores();
    } catch (err) {
        console.error('[proveedores] Error al cambiar estado:', err);
    }
};
