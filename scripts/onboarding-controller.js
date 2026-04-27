const ACTIVE_KEY = "mirest-active-onboarding";

let activeInstance = null;
let activeId = null;

export function cleanupOnboardingDom() {
  document
    .querySelectorAll(".onboarding-overlay, .onboarding-spotlight, .mirest-mod-onb-card, #onboardingRoot > *, #logoutSessionOverlay, #logoutSessionModal")
    .forEach((node) => node.remove());
  document.body.classList.remove("onboarding-open", "tour-active", "panel-sheet-open");
}

export function registerOnboarding(instance, id) {
  if (activeInstance && activeInstance !== instance) {
    try {
      activeInstance.cancel?.();
      activeInstance.finish?.(false);
    } catch {
      cleanupOnboardingDom();
    }
  }
  activeInstance = instance;
  activeId = String(id || "onboarding");
  sessionStorage.setItem(ACTIVE_KEY, activeId);
  cleanupOnboardingDom();
}

export function clearActiveOnboarding(instance) {
  if (!instance || activeInstance === instance) {
    activeInstance = null;
    activeId = null;
    sessionStorage.removeItem(ACTIVE_KEY);
  }
}

export function cancelActiveOnboarding() {
  if (activeInstance) {
    try {
      activeInstance.cancel?.();
      activeInstance.finish?.(false);
    } catch {
      cleanupOnboardingDom();
    }
  }
  activeInstance = null;
  activeId = null;
  sessionStorage.removeItem(ACTIVE_KEY);
  cleanupOnboardingDom();
}

export function showPostOnboardingInsights({ moduleKey = "módulo", role = "operativo" } = {}) {
  if (document.getElementById("mirestPostOnboardingInsights")) return;
  const isAdmin = ["admin", "superadmin", "administrador"].includes(String(role).toLowerCase());
  const box = document.createElement("section");
  box.id = "mirestPostOnboardingInsights";
  box.className = "post-onboarding-insights";
  box.setAttribute("aria-label", "Insights post onboarding");
  box.innerHTML = `
    <div class="post-onboarding-insights__head">
      <strong>Insights</strong>
      <button type="button" aria-label="Cerrar insights">×</button>
    </div>
    <article>
      <span>Estado</span>
      <p>${isAdmin ? `Ya puedes revisar control y trazabilidad en ${moduleKey}` : `Ya puedes operar ${moduleKey} con los pasos clave`}</p>
    </article>
    <article>
      <span>Mañana</span>
      <p>${isAdmin ? "Revisa demanda compras y campaña sugerida" : "Revisa pendientes y prepara la primera acción"}</p>
    </article>
  `;
  box.querySelector("button")?.addEventListener("click", () => box.remove(), { once: true });
  document.body.appendChild(box);
  window.setTimeout(() => box.remove(), 12000);
}

window.MirestOnboardingController = {
  cancel: cancelActiveOnboarding,
  cleanup: cleanupOnboardingDom,
  postInsights: showPostOnboardingInsights,
  get activeId() {
    return activeId || sessionStorage.getItem(ACTIVE_KEY);
  },
};

window.addEventListener("pagehide", cancelActiveOnboarding, { capture: true });
window.addEventListener("beforeunload", cancelActiveOnboarding, { capture: true });
