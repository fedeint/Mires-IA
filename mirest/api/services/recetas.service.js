import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "rec-local-1", nombre: "Receta demo", costo: 15, porciones: 2, categoria: "general" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("recetas")
    .select("id,nombre,costo,porciones,categoria,created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const nombre = String(payload?.nombre || "").trim();
  const costo = Number(payload?.costo);
  const porciones = Number(payload?.porciones ?? 1);
  const categoria = String(payload?.categoria || "general").trim();

  if (!nombre) throw new Error("El nombre es obligatorio.");
  if (!Number.isFinite(costo) || costo <= 0) throw new Error("El costo debe ser mayor a 0.");
  if (!Number.isFinite(porciones) || porciones <= 0) throw new Error("Las porciones deben ser mayores a 0.");

  if (!admin) {
    return { id: `rec-local-${Date.now()}`, nombre, costo, porciones, categoria };
  }

  const { data, error } = await admin
    .from("recetas")
    .insert({ nombre, costo, porciones, categoria })
    .select("id,nombre,costo,porciones,categoria,created_at")
    .single();
  if (error) throw error;
  return data;
}
