import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://twneirdsvyxsdsneidhi.supabase.co';
const supabaseKey = 'sb_publishable_A0yo_kDAGY3OamrUOOL9Bw_ShVWdBMF';
const SUPABASE_SINGLETON_KEY = '__mirest_supabase_client__';

const globalScope = globalThis;

if (!globalScope[SUPABASE_SINGLETON_KEY]) {
  globalScope[SUPABASE_SINGLETON_KEY] = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      // Implícito: enlaces de invitación/recuperación llevan tokens en el hash (#access_token…),
      // suelen durar lo que marque "Mailer OTP expiration" en el panel. PKCE (?code=) caduca ~5 min
      // y el intercambio exige verificador en el mismo navegador donde empezó el flujo (malo para correo).
      flowType: "implicit",
    },
  });
}

export const supabase = globalScope[SUPABASE_SINGLETON_KEY];
export { supabaseUrl, supabaseKey };
const SESSION_EXPIRY_BUFFER_MS = 30 * 1000;

async function clearBrokenSession() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Si la sesión ya está inválida, igual intentamos limpiar el storage manualmente.
  }

  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // Ignoramos errores del storage para no bloquear el flujo.
  }
}

// Metadatos del usuario logueado. Tras un cambio de permisos vía Admin API,
// el objeto `session.user` en localStorage puede seguir desactualizado: el
// JWT no se regenera solo. `getUser()` consulta a GoTrue y devuelve el
// user_metadata vigente (incl. `permissions`), que es lo que usa el sidebar.
export async function getCurrentUser() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    await clearBrokenSession();
    return null;
  }

  if (!session) return null;

  const expiresAtMs = typeof session.expires_at === "number"
    ? session.expires_at * 1000
    : null;

  if (expiresAtMs && expiresAtMs <= Date.now() + SESSION_EXPIRY_BUFFER_MS) {
    await clearBrokenSession();
    return null;
  }

  const { data: userPayload, error: userError } = await supabase.auth.getUser();
  if (userError) {
    const msg = String(userError.message || "").toLowerCase();
    const unauthorized =
      userError.status === 401 || msg.includes("jwt") || msg.includes("invalid");
    if (unauthorized) {
      await clearBrokenSession();
      return null;
    }
    return session.user ?? null;
  }

  return userPayload?.user ?? session.user ?? null;
}

// Cerramos sesión Global
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (!error) {
    window.location.href = './login.html';
  }
}
