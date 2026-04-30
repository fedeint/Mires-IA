import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = window.__MIREST_SUPABASE_URL__ || "";
const SUPABASE_ANON_KEY = window.__MIREST_SUPABASE_ANON_KEY__ || "";

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("[supabase-client] Faltan credenciales públicas.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});
