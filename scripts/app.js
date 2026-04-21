import {
  APP_META,
  formatCurrentDate,
  getGreeting,
  getModuleByKey,
  getRoleLabel,
  initializeThemeToggle,
  isDemoRole,
  isSuperadminRole,
  renderSidebar,
  resolveUserPermissions,
  resolveUserRole,
  toHref,
} from "./navigation.js";
import { initializeDashboard } from "./dashboard.js";
import { registerServiceWorker, requestWakeLock, enableWakeLockAutoReacquire, vibrate } from "../Pwa/pwa.js";
import { initPwaInstallWidget } from "./pwa-install-widget.js";

import { supabase, getCurrentUser } from "./supabase.js";
import { startSessionIdleTimeout } from "./session-idle-timeout.js";

function resolveLoginHref(rootPath) {
  const p = (rootPath || "").trim();
  if (!p) return "login.html";
  return `${p.replace(/\/+$/, "")}/login.html`;
}

document.addEventListener("DOMContentLoaded", async () => {
  const pageType = document.body.dataset.pageType || "dashboard";
  const activeKey = document.body.dataset.moduleKey || "dashboard";
  const activeItem = getModuleByKey(activeKey);
  const rootPath = (document.body.dataset.rootPath || "").replace(/\/+$/, "");

  const isLoginPage = window.location.pathname.includes("login.html") ||
    window.location.pathname.endsWith("/login");

  let user = null;
  try {
    user = await getCurrentUser();
  } catch (err) {
    console.error("[App] Error al verificar sesión:", err);
  }

  if (!user && !isLoginPage) {
    console.log("[App] Usuario no detectado, redirigiendo a login...");
    window.location.href = rootPath ? `${rootPath}/login.html` : "login.html";
    return;
  }

  const userRole = resolveUserRole(user);
  const userPermissions = resolveUserPermissions(user, userRole);
  const profile = buildUserProfile(user, userRole, userPermissions);

  if (activeKey === "accesos" && !isSuperadminRole(userRole)) {
    window.location.href = rootPath ? `${rootPath}/index.html` : "index.html";
    return;
  }

  window.currentUserRole = userRole;
  window.currentUserPermissions = userPermissions;
  window.currentUserProfile = profile;

  document.body.classList.add("page-ready");
  document.body.dataset.userRole = userRole;

  registerServiceWorker(rootPath).catch(() => null);
  initPwaInstallWidget({ rootPath });
  requestWakeLock();
  enableWakeLockAutoReacquire();
  initializeHapticFeedback();

  startSessionIdleTimeout({
    getLoginHref: () => resolveLoginHref(rootPath),
    signOut: () => supabase.auth.signOut(),
  });

  renderSidebar(document.getElementById("sidebarNav"), activeKey, userRole, userPermissions);
  initializeThemeToggle(document.getElementById("themeToggle"));
  initializeResponsiveSidebar(pageType);
  initializePageTransitions();
  setText("currentYear", String(new Date().getFullYear()));
  initializeIAWidget(rootPath);
  setupLogoutBtn(rootPath);
  applyUserIdentity(profile);

  if (pageType === "dashboard") {
    initializeDashboardPage(profile);
    initializeDashboard(profile);
    return;
  }

  initializeModulePage(activeItem);
});

function buildUserProfile(user, role, permissions) {
  const email = user?.email || "";
  const meta = user?.user_metadata || {};
  const rawAvatar = typeof meta.avatar_url === "string" ? meta.avatar_url.trim() : "";
  const avatarUrl =
    rawAvatar.length > 12 && (rawAvatar.startsWith("data:") || rawAvatar.startsWith("http"))
      ? rawAvatar
      : null;
  const fullName = (meta.full_name || meta.name || "").trim();
  const emailHandle = email.split("@")[0] || "";
  const displayName = fullName || capitalize(emailHandle.replace(/[._-]+/g, " ")) || "Invitado";
  const firstName = displayName.split(/\s+/)[0] || displayName;
  const initials = getInitials(displayName);

  return {
    email,
    fullName: displayName,
    firstName,
    initials,
    avatarUrl,
    role,
    permissions,
    roleLabel: getRoleLabel(role),
    isDemo: isDemoRole(role),
    rawMetadata: meta,
  };
}

function getInitials(name) {
  if (!name) return "MR";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "MR";
}

function applyUserIdentity(profile) {
  const avatar = document.querySelector(".avatar");
  if (avatar) {
    if (profile.avatarUrl) {
      avatar.classList.add("avatar--photo");
      avatar.textContent = "";
      const img = document.createElement("img");
      img.alt = "";
      img.src = profile.avatarUrl;
      img.referrerPolicy = "no-referrer";
      avatar.appendChild(img);
    } else {
      avatar.classList.remove("avatar--photo");
      avatar.replaceChildren();
      avatar.textContent = profile.initials;
    }
    avatar.setAttribute("aria-label", profile.fullName);
    avatar.setAttribute("title", `${profile.fullName} · ${profile.roleLabel}`);
  }

  const chip = document.getElementById("pageContextChip");
  if (chip) {
    chip.textContent = profile.roleLabel;
  }
}

function setupLogoutBtn(rootPath) {
  const loginHref = resolveLoginHref(rootPath);

  const signOutAndGoLogin = async () => {
    await supabase.auth.signOut();
    window.location.href = loginHref;
  };

  const actions = document.querySelector(".topbar__actions");
  if (actions && !document.getElementById("topbarLogoutBtn")) {
    const btn = document.createElement("button");
    btn.id = "topbarLogoutBtn";
    btn.type = "button";
    btn.className = "btn btn--ghost btn--sm topbar-logout-btn";
    btn.setAttribute("aria-label", "Cerrar sesión");
    btn.innerHTML = '<i data-lucide="log-out"></i><span class="topbar-logout-btn__label">Salir</span>';
    btn.addEventListener("click", signOutAndGoLogin);
    actions.insertBefore(btn, actions.firstChild);
    window.lucide?.createIcons?.();
  }

  document.getElementById("sidebarLogoutBtn")?.addEventListener("click", signOutAndGoLogin);

  const avatar = document.querySelector(".avatar");
  if (avatar && !avatar.dataset.logoutBound) {
    avatar.dataset.logoutBound = "1";
    avatar.style.cursor = "pointer";
    avatar.title = "Cerrar sesión";
    avatar.addEventListener("click", signOutAndGoLogin);
  }
}

function initializeDashboardPage(profile) {
  const locationLabel = window.location.hostname || "entorno local";

  setText("pageEyebrow", profile.isDemo ? "Modo demo" : "Panel de operación");
  setText("pageTitle", `${getGreeting()}, ${profile.firstName}`);
  setText(
    "pageSubtitle",
    `${capitalize(formatCurrentDate())} · ${locationLabel} · ${profile.isDemo ? "Vista de demostración" : profile.roleLabel}`,
  );
  setText("pageContextChip", profile.isDemo ? "Cuenta demo" : profile.roleLabel);
}

function initializeModulePage(module) {
  const dashboardHref = toHref("index.html");
  const moduleFolder = module.path.split("/")[0] + "/";

  setText("pageEyebrow", "Módulo");
  setText("pageTitle", module.label);
  setText("pageSubtitle", `${module.description} · Punto de entrada colaborativo.`);
  setText("pageContextChip", module.short);
  setText("pageAvatar", module.short);

  setText("moduleBreadcrumbCurrent", module.label);
  setText("moduleTitle", module.label);
  setText("moduleDescription", module.description);
  setText("moduleOwnerHint", module.owner);
  setText("modulePathLabel", moduleFolder);
  setText("moduleEntryLabel", module.path);
  setText("moduleStatusLabel", "Módulo en construcción");

  setHref("primaryBackLink", dashboardHref);
  setHref("secondaryBackLink", dashboardHref);
  setHref("breadcrumbHome", dashboardHref);

  const checklist = document.getElementById("moduleChecklist");
  if (checklist) {
    checklist.innerHTML = module.handoff.map((item) => `<li>${item}</li>`).join("");
  }
}

function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = value;
}

function setHref(id, value) {
  const element = document.getElementById(id);
  if (element) element.setAttribute("href", value);
}

function capitalize(value) {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function initializeResponsiveSidebar(pageType) {
  const sidebar = document.getElementById("appSidebar");
  const toggle = document.getElementById("sidebarToggle");
  const backdrop = document.getElementById("sidebarBackdrop");

  if (!sidebar || !toggle || !backdrop) return;

  const closeSidebar = () => setSidebarState(false, sidebar, toggle);
  const openSidebar = () => setSidebarState(true, sidebar, toggle);

  closeSidebar();

  toggle.addEventListener("click", () => {
    const shouldOpen = !document.body.classList.contains("sidebar-open");
    if (shouldOpen) {
      openSidebar();
      return;
    }

    closeSidebar();
  });

  backdrop.addEventListener("click", closeSidebar);

  sidebar.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      if (window.innerWidth <= 1180) {
        closeSidebar();
      }
    });
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) {
      closeSidebar();
    }
  });

  window.addEventListener("pageshow", closeSidebar);
}

function setSidebarState(isOpen, sidebar, toggle) {
  document.body.classList.toggle("sidebar-open", isOpen);
  sidebar.classList.toggle("sidebar--open", isOpen);
  toggle.setAttribute("aria-expanded", String(isOpen));
  toggle.setAttribute(
    "aria-label",
    isOpen ? "Cerrar navegación lateral" : "Abrir navegación lateral",
  );
}

function initializePageTransitions() {
  const links = document.querySelectorAll('a[href]');

  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      if (!shouldHandleTransition(event, link)) return;

      event.preventDefault();

      const destination = link.href;
      document.body.classList.remove("sidebar-open");
      document.body.classList.add("page-leaving");

      window.setTimeout(() => {
        window.location.href = destination;
      }, 120);
    });
  });

  window.addEventListener("pageshow", () => {
    document.body.classList.remove("page-leaving");
    document.body.classList.add("page-ready");
  });
}

function shouldHandleTransition(event, link) {
  if (event.defaultPrevented) return false;
  if (event.button !== 0) return false;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return false;
  if (link.target && link.target !== "_self") return false;
  if (link.hasAttribute("download")) return false;

  const href = link.getAttribute("href");
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return false;
  }

  const url = new URL(link.href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.href === window.location.href) return false;

  return true;
}

function initializeIAWidget(rootPath) {
  const topbarActions = document.querySelector(".topbar__actions");
  if (!topbarActions) return;

  const iaRoot = rootPath ? `${rootPath}/IA` : "./IA";
  const imgSrc = `${iaRoot}/DalIA.webp`;
  const imgFallback = `${iaRoot}/DalIA.png`;
  const vidSrc = `${iaRoot}/dallA.webm`;

  // ── Botón topbar: avatar con video de DalIA ────────────────────────────────
  const btn = document.createElement("button");
  btn.className = "icon-button ia-widget-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Abrir asistente IA");
  btn.setAttribute("title", "DallIA · Asistente IA");
  btn.innerHTML = `
    <video src="${vidSrc}" autoplay muted loop playsinline
      onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
    </video>
    <img src="${imgSrc}" alt="DallIA" style="display:none;" width="270" height="266" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='${imgFallback}'" />
    <span class="ia-widget-btn__dot"></span>
  `;
  topbarActions.prepend(btn);

  // ── Panel flotante ─────────────────────────────────────────────────────────
  const panel = document.createElement("div");
  panel.className = "ia-widget-panel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", "Chat con DallIA");
  panel.innerHTML = `
    <div class="ia-widget-header">
      <div class="ia-widget-mascot">
        <video src="${vidSrc}" autoplay muted loop playsinline
          onerror="this.style.display='none';this.nextElementSibling.style.display='block'">
        </video>
        <img src="${imgSrc}" alt="DallIA" style="display:none;" width="270" height="266" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='${imgFallback}'" />
        <span class="ia-widget-mascot__dot" title="En línea"></span>
      </div>
      <div class="ia-widget-hactions" style="position:absolute;top:10px;right:10px;">
        <button class="ia-widget-hbtn" id="ia-widget-newchat" type="button" title="Nueva conversación">
          <i data-lucide="plus"></i>
        </button>
        <button class="ia-widget-hbtn" id="ia-widget-close" type="button" aria-label="Cerrar">
          <i data-lucide="x"></i>
        </button>
      </div>
      <div class="ia-widget-header__info">
        <div>
          <div class="ia-widget-header__name">
            DallIA
            <span class="ia-widget-header__badge">IA</span>
          </div>
          <div class="ia-widget-header__sub">
            <span class="ia-widget-header__sub-dot"></span>
            En línea · Asistente de MiRest
          </div>
        </div>
      </div>
    </div>

    <div class="ia-widget-messages" id="ia-widget-msgs" role="log" aria-live="polite"></div>

    <div class="ia-widget-typing" id="ia-widget-typing" aria-hidden="true">
      <div class="ia-widget-typing__avatar">
        <img src="${imgSrc}" alt="DallIA" />
      </div>
      <div class="ia-widget-typing__dots">
        <span class="ia-widget-typing__dot"></span>
        <span class="ia-widget-typing__dot"></span>
        <span class="ia-widget-typing__dot"></span>
      </div>
    </div>

    <div class="ia-widget-footer">
      <div class="ia-widget-footer-row">
        <textarea class="ia-widget-input" id="ia-widget-input" rows="1"
          placeholder="Pregúntale algo a DallIA…" maxlength="800"
          aria-label="Mensaje para DallIA"></textarea>
        <button class="ia-widget-send" id="ia-widget-send" type="button" aria-label="Enviar mensaje">
          <i data-lucide="send"></i>
        </button>
      </div>
      <div class="ia-widget-hint">
        <kbd>Enter</kbd> enviar &nbsp;·&nbsp; <kbd>Shift+Enter</kbd> nueva línea
      </div>
    </div>
  `;
  document.body.appendChild(panel);

  if (window.lucide) window.lucide.createIcons();

  // ── Estado ─────────────────────────────────────────────────────────────────
  let isOpen = false;
  let isLoading = false;
  let history = [];

  const msgsEl = panel.querySelector("#ia-widget-msgs");
  const inputEl = panel.querySelector("#ia-widget-input");
  const sendEl = panel.querySelector("#ia-widget-send");
  const typingEl = panel.querySelector("#ia-widget-typing");
  const closeEl = panel.querySelector("#ia-widget-close");
  const newChatEl = panel.querySelector("#ia-widget-newchat");

  function togglePanel(open) {
    isOpen = open;
    panel.classList.toggle("ia-widget-panel--open", open);
    btn.classList.toggle("ia-widget-btn--active", open);
    btn.setAttribute("aria-label", open ? "Cerrar asistente IA" : "Abrir asistente IA");
    if (open) {
      if (msgsEl.childElementCount === 0) {
        appendMsg("assistant", "¡Hola! Soy DallIA, tu asistente de MiRest. ¿En qué puedo ayudarte hoy?");
      }
      inputEl.focus();
    }
  }

  function appendMsg(role, text) {
    const msg = document.createElement("div");
    msg.className = `ia-widget-msg ia-widget-msg--${role}`;

    const avatarHtml = role === "assistant"
      ? `<div class="ia-widget-msg__avatar"><img src="${imgSrc}" alt="DallIA" /></div>`
      : `<div class="ia-widget-msg__avatar">Tú</div>`;

    const bubbleContent = role === "assistant"
      ? text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br>")
      : escapeHtml(text);

    msg.innerHTML = `
      ${avatarHtml}
      <div class="ia-widget-msg__body">
        <div class="ia-widget-msg__sender">${role === "assistant" ? "DallIA" : "Tú"}</div>
        <div class="ia-widget-msg__bubble">${bubbleContent}</div>
      </div>
    `;
    msgsEl.appendChild(msg);
    msgsEl.scrollTop = msgsEl.scrollHeight;
  }

  function escapeHtml(t) {
    return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  async function sendMsg() {
    const text = inputEl.value.trim();
    if (!text || isLoading) return;

    const userApiKey = localStorage.getItem("mirest_gemini_key") || "";
    if (!userApiKey) {
      appendMsg("assistant", "⚠️ Debes configurar tu API Key de Gemini en el módulo de IA para usar a DallIA.");
      return;
    }

    inputEl.value = "";
    inputEl.style.height = "auto";
    history.push({ role: "user", content: text });
    appendMsg("user", text);

    isLoading = true;
    sendEl.disabled = true;
    typingEl.style.display = "flex";
    typingEl.setAttribute("aria-hidden", "false");
    msgsEl.scrollTop = msgsEl.scrollHeight;

    try {
      const resp = await fetch(`/api/ai`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-gemini-key": userApiKey
        },
        body: JSON.stringify({
          system: "Eres DallIA, asistente inteligente del restaurante MiRest. Responde siempre en español. Usa el contexto para ayudar con pedidos e inventario.",
          messages: history,
        }),
      });
      const json = await resp.json();
      const reply = json?.data?.candidates?.[0]?.content?.parts?.[0]?.text
        || "No pude procesar tu solicitud en este momento. Intenta de nuevo.";
      history.push({ role: "assistant", content: reply });
      appendMsg("assistant", reply);
    } catch (_) {
      appendMsg("assistant", "❌ Error de conexión. Verifica tu internet e intenta de nuevo.");
    } finally {
      isLoading = false;
      sendEl.disabled = false;
      typingEl.style.display = "none";
      typingEl.setAttribute("aria-hidden", "true");
      msgsEl.scrollTop = msgsEl.scrollHeight;
      inputEl.focus();
    }
  }

  // ── Eventos ────────────────────────────────────────────────────────────────
  btn.addEventListener("click", () => togglePanel(!isOpen));
  closeEl.addEventListener("click", () => togglePanel(false));
  newChatEl.addEventListener("click", () => {
    history = [];
    msgsEl.innerHTML = "";
    appendMsg("assistant", "¡Nueva conversación iniciada! ¿En qué puedo ayudarte?");
    inputEl.focus();
  });

  sendEl.addEventListener("click", sendMsg);
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMsg(); }
  });
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";
    inputEl.style.height = Math.min(inputEl.scrollHeight, 96) + "px";
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen) togglePanel(false);
  });
}

function initializeHapticFeedback() {
  document.body.addEventListener("click", (e) => {
    const target = e.target.closest("button, .btn, .chip, .cfg-toggle, .icon-button, .submenu-card");
    if (target) vibrate(40);
  });
}
