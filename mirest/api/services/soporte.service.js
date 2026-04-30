import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "sup-local-1", ticket: "SUP-001", asunto: "Consulta", estado: "abierto" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("soporte_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const ticket = String(payload?.ticket || "").trim();
  const asunto = String(payload?.asunto || "").trim() || "Sin asunto";
  const estado = String(payload?.estado || "").trim() || "abierto";
  if (!ticket) throw new Error("El ticket es obligatorio.");
  const row = { ticket, asunto, estado };

  if (!admin) return { id: `sup-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("soporte_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
