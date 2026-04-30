/**
 * Rol efectivo (JWT) — prioriza app_metadata, igual que el front (resolveUserRole).
 * Exportado para reglas p. ej. admin de org vs superadmin.
 */
export function getAuthRole(user) {
  const a = typeof user?.app_metadata?.role === "string" ? user.app_metadata.role.trim() : "";
  if (a) return a;
  const u = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role.trim() : "";
  return u;
}

export function isSuperadmin(user) {
  return getAuthRole(user) === "superadmin";
}

/**
 * Puede abrir módulo Accesos y llamar a `manage-user-access` (listar, roles, módulos).
 * Incluye admin de organización; ver restricciones admin→superadmin en la function.
 */
export function canManageUserAccess(user) {
  const r = getAuthRole(user);
  return r === "superadmin" || r === "admin";
}
