/**
 * Componentes visuales para la Carta de Productos
 */

export function createProductCard(product) {
  const card = document.createElement('article');
  card.className = 'product-card';
  card.dataset.id = product.id;
  card.dataset.category = product.category;

  const statusLabel = product.status === 'disponible' ? `Disponible · ${product.stock} disponibles` : 'Agotado';

  card.innerHTML = `
    <div class="product-card__image-wrap">
      <img src="${product.image}" alt="${product.name}" class="product-card__image" loading="lazy">
      <div class="product-badge badge--status">
        <span class="badge-dot"></span>
        ${statusLabel}
      </div>
      ${product.popular ? `
        <div class="product-badge badge--popular">
          <i data-lucide="flame"></i>
          Popular
        </div>
      ` : ''}
    </div>
    <div class="product-card__content">
      <div class="product-card__header">
        <h4 class="product-name">${product.name}</h4>
        <span class="product-price">S/ ${product.price}</span>
      </div>
      <p class="product-category">${product.categoryLabel}</p>
      <div class="product-card__footer">
        <div class="product-meta">
          <i data-lucide="clock"></i>
          <span>${product.time}</span>
        </div>
        ${product.popular ? `
          <div class="product-meta meta--popular">
            <i data-lucide="flame"></i>
            <span>Popular</span>
          </div>
        ` : ''}
      </div>
    </div>
  `;

  return card;
}

export function createCategoryPill(category, isActive = false) {
  const pill = document.createElement('button');
  pill.className = `category-pill ${isActive ? 'active' : ''}`;
  pill.dataset.category = category.id;
  pill.textContent = category.label;
  return pill;
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

export function createProductDetailModal(product) {
  const modal = document.createElement('div');
  modal.className = 'product-modal';
  
  const statusLabel = product.status === 'disponible' ? `Disponible · ${product.stock} disponibles` : 'Agotado';
  
  const imagesHtml = (product.images || [product.image]).map((img, idx) => `
    <div class="modal-slide ${idx === 0 ? 'active' : ''}">
      <img src="${img}" alt="${product.name}">
    </div>
  `).join('');

  const indicatorsHtml = (product.images || [product.image]).map((_, idx) => `
    <span class="slide-indicator ${idx === 0 ? 'active' : ''}" data-index="${idx}"></span>
  `).join('');

  const promotionsHtml = product.promotions && product.promotions.length > 0 ? `
    <div class="modal-section">
      <h5 class="section-title"><i data-lucide="tag"></i> PROMOCIONES</h5>
      <div class="promotions-list">
        ${product.promotions.map(promo => `
          <div class="promo-card">
            <div class="promo-info">
              <span class="promo-icon"><i data-lucide="flame"></i></span>
              <div class="promo-text">
                <strong>${promo.title}</strong>
                <p>${promo.description}</p>
              </div>
            </div>
            <span class="promo-discount">${promo.discount}</span>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  const reviewsHtml = product.reviews && product.reviews.length > 0 ? `
    <div class="modal-section">
      <h5 class="section-title"><i data-lucide="star"></i> RESEÑAS</h5>
      <div class="reviews-list">
        ${product.reviews.map(rev => `
          <div class="review-card">
            <div class="review-header">
              <div class="stars">${'★'.repeat(rev.rating)}${'☆'.repeat(5-rev.rating)}</div>
              <span class="review-user">${rev.user}</span>
            </div>
            <p class="review-comment">"${rev.comment}"</p>
          </div>
        `).join('')}
      </div>
    </div>
  ` : '';

  modal.innerHTML = `
    <div class="modal-overlay"></div>
    <div class="modal-container">
      <button class="modal-close"><i data-lucide="x"></i></button>
      
      <div class="modal-layout">
        <div class="modal-gallery">
          ${product.popular ? `<div class="modal-popular-badge"><i data-lucide="flame"></i> Popular</div>` : ''}
          <div class="modal-slides-container">
            ${imagesHtml}
          </div>
          
          <div class="modal-play-overlay">
            <button class="play-button">
              <i data-lucide="play" fill="currentColor"></i>
            </button>
          </div>

          <div class="modal-nav modal-prev"><i data-lucide="chevron-left"></i></div>
          <div class="modal-nav modal-next"><i data-lucide="chevron-right"></i></div>
          <div class="modal-indicators">
            ${indicatorsHtml}
          </div>
        </div>
        
        <div class="modal-info">
          <div class="modal-header-info">
            <span class="modal-category-sku">${product.categoryLabel} · ${product.sku || 'SKU-000'}</span>
            <h2 class="modal-product-name">${product.name}</h2>
            <div class="modal-price-pill">S/ ${product.price}</div>
          </div>
          
          <div class="modal-meta-row">
            <span class="meta-pill"><i data-lucide="clock"></i> ${product.time}</span>
            <span class="meta-pill status-pill-green"><span class="pill-dot"></span> ${statusLabel}</span>
          </div>
          
          <div class="modal-description">
            <div class="desc-card">
              <i data-lucide="sparkle" class="sparkle-icon"></i>
              <p>${product.description || 'Sin descripción disponible.'}</p>
            </div>
          </div>
          
          ${promotionsHtml}
          ${reviewsHtml}
        </div>
      </div>
    </div>
  `;

  return modal;
}
