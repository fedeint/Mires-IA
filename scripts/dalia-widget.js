/**
 * DallA Widget — Mini chat flotante para todos los módulos de MiRest
 * Incluir este script en cualquier módulo para activar el widget de DallA.
 * Requiere que /api/groq, /api/cloudflare-ai o /api/ai estén disponibles.
 */
(function () {
  // ── Detectar root path desde el body ──────────────────────────────────────
  const ROOT = document.body.dataset.rootPath || "../";

  // ── Helpers de credenciales (mismo localStorage que ia.js) ────────────────
  const getProvider  = () => localStorage.getItem("mirest_ai_provider") || "";
  const getGroqKey   = () => localStorage.getItem("mirest_groq_key") || "";
  const getGeminiKey = () => localStorage.getItem("mirest_gemini_key") || "";
  const getCfToken   = () => localStorage.getItem("mirest_cf_token") || "";
  const getCfAccount = () => localStorage.getItem("mirest_cf_account") || "";

  const isConfigured = () => {
    const p = getProvider();
    if (p === "groq")       return !!getGroqKey();
    if (p === "gemini")     return !!getGeminiKey();
    if (p === "cloudflare") return !!(getCfToken() && getCfAccount());
    return false;
  };

  // ── Inyectar CSS ──────────────────────────────────────────────────────────
  const style = document.createElement("style");
  style.textContent = `
    /* ── Dock DallA (misma zona que el antiguo FAB circular: esquina inferior) ── */
    #dalia-dock {
      position: fixed;
      right: max(12px, env(safe-area-inset-right));
      bottom: calc(88px + env(safe-area-inset-bottom));
      z-index: 10050;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 10px;
      max-width: min(100vw - 24px, 320px);
      pointer-events: none;
    }
    #dalia-dock > * {
      pointer-events: auto;
    }
    #dalia-toggle-bar {
      display: inline-flex;
      align-items: center;
      gap: 7px;
      padding: 8px 12px 8px 8px;
      border-radius: 22px;
      background: var(--color-surface, #fff);
      border: 1.5px solid var(--color-border, #e5e7eb);
      box-shadow: 0 4px 20px rgba(0,0,0,.14);
      cursor: pointer;
      transition: all .15s;
      user-select: none;
    }
    #dalia-toggle-bar:hover {
      border-color: #f07c2a;
      box-shadow: 0 6px 22px rgba(240,124,42,.22);
    }
    #dalia-toggle-bar img {
      width: 22px;
      height: 22px;
      border-radius: 50%;
      object-fit: cover;
      border: 1.5px solid #f07c2a;
    }
    #dalia-toggle-bar .dalia-toggle-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-text, #111);
      font-family: var(--font-sans, system-ui, sans-serif);
    }
    .dalia-switch {
      width: 34px;
      height: 18px;
      background: #ccc;
      border-radius: 20px;
      position: relative;
      transition: background .2s;
      flex-shrink: 0;
    }
    .dalia-switch.on { background: #f07c2a; }
    .dalia-switch::before {
      content: '';
      position: absolute;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: #fff;
      top: 3px;
      left: 3px;
      transition: transform .2s;
      box-shadow: 0 1px 3px rgba(0,0,0,.2);
    }
    .dalia-switch.on::before { transform: translateX(16px); }

    /* ── Botón circular: abrir chat (solo si el interruptor está activo) ── */
    #dalia-fab-wrap {
      position: relative;
      display: none;
    }
    #dalia-fab-wrap.dalia-fab-wrap--visible {
      display: block;
    }
    #dalia-fab {
      position: relative;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      border: none;
      cursor: pointer;
      padding: 0;
      overflow: hidden;
      box-shadow: 0 4px 20px rgba(240,124,42,.5);
      transition: transform .2s, box-shadow .2s;
      background: linear-gradient(135deg,#f07c2a,#d96a1a);
    }
    #dalia-fab:hover { transform: scale(1.06); box-shadow: 0 6px 28px rgba(240,124,42,.65); }
    #dalia-fab img { width: 100%; height: 100%; object-fit: cover; }
    #dalia-fab .dalia-fab-fallback {
      width: 100%; height: 100%;
      display: grid; place-items: center;
      font-size: 24px;
    }

    /* ── Widget mini chat ── */
    #dalia-widget {
      position: fixed;
      bottom: calc(200px + env(safe-area-inset-bottom));
      right: max(12px, env(safe-area-inset-right));
      width: 360px;
      height: 560px;
      background: var(--color-surface, #1a1a1a);
      border: 1px solid var(--color-border, #333);
      border-radius: 20px;
      box-shadow: 0 16px 48px rgba(0,0,0,.5);
      display: flex;
      flex-direction: column;
      z-index: 10050;
      overflow: hidden;
      animation: dalia-widget-in .25s cubic-bezier(.34,1.56,.64,1);
      transform-origin: bottom right;
    }
    @keyframes dalia-widget-in {
      from { opacity:0; transform:scale(.85); }
      to   { opacity:1; transform:scale(1); }
    }
    #dalia-widget.dalia-closing {
      animation: dalia-widget-out .18s ease forwards;
    }
    @keyframes dalia-widget-out {
      to { opacity:0; transform:scale(.85); }
    }

    /* ── Cabecera del widget (sin vídeo: el reproductor tapaba el botón cerrar en algunos navegadores) ── */
    .dalia-w-header {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 14px;
      border-bottom: 1px solid var(--color-border, #333);
      background: linear-gradient(135deg, rgba(240,124,42,.12), transparent);
      flex-shrink: 0;
    }
    .dalia-w-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      overflow: hidden;
      border: 2px solid #f07c2a;
      flex-shrink: 0;
    }
    .dalia-w-avatar img { width:100%; height:100%; object-fit:cover; }
    .dalia-w-info { flex:1; min-width:0; }
    .dalia-w-name {
      font-size: 14px; font-weight: 800;
      color: var(--color-text, #fff);
      display: flex; align-items: center; gap: 6px;
    }
    .dalia-w-dot {
      width: 7px; height: 7px; border-radius: 50%;
      background: #22c55e;
      box-shadow: 0 0 5px rgba(34,197,94,.6);
    }
    .dalia-w-sub { font-size: 11px; color: var(--color-text-muted, #999); }
    .dalia-w-close {
      position: relative;
      z-index: 5;
      width: 32px; height: 32px;
      margin-left: auto;
      border-radius: 8px; border: 1px solid var(--color-border, #444);
      background: var(--color-surface-muted, rgba(0,0,0,.2));
      color: var(--color-text, #fff);
      cursor: pointer; font-size: 16px;
      display: grid; place-items: center;
      flex-shrink: 0;
      transition: background .12s, border-color .12s;
    }
    .dalia-w-close:hover { background: rgba(240,124,42,.2); border-color: #f07c2a; }

    /* ── Mensajes ── */
    .dalia-w-messages {
      flex: 1;
      overflow-y: auto;
      padding: 14px 12px 8px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      scroll-behavior: smooth;
    }
    .dalia-w-messages::-webkit-scrollbar { width: 3px; }
    .dalia-w-messages::-webkit-scrollbar-thumb { background: #444; border-radius: 3px; }

    .dalia-w-msg {
      display: flex;
      gap: 8px;
      max-width: 88%;
      animation: dalia-msg-in .2s ease;
    }
    @keyframes dalia-msg-in {
      from { opacity:0; transform:translateY(5px); }
      to   { opacity:1; transform:translateY(0); }
    }
    .dalia-w-msg--user  { align-self: flex-end; flex-direction: row-reverse; }
    .dalia-w-msg--bot   { align-self: flex-start; }

    .dalia-w-msg-av {
      width: 26px; height: 26px;
      border-radius: 50%; flex-shrink: 0;
      overflow: hidden; margin-top: 2px;
    }
    .dalia-w-msg--bot .dalia-w-msg-av { border: 1.5px solid #f07c2a; }
    .dalia-w-msg--user .dalia-w-msg-av {
      background: linear-gradient(135deg,#f07c2a,#d96a1a);
      display: grid; place-items: center;
      font-size: 10px; font-weight: 800; color: #fff;
    }
    .dalia-w-msg-av img { width:100%; height:100%; object-fit:cover; }

    .dalia-w-bubble {
      padding: 9px 12px;
      border-radius: 14px;
      font-size: 13px;
      line-height: 1.55;
      word-break: break-word;
    }
    .dalia-w-msg--user .dalia-w-bubble {
      background: linear-gradient(135deg,#f07c2a,#d96a1a);
      color: #fff;
      border-bottom-right-radius: 3px;
    }
    .dalia-w-msg--bot .dalia-w-bubble {
      background: var(--color-bg, #111);
      color: var(--color-text, #fff);
      border: 1px solid var(--color-border, #333);
      border-bottom-left-radius: 3px;
    }
    .dalia-w-bubble ul { margin: 4px 0 0; padding-left: 16px; }
    .dalia-w-bubble li { margin-bottom: 3px; }

    /* ── Typing ── */
    .dalia-w-typing {
      display: none;
      align-self: flex-start;
      align-items: center;
      gap: 8px;
      padding: 0 12px 8px;
    }
    .dalia-w-typing-av {
      width: 26px; height: 26px;
      border-radius: 50%; overflow: hidden;
      border: 1.5px solid #f07c2a; flex-shrink: 0;
    }
    .dalia-w-typing-av img { width:100%; height:100%; object-fit:cover; }
    .dalia-w-typing-dots {
      display: flex; gap: 4px; align-items: center;
      padding: 8px 12px;
      background: var(--color-bg,#111);
      border: 1px solid var(--color-border,#333);
      border-radius: 14px; border-bottom-left-radius: 3px;
    }
    .dalia-w-dot-anim {
      width: 6px; height: 6px; border-radius: 50%;
      background: #f07c2a;
      animation: dalia-dot .9s infinite ease-in-out;
    }
    .dalia-w-dot-anim:nth-child(2) { animation-delay:.15s; }
    .dalia-w-dot-anim:nth-child(3) { animation-delay:.3s; }
    @keyframes dalia-dot {
      0%,60%,100% { transform:translateY(0); opacity:.3; }
      30% { transform:translateY(-5px); opacity:1; }
    }

    /* ── Input ── */
    .dalia-w-input-area {
      border-top: 1px solid var(--color-border, #333);
      padding: 10px 12px;
      display: flex;
      gap: 8px;
      align-items: flex-end;
      flex-shrink: 0;
      background: var(--color-surface, #1a1a1a);
    }
    .dalia-w-input {
      flex: 1;
      resize: none;
      border: 1.5px solid var(--color-border, #444);
      border-radius: 10px;
      padding: 9px 12px;
      font-size: 13px;
      background: var(--color-bg, #111);
      color: var(--color-text, #fff);
      font-family: inherit;
      min-height: 38px;
      max-height: 90px;
      overflow-y: auto;
      transition: border-color .15s;
    }
    .dalia-w-input:focus {
      outline: none;
      border-color: #f07c2a;
      box-shadow: 0 0 0 3px rgba(240,124,42,.12);
    }
    .dalia-w-input::placeholder { color: var(--color-text-muted,#666); }
    .dalia-w-input:disabled { opacity:.5; cursor:not-allowed; }
    .dalia-w-send {
      width: 38px; height: 38px;
      border-radius: 10px; border: none;
      background: linear-gradient(135deg,#f07c2a,#d96a1a);
      color: #fff; cursor: pointer;
      display: grid; place-items: center;
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(240,124,42,.35);
      transition: transform .12s, filter .12s;
      font-size: 16px;
    }
    .dalia-w-send:hover:not(:disabled) { transform:translateY(-1px); filter:brightness(1.1); }
    .dalia-w-send:disabled { opacity:.4; cursor:not-allowed; transform:none; }

    /* ── Responsive ── */
    @media (max-width: 640px) {
      #dalia-dock {
        right: max(8px, env(safe-area-inset-right));
        bottom: calc(82px + env(safe-area-inset-bottom));
      }
      #dalia-widget {
        width: calc(100vw - 20px);
        right: max(8px, env(safe-area-inset-right));
        bottom: calc(188px + env(safe-area-inset-bottom));
        max-height: min(560px, 72dvh);
      }
    }
  `;
  document.head.appendChild(style);

  // ── Renderizar Markdown básico ─────────────────────────────────────────────
  function renderMd(text) {
    if (typeof text !== "string") return "";
    let h = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    h = h.replace(/((?:^|\n)- .+)+/g, block => {
      const items = block.split("\n").filter(l => l.startsWith("- "))
        .map(l => `<li>${l.slice(2)}</li>`).join("");
      return `<ul>${items}</ul>`;
    });
    return h.replace(/\n/g, "<br>");
  }

  // ── Llamar al LLM ──────────────────────────────────────────────────────────
  async function askDallA(messages, system) {
    const provider = getProvider() || "groq";
    let endpoint, headers;

    if (provider === "groq") {
      endpoint = "/api/groq";
      headers  = { "Content-Type": "application/json", "x-groq-key": getGroqKey() };
    } else if (provider === "cloudflare") {
      endpoint = "/api/cloudflare-ai";
      headers  = { "Content-Type": "application/json", "x-cf-token": getCfToken(), "x-cf-account": getCfAccount() };
    } else {
      endpoint = "/api/ai";
      headers  = { "Content-Type": "application/json", "x-gemini-key": getGeminiKey() };
    }

    const resp = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({ messages, system, model: provider === "groq" ? "llama-3.3-70b-versatile" : undefined }),
    });

    const data = await resp.json();
    if (!resp.ok) throw new Error("Error al conectar con DallA");
    return data?.data?.candidates?.[0]?.content?.parts?.[0]?.text || "Sin respuesta";
  }

  // ── Crear el widget ────────────────────────────────────────────────────────
  function createWidget() {
    const avatarSrc = ROOT + "IA/DalIA.webp";
    const avatarFallback = ROOT + "IA/DalIA.png";
    const pageName  = document.title.replace("MiRest con IA | ", "") || "este módulo";
    const STORAGE_KEY = "mirest_dalia_active";

    // ── Dock inferior: interruptor (siempre) + FAB circular para chat (si está activo) ──
    const dock = document.createElement("div");
    dock.id = "dalia-dock";

    const toggleWrap = document.createElement("div");
    toggleWrap.id = "dalia-toggle-bar";
    toggleWrap.title = "Activar o desactivar DallA";
    toggleWrap.innerHTML = `
      <img src="${avatarSrc}" alt="DallA" width="72" height="72" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='${avatarFallback}'" />
      <span class="dalia-toggle-label">DallA</span>
      <div class="dalia-switch" id="dalia-switch-pill"></div>
    `;

    const fabWrap = document.createElement("div");
    fabWrap.id = "dalia-fab-wrap";

    const fab = document.createElement("button");
    fab.id = "dalia-fab";
    fab.title = "Abrir chat con DallA";
    fab.innerHTML = `<img src="${avatarSrc}" alt="DallA" width="72" height="72" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='${avatarFallback}'" />`;

    fabWrap.appendChild(fab);
    dock.appendChild(fabWrap);
    dock.appendChild(toggleWrap);
    document.body.appendChild(dock);
    /* Si app.js ya montó el chat del topbar (DallIA), evitar duplicado y capas fantasma */
    document.querySelector(".ia-widget-btn")?.remove();
    document.querySelector(".ia-widget-panel")?.remove();

    const switchPill = toggleWrap.querySelector("#dalia-switch-pill");
    const isActive = () => localStorage.getItem(STORAGE_KEY) === "1";

    function syncFabVisibility() {
      fabWrap.classList.toggle("dalia-fab-wrap--visible", isActive());
    }

    if (isActive()) switchPill.classList.add("on");
    syncFabVisibility();

    let widgetEl = null;
    let history  = [];
    let isOpen   = false;

    toggleWrap.addEventListener("click", () => {
      const active = !isActive();
      localStorage.setItem(STORAGE_KEY, active ? "1" : "0");
      switchPill.classList.toggle("on", active);
      syncFabVisibility();
      if (!active && widgetEl) closeWidget();
    });

    function openWidget() {
      if (isOpen) return;
      isOpen = true;

      widgetEl = document.createElement("div");
      widgetEl.id = "dalia-widget";
      widgetEl.innerHTML = `
        <div class="dalia-w-header">
          <div class="dalia-w-avatar">
            <img src="${avatarSrc}" alt="" width="72" height="72" decoding="async" fetchpriority="low" onerror="this.onerror=null;this.src='${avatarFallback}'" />
          </div>
          <div class="dalia-w-info">
            <div class="dalia-w-name"><span class="dalia-w-dot" aria-hidden="true"></span> DallA</div>
            <div class="dalia-w-sub">Asistente MiRest · ${pageName}</div>
          </div>
          <button type="button" class="dalia-w-close" id="dalia-w-close-btn" title="Cerrar" aria-label="Cerrar chat">✕</button>
        </div>
        <div class="dalia-w-messages" id="dalia-w-msgs"></div>
        <div class="dalia-w-typing" id="dalia-w-typing">
          <div class="dalia-w-typing-av"><img src="${avatarSrc}" alt="DallA" width="72" height="72" decoding="async" onerror="this.onerror=null;this.src='${avatarFallback}'" /></div>
          <div class="dalia-w-typing-dots">
            <span class="dalia-w-dot-anim"></span>
            <span class="dalia-w-dot-anim"></span>
            <span class="dalia-w-dot-anim"></span>
          </div>
        </div>
        <div class="dalia-w-input-area">
          <textarea class="dalia-w-input" id="dalia-w-input" rows="1" placeholder="Pregúntale algo a DallA..." maxlength="500"></textarea>
          <button class="dalia-w-send" id="dalia-w-send">➤</button>
        </div>
      `;
      document.body.appendChild(widgetEl);

      const msgsEl   = widgetEl.querySelector("#dalia-w-msgs");
      const inputEl  = widgetEl.querySelector("#dalia-w-input");
      const sendBtn  = widgetEl.querySelector("#dalia-w-send");
      const typingEl = widgetEl.querySelector("#dalia-w-typing");
      const closeBtn = widgetEl.querySelector("#dalia-w-close-btn");

      // Mensaje de bienvenida
      if (history.length === 0) {
        addMsg("bot", `¡Hola! Soy DallA 👋 Estoy aquí para ayudarte con **${pageName}**. ¿En qué puedo ayudarte?`);
      } else {
        history.forEach(m => addMsg(m.role === "user" ? "user" : "bot", m.content, false));
        scrollBottom();
      }

      function addMsg(role, content, animate = true) {
        const msg = document.createElement("div");
        msg.className = `dalia-w-msg dalia-w-msg--${role}`;
        if (!animate) msg.style.animation = "none";

        const av = document.createElement("div");
        av.className = "dalia-w-msg-av";
        if (role === "bot") {
          av.innerHTML = `<img src="${avatarSrc}" alt="DallA" width="72" height="72" decoding="async" onerror="this.onerror=null;this.src='${avatarFallback}'" />`;
        } else {
          av.textContent = "Tú";
        }

        const bubble = document.createElement("div");
        bubble.className = "dalia-w-bubble";
        if (role === "bot") {
          bubble.innerHTML = renderMd(content);
        } else {
          bubble.textContent = content;
        }

        msg.appendChild(av);
        msg.appendChild(bubble);
        msgsEl.appendChild(msg);
        scrollBottom();
      }

      function scrollBottom() {
        msgsEl.scrollTop = msgsEl.scrollHeight;
      }

      async function send() {
        const text = inputEl.value.trim();
        if (!text) return;

        if (!isConfigured()) {
          window.location.href = ROOT + "IA/ia.html";
          return;
        }

        inputEl.value = "";
        inputEl.disabled = true;
        sendBtn.disabled = true;
        addMsg("user", text);

        history.push({ role: "user", content: text });

        typingEl.style.display = "flex";
        scrollBottom();

        try {
          const system = `Eres DallA, el asistente IA del restaurante MiRest. Responde siempre en español. Estás ayudando al usuario en el módulo: ${pageName}. Sé conciso y útil.`;
          const reply = await askDallA(history, system);
          typingEl.style.display = "none";
          history.push({ role: "assistant", content: reply });
          addMsg("bot", reply);
        } catch (e) {
          typingEl.style.display = "none";
          addMsg("bot", "❌ " + (e.message || "Error al conectar con DallA"));
        } finally {
          inputEl.disabled = false;
          sendBtn.disabled = false;
          inputEl.focus();
        }
      }

      sendBtn.addEventListener("click", send);
      inputEl.addEventListener("keydown", e => {
        if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
      });

      closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeWidget();
      });
      inputEl.focus();
    }

    function closeWidget() {
      if (!widgetEl) return;
      widgetEl.classList.add("dalia-closing");
      setTimeout(() => {
        widgetEl?.remove();
        widgetEl = null;
        isOpen = false;
      }, 180);
    }

    fab.addEventListener("click", () => {
      if (isOpen) closeWidget();
      else openWidget();
    });
  }

  // ── Inicializar: respeta tenants.dalla_activo_por_modulo (vía mirest-dallia-visibility.js) ─
  async function bootDalia() {
    try {
      const { shouldShowDallAForCurrentPage } = await import(ROOT + "scripts/mirest-dallia-visibility.js");
      const ok = await shouldShowDallAForCurrentPage();
      if (!ok) return;
    } catch (e) {
      console.warn("[dalia-widget] visibilidad; se muestra el widget por defecto.", e);
    }
    createWidget();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => void bootDalia());
  } else {
    void bootDalia();
  }
})();
