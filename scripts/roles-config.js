/**
 * Carga de permisos desde public.roles_modulos (por tenant). Sin fallback a datos mock.
 * Si no hay fila: ROLE_PERMISSIONS en navigation.js.
 */

import { supabase } from "./supabase.js";
import { getCurrentTenantId } from "./tenant-session.js";

import { ROLE_PERMISSIONS } from "./navigation.js";

/** @type {Record<string, { modulos: string[]; usa_pwa: boolean }> | null} */
let _cache = null;
let _loadPromise = null;

/**
 * Carga o refresca el mapa role → { modulos, usa_pwa }.
 * Idempotente: reutiliza caché en memoria.
 * @param {{ force?: boolean }} [opt]
 * @returns {Promise<Record<string, { modulos: string[]; usa_pwa: boolean }>>}
 */
export function loadRolesConfigMap(opt = {}) {
  if (!opt.force && _cache) {
    return Promise.resolve(_cache);
  }
  if (_loadPromise) {
    return _loadPromise;
  }
  _loadPromise = (async () => {
    const tenantId = await getCurrentTenantId();
    if (!tenantId) {
      _cache = {};
    } else {
      const { data, error } = await supabase
        .from("roles_modulos")
        .select("rol, modulos, usa_pwa")
        .eq("tenant_id", tenantId);
      if (error) {
        console.warn("[roles_modulos] no se pudo leer; se usan permisos por defecto en código.", error);
        _cache = {};
      } else {
        _cache = Object.fromEntries(
          (data || []).map((row) => [row.rol, { modulos: row.modulos || [], usa_pwa: row.usa_pwa !== false }]),
        );
      }
    }
    if (typeof globalThis !== "undefined") {
      globalThis.__MIREST_ROLES_CONFIG__ = _cache;
    }
    _loadPromise = null;
    return _cache;
  })();
  return _loadPromise;
}

/**
 * Módulos por defecto para un rol, según caché Supabase, o `null` para usar `ROLE_PERMISSIONS` en el caller.
 * @param {string} role
 * @returns {string[] | null}
 */
export function getModulesForRoleFromDb(role) {
  const map = (typeof globalThis !== "undefined" && globalThis.__MIREST_ROLES_CONFIG__) || _cache;
  if (!map || !role) return null;
  const entry = map[role];
  if (!entry) return null;
  const modulos = Array.isArray(entry.modulos) ? entry.modulos : [];
  return modulos;
}

/**
 * @param {string} role
 * @returns {boolean | null} null = desconocido, usar true
 */
export function getUsaPwaForRoleFromDb(role) {
  const map = (typeof globalThis !== "undefined" && globalThis.__MIREST_ROLES_CONFIG__) || _cache;
  if (!map || !map[role]) return null;
  return map[role].usa_pwa !== false;
}

export function isRolesConfigLoaded() {
  return _cache != null;
}

/**
 * Módulos efectivos: DB si existe, si no ROLE_PERMISSIONS (código en navigation).
 * @param {string} role
 */
export function getEffectiveModuleKeysForRole(role) {
  const fromDb = getModulesForRoleFromDb(role);
  if (Array.isArray(fromDb) && fromDb.length) {
    return fromDb;
  }
  return ROLE_PERMISSIONS[role] || [];
}
