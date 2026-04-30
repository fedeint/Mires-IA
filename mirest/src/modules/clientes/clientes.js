/**
 * Clientes — CRM: datos reales (Supabase). Ver `scripts/crm-clients.js`.
 */
import { fetchCrmClientRows } from "../scripts/crm-clients.js";

document.addEventListener("DOMContentLoaded", async () => {
  const kpiContainer = document.getElementById("kpi-container");
  const tableBody = document.getElementById("crm-table-body");
  const gridContainer = document.getElementById("crm-grid-container");
  const btnViewList = document.getElementById("btnViewList");
  const btnViewGrid = document.getElementById("btnViewGrid");
  const viewList = document.getElementById("view-list");
  const viewGrid = document.getElementById("view-grid");
  const searchInput = document.getElementById("crmSearch");
  const filterBtns = document.querySelectorAll(".crm-filter-btn");

  let allClients = [];
  let listMessage = null;
  let listOnboardingStep = null;
  let currentFilter = "Todos";
  let searchTerm = "";

  const getBadgeClass = (badge) => {
    if (!badge) return "";
    const b = String(badge).toLowerCase();
    if (b.includes("vip") || b.includes("fieles") || b.includes("alto valor")) return "vip";
    if (b.includes("habitual") || b.includes("regular") || b.includes("frecuente")) return "habitual";
    if (b.includes("nuevo")) return "nuevo";
    if (b.includes("proveedor")) return "nuevo";
    return "habitual";
  };

  const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1);

  function renderKPIs(clients) {
    const total = clients.length;
    const ltvTotal = clients.reduce((acc, c) => acc + (c.ltv || 0), 0);
    const ltvPromedio = total > 0 ? ltvTotal / total : 0;
    const suscritos = clients.filter((c) => c.suscrito).length;
    const ms = monthStart();
    const nuevos = clients.filter((c) => c.creadoEn && new Date(c.creadoEn) >= ms).length;

    const kpis = [
      { label: "Total de Clientes", value: String(total), icon: "fa-users", highlight: false },
      { label: "LTV Promedio", value: `S/ ${ltvPromedio.toFixed(2)}`, icon: "fa-sack-dollar", highlight: true },
      { label: "Suscritos a Campañas", value: String(suscritos), icon: "fa-bullhorn", highlight: false },
      { label: "Nuevos este mes", value: String(nuevos), icon: "fa-chart-line", highlight: false },
    ];

    if (kpiContainer) {
      const hint =
        allClients.length === 0 && listMessage
          ? `<p class="workspace-note" style="grid-column:1/-1;margin:0 0 12px 0">${listMessage}${
              listOnboardingStep != null ? ` <strong>(Onboarding: paso ${listOnboardingStep})</strong>` : ""
            }</p>`
          : "";
      kpiContainer.innerHTML =
        hint +
        kpis
          .map(
            (kpi) => `
        <div class="crm-kpi-card">
            <div class="kpi-icon ${kpi.highlight ? "highlight" : ""}">
                <i class="fa-solid ${kpi.icon}"></i>
            </div>
            <div class="kpi-data">
                <span class="kpi-label">${kpi.label}</span>
                <span class="kpi-value">${kpi.value}</span>
            </div>
        </div>
      `
          )
          .join("");
    }
  }

  function renderViews(clients) {
    if (allClients.length === 0) {
      const empty = `<tr><td colspan="5" class="text-center" style="padding:2rem">${listMessage || "Sin datos aún."}${
        listOnboardingStep != null ? ` (paso de onboarding: ${listOnboardingStep})` : ""
      }</td></tr>`;
      if (tableBody) tableBody.innerHTML = empty;
      if (gridContainer)
        gridContainer.innerHTML = `<div class="crm-card" style="max-width:40rem;margin:0 auto;cursor:default"><p class="client-name">Sin clientes aún</p><p class="client-email" style="white-space:normal;line-height:1.5">${listMessage || "—"}</p></div>`;
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }

    if (tableBody) {
      tableBody.innerHTML = clients
        .map((c) => {
          const badges = [c.tipo, c.arquetipo].filter((b) => b && b !== "—");
          return `
                <tr data-id="${c.id}" style="cursor: pointer;" title="Ver perfil de ${c.nombre}">
                    <td>
                        <div class="td-client">
                            <div class="avatar-circle">${c.avatar || c.nombre.substring(0, 2).toUpperCase()}</div>
                            <div>
                                <span class="client-name">${c.nombre}</span>
                                <span class="client-email">${c.email || ""}</span>
                            </div>
                        </div>
                    </td>
                    <td>
                        <span class="act-date">${c.ultimaVisita || "-"}</span>
                        <span class="act-phone">${c.telefono || "-"}</span>
                    </td>
                    <td>
                        <span class="order-count">${c.pedidos || 0}</span>
                        <span class="order-ticket">Promedio: S/ ${(c.ticketPromedio || 0).toFixed(2)}</span>
                    </td>
                    <td>
                        <span class="ltv-value">S/ ${(c.ltv || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </td>
                    <td>
                        <div class="badges-container">
                            ${badges.map((b) => `<span class="badge ${getBadgeClass(b)}">${b}</span>`).join("")}
                        </div>
                    </td>
                </tr>`;
        })
        .join("");
    }

    if (gridContainer) {
      gridContainer.innerHTML = clients
        .map((c) => {
          const badges = [c.tipo, c.arquetipo].filter((b) => b && b !== "—");
          return `
                <div class="crm-card" data-id="${c.id}" style="cursor: pointer;" title="Ver perfil de ${c.nombre}">
                    <div class="avatar-circle">${c.avatar || c.nombre.substring(0, 2).toUpperCase()}</div>
                    <span class="client-name">${c.nombre}</span>
                    <span class="client-email">${c.email || ""}</span>
                    <div class="crm-card-stats">
                        <div class="stat-box">
                            <span class="stat-box-label">LTV</span>
                            <span class="stat-box-value">S/ ${(c.ltv || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div class="stat-box">
                            <span class="stat-box-label">Pedidos</span>
                            <span class="stat-box-value">${c.pedidos || 0}</span>
                        </div>
                    </div>
                    <div class="badges-container">
                        ${badges.map((b) => `<span class="badge ${getBadgeClass(b)}">${b}</span>`).join("")}
                    </div>
                </div>`;
        })
        .join("");
    }
    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  function switchView(viewType) {
    if (!viewList || !viewGrid) return;
    if (viewType === "list") {
      viewList.style.display = "block";
      viewGrid.style.display = "none";
      btnViewList?.classList.add("active");
      btnViewGrid?.classList.remove("active");
    } else {
      viewList.style.display = "none";
      viewGrid.style.display = "block";
      btnViewGrid?.classList.add("active");
      btnViewList?.classList.remove("active");
    }
  }

  btnViewList?.addEventListener("click", () => switchView("list"));
  btnViewGrid?.addEventListener("click", () => switchView("grid"));

  function syncCrmEmptyLayout() {
    document
      .querySelector(".crm-database-container")
      ?.classList.toggle("crm-database-container--empty", allClients.length === 0);
  }

  function applyFilters() {
    const term = searchTerm.toLowerCase();
    const filtered = allClients.filter((c) => {
      const matchesSearch =
        c.nombre.toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term) || (c.telefono || "").includes(term);

      let matchesFilter = true;
      if (currentFilter === "Clientes") {
        matchesFilter = (c.tipo || "").toLowerCase() !== "proveedor";
      } else if (currentFilter === "Proveedores") {
        matchesFilter = (c.tipo || "").toLowerCase() === "proveedor";
      } else if (currentFilter === "Fieles") {
        matchesFilter = (c.tipo || "").toLowerCase() === "vip" || c.suscrito;
      }
      return matchesSearch && matchesFilter;
    });
    renderViews(filtered);
    renderKPIs(filtered);
    syncCrmEmptyLayout();
  }

  searchInput?.addEventListener("input", (e) => {
    searchTerm = e.target.value;
    applyFilters();
  });

  filterBtns.forEach((btn) => {
    btn.addEventListener("click", (e) => {
      filterBtns.forEach((b) => b.classList.remove("active"));
      (e.currentTarget || e.target).classList.add("active");
      currentFilter = (e.currentTarget || e.target).textContent.trim();
      applyFilters();
    });
  });

  document.addEventListener("click", (e) => {
    if (e.target.closest(".btn-card-action, .btn-icon")) return;
    const target = e.target.closest(".crm-card[data-id], .crm-table tbody tr[data-id]");
    if (target?.dataset.id) {
      const client = allClients.find((c) => String(c.id) === String(target.dataset.id));
      if (client && typeof window.openProfileView === "function") {
        window.openProfileView(client);
      }
    }
  });

  const res = await fetchCrmClientRows();
  if (res.notAuthenticated) {
    listMessage = "Inicia sesión para ver clientes de tu restaurante.";
  } else if (res.message && (!res.clients || res.clients.length === 0)) {
    listMessage = res.message;
    listOnboardingStep = res.onboardingStep;
  }
  allClients = res.clients || [];
  applyFilters();
  if (typeof lucide !== "undefined") lucide.createIcons();
});
