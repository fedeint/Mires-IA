/**
 * Carta: mismo origen que Pedidos (Supabase `products` + `product_categories`).
 */
import { fetchMenuCatalog } from "../Pedidos/implementacion/frontend/core/catalog-fetch.js";

function imageDataUrl(emoji) {
  const e = (emoji && String(emoji)) || "🍽";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect fill="#f1f5f9" width="100%" height="100%"/><text x="200" y="180" font-size="96" text-anchor="middle">${e}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * @param {object} p Fila enriquecida de `fetchMenuCatalog`
 */
export function mapRowToViewModel(p) {
  const md = p.metadata && typeof p.metadata === "object" ? p.metadata : {};
  const image = String(md.image_url || "").trim() || imageDataUrl(p.emoji);
  const time =
    typeof md.prep_minutes === "number"
      ? `${md.prep_minutes} min`
      : (md.prep_time != null && String(md.prep_time)) || "—";
  const stock = typeof md.stock_units === "number" ? String(md.stock_units) : (md.stock_label != null && String(md.stock_label)) || "—";

  return {
    id: p.id,
    name: p.name,
    category: p.category,
    categoryLabel: p.categoryLabel,
    price: p.price,
    image,
    images: Array.isArray(md.images) && md.images.length ? md.images : [image],
    status: p.is_active === false ? "agotado" : "disponible",
    stock,
    popular: Boolean(md.popular),
    time,
    description: (md.description != null && String(md.description)) || "",
    sku: p.sku || (md.sku != null && String(md.sku)) || "",
    promotions: Array.isArray(md.promotions) ? md.promotions : undefined,
    reviews: Array.isArray(md.reviews) ? md.reviews : undefined,
    palette: p.palette,
    badge: p.badge,
  };
}

export async function loadProductosCatalog() {
  const r = await fetchMenuCatalog();
  if (!r.ok) {
    return { ok: false, message: r.error || "Error al cargar", products: [], categoryPills: [], notAuthenticated: false };
  }
  if (r.notAuthenticated) {
    return {
      ok: true,
      notAuthenticated: true,
      message: "Inicia sesión para ver la carta de tu local.",
      products: [],
      categoryPills: [],
    };
  }
  const products = (r.products || []).map(mapRowToViewModel);
  const categoryPills = (r.categories || [])
    .filter((c) => c.id && c.id !== "all")
    .map((c) => ({ id: c.id, label: c.name || c.id }));
  const withTodos = [{ id: "todos", label: "Todos" }, ...categoryPills];
  return {
    ok: true,
    products,
    categoryPills: withTodos,
    notAuthenticated: false,
    emptyMessage:
      products.length === 0
        ? "Sin productos activos. Crea el catálogo en operación o en `products` + `product_categories` (DallA)."
        : null,
  };
}
