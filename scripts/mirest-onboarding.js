/**
 * Onboarding en 3 fases (PRE / PRO / POST) — solo aplica a perfil **admin** en el producto.
 * El progreso se persiste en `user.user_metadata.mirest_onboarding` (por usuario).
 */

import { getRoleLabel } from "./navigation.js";
import { supabase } from "./supabase.js";

const STORAGE_KEY = "mirest_onboarding";

const PHASE_DEFS = {
  pre: {
    id: "pre",
    title: "Fase PRE",
    subtitle: "Setup inicial — antes de operar",
    items: [
      { id: "presupuesto", text: "Presupuesto definido" },
      { id: "almacen", text: "Almacén con productos y proveedores" },
      { id: "equipo", text: "Equipo coordinado cocina mozos caja" },
      { id: "celular", text: "Celular listo para pedidos" },
      { id: "horario", text: "Horario de operación listo" },
      { id: "marketing_inicial", text: "Marketing fotos redes menú digital plato del día" },
    ],
  },
  pro: {
    id: "pro",
    title: "Fase PRO",
    subtitle: "Día 01 — primera operación real",
    items: [
      { id: "caja_a", text: "Primera sesión de caja abierta" },
      { id: "pedido1", text: "Primer pedido tomado" },
      { id: "cocina_items", text: "Cocina recibiendo ítems" },
      { id: "stock_auto", text: "Stock bajando solo con ventas" },
    ],
  },
  post: {
    id: "post",
    title: "Fase POST",
    subtitle: "Análisis y mejora continua",
    items: [
      { id: "reporte1", text: "Primer reporte generado" },
      { id: "meta_diaria", text: "Meta diaria configurada" },
      { id: "dallia", text: "DallA activa con datos reales" },
      { id: "objetivos", text: "Objetivos claros ahorro ventas sede innovación" },
    ],
  },
};

function emptyState() {
  return {
    pre: { items: {} },
    pro: { items: {} },
    post: { items: {} },
    updatedAt: null,
  };
}

/**
 * @param {Record<string, unknown> | null | undefined} user
 */
export function getMirestOnboardingFromUser(user) {
  const raw = user?.user_metadata && user.user_metadata[STORAGE_KEY];
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return mergeState(/** @type {Record<string, any>} */ (raw));
  }
  return emptyState();
}

function mergeState(raw) {
  const st = emptyState();
  for (const pid of Object.keys(PHASE_DEFS)) {
    const phase = PHASE_DEFS[/** @type {'pre'|'pro'|'post'} */ (pid)];
    const incoming = raw[pid]?.items && typeof raw[pid].items === "object" ? raw[pid].items : {};
    const out = { ...st[pid], items: {} };
    for (const item of phase.items) {
      out.items[item.id] = Boolean(incoming[item.id]);
    }
    st[pid] = out;
  }
  st.updatedAt = typeof raw.updatedAt === "string" ? raw.updatedAt : st.updatedAt;
  return st;
}

function countPhase(phase) {
  const items = Object.values(phase?.items || {});
  const total = items.length;
  const done = items.filter(Boolean).length;
  return { done, total };
}

function countAll(state) {
  let done = 0;
  let total = 0;
  for (const k of Object.keys(PHASE_DEFS)) {
    const c = countPhase(state[k]);
    done += c.done;
    total += c.total;
  }
  return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

/**
 * @param {string} phaseId
 * @param {string} itemId
 * @param {import('@supabase/supabase-js').SupabaseClient} client
 */
export async function setMirestOnboardingItem(phaseId, itemId, client = supabase) {
  const { data, error: sessionErr } = await client.auth.getUser();
  if (sessionErr) throw sessionErr;
  const user = data?.user;
  if (!user) throw new Error("No hay sesión autenticada");

  if (!PHASE_DEFS[phaseId]) {
    throw new Error("Fase de onboarding desconocida");
  }
  if (!PHASE_DEFS[phaseId].items.some((i) => i.id === itemId)) {
    throw new Error("Tarea de onboarding desconocida");
  }

  const st = getMirestOnboardingFromUser(user);
  const current = Boolean(st[phaseId]?.items?.[itemId]);
  const nextItems = { ...st[phaseId].items, [itemId]: !current };
  const next = {
    ...st,
    [phaseId]: { items: nextItems },
    updatedAt: new Date().toISOString(),
  };

  const prev = user.user_metadata && typeof user.user_metadata === "object" ? { ...user.user_metadata } : {};
  const { error: updateErr } = await client.auth.updateUser({
    data: { ...prev, [STORAGE_KEY]: next },
  });
  if (updateErr) throw updateErr;
  return next;
}

/**
 * Panel de checklist solo para **Administrador** (onboarding por local).
 * @param {HTMLElement | null} host
 * @param {Record<string, unknown> | null} user
 * @param {{ role: string, isDemo?: boolean }} profile
 */
export function renderAdminOnboardingPanel(host, user, profile) {
  if (!host) return;
  host.innerHTML = "";
  host.classList.add("onboarding-rail", "onboarding-rail--empty");
  if (!profile || profile.isDemo || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return;
  }

  const st = getMirestOnboardingFromUser(user);
  const { done, total, pct } = countAll(st);

  host.classList.remove("onboarding-rail--empty");
  const meta = (user && user.user_metadata) || {};
  const name =
    (typeof meta.full_name === "string" && meta.full_name.trim()) ||
    (typeof meta.name === "string" && meta.name.trim()) ||
    (typeof user?.email === "string" && user.email.split("@")[0]) ||
    "Administrador";

  host.innerHTML = `
    <div class="info-panel card onboarding-3f" id="mirestOnboarding3F">
      <div class="panel-heading">
        <div>
          <span class="eyebrow">Onboarding del negocio</span>
          <h3>Plan en 3 fases</h3>
          <p class="onboarding-3f__lede" style="margin:0.35rem 0 0;font-size:14px;color:var(--color-text-muted);line-height:1.45">
            Progreso en <strong>tu usuario</strong> (${name} · ${getRoleLabel(profile.role)})
            Ajustes de módulos por persona en <strong>Accesos</strong>
            DallA respeta solo los módulos asignados a cada perfil
          </p>
        </div>
        <span class="chip chip--accent" id="mirestOnbSummary">${done}/${total} completado ${pct}%</span>
      </div>
      <div class="onboarding-3f__phases" role="list">
        ${(
          Object.keys(PHASE_DEFS)
        )
        .map((id) => renderPhase(st, id))
        .join("")}
      </div>
      <div class="onboarding-post-insights card" style="margin-top:1rem;padding:1rem 1.1rem;border:1px solid var(--color-border);border-radius:12px;background:var(--color-surface-muted)">
        <span class="eyebrow">Fase POST · Insights</span>
        <p style="margin:0.4rem 0 0.6rem;font-size:13px;color:var(--color-text-muted);line-height:1.45">
          Las automatizaciones de mercado y captación van <strong>antes o después</strong> del turno no durante el servicio pico
        </p>
        <ul style="margin:0;padding-left:1.1rem;font-size:13px;line-height:1.5;color:var(--color-text)">
          <li style="margin-bottom:0.35rem"><strong>Evento 1 · General</strong> — Saca el pulso del día en <strong>Inicio</strong> y <strong>Reportes</strong> con datos ya cerrados en caja y pedidos</li>
          <li><strong>Evento 2 · Mañana</strong> — Desde <strong>Clientes</strong> y campañas define objetivos de demanda y adquisición para la siguiente apertura sin mezclarlo con la operación en vivo</li>
        </ul>
      </div>
    </div>
  `;

  host
    .querySelectorAll("input.onboarding-3f__ck")
    .forEach((input) => {
      input.addEventListener("change", async () => {
        const el = /** @type {HTMLInputElement} */ (input);
        const { phase, item } = el.dataset;
        if (!phase || !item) return;
        const row = el.closest("label");
        if (row) {
          el.disabled = true;
          row.classList.add("onboarding-3f__row--saving");
        }
        try {
          const next = await setMirestOnboardingItem(phase, item, supabase);
          const row = el.closest("label");
          if (row) {
            row.classList.toggle("onboarding-3f__row--on", el.checked);
          }
          applyOnboardingToSummary(host, next);
          if (window.lucide) window.lucide.createIcons();
        } catch (e) {
          console.error("[mirest-onboarding]", e);
          el.checked = !el.checked;
          if (e?.message) window.alert(e.message);
        } finally {
          if (el) {
            el.disabled = false;
            if (row) {
              row.classList.remove("onboarding-3f__row--saving");
            }
          }
        }
      });
    });

  if (window.lucide) {
    try {
      window.lucide.createIcons();
    } catch (_) { /* */ }
  }
}

function applyOnboardingToSummary(host, state) {
  const sum = host.querySelector("#mirestOnbSummary");
  if (!sum) return;
  const c = countAll(state);
  sum.textContent = `${c.done}/${c.total} completado — ${c.pct}%`;
}

function renderPhase(state, phaseId) {
  const def = PHASE_DEFS[phaseId];
  const s = state[phaseId] || { items: {} };
  return `
    <div class="onboarding-3f__phase" role="listitem">
      <div class="onboarding-3f__phase-top">
        <h4 class="onboarding-3f__h">${def.title} <span class="onboarding-3f__h-sub">${def.subtitle}</span></h4>
      </div>
      <ul class="onboarding-3f__ul">
        ${def.items
          .map(
            (it) => {
              const on = Boolean(s.items[it.id]);
              return `
            <li>
              <label class="onboarding-3f__row ${on ? "onboarding-3f__row--on" : ""}" data-ob-row="${it.id}">
                <input
                  class="onboarding-3f__ck"
                  type="checkbox"
                  data-phase="${phaseId}"
                  data-item="${it.id}"
                  ${on ? "checked" : ""}
                />
                <span class="onboarding-3f__text">${it.text}</span>
              </label>
            </li>
          `;
            },
          )
          .join("")}
      </ul>
    </div>
  `;
}
