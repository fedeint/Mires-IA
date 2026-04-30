import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "cfg-local-1", clave: "tema", valor: "dark", categoria: "ui" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("configuracion_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const clave = String(payload?.clave || "").trim();
  const valor = String(payload?.valor || "").trim() || "";
  const categoria = String(payload?.categoria || "").trim() || "general";
  if (!clave) throw new Error("La clave es obligatoria.");
  const row = { clave, valor, categoria };

  if (!admin) return { id: `cfg-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("configuracion_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
