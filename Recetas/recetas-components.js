/**
 * Recetas/recetas-components.js
 * Generadores de HTML para el módulo de Recetas
 */

/**
 * Crea la tarjeta (card) para la vista de cuadrícula
 */
export function renderRecipeCard(r) {
    const rentabilidad = r.precioVenta > 0 ? ((r.precioVenta - r.costo) / r.precioVenta * 100).toFixed(1) : 0;
    
    return `
        <article class="recipe-card" data-id="${r.id}">
            <div class="recipe-card-header">
                <span class="recipe-version">${r.version}</span>
                <span class="status-pill ${r.estado.toLowerCase()}">${r.estado}</span>
            </div>
            
            <div class="recipe-card-body">
                <h3>${r.nombre}</h3>
                <span class="recipe-category">${r.categoria}</span>
                
                <div class="recipe-quick-stats">
                    <div class="q-stat">
                        <i data-lucide="clock"></i>
                        <span>${r.tiempo}</span>
                    </div>
                    <div class="q-stat">
                        <i data-lucide="layers"></i>
                        <span>${r.ingredientes} ing.</span>
                    </div>
                </div>

                <div class="recipe-pricing-grid">
                    <div class="price-item">
                        <span class="label">Costo</span>
                        <span class="value">S/ ${Number(r.costo).toFixed(2)}</span>
                    </div>
                    <div class="price-item">
                        <span class="label">Venta</span>
                        <span class="value primary">S/ ${Number(r.precioVenta).toFixed(2)}</span>
                    </div>
                    <div class="price-item rent">
                        <span class="label">Rent.</span>
                        <span class="value success">${rentabilidad}%</span>
                    </div>
                </div>
            </div>

            <div class="recipe-card-footer">
                <button class="btn-card-action edit" title="Editar">
                    <i data-lucide="edit-3"></i>
                </button>
                <button class="btn-card-action del" title="Eliminar">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        </article>
    `;
}

/**
 * Crea la fila (row) para la vista de tabla/lista
 */
export function renderRecipeRow(r) {
    return `
        <tr data-id="${r.id}">
            <td class="col-producto">
                <strong>${r.nombre}</strong>
            </td>
            <td class="col-categoria">${r.categoria}</td>
            <td class="col-version"><span class="v-tag">${r.version}</span></td>
            <td class="col-tiempo">
                <div class="t-flex"><i data-lucide="clock"></i> ${r.tiempo}</div>
            </td>
            <td class="col-ingredientes">${r.ingredientes}</td>
            <td class="col-stock">
                <span class="stock-indicator">S/ ${Number(r.precioVenta).toFixed(2)}</span>
            </td>
            <td class="col-estado">
                <span class="status-pill-mini ${r.estado.toLowerCase()}">${r.estado}</span>
            </td>
            <td class="col-acciones">
                <div class="row-actions">
                    <button class="btn-row-action edit" title="Editar"><i data-lucide="edit-3"></i></button>
                    <button class="btn-row-action del" title="Eliminar"><i data-lucide="trash-2"></i></button>
                </div>
            </td>
        </tr>
    `;
}
