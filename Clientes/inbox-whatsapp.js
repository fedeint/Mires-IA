/**
 * Inbox: contactos reales (misma base que Clientes). Sin historial de chat inventado.
 */
import { fetchCrmClientRows } from "../scripts/crm-clients.js";

const NO_HISTORY = {
  text: "Sin historial de WhatsApp en DallA. Conecta WhatsApp Business para mensajes reales.",
  time: "—",
  type: "received",
  status: "",
};

function buildInboxFromClients(clients) {
  return (clients || []).map((c) => {
    const isProv = (c.tipo || "").toLowerCase() === "proveedor";
    const color = isProv
      ? "#10b981"
      : "linear-gradient(135deg, #fb923c, #f97316)";
    return {
      ...c,
      nombre: c.nombre,
      telefono: c.telefono || "—",
      tipo: isProv ? "proveedor" : "cliente",
      color,
      isOnline: false,
      isBot: false,
      unread: 0,
      ltv: c.ltv || 0,
      pedidos: c.pedidos || 0,
      ticketPromedio: c.ticketPromedio || 0,
      ultimaVisita: c.ultimaVisita || "—",
      fav: (c.comportamiento?.platos && c.comportamiento.platos[0]) || "—",
      statusText: c.tipo || "—",
      deuda: 0,
      creditDias: "—",
      proxVencimiento: "—",
      tiempoEntrega: "—",
      mensajes: [NO_HISTORY],
    };
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const res = await fetchCrmClientRows();
  const inboxData = buildInboxFromClients(res.clients || []);
  if (res.message && (!res.clients || res.clients.length === 0) && res.notAuthenticated !== true) {
    const wrap = document.getElementById("chatListContainer")?.parentElement;
    if (wrap) {
      const note = document.createElement("p");
      note.className = "workspace-note";
      note.style.cssText = "margin:0 0 1rem 0;grid-column:1/-1";
      note.textContent = res.message + (res.onboardingStep != null ? ` (Onboarding: paso ${res.onboardingStep})` : "");
      wrap.insertBefore(note, wrap.firstChild);
    }
  }

  const chatListContainer = document.getElementById("chatListContainer");
  const chatHeader = document.getElementById("chatHeader");
  const chatMessages = document.getElementById("chatMessages");
  const chatContextPanel = document.getElementById("chatContextPanel");
  const filterPills = document.querySelectorAll(".inbox-pill");
  const searchInput = document.getElementById("chatSearchInput");

  let activeFilter = "todos";
  /** @type {string | null} */
  let activeChatId = null;

  function renderList() {
    if (!chatListContainer) return;
    if (inboxData.length === 0) {
      chatListContainer.innerHTML = `<p class="workspace-note" style="padding:1rem">${
        res.notAuthenticated ? "Inicia sesión para ver contactos." : res.message || "Sin contactos aún."
      }</p>`;
      return;
    }
    const term = (searchInput && searchInput.value) ? searchInput.value.toLowerCase() : "";
    const filtered = inboxData.filter((c) => {
      const matchFilter = activeFilter === "todos" || c.tipo === activeFilter;
      const lastMsg = c.mensajes && c.mensajes.length ? c.mensajes[c.mensajes.length - 1].text : "";
      const matchSearch =
        c.nombre.toLowerCase().includes(term) || lastMsg.toLowerCase().includes(term) || (c.email || "").toLowerCase().includes(term);
      return matchFilter && matchSearch;
    });

    chatListContainer.innerHTML = filtered
      .map((c) => {
        const lastMsg = c.mensajes && c.mensajes.length ? c.mensajes[c.mensajes.length - 1] : NO_HISTORY;
        const badgeHTML =
          c.tipo === "proveedor" ? '<span class="badge-prov">Proveedor</span>' : c.isBot
            ? '<span class="badge-bot"><i class="fa-solid fa-robot"></i> Bot</span>'
            : "";
        const unreadHTML = c.unread > 0 ? `<div class="badge-unread">${c.unread}</div>` : "";

        return `
            <div class="chat-item ${String(c.id) === String(activeChatId) ? "active" : ""}" data-id="${c.id}">
                <div class="chat-avatar" style="background: ${c.color}; color:white;">
                    ${c.avatar}
                    ${c.isOnline ? '<span class="online-dot"></span>' : ""}
                </div>
                <div class="chat-info">
                    <div class="chat-name-row">
                        <span class="chat-name">${c.nombre} ${badgeHTML}</span>
                        <span class="chat-time">${lastMsg.time}</span>
                    </div>
                    <div class="chat-preview-row">
                        <span class="chat-preview">${lastMsg.text}</span>
                        ${unreadHTML}
                    </div>
                </div>
            </div>`;
      })
      .join("");
  }

  function renderActiveChat() {
    if (!chatHeader || !chatMessages || !chatContextPanel) return;
    const c = inboxData.find((x) => String(x.id) === String(activeChatId));
    const inputContainer = document.querySelector(".chat-input-container");

    if (!c) {
      chatHeader.innerHTML = "";
      chatMessages.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#94a3b8; text-align:center;">
                    <i class="fa-regular fa-comments" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="font-size: 16px; font-weight: 500;">Selecciona una conversación para empezar</p>
                </div>`;
      if (inputContainer) inputContainer.style.display = "none";
      chatContextPanel.innerHTML = `
                <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; color:#94a3b8; text-align:center;">
                    <i class="fa-solid fa-address-card" style="font-size: 48px; margin-bottom: 16px; opacity: 0.5;"></i>
                    <p style="font-size: 14px; font-weight: 500;">Perfil del contacto</p>
                </div>`;
      return;
    }
    if (inputContainer) inputContainer.style.display = "flex";

    chatHeader.innerHTML = `
            <div class="chat-header-info">
                <div class="chat-avatar" style="background: ${c.color}; color:white;">${c.avatar}</div>
                <div class="chat-header-text">
                    <h3>${c.nombre} <i class="fa-brands fa-whatsapp" style="color:#25d366;"></i></h3>
                    <p>${c.telefono} · ${c.isOnline ? '<span style="color:#16a34a; font-weight:600;">En línea</span>' : "Desconectado"}</p>
                </div>
            </div>
            <button class="btn-secondary" id="btnOpenProfile" type="button" style="padding: 8px 16px; font-size:13px; border-radius:8px;">Ver perfil 360°</button>
        `;

    const btnP = document.getElementById("btnOpenProfile");
    if (btnP) btnP.addEventListener("click", () => {
      if (typeof window.openProfileView === "function") window.openProfileView(c);
    });

    chatMessages.innerHTML = c.mensajes
      .map((m) => {
        const checkIcon =
          m.type === "sent" ? (m.status === "read" ? '<i class="fa-solid fa-check-double read"></i>' : '<i class="fa-solid fa-check-double"></i>') : "";
        return `
            <div class="msg-wrapper ${m.type}">
                <div class="msg-bubble">${m.text}</div>
                <div class="msg-meta">${m.time} ${checkIcon}</div>
            </div>`;
      })
      .join("");
    chatMessages.scrollTop = chatMessages.scrollHeight;

    if (c.tipo === "cliente") {
      chatContextPanel.innerHTML = `
                <div class="context-card">
                    <div class="context-avatar" style="background: ${c.color};">${c.avatar}</div>
                    <h3>${c.nombre}</h3>
                    <span class="badge ${(c.statusText || "").toUpperCase().includes("VIP") ? "vip" : "habitual"}">${c.statusText}</span>
                </div>
                <div class="context-kpi-block kpi-client"><span>Lifetime Value</span><strong>S/ ${c.ltv.toLocaleString("en-US", { minimumFractionDigits: 2 })}</strong><p>${c.pedidos} pedidos históricos</p></div>
                <ul class="context-info-list">
                    <li><span>Ticket Promedio</span><strong>S/ ${(c.ticketPromedio || 0).toFixed(2)}</strong></li>
                    <li><span>Última actividad</span><strong>${c.ultimaVisita}</strong></li>
                    <li><span>Favorito / plato</span><strong>${c.fav}</strong></li>
                </ul>
                <div class="context-actions"><button type="button" class="btn-orange-gradient" style="justify-content:center;"><i class="fa-solid fa-plus"></i> Crear Pedido</button><button type="button" class="btn-secondary" style="justify-content:center;"><i class="fa-regular fa-note-sticky"></i> Agregar Nota</button></div>
            `;
    } else {
      chatContextPanel.innerHTML = `
                <div class="context-card">
                    <div class="context-avatar" style="background: ${c.color};"><i class="fa-solid fa-truck"></i></div>
                    <h3>${c.nombre}</h3>
                    <span class="badge" style="background:#dcfce7; color:#16a34a;">${c.statusText}</span>
                </div>
                <div class="context-kpi-block kpi-prov" style="background:#fefce8; border:1px solid #fef08a; color:#854d0e;"><span>Saldo B2B</span><strong>N/D (integra contabilidad)</strong><p>—</p></div>
                <ul class="context-info-list">
                    <li><span>Próx. Vencimiento</span><strong style="color:#94a3b8;">—</strong></li>
                    <li><span>LTV (pedidos)</span><strong>S/ ${(c.ltv || 0).toFixed(2)}</strong></li>
                </ul>
                <div class="context-actions"><button type="button" class="btn-orange-gradient" style="justify-content:center;"><i class="fa-solid fa-file-invoice"></i> Orden de Compra</button><button type="button" class="btn-secondary" style="justify-content:center;"><i class="fa-solid fa-money-bill-wave"></i> Registrar Pago</button></div>
            `;
    }
  }

  if (filterPills && searchInput) {
    filterPills.forEach((p) =>
      p.addEventListener("click", (e) => {
        filterPills.forEach((btn) => btn.classList.remove("active"));
        e.currentTarget.classList.add("active");
        activeFilter = e.currentTarget.dataset.filter || "todos";
        renderList();
      })
    );
    searchInput.addEventListener("input", renderList);
  }

  if (chatListContainer) {
    chatListContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".chat-item");
      if (item && item.dataset.id) {
        activeChatId = String(item.dataset.id);
        renderList();
        renderActiveChat();
      }
    });
  }

  renderList();
  renderActiveChat();
});
