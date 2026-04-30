import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "ped-local-1", cliente: "Mesa 1", total: "0", estado: "pendiente" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("pedidos_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const cliente = String(payload?.cliente || "").trim();
  const total = String(payload?.total || "").trim() || "0";
  const estado = String(payload?.estado || "").trim() || "pendiente";
  if (!cliente) throw new Error("El cliente es obligatorio.");
  const row = { cliente, total, estado };

  if (!admin) return { id: `ped-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("pedidos_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
