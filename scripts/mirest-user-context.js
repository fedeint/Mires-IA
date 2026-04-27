/**
 * Carga de contexto MiRest: user_profiles (Supabase) + puente a roles del shell.
 * Prioridad: columnas de BD (modulos_acceso, role, usa_pwa) > metadata de Auth.
 */
import { getCurrentUser, supabase } from "./supabase.js";
import { resolveShellRoleFromProfile } from "./mirest-role-maps.js";
import { resolveUserRole } from "./navigation.js";

/**
 * @param {import('@supabase/auth-js').User | null} [existingUser] evita segundo getUser si ya lo tienes
 * @returns {Promise<{
 *  user: import('@supabase/auth-js').User | null;
 *  profile: Record<string, unknown> | null;
 *  shellRole: string;
 *  permissions: string[] | null;
 *  usaPwa: boolean;
 * }>}
 */
export async function loadMirestUserContext(existingUser) {
  const user = existingUser != null ? existingUser : (await getCurrentUser());
  if (!user) {
    return { user: null, profile: null, shellRole: "demo", permissions: null, usaPwa: true };
  }
  const { data: profile, error } = await supabase
    .from("usuarios")
    .select("id, tenant_id, role, modulos_acceso, usa_pwa, full_name, restaurant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.warn("[mirest] usuarios:", error);
  }
  const shellFromDb = profile ? resolveShellRoleFromProfile(/** @type {string} */(profile.role), user) : null;
  const shellRole = shellFromDb || resolveUserRole(user);
  const rawMods = profile && Array.isArray(profile.modulos_acceso) ? profile.modulos_acceso : null;
  const permissions = rawMods && rawMods.length > 0 ? rawMods : null;
  const usaPwa = profile == null || profile.usa_pwa !== false;
  return {
    user,
    profile,
    shellRole,
    permissions,
    usaPwa,
  };
}

