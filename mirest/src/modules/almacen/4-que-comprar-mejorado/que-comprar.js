// Estado de la aplicación
let inventario = [];
let productosFiltrados = [];
let filtroActual = 'todos';
let busquedaActual = '';

// Elementos del DOM
const listaQueComprar = document.getElementById('listaQueComprar');
const mensajeVacio = document.getElementById('mensajeVacio');
const totalPorComprar = document.getElementById('totalPorComprar');
const totalCriticos = document.getElementById('totalCriticos');
const totalBajos = document.getElementById('totalBajos');
const busquedaInput = document.getElementById('busquedaInsumo');
const filterBtns = document.querySelectorAll('.filter-btn');

// Inicialización
function init() {
    cargarDatos();
    configurarEventos();
}

async function cargarDatos() {
    try {
        const datosInventario = await window.AlmacenDB.getInsumos();

        // Filtrar solo los que necesitan compra: stockActual <= stockMinimo
        inventario = datosInventario
            .filter(item => item.stockActual <= item.stockMinimo)
            .map(item => {
                const sugerido = calcularCantidadSugerida(item.stockActual, item.stockMinimo);
                return {
                    ...item,
                    estadoRepo: item.estado || getEstado(item),
                    sugerido,
                    costoEstimado: sugerido * (item.costoUnitario || 0)
                };
            });

        actualizarContadores();
        filtrarYRenderizar();
    } catch (err) {
        console.error('[que-comprar] Error al cargar datos:', err);
        listaQueComprar.innerHTML = '<tr><td colspan="11" style="text-align:center; padding:2rem; color:#ef4444;">❌ Error al cargar datos. Verifique la conexión.</td></tr>';
    }
}

function calcularCantidadSugerida(stockActual, stockMinimo) {
    return Math.max(0, (stockMinimo * 2) - stockActual);
}

function getEstado(item) {
    const stock = item.stockActual || 0;
    const minimo = item.stockMinimo || 0;
    if (stock === 0) return 'critico';
    if (stock <= minimo * 0.5) return 'critico';
    if (stock <= minimo) return 'bajo';
    return 'ok';
}

function actualizarContadores() {
    totalPorComprar.textContent = inventario.length;
    totalCriticos.textContent = inventario.filter(i => i.estadoRepo === 'critico').length;
    totalBajos.textContent = inventario.filter(i => i.estadoRepo === 'bajo').length;
}

function filtrarYRenderizar() {
    productosFiltrados = inventario.filter(item => {
        if (filtroActual !== 'todos' && item.estadoRepo !== filtroActual) return false;
        if (busquedaActual && !item.nombre.toLowerCase().includes(busquedaActual.toLowerCase())) return false;
        return true;
    });

    // Ordenar por urgencia (críticos primero)
    productosFiltrados.sort((a, b) => {
        if (a.estadoRepo === 'critico' && b.estadoRepo !== 'critico') return -1;
        if (a.estadoRepo !== 'critico' && b.estadoRepo === 'critico') return 1;
        return 0;
    });

    renderizarTabla();
}

function renderizarTabla() {
    listaQueComprar.innerHTML = '';

    if (productosFiltrados.length === 0) {
        mensajeVacio.style.display = 'block';
        document.getElementById('tablaQueComprar').style.display = 'none';
        return;
    }

    mensajeVacio.style.display = 'none';
    document.getElementById('tablaQueComprar').style.display = 'table';

    productosFiltrados.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="font-weight: 600;">${item.nombre}</td>
            <td style="font-size: 0.75rem; color: var(--muted-foreground);">${item.categoria}</td>
            <td style="font-weight: 700;">${item.stockActual} ${item.unidad}</td>
            <td>${item.stockMinimo} ${item.unidad}</td>
            <td style="color: var(--primary); font-weight: 700;">+${item.sugerido.toFixed(1)} ${item.unidad}</td>
            <td style="font-weight: 600;">S/ ${item.costoEstimado.toFixed(2)}</td>
            <td style="font-size: 0.75rem;">${item.proveedor || '-'}</td>
            <td style="font-size: 0.75rem; color: var(--muted-foreground);">${item.ubicacion || '-'}</td>
            <td style="font-size: 0.75rem;">${item.ultimoIngreso || '-'}</td>
            <td><span class="badge badge-${item.estadoRepo}">${item.estadoRepo}</span></td>
            <td>
                <button class="btn-contactar" onclick="contactarProveedor('${item.proveedor}')">💬 Contactar</button>
            </td>
        `;
        listaQueComprar.appendChild(row);
    });
}

function configurarEventos() {
    busquedaInput.addEventListener('input', (e) => {
        busquedaActual = e.target.value;
        filtrarYRenderizar();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            filtroActual = btn.dataset.filter;
            filtrarYRenderizar();
        });
    });
}

function contactarProveedor(proveedor) {
    window.location.href = '../../Clientes-Bruce/clientes.html?nombre=' + encodeURIComponent(proveedor);
}

init();
