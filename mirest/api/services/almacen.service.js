import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "alm-local-1", nombre: "Insumo demo", stock: 20, unidad: "kg", minimo: 5 },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("almacen_items")
    .select("id,nombre,stock,unidad,minimo,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const nombre = String(payload?.nombre || "").trim();
  const stock = Number(payload?.stock);
  const unidad = String(payload?.unidad || "u").trim();
  const minimo = Number(payload?.minimo ?? 0);

  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!Number.isFinite(stock) || stock < 0) throw new Error("El stock debe ser 0 o mayor.");
  if (!Number.isFinite(minimo) || minimo < 0) throw new Error("El mínimo debe ser 0 o mayor.");

  if (!admin) {
    return { id: `alm-local-${Date.now()}`, nombre, stock, unidad, minimo };
  }

  const { data, error } = await admin
    .from("almacen_items")
    .insert({ nombre, stock, unidad, minimo })
    .select("id,nombre,stock,unidad,minimo,created_at")
    .single();
  if (error) throw error;
  return data;
}
