/**
 * Runner de onboarding por módulo: spotlight + verificación en BD / local (como Pedidos PRO).
 */
import { getVerifyHandler, MIREST_MODULE_ONBOARDING, createMirestOnboardingContext } from "./mirest-module-onboarding-registry.js";

/**
 * @typedef {object} MirestOnboardingContext
 * @property {import('@supabase/supabase-js').SupabaseClient} supabase
 * @property {string | null} tenantId
 * @property {string | null} restaurantId
 * @property {import('@supabase/auth-js').User} user
 * @property {Record<string, unknown> | null} profile
 * @property {boolean} [guiaSinTenant] — sin `tenant` en nube: tour visible, comprobación remota desactivada
 */

const POLL_MS = 12000;

export class MirestModuleOnboardingRunner {
  /**
   * @param {string} moduleKey - clave en MIREST_MODULE_ONBOARDING
   * @param {{ force?: boolean }} [opts]
   */
  constructor(moduleKey, opts = {}) {
    const def = MIREST_MODULE_ONBOARDING[moduleKey];
    if (!def) throw new Error(`Módulo de onboarding desconocido: ${moduleKey}`);
    this.moduleKey = moduleKey;
    this.def = def;
    this.force = opts.force === true;
    this.currentIndex = 0;
    this.overlay = null;
    this._poll = null;
    this._spotlightRaf = null;
    this.ctx = /** @type {MirestOnboardingContext | null} */ (null);
    this._lastOk = false;
  }

  /**
   * @returns {Promise<void>}
   */
  async start() {
    if (!this.force) {
      try {
        if (localStorage.getItem(this.def.storageKey) === "1") return;
      } catch {
        /* */
      }
    }
    this.ctx = await createMirestOnboardingContext();
    if (!this.ctx) {
      window.alert("Inicia sesión con tu cuenta (Auth) para abrir el tour de este módulo.");
      return;
    }
    this._buildOverlay();
  }

  _buildOverlay() {
    if (this.overlay) return;
    this.overlay = document.createElement("div");
    this.overlay.className = "onboarding-overlay open";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-label", `Tour: ${this.def.label}`);
    this.overlay.innerHTML = `
      <div class="onboarding-spotlight" id="mirestModObSpotlight"></div>
      <div class="onboarding-card mirest-mod-onb-card" id="mirestModObCard" style="max-width:min(400px,92vw)">
        <div class="onboarding-header" style="align-items:flex-start;gap:8px">
          <div style="flex:1;min-width:0">
            <p class="mirest-mod-onb-kicker" style="margin:0 0 4px;font-size:12px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;color:var(--color-text-muted)">
              <span id="mirestModObIcon">${this.def.icon || ""}</span> <span id="mirestModObModLabel"></span>
            </p>
            <h2 id="mirestModObTitle" style="margin:0;font-size:1.1rem;font-weight:700"></h2>
          </div>
          <button type="button" class="onboarding-skip" id="mirestModObSkip">Cerrar</button>
        </div>
        <p id="mirestModObDesc" style="margin:8px 0 4px;font-size:13px;line-height:1.4;color:var(--color-text)"></p>
        <p id="mirestModObAction" style="margin:0 0 6px;font-size:12px;font-weight:600;color:var(--color-accent)"></p>
        <p id="mirestModObGuiaAviso" style="display:none;font-size:11px;line-height:1.35;padding:6px 8px;border-radius:8px;border:1px solid rgba(234,179,8,.4);background:rgba(234,179,8,.12);color:var(--color-text);margin:0 0 8px"></p>
        <div class="mirest-mod-onb-cond" style="font-size:11px;padding:6px 8px;border-radius:8px;background:var(--color-surface-muted);color:var(--color-text-muted);margin-bottom:8px">
          <strong style="color:var(--color-text)">Listo cuando</strong>
          <span id="mirestModObWhen"></span>
        </div>
        <p id="mirestModObState" style="font-size:13px;margin:0 0 8px"></p>
        <div class="onboarding-footer" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;justify-content:space-between">
          <span id="mirestModObProg" style="font-size:12px;color:var(--color-text-muted)"></span>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            <button type="button" class="onboarding-btn onboarding-btn--ghost" id="mirestModObCheck" style="background:var(--color-surface-muted)">Verificar ahora</button>
            <button type="button" class="onboarding-btn" id="mirestModObNext">Siguiente</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    const guiaAviso = document.getElementById("mirestModObGuiaAviso");
    if (guiaAviso && this.ctx?.guiaSinTenant) {
      guiaAviso.style.display = "block";
      guiaAviso.textContent =
        "Sin tenant en la cuenta modo guía sin comprobaciones en base hasta vincular local en Accesos o perfiles";
    }
    document.getElementById("mirestModObModLabel").textContent = this.def.label;
    document.getElementById("mirestModObSkip").onclick = () => this.finish(false);
    document.getElementById("mirestModObNext").onclick = () => {
      void this._next();
    };
    document.getElementById("mirestModObCheck").onclick = () => this._runVerify();

    window.addEventListener("scroll", () => this._scheduleSpotlight(), { passive: true, capture: true });
    window.addEventListener("resize", () => this._scheduleSpotlight(), { passive: true });

    void this._showStep();
    this._poll = window.setInterval(() => {
      void this._runVerify(true);
    }, POLL_MS);
  }

  _currentStep() {
    return this.def.steps[this.currentIndex];
  }

  _scheduleSpotlight() {
    if (this._spotlightRaf != null) return;
    this._spotlightRaf = requestAnimationFrame(() => {
      this._spotlightRaf = null;
      this._updateSpotlight();
    });
  }

  _updateSpotlight() {
    const step = this._currentStep();
    const spotlight = document.getElementById("mirestModObSpotlight");
    const card = document.getElementById("mirestModObCard");
    if (!spotlight || !card) return;
    const sel = (step?.element && String(step.element).trim()) || "body";
    const el = document.querySelector(sel.split(",")[0].trim());
    if (!el || el.offsetParent === null) {
      spotlight.style.display = "none";
      card.style.top = "50%";
      card.style.left = "50%";
      card.style.transform = "translate(-50%, -50%)";
      return;
    }
    spotlight.style.display = "block";
    const rect = el.getBoundingClientRect();
    const padding = 12;
    spotlight.style.top = `${rect.top - padding}px`;
    spotlight.style.left = `${rect.left - padding}px`;
    spotlight.style.width = `${rect.width + padding * 2}px`;
    spotlight.style.height = `${rect.height + padding * 2}px`;
    this._positionCardNear(rect, card);
    if (rect.bottom < 0 || rect.top > window.innerHeight || rect.top < 80) {
      el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }
  }

  _positionCardNear(targetRect, card) {
    card.style.transform = "none";
    const cr = card.getBoundingClientRect();
    let top = targetRect.bottom + 18;
    let left = targetRect.left;
    if (top + cr.height > window.innerHeight - 16) {
      top = Math.max(16, targetRect.top - cr.height - 18);
    }
    if (left + cr.width > window.innerWidth - 16) {
      left = window.innerWidth - cr.width - 16;
    }
    if (left < 16) left = 16;
    card.style.top = `${top}px`;
    card.style.left = `${left}px`;
  }

  /**
   * @param {boolean} [silent]
   * @returns {Promise<void>}
   */
  async _runVerify(silent = false) {
    const step = this._currentStep();
    const st = document.getElementById("mirestModObState");
    if (!this.ctx) return;
    const guiaSolo = this.ctx.guiaSinTenant === true;
    const fn = step?.verifyId ? getVerifyHandler(step.verifyId) : null;
    let ok = false;
    if (guiaSolo) {
      ok = true;
    } else if (fn) {
      try {
        ok = Boolean(await fn(this.ctx));
      } catch (e) {
        console.warn("[mirest-mod-onb]", e);
        ok = false;
      }
    } else {
      ok = true;
    }
    this._lastOk = ok;
    if (st) {
      st.textContent = guiaSolo
        ? "Modo guía sin tenant continúa cuando vincules local las comprobaciones volverán"
        : ok
        ? "Paso listo puedes avanzar"
        : "Falta dato en sistema guarda y vuelve a verificar";
      st.style.color = ok ? "var(--color-success, #16a34a)" : "var(--color-text-muted)";
    }
    const nextBtn = document.getElementById("mirestModObNext");
    if (nextBtn) {
      nextBtn.disabled = !ok;
      nextBtn.style.opacity = ok ? "1" : "0.5";
    }
    if (!silent && !ok) {
      this._scheduleSpotlight();
    }
  }

  async _showStep() {
    const step = this._currentStep();
    if (!step) {
      this.finish(true);
      return;
    }
    const title = document.getElementById("mirestModObTitle");
    const desc = document.getElementById("mirestModObDesc");
    const act = document.getElementById("mirestModObAction");
    const when = document.getElementById("mirestModObWhen");
    const prog = document.getElementById("mirestModObProg");
    if (title) title.textContent = `Paso ${step.paso} — ${step.titulo}`;
    if (desc) desc.textContent = step.descripcion || "";
    if (act) act.textContent = step.accion ? `Acción ${step.accion}` : "";
    if (when) when.textContent = step.completado_cuando || "—";
    if (prog) {
      prog.textContent = `Paso ${this.currentIndex + 1} de ${this.def.steps.length}`;
    }
    const nextBtn2 = document.getElementById("mirestModObNext");
    if (nextBtn2) {
      nextBtn2.textContent =
        this.currentIndex < this.def.steps.length - 1 ? "Siguiente" : "Listo";
    }
    this._lastOk = false;
    await this._runVerify(true);
    this._scheduleSpotlight();
    const sel0 = (step?.element && String(step.element).trim()) || "body";
    const el0 = document.querySelector(sel0.split(",")[0].trim());
    if (el0 && el0.offsetParent !== null) {
      requestAnimationFrame(() => {
        el0.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        window.setTimeout(() => this._scheduleSpotlight(), 320);
      });
    }
  }

  async _next() {
    await this._runVerify();
    if (!this._lastOk) return;
    this.currentIndex += 1;
    if (this.currentIndex >= this.def.steps.length) {
      this.finish(true);
      return;
    }
    await this._showStep();
  }

  finish(completed) {
    if (this._poll) {
      clearInterval(this._poll);
      this._poll = null;
    }
    if (this.overlay) {
      this.overlay.classList.remove("open");
      setTimeout(() => {
        this.overlay?.remove();
        this.overlay = null;
      }, 250);
    }
    if (completed) {
      try {
        localStorage.setItem(this.def.storageKey, "1");
      } catch {
        /* */
      }
    }
  }
}

/**
 * Inicia el tour de un módulo (desde un botón en la página o consola).
 * @param {string} moduleKey
 * @param {{ force?: boolean }} [opts]
 */
export function startMirestModuleOnboarding(moduleKey, opts) {
  const r = new MirestModuleOnboardingRunner(moduleKey, opts);
  r.start();
  return r;
}

/**
 * @returns {string[]} claves de módulos
 */
export function getModuleOnboardingKeys() {
  return Object.keys(MIREST_MODULE_ONBOARDING);
}
