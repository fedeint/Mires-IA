import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "rep-local-1", titulo: "Ventas semanales", periodo: "2026-W18", valor: "0" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("reportes_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const titulo = String(payload?.titulo || "").trim();
  const periodo = String(payload?.periodo || "").trim() || "sin-periodo";
  const valor = String(payload?.valor || "").trim() || "0";
  if (!titulo) throw new Error("El titulo es obligatorio.");
  const row = { titulo, periodo, valor };

  if (!admin) return { id: `rep-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("reportes_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
