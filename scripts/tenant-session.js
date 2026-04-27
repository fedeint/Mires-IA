/**
 * tenant_id de la sesión (usuarios / JWT). Caché por sesión; invalidar al cerrar login.
 */
import { supabase } from "./supabase.js";

let _cacheValid = false;
let _cachedTenant = /** @type {string | null} */ (null);

/**
 * @returns {Promise<string | null>}
 */
export async function getCurrentTenantId() {
  if (_cacheValid) {
    return _cachedTenant;
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    _cachedTenant = null;
    _cacheValid = true;
    return null;
  }
  const { data, error } = await supabase
    .from("usuarios")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (error) {
    console.warn("[tenant] usuarios", error);
    _cachedTenant = null;
    _cacheValid = true;
    return null;
  }
  _cachedTenant = data?.tenant_id != null ? String(data.tenant_id) : null;
  _cacheValid = true;
  return _cachedTenant;
}

export function clearTenantIdCache() {
  _cacheValid = false;
  _cachedTenant = null;
}
