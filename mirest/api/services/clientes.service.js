import { createClient } from "@supabase/supabase-js";

const hasSupabaseConfig =
  Boolean(process.env.SUPABASE_URL) && Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

const admin = hasSupabaseConfig
  ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
  : null;

const fallbackData = [
  { id: "cli-local-1", nombre: "Cliente demo", email: "demo@correo.com", telefono: "999999999" },
];

export async function list() {
  if (!admin) return fallbackData;
  const { data, error } = await admin
    .from("clientes_items")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) throw error;
  return data || [];
}

export async function create(payload) {
  const nombre = String(payload?.nombre || "").trim();
  const email = String(payload?.email || "").trim();
  const telefono = String(payload?.telefono || "").trim();
  if (!nombre) throw new Error("El nombre es obligatorio.");
  const row = { nombre, email: email || "sin-email", telefono: telefono || "sin-telefono" };

  if (!admin) return { id: `cli-local-${Date.now()}`, ...row };

  const { data, error } = await admin
    .from("clientes_items")
    .insert(row)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}
