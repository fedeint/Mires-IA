/**
 * Controlador: carta sincronizada con `fetchMenuCatalog` (misma lógica que Pedidos).
 */
import { createProductCard, createCategoryPill, renderMetricCard, createProductDetailModal } from "./productos-components.js";
import { loadProductosCatalog } from "./productos-catalog.js";

class ProductosController {
  constructor() {
    this.products = [];
    this.categories = [{ id: "todos", label: "Todos" }];
    this.currentCategory = "todos";
    this.searchTerm = "";
    this.activeModal = null;
    this.notes = null;
    this.bootstrap();
  }

  async bootstrap() {
    this.cacheDOM();
    const r = await loadProductosCatalog();
    this.notes = r.notAuthenticated ? r.message : r.emptyMessage;
    if (!r.ok) {
      this.notes = r.message || "No se pudo cargar el catálogo.";
    }
    this.products = r.products || [];
    this.categories = (r.categoryPills && r.categoryPills.length ? r.categoryPills : this.categories) || this.categories;
    this.bindEvents();
    this.render();
  }

  cacheDOM() {
    this.metricsContainer = document.getElementById("metricsContainer");
    this.categoriesContainer = document.getElementById("categoriesContainer");
    this.productsContainer = document.getElementById("productsContainer");
    this.productSearch = document.getElementById("productSearch");
  }

  bindEvents() {
    if (this.productSearch) {
      this.productSearch.addEventListener("input", (e) => {
        this.searchTerm = (e.target.value || "").toLowerCase();
        this.renderProducts();
      });
    }

    if (this.categoriesContainer) {
      this.categoriesContainer.addEventListener("click", (e) => {
        const pill = e.target.closest(".category-pill");
        if (pill) {
          this.currentCategory = pill.dataset.category;
          this.updateCategoryPills();
          this.renderProducts();
        }
      });
    }

    if (this.productsContainer) {
      this.productsContainer.addEventListener("click", (e) => {
        const card = e.target.closest(".product-card");
        if (card && card.dataset.id) {
          const product = this.products.find((p) => String(p.id) === String(card.dataset.id));
          if (product) this.openProductModal(product);
        }
      });
    }
  }

  render() {
    this.renderNote();
    this.renderMetrics();
    this.renderCategories();
    this.renderProducts();
  }

  renderNote() {
    if (!this.metricsContainer || !this.notes) return;
    const existing = this.metricsContainer.parentElement?.querySelector(".productos-catalog-note");
    if (existing) existing.remove();
    if (this.notes) {
      const p = document.createElement("p");
      p.className = "workspace-note productos-catalog-note";
      p.style.marginBottom = "1rem";
      p.textContent = this.notes;
      this.metricsContainer.parentElement?.insertBefore(p, this.metricsContainer);
    }
  }

  renderMetrics() {
    if (!this.metricsContainer) return;
    const available = this.products.filter((p) => p.status === "disponible").length;
    const outOfStock = this.products.filter((p) => p.status === "agotado").length;
    const withPopular = this.products.find((p) => p.popular);
    const most = withPopular || this.products[0];
    const mostName = most ? most.name : "—";

    this.metricsContainer.innerHTML = `
      ${renderMetricCard("metricAvailable", "Disponibles", String(available), "check-circle", "success")}
      ${renderMetricCard("metricOutOfStock", "Agotados", String(outOfStock), "alert-triangle", "warning")}
      ${renderMetricCard("metricMostSold", "Destacado", mostName, "flame", "accent")}
    `;

    if (window.lucide) lucide.createIcons();
  }

  renderCategories() {
    if (!this.categoriesContainer) return;
    this.categoriesContainer.innerHTML = "";
    this.categories.forEach((cat) => {
      const pill = createCategoryPill(cat, cat.id === this.currentCategory);
      this.categoriesContainer.appendChild(pill);
    });
  }

  updateCategoryPills() {
    if (!this.categoriesContainer) return;
    const pills = this.categoriesContainer.querySelectorAll(".category-pill");
    pills.forEach((pill) => {
      pill.classList.toggle("active", pill.dataset.category === this.currentCategory);
    });
  }

  renderProducts() {
    if (!this.productsContainer) return;
    const filtered = this.products.filter((p) => {
      const matchesCategory = this.currentCategory === "todos" || p.category === this.currentCategory;
      const matchesSearch = p.name.toLowerCase().includes(this.searchTerm);
      return matchesCategory && matchesSearch;
    });

    this.productsContainer.innerHTML = "";

    if (this.products.length === 0) {
      this.productsContainer.innerHTML = `
        <div class="mod-placeholder">
          <div class="mod-placeholder-icon">
            <i data-lucide="package"></i>
          </div>
          <h2>Sin productos en catálogo</h2>
          <p>${this.notes || "Añade productos activos en DallA o inicia sesión."}</p>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
      return;
    }

    if (filtered.length === 0) {
      this.productsContainer.innerHTML = `
        <div class="mod-placeholder">
          <div class="mod-placeholder-icon">
            <i data-lucide="search-x"></i>
          </div>
          <h2>No se encontraron productos</h2>
          <p>Prueba otra categoría o término de búsqueda.</p>
        </div>
      `;
    } else {
      filtered.forEach((p) => {
        const card = createProductCard(p);
        this.productsContainer.appendChild(card);
      });
    }

    if (window.lucide) lucide.createIcons();
  }

  openProductModal(product) {
    const modalElement = createProductDetailModal(product);
    document.body.appendChild(modalElement);
    document.body.style.overflow = "hidden";
    this.activeModal = modalElement;

    if (window.lucide) lucide.createIcons();

    let currentSlide = 0;
    const slides = modalElement.querySelectorAll(".modal-slide");
    const indicators = modalElement.querySelectorAll(".slide-indicator");
    const totalSlides = slides.length;
    let autoPlayInterval = null;

    const showSlide = (n) => {
      if (totalSlides === 0) return;
      slides[currentSlide].classList.remove("active");
      indicators[currentSlide].classList.remove("active");
      currentSlide = (n + totalSlides) % totalSlides;
      slides[currentSlide].classList.add("active");
      indicators[currentSlide].classList.add("active");
    };

    const startAutoPlay = () => {
      if (totalSlides <= 1) return;
      autoPlayInterval = setInterval(() => {
        showSlide(currentSlide + 1);
      }, 4000);
    };

    const resetAutoPlay = () => {
      clearInterval(autoPlayInterval);
      startAutoPlay();
    };

    const next = modalElement.querySelector(".modal-next");
    const prev = modalElement.querySelector(".modal-prev");
    if (next) {
      next.addEventListener("click", () => {
        showSlide(currentSlide + 1);
        resetAutoPlay();
      });
    }
    if (prev) {
      prev.addEventListener("click", () => {
        showSlide(currentSlide - 1);
        resetAutoPlay();
      });
    }

    indicators.forEach((ind, idx) => {
      ind.addEventListener("click", () => {
        showSlide(idx);
        resetAutoPlay();
      });
    });

    startAutoPlay();

    const closeModal = () => {
      clearInterval(autoPlayInterval);
      modalElement.classList.add("fade-out");
      setTimeout(() => {
        modalElement.remove();
        document.body.style.overflow = "";
        this.activeModal = null;
      }, 300);
    };

    const closeEl = modalElement.querySelector(".modal-close");
    const over = modalElement.querySelector(".modal-overlay");
    if (closeEl) closeEl.addEventListener("click", closeModal);
    if (over) over.addEventListener("click", closeModal);

    const onKeyDown = (e) => {
      if (e.key === "Escape") {
        closeModal();
        document.removeEventListener("keydown", onKeyDown);
      }
    };
    document.addEventListener("keydown", onKeyDown);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new ProductosController();
});
