/**
 * Lead scoring: datos desde `fetchCrmClientRows`. RFM derivado o desde metadata;
 * riesgo heurístico (sin inventar historial de compras no reflejado en pedidos).
 */
import { fetchCrmClientRows } from "../scripts/crm-clients.js";

const MAXR = 30;
const MAXF = 30;
const MAXM = 40;

function rfmHeuristic(c) {
  const m = c.rfm;
  if (m && typeof m.recencia === "object" && m.recencia != null && "v" in m.recencia) {
    return {
      recencia: m.recencia,
      frecuencia: m.frecuencia,
      monetario: m.monetario,
      engagement: Number(m.engagement ?? c.score) || 0,
    };
  }
  const uv = c.ultimaVisita || "";
  let rPts = 5;
  if (uv === "hoy" || uv === "ayer") rPts = 30;
  else {
    const mday = String(uv).match(/(\d+)\s*d/);
    if (mday) rPts = Math.max(0, 30 - Math.min(30, parseInt(mday[1], 10)));
  }
  const fPts = Math.min(MAXF, (c.pedidos || 0) * 3);
  const mPts = Math.min(MAXM, Math.round((c.ltv || 0) / 1500 * MAXM));
  return {
    recencia: { v: rPts, max: MAXR, text: c.ultimaVisita || "—" },
    frecuencia: { v: fPts, max: MAXF, text: `${c.pedidos || 0} pedidos (served/closed)` },
    monetario: { v: mPts, max: MAXM, text: `S/ ${(c.ticketPromedio || 0).toFixed(2)} tkt prom` },
    engagement: c.score || 0,
  };
}

function riesgoHeuristic(c) {
  const s = c.score || 0;
  if (s < 25) return { text: "Riesgo alto: poca actividad monetaria (heurístico)", class: "high" };
  if (s < 55) return { text: "Riesgo medio (heurístico)", class: "medium" };
  return { text: "Riesgo bajo (heurístico)", class: "low" };
}

function buildSecuencias(meta) {
  const raw = meta && Array.isArray(meta.secuencias) ? meta.secuencias : [];
  if (raw.length === 0) {
    return [{ nombre: "Ninguna secuencia guardada", estado: "Añade `secuencias` en metadata (Supabase)", class: "habitual" }];
  }
  return raw.map((s) => ({
    nombre: s.nombre || "—",
    estado: s.estado || "—",
    class: s.class || "habitual",
  }));
}

/**
 * @param {object} c Fila de `fetchCrmClientRows`
 */
function toScoringView(c) {
  const rfm = rfmHeuristic(c);
  const meta = c._metadata && typeof c._metadata === "object" ? c._metadata : {};
  return {
    ...c,
    dni: c.documento || "—",
    rfm,
    riesgo: riesgoHeuristic(c),
    nurturing: {
      tactica: c.nurturing?.tactica || "—",
      paso: c.nurturing?.estado || "—",
      proximaAccion: c.nurturing?.proximaAccion || "—",
    },
    comportamiento: {
      horario: c.comportamiento?.horario || "—",
      dias: c.comportamiento?.dias || "—",
      frecuencia: meta.frecuencia_visitas || "—",
      platos: (c.comportamiento?.platos && c.comportamiento.platos.length)
        ? c.comportamiento.platos
        : ["— (sin platos en metadata)"],
    },
    secuencias: buildSecuencias(meta),
  };
}

document.addEventListener("DOMContentLoaded", async () => {
  const scoringDirectory = document.getElementById("scoringDirectory");
  const detailedProfile = document.getElementById("detailedProfile");
  const btnBack = document.getElementById("btnBackToDirectory");
  const pageTitle = document.getElementById("pageTitle");
  const pageSubtitle = document.getElementById("pageSubtitle");

  if (!scoringDirectory) return;

  const res = await fetchCrmClientRows();
  let scoringList = (res.clients || []).map(toScoringView);
  if (res.message && scoringList.length === 0) {
    scoringDirectory.innerHTML = `<p class="workspace-note" style="padding:1rem;grid-column:1/-1">${res.message}${
      res.onboardingStep != null ? ` (Onboarding: paso ${res.onboardingStep})` : ""
    }</p>`;
  }

  if (res.notAuthenticated && scoringList.length === 0) {
    scoringDirectory.innerHTML = '<p class="workspace-note" style="padding:1rem">Inicia sesión para ver el scoring RFM.</p>';
  }

  const byId = new Map();
  for (const row of scoringList) byId.set(String(row.id), row);

  function renderDirectory() {
    if (scoringList.length === 0) return;
    scoringDirectory.innerHTML = scoringList
      .map(
        (c) => `
            <div class="minimal-card" data-sid="${c.id}" role="button" tabindex="0" style="cursor:pointer">
                <div class="minimal-avatar">${c.avatar}</div>
                <h3 class="minimal-name">${c.nombre}</h3>
                <span class="minimal-id"><i class="fa-regular fa-id-card"></i> ${c.dni}</span>
                <span class="minimal-email"><i class="fa-solid fa-envelope"></i> ${
                  c.email && c.email.length > 18 ? c.email.substring(0, 18) + "..." : c.email || "—"
                }</span>
            </div>
        `
      )
      .join("");

    scoringDirectory.querySelectorAll(".minimal-card[data-sid]").forEach((el) => {
      el.addEventListener("click", () => {
        abrirPerfilAnalitico(String(el.getAttribute("data-sid")));
      });
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrirPerfilAnalitico(String(el.getAttribute("data-sid")));
        }
      });
    });
  }

  function abrirPerfilAnalitico(sid) {
    const c = byId.get(String(sid));
    if (!c) return;

    scoringDirectory.style.display = "none";
    if (detailedProfile) detailedProfile.style.display = "flex";
    if (btnBack) btnBack.style.display = "flex";
    if (pageTitle) pageTitle.textContent = "Perfil de cliente (RFM derivado de pedidos reales)";
    if (pageSubtitle) pageSubtitle.textContent = "Datos: Contactos + pedidos served/closed. Ajusta metadata en Supabase para precisión.";

    const dAvatar = document.getElementById("detAvatar");
    if (dAvatar) dAvatar.textContent = c.avatar;
    const dName = document.getElementById("detName");
    if (dName) dName.textContent = c.nombre;
    const dStatus = document.getElementById("detStatus");
    if (dStatus) dStatus.innerHTML = `<i class="fa-solid fa-star"></i> ${c.tipo || "—"}`;

    const dL = document.getElementById("detLtv");
    if (dL) dL.textContent = `S/ ${(c.ltv || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}`;
    const dP = document.getElementById("detPedidos");
    if (dP) dP.textContent = `${c.pedidos} pedidos`;
    const dT = document.getElementById("detTicket");
    if (dT) dT.textContent = `S/ ${(c.ticketPromedio || 0).toFixed(2)} tkt prom`;

    const sumR = document.getElementById("sumRecencia");
    if (sumR) sumR.textContent = `${Math.min(5, Math.round((c.rfm.recencia.v / c.rfm.recencia.max) * 5))}/5`;
    const sumF = document.getElementById("sumFrecuencia");
    if (sumF) sumF.textContent = `${Math.min(5, Math.round((c.rfm.frecuencia.v / c.rfm.frecuencia.max) * 5))}/5`;
    const sumM = document.getElementById("sumMonetario");
    if (sumM) sumM.textContent = `${Math.min(5, Math.round((c.rfm.monetario.v / c.rfm.monetario.max) * 5))}/5`;

    const dArq = document.getElementById("detArquetipo");
    if (dArq) dArq.textContent = c.arquetipo;
    const dChurn = document.getElementById("detChurn");
    if (dChurn) {
      dChurn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ${c.riesgo.text}`;
      dChurn.className = `churn-risk-badge ${c.riesgo.class}`;
    }
    const dPhone = document.getElementById("detPhone");
    if (dPhone) dPhone.textContent = c.telefono;
    const dEm = document.getElementById("detEmail");
    if (dEm) dEm.textContent = c.email;

    const b1 = document.getElementById("block1-kpis");
    if (b1) {
      b1.innerHTML = `
            <div class="analytics-card">
                <span class="segment-label">Recencia</span>
                <h3>${c.rfm.recencia.v}/${c.rfm.recencia.max} pts</h3>
                <div class="progress-container"><div class="progress-bg"><div class="progress-fill green" style="width: ${
                  (c.rfm.recencia.v / c.rfm.recencia.max) * 100
                }%;"></div></div></div>
                <span class="activity-meta" style="display:block; margin-top:8px;">${c.rfm.recencia.text}</span>
            </div>
            <div class="analytics-card">
                <span class="segment-label">Frecuencia</span>
                <h3>${c.rfm.frecuencia.v}/${c.rfm.frecuencia.max} pts</h3>
                <div class="progress-container"><div class="progress-bg"><div class="progress-fill green" style="width: ${
                  (c.rfm.frecuencia.v / c.rfm.frecuencia.max) * 100
                }%;"></div></div></div>
                <span class="activity-meta" style="display:block; margin-top:8px;">${c.rfm.frecuencia.text}</span>
            </div>
            <div class="analytics-card">
                <span class="segment-label">Valor monetario</span>
                <h3>${c.rfm.monetario.v}/${c.rfm.monetario.max} pts</h3>
                <div class="progress-container"><div class="progress-bg"><div class="progress-fill orange" style="width: ${
                  (c.rfm.monetario.v / c.rfm.monetario.max) * 100
                }%;"></div></div></div>
                <span class="activity-meta" style="display:block; margin-top:8px;">${c.rfm.monetario.text}</span>
            </div>
            <div class="analytics-card">
                <span class="segment-label">Puntaje operativo (LTV+pedidos)</span>
                <h3 style="color: #9333ea;">${c.rfm.engagement}%</h3>
                <div class="progress-container"><div class="progress-bg"><div class="progress-fill" style="background:#9333ea; width: ${Math.min(100, c.rfm.engagement)}%;"></div></div></div>
            </div>
        `;
    }

    const b2f = document.getElementById("block2-nurturing-flow");
    if (b2f) {
      b2f.innerHTML = `
            <h3>Nurturing (metadata)</h3>
            <span style="font-size: 14px; font-weight:600; color: #111827;">Táctica: ${
              c.nurturing.tactica
            } · Estado: ${c.nurturing.paso}</span>
            <div class="flow-step" style="margin-top:0.5rem; opacity:0.9">
                <span>Completar metadata en</span> <code>customers.metadata</code>
            </div>
        `;
    }
    const b2n = document.getElementById("block2-next-action");
    if (b2n) {
      b2n.innerHTML = `
            <h3 style="color: #a16207;">Próxima acción (metadata)</h3>
            <p style="font-size: 15px; font-weight: 600; color: #111827; margin:0;"><i class="fa-brands fa-whatsapp" style="color:#16a34a; font-size:18px;"></i> ${c.nurturing.proximaAccion}</p>
        `;
    }

    const b3s = document.getElementById("block3-sequences");
    if (b3s) {
      b3s.innerHTML = `
            <h3>Secuencias (metadata)</h3>
            <ul class="behavior-list">
                ${c.secuencias.map((s) => `<li><span>${s.nombre}</span> <span class="badge ${s.class}">${s.estado}</span></li>`).join("")}
            </ul>
        `;
    }
    const b3b = document.getElementById("block3-behavior");
    if (b3b) {
      b3b.innerHTML = `
            <h3>Comportamiento (metadata o derivado de pedidos)</h3>
            <ul class="behavior-list">
                <li><span class="segment-label">Horario preferido</span> <span>${c.comportamiento.horario}</span></li>
                <li><span class="segment-label">Días</span> <span>${c.comportamiento.dias}</span></li>
                <li><span class="segment-label">Frecuencia (metadata)</span> <span>${c.comportamiento.frecuencia}</span></li>
            </ul>
            <div style="margin-top: 16px;">
                <span class="segment-label">Platos (metadata)</span>
                <ol style="padding-left: 20px; font-size:14px; color:#111827; font-weight:600; margin-top:8px;">
                    ${c.comportamiento.platos.map((p) => `<li>${p}</li>`).join("")}
                </ol>
            </div>
        `;
    }
  }

  if (btnBack) {
    btnBack.addEventListener("click", () => {
      if (detailedProfile) detailedProfile.style.display = "none";
      btnBack.style.display = "none";
      scoringDirectory.style.display = "grid";
      if (pageTitle) pageTitle.textContent = "Segmentación RFM";
      if (pageSubtitle)
        pageSubtitle.textContent =
          "Clasificación basada en recencia, frecuencia y valor monetario (pedidos reales en DallA).";
    });
  }

  if (scoringList.length) renderDirectory();
  if (typeof window !== "undefined") {
    window.abrirPerfilAnalitico = (id) => abrirPerfilAnalitico(String(id));
  }
});
