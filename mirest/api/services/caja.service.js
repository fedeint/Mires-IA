import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "caja-local-1", concepto: "Venta demo", monto: "20.00", metodo: "efectivo" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("caja_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const concepto = String(payload?.concepto || "").trim();
  const monto = String(payload?.monto || "").trim() || "0";
  const metodo = String(payload?.metodo || "").trim() || "efectivo";
  if (!concepto) throw new Error("El concepto es obligatorio.");
  const row = { concepto, monto, metodo };

  if (!admin) return { id: `caja-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("caja_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
