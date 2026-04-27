/**
 * Política de tours (onboarding) por módulo: se lee de la caché de Configuración
 * (`mirest_config` / restaurant_settings mirest_shell_v1.tour) que el superadmin
 * ajusta en Configuración del sistema.
 */
import { getCachedMirestConfig } from "./mirest-app-config.js";

/**
 * @param {string} moduleKey - p. ej. caja, pedidos, clientes
 * @returns {boolean}
 */
export function isMirestModuleTourEnabled(moduleKey) {
  const c = getCachedMirestConfig();
  const tour = c && typeof c === "object" && c.tour && typeof c.tour === "object" ? c.tour : null;
  if (!tour) return true;
  if (tour.modulosHabilitado === false) return false;
  const per = tour.activoPorModulo;
  if (per && typeof per === "object" && Object.prototype.hasOwnProperty.call(per, moduleKey)) {
    return per[moduleKey] === true;
  }
  return true;
}
