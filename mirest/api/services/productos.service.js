import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "local-1", nombre: "Producto demo", precio: 10, stock: 0, categoria: "general" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("productos")
    .select("id,nombre,precio,stock,categoria,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const nombre = String(payload?.nombre || "").trim();
  const precio = Number(payload?.precio);
  const stock = Number(payload?.stock ?? 0);
  const categoria = String(payload?.categoria || "general").trim();

  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!Number.isFinite(precio) || precio <= 0) throw new Error("El precio debe ser mayor a 0.");
  if (!Number.isFinite(stock) || stock < 0) throw new Error("El stock debe ser 0 o mayor.");

  if (!admin) {
    return { id: `local-${Date.now()}`, nombre, precio, stock, categoria };
  }

  const { data, error } = await admin
    .from("productos")
    .insert({ nombre, precio, stock, categoria })
    .select("id,nombre,precio,stock,categoria,created_at")
    .single();
  if (error) throw error;
  return data;
}
