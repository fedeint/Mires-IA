/**
 * Evita solapar el tour multivista del CRM (`Clientes/tour-interactivo.js`)
 * con el onboarding por módulo del shell (`MirestOnboarding`).
 * Las claves de localStorage deben coincidir con `tour-interactivo.js`.
 */
import { getCachedMirestConfig } from "./mirest-app-config.js";

function tourUserScope() {
  try {
    return localStorage.getItem("mirest_user_id") || sessionStorage.getItem("mirest_user_id") || "anon";
  } catch {
    return "anon";
  }
}

function tourKey(name) {
  return `mirest_tu_${tourUserScope()}_${name}`;
}

function isTourValueOff(v) {
  return v === false || v === "false" || v === 0 || v === "0";
}

function isCrmTourGloballyOff() {
  try {
    const c = getCachedMirestConfig();
    const tour = c && typeof c === "object" && c.tour && typeof c.tour === "object" ? c.tour : null;
    if (!tour) return false;
    if (isTourValueOff(tour.modulosHabilitado)) return true;
    const per = tour.activoPorModulo;
    if (per && typeof per === "object" && Object.prototype.hasOwnProperty.call(per, "clientes")) {
      return isTourValueOff(per.clientes);
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Rutas bajo Clientes/ que cargan `tour-interactivo.js`.
 * @param {string} pathname
 */
function isClientesCrmPath(pathname) {
  return /Clientes[/\\]/i.test(pathname || "");
}

/**
 * Si true, no iniciar `MirestOnboarding.start(moduleKey)` al cargar la página.
 * @param {string} moduleKey
 */
export function shouldDeferShellModuleOnboardingForCrmTour(moduleKey) {
  if (moduleKey !== "clientes" && moduleKey !== "proveedores") return false;
  if (typeof window === "undefined" || !isClientesCrmPath(window.location.pathname)) return false;
  if (isCrmTourGloballyOff()) return false;
  try {
    if (localStorage.getItem(tourKey("tourCompletado")) === "true") return false;
  } catch {
    return false;
  }
  return true;
}
