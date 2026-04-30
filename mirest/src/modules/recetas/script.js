// --- Estado: recetas desde public.recetas, receta_insumos, insumos, productos (vistas) ---
let recetas = [];

async function loadRecetasFromSupabase() {
    try {
        const { supabase } = await import('../scripts/supabase.js');
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        const { data: rws, error: e0 } = await supabase
            .from('recetas')
            .select('id, name, code, instructions, yield_quantity, yield_unit, created_at, updated_at')
            .order('name');
        if (e0 || !rws?.length) return;
        const rids = rws.map((r) => r.id);
        const { data: ings, error: e1 } = await supabase
            .from('receta_insumos')
            .select('id, recipe_id, quantity, unit, insumo_id')
            .in('recipe_id', rids);
        if (e1) return;
        const { data: mprList } = await supabase
            .from('menu_product_recipes')
            .select('recipe_id, menu_product_id, menu_products(sale_price, name, metadata)')
            .in('recipe_id', rids);
        const priceByRecipe = new Map();
        (mprList || []).forEach((row) => {
            if (row?.recipe_id && !priceByRecipe.has(row.recipe_id) && row.menu_products) {
                const mp = row.menu_products;
                priceByRecipe.set(row.recipe_id, { price: Number(mp.sale_price) || 0, name: mp.name, metadata: mp.metadata });
            }
        });
        const insIds = [...new Set((ings || []).map((x) => x.insumo_id).filter(Boolean))];
        let insMap = new Map();
        if (insIds.length) {
            const { data: insu, error: e2 } = await supabase
                .from('insumos')
                .select('id, nombre, costo_unitario')
                .in('id', insIds);
            if (e2) return;
            insMap = new Map((insu || []).map((i) => [i.id, i]));
        }
        const ingByR = new Map();
        for (const row of ings || []) {
            if (!ingByR.has(row.recipe_id)) ingByR.set(row.recipe_id, []);
            const ins = row.insumo_id ? insMap.get(row.insumo_id) : null;
            const lineCost = ins
                ? Number(row.quantity || 0) * (Number(ins.costo_unitario) || 0)
                : 0;
            const cantLabel = [String(row.quantity ?? ''), String(row.unit || '')].filter(Boolean).join(' ').trim() || '—';
            ingByR.get(row.recipe_id).push({
                ingrediente: ins?.nombre || 'Insumo',
                cantidad: cantLabel,
                costo: Math.round(lineCost * 100) / 100
            });
        }
        recetas = rws.map((r) => {
            const det = ingByR.get(r.id) || [];
            const subtotal = det.reduce((s, x) => s + (Number(x.costo) || 0), 0);
            const mpr = priceByRecipe.get(r.id);
            const precioVenta = mpr ? mpr.price : 0;
            const prodMeta = mpr?.metadata && typeof mpr.metadata === 'object' ? mpr.metadata : {};
            const categoria = prodMeta.categoria != null ? String(prodMeta.categoria) : '—';
            return {
                id: r.id,
                nombre: r.name,
                categoria,
                estado: 'Activa',
                costo: Math.round(subtotal * 1000) / 1000,
                precioVenta,
                foodCost: precioVenta > 0
                    ? Math.round((subtotal / precioVenta) * 100 * 100) / 100
                    : 0,
                tiempo: '—',
                porciones: r.yield_quantity != null ? String(r.yield_quantity) : '1',
                ingredientes: String(det.length),
                version: r.code != null ? String(r.code) : 'v1',
                foto: null,
                detalleIngredientes: det
            };
        });
    } catch (e) {
        console.warn('[recetas] Carga desde base omitida o vacía', e);
    }
}

let modoVista = 'grid'; // 'lista' o 'grid'
let filtroActual = 'Todos';
let busquedaActual = '';
let idAEliminar = null;

document.addEventListener('DOMContentLoaded', async () => {
    // --- Elementos del DOM ---
    const gridRecetas = document.getElementById('gridRecetas');
    const containerGrid = document.getElementById('container-recetas-grid');
    const containerLista = document.getElementById('container-recetas-lista');
    const btnViewList = document.getElementById('btnViewList');
    const btnViewGrid = document.getElementById('btnViewGrid');
    const inputBusqueda = document.getElementById('inputBusqueda');
    const filterPills = document.querySelectorAll('.pill');
    const countTotal = document.getElementById('count-total');
    const countActivas = document.getElementById('count-activas');
    const btnPlantilla = document.getElementById('btnPlantilla');
    const fileImportar = document.getElementById('fileImportar');

    // Modales
    const modalEdit = document.getElementById('modalEditReceta');
    const modalConfirm = document.getElementById('modalConfirmDelete');
    const modalPlantillaImport = document.getElementById('modalPlantillaImport');
    const formEdit = document.getElementById('formEditReceta');
    const btnCloseModal = document.getElementById('btnCloseModal');
    const btnCancelEdit = document.getElementById('btnCancelEdit');
    const btnCancelDelete = document.getElementById('btnCancelDelete');
    const btnConfirmDeleteAction = document.getElementById('btnConfirmDeleteAction');
    const btnClosePlantillaImport = document.getElementById('btnClosePlantillaImport');
    const btnCancelPlantillaImport = document.getElementById('btnCancelPlantillaImport');
    const btnDescargarPlantilla = document.getElementById('btnDescargarPlantilla');
    const btnAbrirImport = document.getElementById('btnAbrirImport');
    const toastImport = document.getElementById('toastImport');
    let toastTimeoutId = null;

    const btnAbrirCrearRapida = document.getElementById('btnAbrirCrearRapida');
    const modalCrearRapida = document.getElementById('modalCrearRapida');
    const btnCloseCrearRapida = document.getElementById('btnCloseCrearRapida');
    const btnCancelCrearRapida = document.getElementById('btnCancelCrearRapida');
    const btnAddQuickIngredient = document.getElementById('btnAddQuickIngredient');
    const formCrearRapida = document.getElementById('formCrearRapida');
    const quickIngredientsBody = document.getElementById('quickIngredientsBody');
    const quickCostoTotal = document.getElementById('quickCostoTotal');
    const quickProducto = document.getElementById('quickProducto');
    const quickPorciones = document.getElementById('quickPorciones');
    const quickCategoria = document.getElementById('quickCategoria');
    const quickTiempo = document.getElementById('quickTiempo');

    // --- Inicialización (datos reales) ---
    await loadRecetasFromSupabase();
    renderizar();
    actualizarStats();
    setupEventListeners();

    function setupEventListeners() {
        // Toggle de vistas
        btnViewList?.addEventListener('click', () => cambiarVista('lista'));
        btnViewGrid?.addEventListener('click', () => cambiarVista('grid'));

        // Búsqueda
        inputBusqueda?.addEventListener('input', (e) => {
            busquedaActual = e.target.value.toLowerCase();
            renderizar();
        });

        // Filtros (Chips)
        filterPills.forEach(pill => {
            pill.addEventListener('click', () => {
                filterPills.forEach(p => p.classList.remove('active'));
                pill.classList.add('active');
                filtroActual = pill.dataset.filter;
                renderizar();
            });
        });

        // Interfaz Plantilla / Importar
        const btnNuevaReceta = document.getElementById('btnNuevaReceta');
        btnNuevaReceta?.addEventListener('click', () => {
            abrirModalPlantillaImport();
        });

        btnClosePlantillaImport?.addEventListener('click', cerrarModalPlantillaImport);
        btnCancelPlantillaImport?.addEventListener('click', cerrarModalPlantillaImport);

        btnDescargarPlantilla?.addEventListener('click', () => {
            descargarPlantillaExcel();
        });

        btnAbrirImport?.addEventListener('click', () => {
            fileImportar?.click();
        });

        fileImportar?.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) importarRecetasExcel(file);
            fileImportar.value = '';
            cerrarModalPlantillaImport();
        });

        btnAbrirCrearRapida?.addEventListener('click', () => {
            cerrarModalPlantillaImport();
            abrirModalCrearRapida();
        });

        btnCloseCrearRapida?.addEventListener('click', cerrarModalCrearRapida);
        btnCancelCrearRapida?.addEventListener('click', cerrarModalCrearRapida);

        btnAddQuickIngredient?.addEventListener('click', () => {
            agregarFilaQuick();
        });

        quickIngredientsBody?.addEventListener('input', (e) => {
            if (!(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLSelectElement)) return;
            recalcularCostoQuick();
        });

        quickIngredientsBody?.addEventListener('click', (e) => {
            const target = e.target;
            const btn = target instanceof HTMLElement ? target.closest('button[data-action="remove-row"]') : null;
            if (!btn) return;
            btn.closest('tr')?.remove();
            recalcularCostoQuick();
        });

        // Modal Edit: Cerrar
        btnCloseModal?.addEventListener('click', cerrarModal);
        btnCancelEdit?.addEventListener('click', cerrarModal);
        
        // Modal Confirm Delete: Acciones
        btnCancelDelete?.addEventListener('click', cerrarModalConfirm);
        btnConfirmDeleteAction?.addEventListener('click', () => {
            if (idAEliminar !== null) {
                recetas = recetas.filter(r => r.id !== idAEliminar);
                renderizar();
                actualizarStats();
                cerrarModalConfirm();
            }
        });

        // Cerrar al hacer clic fuera
        window.addEventListener('click', (e) => {
            if (e.target === modalEdit) cerrarModal();
            if (e.target === modalConfirm) cerrarModalConfirm();
            if (e.target === modalPlantillaImport) cerrarModalPlantillaImport();
            if (e.target === modalCrearRapida) cerrarModalCrearRapida();
        });

        // Tecla Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                cerrarModal();
                cerrarModalConfirm();
                cerrarModalPlantillaImport();
                cerrarModalCrearRapida();
            }
        });

        // Modal Edit: Guardar cambios
        formEdit?.addEventListener('submit', (e) => {
            e.preventDefault();
            guardarCambiosReceta();
        });

        formCrearRapida?.addEventListener('submit', (e) => {
            e.preventDefault();
            guardarRecetaRapida();
        });

        // Respaldo global: evita que un enter/submit en el modal recargue la página si el ID del form cambia
        document.addEventListener('submit', (e) => {
            if (e.target && e.target.closest('#modalCrearRapida')) {
                if (e.target !== formCrearRapida) {
                    e.preventDefault();
                    guardarRecetaRapida();
                }
            }
        });
    }

    function cambiarVista(nuevaVista) {
        modoVista = nuevaVista;
        if (modoVista === 'lista') {
            btnViewList?.classList.add('active');
            btnViewGrid?.classList.remove('active');
            containerLista.style.display = 'block';
            containerGrid.style.display = 'none';
        } else {
            btnViewGrid?.classList.add('active');
            btnViewList?.classList.remove('active');
            containerGrid.style.display = 'grid';
            containerLista.style.display = 'none';
        }
        renderizar();
    }

    function renderizar() {
        if (recetas.length === 0) {
            const emptyMsg = '<div class="recipe-empty-hint" style="padding:1.25rem;border:1px dashed var(--color-border,#e5e5e5);border-radius:12px;max-width:40rem">Sin datos aún. Carga recetas reales: insumos con costo, platos de venta y <strong>recipe_ingredients</strong> con cantidad. Revisa el onboarding (pasos 4–7) o inicia sesión con RLS/tenant activo.</div>';
            if (containerGrid) containerGrid.innerHTML = emptyMsg;
            if (gridRecetas) gridRecetas.innerHTML = `<tr><td colspan="8">${emptyMsg}</td></tr>`;
            actualizarConteosPills();
            return;
        }
        const avgPrecio = recetas.length > 0
            ? recetas.reduce((sum, r) => sum + (Number(r.precioVenta) || 0), 0) / recetas.length
            : 0;

        let filtered = [...recetas];

        if (filtroActual === 'MasRentables') {
            filtered = filtered
                .filter(r => Number(r.precioVenta) > 0)
                .sort((a, b) => {
                    const rentA = ((a.precioVenta - a.costo) / a.precioVenta) * 100;
                    const rentB = ((b.precioVenta - b.costo) / b.precioVenta) * 100;
                    return rentB - rentA;
                });
        } else if (filtroActual === 'PlatosCaros') {
            filtered = filtered.filter(r => Number(r.precioVenta) > avgPrecio);
        } else if (filtroActual === 'PlatosMódicos') {
            filtered = filtered.filter(r => Number(r.precioVenta) <= avgPrecio);
        }
        // 'Todos' → sin filtro adicional

        if (busquedaActual) {
            filtered = filtered.filter(r => String(r.nombre).toLowerCase().includes(busquedaActual));
        }

        if (modoVista === 'lista') renderLista(filtered);
        else renderGrid(filtered);

        actualizarConteosPills();
    }

    function renderLista(items) {
        if (!gridRecetas) return;
        gridRecetas.innerHTML = items.map(r => {
            const hasDetails = r.detalleIngredientes && r.detalleIngredientes.length > 0;
            const ingredientsHtml = hasDetails ? r.detalleIngredientes.map(ing => `
                <tr>
                    <td>${ing.ingrediente}</td>
                    <td>${ing.cantidad}</td>
                    <td>S/ ${Number(ing.costo || 0).toFixed(2)}</td>
                </tr>
            `).join('') : '<tr><td colspan="3" class="text-center">No hay ingredientes registrados</td></tr>';

            const faltantesList = Array.isArray(r.faltantes) ? r.faltantes : [];
            const stockOk = r.stockOk === true || faltantesList.length === 0;
            const stockHtml = stockOk
                ? '<span class="badge-stock ok">Stock OK</span>'
                : '<span class="badge-stock low">Falta ingrediente</span>';

            return `
                <tr class="recipe-row-main" id="row-main-${r.id}">
                    <td>
                        <div style="display: flex; align-items: center; gap: 10px;">
                            <button class="btn-toggle-row" onclick="toggleRecetaDetalle(${r.id})">
                                <i class="fa-solid fa-chevron-right"></i>
                            </button>
                            <div class="col-producto">
                                <strong>${r.nombre}</strong>
                                <span>${r.nombre}</span>
                            </div>
                        </div>
                    </td>
                    <td>${r.categoria}</td>
                    <td class="col-version">${r.version}</td>
                    <td><i class="fa-regular fa-clock"></i> ${r.tiempo}</td>
                    <td><span class="badge-ingredientes">${r.ingredientes}</span></td>
                    <td class="col-stock">${stockHtml}</td>
                    <td>
                        <span class="badge-status-mini ${String(r.estado).toLowerCase()}">
                            ${r.estado}
                        </span>
                    </td>
                    <td class="col-acciones">
                        <div class="card-actions">
                            <button class="btn-card-action edit" onclick="editarReceta(${r.id})">
                                <i class="fa-solid fa-pen"></i>
                            </button>
                            <button class="btn-card-action del" onclick="eliminarReceta(${r.id})">
                                <i class="fa-solid fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
                <tr class="recipe-row-details" id="row-details-${r.id}">
                    <td colspan="8">
                        <div class="details-container">
                            <div class="ingredients-toolbar">
                                <div class="ingredients-toolbar-title">Ingredientes</div>
                                <div class="ingredients-toolbar-actions">
                                    <button class="btn-ingredient-action" type="button" id="btnIngEdit-${r.id}" onclick="iniciarEdicionIngredientes(${r.id})" title="Editar ingredientes">
                                        <i class="fa-solid fa-pen"></i>
                                    </button>
                                    <button class="btn-ingredient-action is-hidden" type="button" id="btnIngSave-${r.id}" onclick="guardarEdicionIngredientes(${r.id})" title="Guardar">
                                        <i class="fa-solid fa-check"></i>
                                    </button>
                                    <button class="btn-ingredient-action is-hidden" type="button" id="btnIngCancel-${r.id}" onclick="cancelarEdicionIngredientes(${r.id})" title="Cancelar">
                                        <i class="fa-solid fa-xmark"></i>
                                    </button>
                                </div>
                            </div>
                            <table class="ingredients-subtable">
                                <thead>
                                    <tr>
                                        <th>INGREDIENTE</th>
                                        <th>CANTIDAD</th>
                                        <th>COSTO</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ingredientsHtml}
                                </tbody>
                            </table>
                            <div class="total-cost-row">
                                <span class="total-cost-label">Costo total receta</span>
                                <span class="total-cost-value">S/ ${Number(r.costo || 0).toFixed(2)}</span>
                            </div>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
    }

    window.toggleRecetaDetalle = function(id) {
        const rowDetails = document.getElementById(`row-details-${id}`);
        const rowMain = document.getElementById(`row-main-${id}`);
        const btnToggle = rowMain ? rowMain.querySelector('.btn-toggle-row') : null;
        
        if (rowDetails && btnToggle) {
            const isOpen = rowDetails.classList.contains('show');
            
            // Cerrar otros abiertos (opcional, pero mejora la limpieza)
            document.querySelectorAll('.recipe-row-details.show').forEach(row => {
                if (row.id !== `row-details-${id}`) {
                    row.classList.remove('show');
                    const otherId = row.id.split('-').pop();
                    const otherMain = document.getElementById(`row-main-${otherId}`);
                    otherMain?.querySelector('.btn-toggle-row')?.classList.remove('active');
                }
            });

            if (isOpen) {
                rowDetails.classList.remove('show');
                btnToggle.classList.remove('active');
                btnToggle.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
            } else {
                rowDetails.classList.add('show');
                btnToggle.classList.add('active');
                btnToggle.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
            }
        }
    };

    const escapeHtml = (value) => String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');

    window.iniciarEdicionIngredientes = function(id) {
        const receta = recetas.find(r => r.id === id);
        if (!receta) return;

        const rowDetails = document.getElementById(`row-details-${id}`);
        if (!rowDetails) return;

        if (!rowDetails.classList.contains('show')) {
            window.toggleRecetaDetalle(id);
        }

        const editBtn = document.getElementById(`btnIngEdit-${id}`);
        const saveBtn = document.getElementById(`btnIngSave-${id}`);
        const cancelBtn = document.getElementById(`btnIngCancel-${id}`);
        editBtn?.classList.add('is-hidden');
        saveBtn?.classList.remove('is-hidden');
        cancelBtn?.classList.remove('is-hidden');

        const tbody = rowDetails.querySelector('.ingredients-subtable tbody');
        if (!tbody) return;

        const ingredientes = Array.isArray(receta.detalleIngredientes) ? receta.detalleIngredientes : [];
        tbody.innerHTML = ingredientes.length > 0
            ? ingredientes.map((ing, index) => `
                <tr data-idx="${index}">
                    <td><input class="ingredient-edit-input" type="text" value="${escapeHtml(ing.ingrediente)}"></td>
                    <td><input class="ingredient-edit-input" type="text" value="${escapeHtml(ing.cantidad)}"></td>
                    <td>
                        <div class="ingredient-cost-input">
                            <span class="ingredient-cost-prefix">S/</span>
                            <input class="ingredient-edit-input" type="number" step="0.01" value="${Number(ing.costo ?? 0).toFixed(2)}">
                        </div>
                    </td>
                </tr>
            `).join('')
            : '<tr><td colspan="3" class="text-center">No hay ingredientes registrados</td></tr>';
    };

    window.cancelarEdicionIngredientes = function(id) {
        renderizar();
        window.toggleRecetaDetalle(id);
    };

    window.guardarEdicionIngredientes = function(id) {
        const receta = recetas.find(r => r.id === id);
        if (!receta) return;

        const rowDetails = document.getElementById(`row-details-${id}`);
        if (!rowDetails) return;

        const tbody = rowDetails.querySelector('.ingredients-subtable tbody');
        if (!tbody) return;

        const rows = Array.from(tbody.querySelectorAll('tr[data-idx]'));
        const nuevosIngredientes = rows.map(row => {
            const inputs = row.querySelectorAll('input.ingredient-edit-input');
            const ingrediente = (inputs[0]?.value ?? '').trim();
            const cantidad = (inputs[1]?.value ?? '').trim();
            const costoRaw = inputs[2]?.value ?? '0';
            const costo = Number.parseFloat(costoRaw);
            return {
                ingrediente: ingrediente || '-',
                cantidad: cantidad || '-',
                costo: Number.isFinite(costo) ? costo : 0
            };
        });

        receta.detalleIngredientes = nuevosIngredientes;
        receta.ingredientes = nuevosIngredientes.length;
        receta.costo = nuevosIngredientes.reduce((sum, ing) => sum + (Number.isFinite(ing.costo) ? ing.costo : 0), 0);
        receta.foodCost = receta.precioVenta > 0 ? (receta.costo / receta.precioVenta) * 100 : 0;

        renderizar();
        actualizarStats();
        window.toggleRecetaDetalle(id);
    };

    function renderGrid(items) {
        if (!containerGrid) return;
        containerGrid.innerHTML = items.map(r => {
            const costo = Number(r.costo) || 0;
            const venta = Number(r.precioVenta) || 0;
            const ganancia = venta - costo;
            const foodCost = venta > 0 ? (costo / venta) * 100 : 0;
            const foodCostText = venta > 0 ? `${foodCost.toFixed(1)}%` : 'N/A';

            const pctRaw = venta > 0 ? (ganancia / venta) * 100 : null;
            const pct = pctRaw === null ? 0 : Math.max(0, Math.min(pctRaw, 100));
            const barColor = pctRaw !== null && pctRaw >= 30 ? '#16a34a' : pctRaw !== null && pctRaw >= 15 ? '#f59e0b' : '#ef4444';
            const pctLabel = pctRaw === null ? 'N/A' : `${pctRaw.toFixed(1)}%`;

            const botonLabel = venta > 0 ? `Precio Total S/ ${venta.toFixed(2)}` : `Costo S/ ${costo.toFixed(2)}`;

            return `
            <div class="recipe-card" data-id="${r.id}">
                <div class="card-header">
                    <div class="card-icon-box"><i class="fa-solid fa-utensils"></i></div>
                    <span class="badge-status-mini ${String(r.estado).toLowerCase()}">${r.estado}</span>
                </div>
                <div class="card-info">
                    <h3>${r.nombre}</h3>
                    <span class="card-category">${r.categoria}</span>
                </div>
                <div class="card-finance-grid">
                    <div class="finance-item"><span class="label">Costo</span><span class="value">S/ ${costo.toFixed(2)}</span></div>
                    <div class="finance-item"><span class="label">Venta</span><span class="value sale">S/ ${venta.toFixed(2)}</span></div>
                    <div class="finance-item highlight"><span class="label">Ganancia</span><span class="value profit ${ganancia < 0 ? 'negative' : ''}">S/ ${ganancia.toFixed(2)}</span></div>
                </div>

                ${venta > 0 ? `
                <div class="card-profitability">
                    <div class="profitability-label">
                        <span>Rentabilidad</span>
                        <span style="color:${barColor};font-weight:800;">${pctLabel}</span>
                    </div>
                    <div class="profitability-bar-wrap">
                        <div class="profitability-bar" style="width:${pct}%;background:${barColor};"></div>
                    </div>
                </div>` : ''}

                <div class="card-stats-toggle">
                    <button class="btn-toggle-card-stats" type="button" onclick="toggleCardStats(${r.id})">
                        <span>Ver detalles</span>
                        <i class="fa-solid fa-chevron-down"></i>
                    </button>
                </div>

                <div class="card-stats-panel" id="card-stats-${r.id}">
                    <div class="card-stats-grid">
                        <div class="card-stat-item"><i class="fa-regular fa-clock"></i><span>${r.tiempo}</span></div>
                        <div class="card-stat-item"><i class="fa-solid fa-user-group"></i><span>${r.porciones} porc.</span></div>
                        <div class="card-stat-item"><i class="fa-solid fa-mortar-pestle"></i><span>${r.ingredientes} ingr.</span></div>
                        <div class="card-stat-item"><i class="fa-solid fa-chart-pie"></i><span>FC: ${foodCostText}</span></div>
                    </div>
                    <div class="card-stat-item" style="padding: 0 4px; margin-top: 8px;">
                        <i class="fa-solid fa-code-branch"></i><span>Versión: ${r.version}</span>
                    </div>
                </div>

                <div class="card-footer">
                    <div class="card-cost-main">${botonLabel}</div>
                    <div class="card-actions">
                        <button class="btn-card-action edit" onclick="editarReceta(${r.id})"><i class="fa-solid fa-pen"></i></button>
                        <button class="btn-card-action del" onclick="eliminarReceta(${r.id})"><i class="fa-solid fa-trash"></i></button>
                    </div>
                </div>
            </div>
        `;
        }).join('');
    }

    window.toggleCardStats = function(id) {
        if (!containerGrid) return;
        const targetCard = containerGrid.querySelector(`.recipe-card[data-id="${id}"]`);
        if (!targetCard) return;
        containerGrid.querySelectorAll('.recipe-card.show-stats').forEach(card => {
            if (card !== targetCard) card.classList.remove('show-stats');
        });
        targetCard.classList.toggle('show-stats');
    };

    function actualizarStats() {
        if (countTotal) countTotal.textContent = recetas.length;
        if (countActivas) countActivas.textContent = recetas.filter(r => r.estado === 'Activa').length;
    }

    function actualizarConteosPills() {
        const avgPrecio = recetas.length > 0
            ? recetas.reduce((sum, r) => sum + (Number(r.precioVenta) || 0), 0) / recetas.length
            : 0;

        filterPills.forEach(pill => {
            const filter = pill.dataset.filter;
            let count = 0;

            if (filter === 'Todos') {
                count = recetas.length;
            } else if (filter === 'MasRentables') {
                count = recetas.filter(r => Number(r.precioVenta) > 0).length;
            } else if (filter === 'PlatosCaros') {
                count = recetas.filter(r => Number(r.precioVenta) > avgPrecio).length;
            } else if (filter === 'PlatosMódicos') {
                count = recetas.filter(r => Number(r.precioVenta) <= avgPrecio).length;
            }

            const countSpan = pill.querySelector('.pill-count');
            if (countSpan) countSpan.textContent = count;
        });
    }

    // --- Funciones Globales para Botones ---
    window.abrirModalNuevaReceta = function() {
        if (modalEdit) {
            const modalTitleElement = modalEdit.querySelector('h3');
            if (modalTitleElement) modalTitleElement.innerHTML = '<i class="fa-solid fa-file-circle-plus"></i> Nueva Receta';
            formEdit.reset();
            document.getElementById('editRecipeId').value = '';
            document.getElementById('editVersion').value = 'v1'; // Default version
            document.getElementById('editEstado').value = 'Activa'; // Default state
            modalEdit.classList.add('show');
        }
    };

    window.editarReceta = function(id) {
        const receta = recetas.find(r => r.id === id);
        if (!receta) return;
        const modalTitleElement = modalEdit.querySelector('h3');
        if (modalTitleElement) modalTitleElement.innerHTML = '<i class="fa-solid fa-file-pen"></i> Editar Receta';
        document.getElementById('editRecipeId').value = receta.id;
        document.getElementById('editNombre').value = receta.nombre;
        document.getElementById('editCategoria').value = receta.categoria;
        document.getElementById('editCosto').value = receta.costo;
        document.getElementById('editPrecioVenta').value = receta.precioVenta;
        document.getElementById('editTiempo').value = receta.tiempo;
        document.getElementById('editPorciones').value = receta.porciones;
        document.getElementById('editEstado').value = receta.estado;
        document.getElementById('editVersion').value = receta.version;
        modalEdit?.classList.add('show');
    };

    window.eliminarReceta = function(id) {
        idAEliminar = id;
        modalConfirm?.classList.add('show');
    };

    function cerrarModal() {
        modalEdit?.classList.remove('show');
    }

    function cerrarModalConfirm() {
        modalConfirm?.classList.remove('show');
        idAEliminar = null;
    }

    function abrirModalPlantillaImport() {
        modalPlantillaImport?.classList.add('show');
    }

    function cerrarModalPlantillaImport() {
        modalPlantillaImport?.classList.remove('show');
    }

    function abrirModalCrearRapida() {
        if (formCrearRapida) formCrearRapida.reset();
        if (quickTiempo) quickTiempo.value = '15 min';
        if (quickPorciones) quickPorciones.value = '1';
        if (quickIngredientsBody) quickIngredientsBody.innerHTML = '';
        agregarFilaQuick();
        recalcularCostoQuick();
        modalCrearRapida?.classList.add('show');
        quickProducto?.focus();
    }

    function cerrarModalCrearRapida() {
        modalCrearRapida?.classList.remove('show');
    }

    function agregarFilaQuick() {
        if (!quickIngredientsBody) return;
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><input class="form-control" type="text" placeholder="Ej: Arroz"></td>
            <td><input class="form-control" type="number" step="0.01" min="0" placeholder="0.0"></td>
            <td>
                <select class="form-control">
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="lt">lt</option>
                    <option value="ml">ml</option>
                    <option value="und">und</option>
                </select>
            </td>
            <td><input class="form-control quick-cost-input" type="number" step="0.001" min="0" placeholder="0.000"></td>
            <td style="text-align:right;">
                <button class="btn-quick-row" type="button" data-action="remove-row" title="Eliminar fila">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </td>
        `;
        quickIngredientsBody.appendChild(tr);
    }

    function recalcularCostoQuick() {
        if (!quickCostoTotal || !quickIngredientsBody) return;
        const inputs = quickIngredientsBody.querySelectorAll('input.quick-cost-input');
        const total = Array.from(inputs).reduce((sum, el) => {
            const value = Number.parseFloat(el.value);
            return sum + (Number.isFinite(value) ? value : 0);
        }, 0);
        quickCostoTotal.textContent = `S/ ${total.toFixed(2)}`;
    }

    function guardarRecetaRapida() {
        const qProducto = document.getElementById('quickProducto');
        const qCategoria = document.getElementById('quickCategoria');
        const qPorciones = document.getElementById('quickPorciones');
        const qTiempo = document.getElementById('quickTiempo');
        const qBody = document.getElementById('quickIngredientsBody');

        const nombre = qProducto ? qProducto.value.trim() : 'Nueva Receta Rápida';
        if (!nombre || nombre === '') return;

        const detalleIngredientes = [];
        if (qBody) {
            const rows = Array.from(qBody.querySelectorAll('tr'));
            rows.forEach(row => {
                const ing = row.querySelector('td:nth-child(1) input')?.value?.trim() || '';
                const cantidad = row.querySelector('td:nth-child(2) input')?.value || '';
                const unidad = row.querySelector('td:nth-child(3) select')?.value || '';
                const costoRaw = row.querySelector('td:nth-child(4) input')?.value || '0';
                const costo = Number.parseFloat(costoRaw);
                if (!ing) return;
                detalleIngredientes.push({
                    ingrediente: ing,
                    cantidad: `${cantidad} ${unidad}`.trim() || '-',
                    costo: Number.isFinite(costo) ? costo : 0
                });
            });
        }

        const costoTotal = detalleIngredientes.reduce((sum, ing) => sum + (Number.isFinite(ing.costo) ? ing.costo : 0), 0);
        const porciones = qPorciones ? qPorciones.value || '1' : '1';
        const tiempo = qTiempo ? qTiempo.value.trim() || '15 min' : '15 min';
        const categoria = qCategoria ? qCategoria.value || 'Otros' : 'Otros';

        const nuevaReceta = {
            id: Date.now(),
            nombre,
            categoria,
            estado: 'Activa',
            costo: costoTotal,
            precioVenta: 0,
            foodCost: 0,
            tiempo,
            porciones,
            ingredientes: detalleIngredientes.length,
            version: 'v1',
            foto: null,
            detalleIngredientes
        };

        recetas.unshift(nuevaReceta);
        cerrarModalCrearRapida();
        renderizar();
        actualizarStats();
    }

    function mostrarToastImport(message) {
        if (!toastImport) return;
        toastImport.textContent = message;
        toastImport.classList.add('show');
        if (toastTimeoutId) window.clearTimeout(toastTimeoutId);
        toastTimeoutId = window.setTimeout(() => {
            toastImport.classList.remove('show');
        }, 3200);
    }

    function guardarCambiosReceta() {
        const idStr = document.getElementById('editRecipeId').value;
        const costo = Number.parseFloat(document.getElementById('editCosto').value);
        const venta = Number.parseFloat(document.getElementById('editPrecioVenta').value);
        const foodCost = venta > 0 ? (costo / venta) * 100 : 0;

        if (idStr === '') {
            // Nueva Receta
            const nuevaReceta = {
                id: Date.now(),
                nombre: document.getElementById('editNombre').value,
                categoria: document.getElementById('editCategoria').value,
                costo: costo,
                precioVenta: venta,
                foodCost: foodCost,
                tiempo: document.getElementById('editTiempo').value,
                porciones: document.getElementById('editPorciones').value,
                estado: document.getElementById('editEstado').value,
                version: document.getElementById('editVersion').value,
                ingredientes: 0,
                detalleIngredientes: []
            };
            recetas.push(nuevaReceta);
        } else {
            // Editar Receta
            const id = Number(idStr);
            const index = recetas.findIndex(r => r.id === id);
            if (index !== -1) {
                recetas[index] = {
                    ...recetas[index],
                    nombre: document.getElementById('editNombre').value,
                    categoria: document.getElementById('editCategoria').value,
                    costo: costo,
                    precioVenta: venta,
                    foodCost: foodCost,
                    tiempo: document.getElementById('editTiempo').value,
                    porciones: document.getElementById('editPorciones').value,
                    estado: document.getElementById('editEstado').value,
                    version: document.getElementById('editVersion').value
                };
            }
        }
        cerrarModal();
        renderizar();
        actualizarStats();
    }

    function descargarPlantillaExcel() {
        if (typeof XLSX === 'undefined') {
            alert('No se pudo cargar la librería XLSX. Revisa tu conexión o el bloqueo de recursos externos.');
            return;
        }
        const data = [
            ["Producto", "Categoria", "Version", "Estado", "Tiempo", "Porciones", "PrecioVenta", "Ingrediente", "Cantidad", "Costo"],
            ["Ají de Gallina", "Platos de fondo", "v1", "Activa", "25 min", "1", 18.00, "Gallina entera", "0.2 kg", 2.80],
            ["Ají de Gallina", "Platos de fondo", "v1", "Activa", "25 min", "1", 18.00, "Ají amarillo", "0.05 kg", 0.40],
            ["Arroz Chaufa", "Platos de fondo", "v1", "Activa", "15 min", "1", 15.00, "Arroz", "0.15 kg", 0.525]
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Recetas");
        XLSX.writeFile(wb, "Plantilla_Recetas_MiRest.xlsx");
    }

    function importarRecetasExcel(file) {
        if (typeof XLSX === 'undefined') {
            alert('No se pudo cargar la librería XLSX. Revisa tu conexión o el bloqueo de recursos externos.');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);

            if (jsonData.length === 0) {
                alert("El archivo está vacío o no tiene el formato correcto.");
                return;
            }

            const normalizeKey = (key) => String(key ?? '')
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9]+/g, '')
                .toLowerCase();

            const parseNumber = (value) => {
                if (typeof value === 'number' && Number.isFinite(value)) return value;
                if (value === null || value === undefined) return 0;
                const str = String(value).trim();
                if (!str) return 0;
                const cleaned = str
                    .replace(/[^\d,.-]/g, '')
                    .replace(',', '.');
                const num = Number.parseFloat(cleaned);
                return Number.isFinite(num) ? num : 0;
            };

            const getRowValue = (row, keys) => {
                const map = {};
                Object.keys(row).forEach(k => {
                    map[normalizeKey(k)] = row[k];
                });
                for (const k of keys) {
                    const v = map[normalizeKey(k)];
                    if (v !== undefined && v !== null && String(v).trim() !== '') return v;
                }
                return undefined;
            };

            // Agrupar por Producto
            const grouped = {};
            jsonData.forEach(row => {
                const productName = getRowValue(row, ['Producto', 'Nombre', 'Receta', 'Plato']);
                if (!productName) return;

                if (!grouped[productName]) {
                    const categoria = getRowValue(row, ['Categoria', 'Categoría', 'Tipo', 'Grupo']);
                    const estado = getRowValue(row, ['Estado']);
                    const tiempo = getRowValue(row, ['Tiempo', 'TiempoPrep', 'Tiempo Prep']);
                    const porciones = getRowValue(row, ['Porciones', 'Rendimiento']);
                    const version = getRowValue(row, ['Version', 'Versión']);
                    const precioVentaRaw = getRowValue(row, ['PrecioVenta', 'Precio Venta', 'Precio', 'PVP']);

                    grouped[productName] = {
                        id: Date.now() + Math.floor(Math.random() * 1000000),
                        nombre: String(productName),
                        categoria: String(categoria ?? "Otros"),
                        estado: String(estado ?? "Activa"),
                        tiempo: tiempo ?? "15 min",
                        porciones: porciones ?? "1",
                        version: version ?? "v1",
                        precioVenta: parseNumber(precioVentaRaw),
                        detalleIngredientes: []
                    };
                }

                // Añadir ingrediente al detalle
                const ingrediente = getRowValue(row, ['Ingrediente', 'Insumo']);
                if (ingrediente) {
                    const cantidad = getRowValue(row, ['Cantidad']);
                    const costoRaw = getRowValue(row, ['Costo', 'Coste']);
                    grouped[productName].detalleIngredientes.push({
                        ingrediente: ingrediente,
                        cantidad: cantidad ?? "-",
                        costo: parseNumber(costoRaw)
                    });
                }
            });

            // Convertir a array y calcular costos totales
            const nuevasRecetas = Object.values(grouped).map(r => {
                const costoTotal = r.detalleIngredientes.reduce((sum, ing) => sum + ing.costo, 0);
                const foodCost = r.precioVenta > 0 ? (costoTotal / r.precioVenta) * 100 : 0;
                return {
                    ...r,
                    costo: costoTotal,
                    foodCost: foodCost,
                    ingredientes: r.detalleIngredientes.length
                };
            });

            if (nuevasRecetas.length === 0) {
                alert("No se encontraron recetas válidas. Asegúrate de tener la columna 'Producto' o 'Nombre'.");
                return;
            }

            // Unir con las recetas existentes (opcional, o reemplazar)
            recetas = [...nuevasRecetas, ...recetas];
            
            renderizar();
            actualizarStats();
            const sinPrecioCount = nuevasRecetas.filter(r => r.estado === 'Activa' && (!r.precioVenta || r.precioVenta <= 0) && r.costo > 0).length;
            const mensajes = [`¡Importación exitosa! Se han cargado ${nuevasRecetas.length} recetas.`];
            if (sinPrecioCount > 0) mensajes.push(`⚠ ${sinPrecioCount} activas sin precio de venta`);
            mostrarToastImport(mensajes.join('  |  '));
            fileImportar.value = ''; 
        };
        reader.readAsArrayBuffer(file);
    }
});