import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "acc-local-1", usuario: "demo@mi-rest.dev", rol: "admin", estado: "activo" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("accesos_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const usuario = String(payload?.usuario || "").trim();
  const rol = String(payload?.rol || "").trim() || "operador";
  const estado = String(payload?.estado || "").trim() || "activo";
  if (!usuario) throw new Error("El usuario es obligatorio.");
  const row = { usuario, rol, estado };

  if (!admin) return { id: `acc-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("accesos_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
