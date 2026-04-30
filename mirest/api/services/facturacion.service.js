import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "fac-local-1", comprobante: "F001-1", monto: "0", estado: "emitido" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("facturacion_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const comprobante = String(payload?.comprobante || "").trim();
  const monto = String(payload?.monto || "").trim() || "0";
  const estado = String(payload?.estado || "").trim() || "emitido";
  if (!comprobante) throw new Error("El comprobante es obligatorio.");
  const row = { comprobante, monto, estado };

  if (!admin) return { id: `fac-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("facturacion_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
