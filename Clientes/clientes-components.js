/**
 * Clientes/clientes-components.js
 * Generadores de HTML para el módulo de Clientes
 */

/**
 * Crea la tarjeta (card) para la vista de cuadrícula
 */
export function renderClientCard(c) {
    return `
        <article class="client-card" data-type="${c.tipo}" data-id="${c.id}">
            <button class="preview-hint" type="button" title="Vista previa" aria-label="Abrir vista previa">
                <i data-lucide="eye"></i>
            </button>
            <div class="initials-box">${c.avatar || c.nombre.substring(0, 2).toUpperCase()}</div>
            <span class="status-badge ${(c.tipo || c.estado || 'Regular').toLowerCase() === 'vip' ? 'vip' : 'regular'}">${c.tipo || c.estado || 'Regular'}</span>
            <div class="client-info">
                <h3>${c.nombre}</h3>
                <span class="doc-id">${c.arquetipo || 'DNI: ' + (c.documento || '-')}</span>
                <div class="client-stats">
                    <span><i data-lucide="shopping-cart"></i> Pedidos: ${c.pedidos ?? c.compras ?? 0}</span>
                    <span><i data-lucide="coins"></i> LTV: S/ ${(c.ltv ?? c.gastado ?? 0).toFixed(2)}</span>
                </div>
                <div class="contact-list">
                    <span><i data-lucide="mail"></i> ${c.email}</span>
                    <span><i data-lucide="phone"></i> ${c.telefono}</span>
                </div>
            </div>
            <div class="card-footer-actions">
                <div class="card-actions">
                    <button class="btn-card-action edit" title="Editar">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn-card-action del" title="Eliminar">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </div>
        </article>
    `;
}

/**
 * Crea la fila (row) para la vista de tabla/lista
 */
export function renderClientRow(c) {
    return `
        <tr data-id="${c.id}">
            <td>
                <div style="display: flex; align-items: center; gap: 12px;">
                    <div class="avatar-circle" style="width: 32px; height: 32px; font-size: 0.7rem;">
                        ${c.avatar || c.nombre.substring(0, 2).toUpperCase()}
                    </div>
                    <strong>${c.nombre}</strong>
                </div>
            </td>
            <td>${c.arquetipo || c.documento || '-'}</td>
            <td>${c.email}</td>
            <td>${c.telefono}</td>
            <td style="text-transform: capitalize;">${['VIP', 'Regular', 'Cliente'].includes(c.tipo) ? 'Cliente' : (c.tipo || 'Cliente')}</td>
            <td>
                <span class="badge-status-mini ${(c.tipo || c.estado || '').toLowerCase() === 'vip' ? 'activa' : 'inactiva'}" style="text-transform: uppercase;">
                    ${(c.tipo || c.estado || '').toLowerCase() === 'vip' ? 'VIP' : 'Regular'}
                </span>
            </td>
            <td>
                <div class="card-actions">
                    <button class="btn-card-action preview" title="Vista previa" aria-label="Abrir vista previa">
                        <i data-lucide="eye"></i>
                    </button>
                    <button class="btn-card-action edit" title="Editar">
                        <i data-lucide="edit-3"></i>
                    </button>
                    <button class="btn-card-action del" title="Eliminar">
                        <i data-lucide="trash-2"></i>
                    </button>
                </div>
            </td>
        </tr>
    `;
}
