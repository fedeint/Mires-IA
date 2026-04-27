/**
 * Puente entre app_role (Supabase / user_profiles) y claves de rol del shell (navigation.js, Accesos).
 * No modifica la BD: solo mapea etiquetas.
 */

/** @type {Record<string, string>} */
export const APP_ROLE_TO_SHELL = {
  superadmin: "superadmin",
  administrador: "admin",
  cajero: "caja",
  mesero: "pedidos",
  cocinero: "chef",
  almacenero: "almacen",
  marketing: "marketing",
};

const SHELL_TO_APP = {
  superadmin: "superadmin",
  admin: "administrador",
  caja: "cajero",
  pedidos: "mesero",
  chef: "cocinero",
  almacen: "almacenero",
  marketing: "marketing",
  demo: "mesero",
  soporte: "mesero",
};

/**
 * @param {string} [appRole] valor de user_profiles.role (enum app_role)
 * @param {import('@supabase/auth-js').User} [user] fallback a metadata
 * @returns {string}
 */
export function resolveShellRoleFromProfile(appRole, user) {
  if (appRole && APP_ROLE_TO_SHELL[appRole]) {
    return APP_ROLE_TO_SHELL[appRole];
  }
  const m =
    (user?.app_metadata && typeof user.app_metadata.role === "string" && user.app_metadata.role.trim()) ||
    (user?.user_metadata && typeof user.user_metadata.role === "string" && user.user_metadata.role.trim()) ||
    "";
  return m || "demo";
}

/**
 * Para formularios Accesos / servicios que aún usan nombres shell.
 * @param {string} shellRole
 */
export function shellRoleToAppRole(shellRole) {
  if (!shellRole) {
    return "mesero";
  }
  if (SHELL_TO_APP[shellRole]) {
    return SHELL_TO_APP[shellRole];
  }
  if (Object.prototype.hasOwnProperty.call(APP_ROLE_TO_SHELL, shellRole)) {
    return shellRole;
  }
  return "mesero";
}
