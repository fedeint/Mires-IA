import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "coc-local-1", orden: "ORD-001", estado: "pendiente", prioridad: "media" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("cocina_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const orden = String(payload?.orden || "").trim();
  const estado = String(payload?.estado || "").trim() || "pendiente";
  const prioridad = String(payload?.prioridad || "").trim() || "media";
  if (!orden) throw new Error("La orden es obligatoria.");
  const row = { orden, estado, prioridad };

  if (!admin) return { id: `coc-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("cocina_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
