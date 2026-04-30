import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "del-local-1", pedido: "PD-001", repartidor: "Sin asignar", estado: "pendiente" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("delivery_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const pedido = String(payload?.pedido || "").trim();
  const repartidor = String(payload?.repartidor || "").trim() || "Sin asignar";
  const estado = String(payload?.estado || "").trim() || "pendiente";
  if (!pedido) throw new Error("El pedido es obligatorio.");
  const row = { pedido, repartidor, estado };

  if (!admin) return { id: `del-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("delivery_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
