/**
 * Hidrata `refData` desde Supabase (RLS + tenant en JWT). Sin datos de muestra.
 */
import { supabase } from '../../../../scripts/supabase.js';
import { listOperationalStaffForCaja } from '../../../../scripts/operational-staff.js';

const PALETTES = ['sunset', 'amber', 'mint', 'ocean', 'sand', 'berry', 'rose', 'gold', 'lime'];
const CAT_TODOS = [{ id: 'all', name: 'Todos' }];

function pickPalette(i) {
  return PALETTES[i % PALETTES.length];
}

/**
 * @returns {Promise<{ ok: boolean, notAuthenticated?: boolean, products: object[], categories: object[], recipeAvailability: Record<string, object>, error?: string }>}
 */
export async function fetchMenuCatalog() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { ok: true, notAuthenticated: true, products: [], categories: structuredClone(CAT_TODOS), recipeAvailability: {} };
  }

  const { data: catRows, error: catErr } = await supabase
    .from('categorias_producto')
    .select('id, slug, name, sort_order')
    .order('sort_order', { ascending: true });

  const { data: prodRows, error: prodErr } = await supabase
    .from('productos')
    .select('id, name, price, category_id, sku, metadata, is_active')
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (catErr || prodErr) {
    const err = (catErr || prodErr || {}).message || 'Error al leer el catálogo';
    return { ok: false, error: err, products: [], categories: structuredClone(CAT_TODOS), recipeAvailability: {} };
  }

  const byCatId = new Map((catRows || []).map((c) => [c.id, c]));
  const categories = [
    ...CAT_TODOS,
    ...(catRows || []).map((c) => ({ id: c.slug, name: c.name })),
  ];
  const products = (prodRows || []).map((p, i) => {
    const c = p.category_id ? byCatId.get(p.category_id) : null;
    const md = p.metadata && typeof p.metadata === 'object' ? p.metadata : {};
    return {
      id: p.id,
      name: p.name,
      category: c ? c.slug : 'general',
      categoryLabel: c ? c.name : 'General',
      price: Number(p.price) || 0,
      badge: String(md.badge != null ? md.badge : ''),
      emoji: String(md.emoji != null ? md.emoji : '🍽'),
      palette: String(md.palette != null ? md.palette : pickPalette(i)),
      metadata: md,
      sku: p.sku != null ? String(p.sku) : '',
      is_active: p.is_active,
    };
  });

  const recipeAvailability = {};
  const { data: mpr, error: mprErr } = await supabase
    .from('menu_product_recipes')
    .select('menu_product_id, recipe_id');
  if (!mprErr && mpr) {
    for (const row of mpr) {
      if (row.menu_product_id && row.recipe_id) {
        recipeAvailability[row.menu_product_id] = {
          recipeId: row.recipe_id,
          inStock: true,
          kitchenStation: 'general',
        };
      }
    }
  }

  return { ok: true, products, categories, recipeAvailability };
}

export async function fetchOperationalWaiters() {
  const r = await listOperationalStaffForCaja();
  if (!r.ok) {
    return { ok: false, waiters: [], errorMessage: r.errorMessage || '' };
  }
  if (r.empty) {
    return { ok: true, waiters: [] };
  }
  const waiters = r.meseros.map((m) => ({
    id: m.id,
    name: m.name,
    shift: m.role || '—',
  }));
  return { ok: true, waiters };
}
