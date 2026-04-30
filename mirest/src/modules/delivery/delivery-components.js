/**
 * Componentes reutilizables (p. ej. tarjetas). La pantalla de delivery operativa vive en Pedidos (módulo/modo delivery).
 */

export function createOrderCard(order, onAction) {
  const div = document.createElement('div');
  div.className = `delivery-card card ${order.status === 'listo' ? 'status-ready-pulse' : ''}`;
  div.dataset.orderId = order.id;
  
  const channelClass = order.channel.replace(/\s+/g, '-').toLowerCase();
  const statusLabel = order.status === 'pendiente' ? 'Pendiente' : 
                     order.status === 'preparacion' ? 'En Preparación' : 'Listo para Recoger';
  
  const actionBtn = order.status === 'pendiente' ? 
    `<button class="btn-action btn-accept">Aceptar</button>` :
    order.status === 'preparacion' ? 
    `<button class="btn-action btn-ready">Listo</button>` :
    `<button class="btn-action btn-collected">Recogido ✓</button>`;

  const totalItems = order.items ? order.items.reduce((acc, item) => acc + item.qty, 0) : 0;
  const itemsHtml = order.items ? order.items.map(item => `
    <div class="item-detail-row">
      <span class="item-qty">${item.qty}x</span>
      <span class="item-name">${item.name}</span>
      <span class="item-price">S/ ${item.price}</span>
    </div>
  `).join('') : '';

  div.innerHTML = `
    <div class="delivery-card__header">
      <span class="channel-badge channel-${channelClass}">${order.channel}</span>
      <span class="order-id">#${order.id}</span>
      <span class="status-badge status-${order.status}">${statusLabel}</span>
    </div>
    <div class="delivery-card__body">
      <h4 class="customer-name">${order.customer}</h4>
      <p class="address"><i data-lucide="map-pin"></i> ${order.address}</p>
      
      <div class="items-summary-pill">
        <i data-lucide="package"></i>
        <span>${totalItems} items · S/ ${order.price}</span>
        <i data-lucide="chevron-down" class="expand-icon"></i>
      </div>

      <div class="items-expanded-list">
        ${itemsHtml}
      </div>

      <p class="time"><i data-lucide="clock"></i> ${order.time}</p>
      ${order.rider ? `<p class="rider-info"><i data-lucide="bike"></i> ${order.rider}</p>` : ''}
    </div>
    <div class="delivery-card__footer">
      <div class="price-info">
        <span class="price-label">S/ ${order.price}</span>
        <span class="connection-status ${order.connected ? 'connected' : ''}">
          <i data-lucide="wifi"></i> ${order.connected ? 'Conectado' : 'Desconectado'}
        </span>
      </div>
      ${actionBtn}
    </div>
  `;

  // Eventos
  const btn = div.querySelector('.btn-action');
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    onAction(order.id, order.status);
  });

  div.addEventListener('click', (e) => {
    if (!e.target.closest('.delivery-card__footer') && !e.target.closest('.btn-action')) {
      div.classList.toggle('is-expanded');
    }
  });

  return div;
}

export function renderMetricCard(id, label, value, icon, variant = "accent") {
  return `
    <article class="mod-stat-card">
      <div class="mod-stat-icon mod-stat-icon--${variant}">
        <i data-lucide="${icon}"></i>
      </div>
      <div class="mod-stat-info">
        <span class="mod-stat-label">${label}</span>
        <div class="mod-stat-value" id="${id}">${value}</div>
      </div>
    </article>
  `;
}
