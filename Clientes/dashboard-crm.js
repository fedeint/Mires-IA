/**
 * CRM dashboard: LTV y top clientes desde Supabase. Embudo: sin datos sintéticos.
 */
import { fetchCrmClientRows } from "../scripts/crm-clients.js";

document.addEventListener("DOMContentLoaded", async () => {
  const funnelArea = document.getElementById("funnelRenderArea");
  if (funnelArea) {
    funnelArea.innerHTML = `
            <p class="workspace-note" style="grid-column:1/-1;margin:0 0 1rem 0">
                No hay integración de campañas/embudo en este entorno. Conecta envíos o CRM de campañas para ver el embudo.
            </p>
            <div class="funnel-step">
                <div class="funnel-label">
                    <span>Enviados</span>
                    <span>0 (0%)</span>
                </div>
                <div class="funnel-bar-bg">
                    <div class="funnel-bar-fill bg-f1" style="width:0%;"></div>
                </div>
            </div>`;
  }

  const res = await fetchCrmClientRows();
  const all = res.clients || [];
  const listMsg = res.message;
  const step = res.onboardingStep;
  if (all.length === 0 && listMsg) {
    const t = document.getElementById("topClientsTable");
    if (t) {
      t.parentElement?.insertAdjacentHTML(
        "beforebegin",
        `<p class="workspace-note" style="margin:0.75rem 0">${
          listMsg
        }${step != null ? ` (Onboarding: paso ${step})` : ""}</p>`
      );
    }
  }

  let topClients = all.filter((c) => (c.tipo || "").toLowerCase() !== "proveedor");
  topClients.sort((a, b) => (b.ltv || 0) - (a.ltv || 0));
  const top10 = topClients.slice(0, 10);

  const tableBody = document.getElementById("topClientsTable");
  if (tableBody) {
    if (top10.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="text-center" style="padding:1.5rem">${
        res.notAuthenticated
          ? "Inicia sesión."
          : listMsg || "Sin clientes aún. Los datos salen de Contactos y pedidos con customer_id."
      }</td></tr>`;
    } else {
      tableBody.innerHTML = top10
        .map((c, index) => {
          const rankClass = index < 3 ? `rank-${index + 1}` : "";
          const tipo = c.tipo || "—";
          const badgeClass =
            String(tipo).toLowerCase().includes("vip") || tipo === "VIP" ? "vip" : "habitual";
          return `
            <tr class="client-row-clickable" data-client-id="${c.id}" style="cursor:pointer">
                <td><div class="rank-number ${rankClass}">${index + 1}</div></td>
                <td><strong style="color:#0f172a; font-size:14px; display:block;">${
                  c.nombre
                }</strong><span style="color:#64748b; font-size:12px;">${c.email || "—"}</span></td>
                <td><strong style="color:#ea580c; font-size:15px;">S/ ${(c.ltv || 0).toLocaleString(
                  "en-US",
                  { minimumFractionDigits: 2 }
                )}</strong></td>
                <td><span style="color:#334155; font-size:14px; font-weight:500;">${
                  c.pedidos
                } pedidos</span></td>
                <td><span class="status-badge ${badgeClass}">${tipo}</span></td>
            </tr>`;
        })
        .join("");
    }
  }

  const clientsById = new Map(all.map((c) => [String(c.id), c]));
  document.querySelectorAll(".client-row-clickable[data-client-id]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-client-id");
      const c = clientsById.get(String(id));
      if (c && typeof window.openProfileView === "function") window.openProfileView(c);
    });
  });
});
