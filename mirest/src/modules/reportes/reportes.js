/**
 * reportes.js — Módulo Reportes
 * Lógica de negocio y eventos específicos de Reportes
 */

import { renderReportes, initializeStats, initializeTime, getIconForTipo, getIconClassForTipo } from './render.js';
import { showToast as uiShowToast } from '../scripts/ui-utils.js';
import { initTheme } from './theme.js';

document.addEventListener('DOMContentLoaded', () => {
    initializeReportes();
});

let reportesData = [];
let reporteActualDescargar = null;

function initializeReportes() {
    initializeTime();
    initializeReportesData();
    renderReportes(reportesData);
    initializeStats(reportesData);
    initializeFilters();
    initializeSearch();
    initializeActions();
    initTheme();
    lucide.createIcons();
}

function initializeReportesData() {
    reportesData = [
        {
            id: 1,
            tipo: 'ventas',
            nombre: 'Reporte de Ventas del Día',
            descripcion: 'Resumen de ventas, ticket promedio y comparativa horaria.',
            fecha: 'Hoy',
            formato: 'PDF',
            tamano: 2.4,
            icon: 'trending-up',
            iconClass: 'green'
        },
        {
            id: 2,
            tipo: 'productos',
            nombre: 'Productos Más Vendidos',
            descripcion: 'Análisis de productos por cantidad y revenue generado.',
            fecha: 'Semanal',
            formato: 'XLSX',
            tamano: 1.8,
            icon: 'package',
            iconClass: 'orange'
        },
        {
            id: 3,
            tipo: 'clientes',
            nombre: 'Reporte de Clientes',
            descripcion: 'Nuevos clientes, frecuencia de compra y segmentación.',
            fecha: 'Mensual',
            formato: 'PDF',
            tamano: 3.1,
            icon: 'users',
            iconClass: 'blue'
        },
        {
            id: 4,
            tipo: 'caja',
            nombre: 'Cierre de Caja',
            descripcion: 'Resumen de ingresos, métodos de pago y arqueo de caja.',
            fecha: 'Hoy',
            formato: 'PDF',
            tamano: 1.2,
            icon: 'banknote',
            iconClass: 'yellow'
        },
        {
            id: 5,
            tipo: 'inventario',
            nombre: 'Estado de Inventario',
            descripcion: 'Stock actual, alertas de productos bajos y rotación.',
            fecha: 'Semanal',
            formato: 'XLSX',
            tamano: 2.7,
            icon: 'warehouse',
            iconClass: 'red'
        },
        {
            id: 6,
            tipo: 'ventas',
            nombre: 'Resumen Mensual de Ventas',
            descripcion: 'Análisis completo del mes con tendencias y comparativas.',
            fecha: 'Mensual',
            formato: 'PDF',
            tamano: 4.5,
            icon: 'bar-chart-3',
            iconClass: 'green'
        },
        {
            id: 7,
            tipo: 'productos',
            nombre: 'Análisis de Margen de Productos',
            descripcion: 'Rentabilidad por producto, costos y margen de ganancia.',
            fecha: 'Mensual',
            formato: 'XLSX',
            tamano: 3.3,
            icon: 'percent',
            iconClass: 'orange'
        },
        {
            id: 8,
            tipo: 'clientes',
            nombre: 'Fidelización de Clientes',
            descripcion: 'Programa de lealtad, puntos y recompensas acumuladas.',
            fecha: 'Mensual',
            formato: 'PDF',
            tamano: 2.1,
            icon: 'gift',
            iconClass: 'blue'
        },
        {
            id: 9,
            tipo: 'caja',
            nombre: 'Flujo de Efectivo',
            descripcion: 'Análisis de entradas y salidas de dinero por período.',
            fecha: 'Semanal',
            formato: 'XLSX',
            tamano: 1.5,
            icon: 'dollar-sign',
            iconClass: 'yellow'
        },
        {
            id: 10,
            tipo: 'inventario',
            nombre: 'Rotación de Inventario',
            descripcion: 'Velocidad de venta y productos con mayor rotación.',
            fecha: 'Mensual',
            formato: 'PDF',
            tamano: 2.8,
            icon: 'repeat',
            iconClass: 'red'
        }
    ];
}

/* ── Filtros ── */
function initializeFilters() {
    const filterBtns = document.querySelectorAll('.rp-filter-btn');
    const searchInput = document.getElementById('rpSearchInput');

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const filtro = btn.dataset.filter;
            const busqueda = searchInput?.value || '';
            renderReportes(reportesData, filtro, busqueda);
        });
    });

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const filtroActivo = document.querySelector('.rp-filter-btn.active')?.dataset.filter || 'todos';
            renderReportes(reportesData, filtroActivo, e.target.value);
        });
    }
}

/* ── Búsqueda ── */
function initializeSearch() {
    const searchInput = document.getElementById('rpSearchInput');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
        const filtroActivo = document.querySelector('.rp-filter-btn.active')?.dataset.filter || 'todos';
        renderReportes(reportesData, filtroActivo, e.target.value);
    });
}

/* ── Acciones ── */
function initializeActions() {
    const btnGenerar = document.getElementById('btnGenerarReporte');
    const btnExportar = document.getElementById('btnExportarTodos');
    const btnRefrescar = document.getElementById('btnRefrescarReportes');
    const btnGenerarMain = document.getElementById('btnGenerarReporteMain');

    btnGenerar?.addEventListener('click', () => abrirModalGenerar());
    btnExportar?.addEventListener('click', () => exportarTodos());
    btnRefrescar?.addEventListener('click', () => refrescarReportes());

    btnGenerarMain?.addEventListener('click', () => {
        showToast('Generando vista previa...');
        setTimeout(() => {
            const emptyState = document.getElementById('reporteEmptyState');
            const content = document.getElementById('reporteContent');
            const actions = document.getElementById('reporteHeaderActions');
            
            // Reflejar tipo y fechas del formulario en el borrador
            const tipoSelect = document.getElementById('rpInputTipo');
            const fechaHastaInput = document.getElementById('rpInputFechaHasta');
            
            if (tipoSelect) {
                const badge = document.querySelector('.rp-paper-meta .rp-badge-orange');
                if (badge) {
                    const cleanText = tipoSelect.value.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ ]/g, '').trim();
                    badge.textContent = cleanText || 'Reporte';
                }
            }
            
            if (fechaHastaInput && fechaHastaInput.value) {
                const dateP = document.querySelector('.rp-paper-meta p');
                if (dateP) {
                    const h = new Date().getHours().toString().padStart(2, '0');
                    const m = new Date().getMinutes().toString().padStart(2, '0');
                    const [yy, mm, dd] = fechaHastaInput.value.split('-');
                    dateP.innerHTML = `${dd}/${mm}/${yy} &mdash; ${h}:${m}`;
                }
            }

            if (emptyState) emptyState.style.display = 'none';
            if (content) content.style.display = 'block';
            if (actions) actions.style.display = 'flex';
            
            showToast('Vista previa cargada', 'success');
        }, 600);
    });

    initializeModales();
    initializeSelectableButtons();
    initializeNotesTools();
}

/* ── Herramientas de Notas ── */
function initializeNotesTools() {
    const btnVoz = document.getElementById('btnDictarVoz');
    const btnImg = document.getElementById('btnAdjuntarImagen');
    const inputImg = document.getElementById('inputFileImage');
    const textarea = document.getElementById('notasObservaciones');
    const previewContainer = document.getElementById('imagePreviewContainer');

    btnVoz?.addEventListener('click', () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            showToast('Tu navegador no soporta dictado por voz', 'info');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'es-ES';
        recognition.interimResults = false;

        recognition.onstart = function() {
            showToast('Micrófono activado. Habla ahora...', 'info');
            if (btnVoz) btnVoz.style.color = '#ef4444'; // Rojo durante grabación
        };

        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            if (textarea) {
                textarea.value += (textarea.value ? ' ' : '') + transcript;
            }
            showToast('Texto transcrito correctamente', 'success');
            if (btnVoz) btnVoz.style.color = '';
        };

        recognition.onerror = function(event) {
            // Error común al no permitir el micrófono
            const errorMsg = event.error === 'not-allowed' ? 'Permiso denegado para usar el micrófono' : 'Error en dictado: ' + event.error;
            showToast(errorMsg, 'info');
            if (btnVoz) btnVoz.style.color = '';
        };

        recognition.onend = function() {
            if (btnVoz) btnVoz.style.color = '';
        };

        recognition.start();
    });

    btnImg?.addEventListener('click', () => {
        inputImg?.click();
    });

    inputImg?.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();

            reader.onload = function(event) {
                const imgWrap = document.createElement('div');
                imgWrap.style.position = 'relative';
                
                const img = document.createElement('img');
                img.src = event.target.result;
                img.style.width = '70px';
                img.style.height = '70px';
                img.style.objectFit = 'cover';
                img.style.borderRadius = '8px';
                img.style.border = '1px solid var(--rp-border, #e5e7eb)';
                
                const removeBtn = document.createElement('button');
                removeBtn.innerHTML = '&times;';
                removeBtn.style.position = 'absolute';
                removeBtn.style.top = '-6px';
                removeBtn.style.right = '-6px';
                removeBtn.style.width = '20px';
                removeBtn.style.height = '20px';
                removeBtn.style.background = '#ef4444';
                removeBtn.style.color = 'white';
                removeBtn.style.border = 'none';
                removeBtn.style.borderRadius = '50%';
                removeBtn.style.cursor = 'pointer';
                removeBtn.style.fontSize = '12px';
                removeBtn.style.display = 'grid';
                removeBtn.style.placeItems = 'center';
                
                removeBtn.onclick = () => imgWrap.remove();

                imgWrap.appendChild(img);
                imgWrap.appendChild(removeBtn);

                if (previewContainer) {
                    previewContainer.appendChild(imgWrap);
                }
            };
            
            reader.readAsDataURL(file);
            showToast('Imagen adjuntada', 'success');
            e.target.value = '';
        }
    });
}

/* ── Modales ── */
function initializeModales() {
    const modalGenerar = document.getElementById('generarReporteModal');
    const modalDescargar = document.getElementById('descargarModal');

    document.getElementById('closeGenerarModal')?.addEventListener('click', () => cerrarModal(modalGenerar));
    document.getElementById('closeDescargarModal')?.addEventListener('click', () => cerrarModal(modalDescargar));

    modalGenerar?.addEventListener('click', (e) => { if (e.target === modalGenerar) cerrarModal(modalGenerar); });
    modalDescargar?.addEventListener('click', (e) => { if (e.target === modalDescargar) cerrarModal(modalDescargar); });

    document.getElementById('btnConfirmarGenerar')?.addEventListener('click', () => confirmarGenerar());
    document.getElementById('btnConfirmarDescarga')?.addEventListener('click', () => confirmarDescarga());
}

function initializeSelectableButtons() {
    document.querySelectorAll('.rp-selectable-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const group = btn.closest('.rp-btn-group');
            if (!group) return;

            group.querySelectorAll('.rp-selectable-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const input = group.parentElement.querySelector('input[type="hidden"]');
            if (input) input.value = btn.dataset.value;
        });
    });
}

function abrirModalGenerar() {
    const modal = document.getElementById('generarReporteModal');
    modal.classList.add('open');
    lucide.createIcons();
}

function cerrarModal(modal) {
    modal.classList.remove('open');
}

function confirmarGenerar() {
    const tipo = document.getElementById('rpTipoReporte')?.value || 'ventas';
    const formato = document.getElementById('rpFormato')?.value || 'pdf';
    const rango = document.getElementById('rpRangoFechas')?.value || 'hoy';

    cerrarModal(document.getElementById('generarReporteModal'));

    const tipoLabels = {
        ventas: 'Reporte de Ventas',
        productos: 'Productos Más Vendidos',
        clientes: 'Reporte de Clientes',
        caja: 'Cierre de Caja'
    };

    const formatoLabels = { pdf: 'PDF', xlsx: 'Excel' };

    showToast(`Generando ${tipoLabels[tipo]} (${formatoLabels[formato]})...`);

    setTimeout(() => {
        const nuevoReporte = {
            id: reportesData.length + 1,
            tipo: tipo,
            nombre: tipoLabels[tipo] + ' - ' + rango.charAt(0).toUpperCase() + rango.slice(1),
            descripcion: `Reporte generado para el período: ${rango}`,
            fecha: 'Nuevo',
            formato: formato.toUpperCase(),
            tamano: (Math.random() * 3 + 1).toFixed(1),
            icon: getIconForTipo(tipo),
            iconClass: getIconClassForTipo(tipo)
        };

        reportesData.unshift(nuevoReporte);
        renderReportes(reportesData);
        initializeStats(reportesData);
        showToast(`${tipoLabels[tipo]} generado exitosamente`, 'success');
    }, 1500);
}

/* ── Acciones globales ── */
window.verReporte = function(id) {
    const reporte = reportesData.find(r => r.id === id);
    if (reporte) {
        showToast(`Visualizando: ${reporte.nombre}`);
    }
};

window.descargarReporte = function(id) {
    const reporte = reportesData.find(r => r.id === id);
    if (reporte) {
        reporteActualDescargar = reporte;
        document.getElementById('descargarReporteNombre').textContent = reporte.nombre;
        document.getElementById('descargarReporteFormato').textContent = reporte.formato;

        const iconContainer = document.getElementById('descargarIcon');
        if (iconContainer) {
            iconContainer.style.background = `var(--rp-${reporte.iconClass}-dim)`;
        }

        document.getElementById('descargarModal').classList.add('open');
        lucide.createIcons();
    }
};

function confirmarDescarga() {
    cerrarModal(document.getElementById('descargarModal'));

    if (reporteActualDescargar) {
        showToast(`Descargando ${reporteActualDescargar.nombre}...`);

        setTimeout(() => {
            const descargadosEl = document.getElementById('reportesDescargados');
            if (descargadosEl) {
                descargadosEl.textContent = parseInt(descargadosEl.textContent) + 1;
            }
            showToast(`${reporteActualDescargar.nombre} descargado`, 'success');
            reporteActualDescargar = null;
        }, 1500);
    }
}

function exportarTodos() {
    showToast('Preparando exportación de todos los reportes...');

    setTimeout(() => {
        const descargadosEl = document.getElementById('reportesDescargados');
        if (descargadosEl) {
            descargadosEl.textContent = parseInt(descargadosEl.textContent) + reportesData.length;
        }
        showToast(`${reportesData.length} reportes exportados exitosamente`, 'success');
    }, 2000);
}

function refrescarReportes() {
    showToast('Actualizando reportes...');

    setTimeout(() => {
        const hoyEl = document.getElementById('reportesHoy');
        if (hoyEl) {
            hoyEl.textContent = Math.floor(Math.random() * 5) + 1;
        }
        showToast('Reportes actualizados', 'success');
    }, 800);
}

/* ── Toast wrapper ── */
function showToast(message, type = 'info') {
    uiShowToast('rpToast', 'rpToastMsg', message, 'rpToastIcon', type === 'success' ? 'check-circle' : 'info');
}