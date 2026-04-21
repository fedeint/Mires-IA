// IA/ia.js — Módulo principal DallIA

// ─── Estado global de la sesión ───────────────────────────────────────────────
let conversationHistory = []; // Array<{role: string, content: string}>
let ragDisabled = false;
let supabaseWarning = false;

// Configuración inicial con las nuevas credenciales de Supabase
window.MIREST_CONFIG = window.MIREST_CONFIG || {
  supabaseUrl: "https://twneirdsvyxsdsneidhi.supabase.co",
  supabaseAnonKey: "sb_publishable_A0yo_kDAGY3OamrUOOL9Bw_ShVWdBMF"
};

// ─── Gestión de proveedor y credenciales ──────────────────────────────────────
function getProvider() { return localStorage.getItem("mirest_ai_provider") || ""; }
function saveProvider(p) { localStorage.setItem("mirest_ai_provider", p); }

function getGroqKey() { return localStorage.getItem("mirest_groq_key") || ""; }
function saveGroqKey(k) { localStorage.setItem("mirest_groq_key", k.trim()); }

function getGeminiKey() { return localStorage.getItem("mirest_gemini_key") || ""; }
function saveGeminiKey(k) { localStorage.setItem("mirest_gemini_key", k.trim()); }

function getCfToken() { return localStorage.getItem("mirest_cf_token") || ""; }
function saveCfToken(k) { localStorage.setItem("mirest_cf_token", k.trim()); }

function getCfAccount() { return localStorage.getItem("mirest_cf_account") || ""; }
function saveCfAccount(k) { localStorage.setItem("mirest_cf_account", k.trim()); }

function clearGroqKey() {
  ["mirest_ai_provider", "mirest_groq_key", "mirest_gemini_key", "mirest_cf_token", "mirest_cf_account"]
    .forEach(k => localStorage.removeItem(k));
}

function isConfigured() {
  const p = getProvider();
  if (p === "groq") return !!getGroqKey();
  if (p === "gemini") return !!getGeminiKey();
  if (p === "cloudflare") return !!(getCfToken() && getCfAccount());
  return false;
}

// ─── 6.1 renderMarkdown(text) ─────────────────────────────────────────────────
// Convierte Markdown básico a HTML sin alterar el contenido semántico.
// Requirements: 1.4
function renderMarkdown(text) {
  if (typeof text !== "string") return "";

  // 1. Convertir **texto** → <strong>texto</strong>
  let html = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // 2. Convertir bloques de líneas con "- " en listas <ul><li>…</li></ul>
  //    Agrupa líneas consecutivas que empiezan con "- " en un solo <ul>.
  html = html.replace(/((?:^|\n)- .+)+/g, (block) => {
    const items = block
      .split("\n")
      .filter((line) => line.startsWith("- "))
      .map((line) => `<li>${line.slice(2)}</li>`)
      .join("");
    return `<ul>${items}</ul>`;
  });

  // 3. Convertir \n restantes → <br>
  html = html.replace(/\n/g, "<br>");

  return html;
}

// ─── 6.3 filterAndSortChunks(chunks, threshold, topK) ────────────────────────
// Filtra por umbral de similitud, ordena descendente y limita a topK.
// Requirements: 3.2, 3.3
function filterAndSortChunks(chunks, threshold = 0.70, topK = 5) {
  return chunks
    .filter((chunk) => chunk.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
}

// ─── 6.7 buildLLMPayload(chunks, userText, history) ──────────────────────────
// Construye el payload para el proxy LLM (netlify/functions/ai.js).
// Requirements: 4.1, 4.2, 4.3, 4.5
function buildLLMPayload(chunks, userText, history) {
  // Ordenar chunks por similitud descendente antes de ensamblar el contexto
  const sorted = [...chunks].sort((a, b) => b.similarity - a.similarity);

  let contextBlock;
  if (sorted.length === 0) {
    contextBlock =
      "NOTA: No se encontró contexto relevante en la base de documentos para esta pregunta. " +
      "Responde basándote únicamente en tu conocimiento general del restaurante.";
  } else {
    contextBlock =
      "CONTEXTO RELEVANTE:\n" +
      sorted
        .map((chunk, i) => `[${i + 1}] (Fuente: ${chunk.metadata?.source || 'Documentación'}): ${chunk.content}`)
        .join("\n\n");
  }

  const system =
    "Eres DallIA, el asistente de inteligencia artificial del restaurante MiRest. " +
    "Debes responder SIEMPRE en español. " +
    "Usa únicamente el contexto provisto para responder preguntas sobre el negocio " +
    "(recetas, proveedores, productos, operaciones, etc.). " +
    "Si la información no está en el contexto, indícalo con amabilidad.\n\n" +
    contextBlock;

  return {
    system,
    messages: history,
    model: "gemini-1.5-flash",
  };
}

// ─── 6.9 extractResponseText(data) ───────────────────────────────────────────
// Extrae el texto de la respuesta de Gemini sin modificarlo.
// Requirements: 4.4
function extractResponseText(data) {
  return data.candidates[0].content.parts[0].text;
}

// ─── 6.11 truncateHistory(history) ───────────────────────────────────────────
// Si el historial supera 40 mensajes (20 pares), descarta los pares más
// antiguos preservando siempre el mensaje más reciente del usuario.
// Requirements: 4.6, 6.5
function truncateHistory(history) {
  if (history.length <= 40) return history;

  // Tomar los últimos 40 mensajes (20 pares más recientes)
  return history.slice(history.length - 40);
}

// ─── Helper: appendToHistory ──────────────────────────────────────────────────
function appendToHistory(role, content) {
  conversationHistory.push({ role, content });
}

// ─── 7.1 getEmbedding(text) ───────────────────────────────────────────────────
// Convierte el texto en un vector de embedding llamando al proxy backend.
// Requirements: 2.1, 2.2, 2.4
async function getEmbedding(text) {
  const response = await fetch("/api/ai-embedding", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-gemini-key": getGeminiKey(),
    },
    body: JSON.stringify({ text }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      `Error al generar el embedding: ${data.error || response.statusText}`
    );
  }

  return data.embedding;
}

// ─── 7.2 retrieveContext(embedding) ──────────────────────────────────────────
// Busca documentos relevantes en Supabase usando el vector de embedding.
// Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 8.2, 8.4
async function retrieveContext(embedding) {
  const config = window.MIREST_CONFIG || {};
  const SUPABASE_URL = config.supabaseUrl || config.SUPABASE_URL;
  const SUPABASE_ANON_KEY = config.supabaseAnonKey || config.SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error(
      "[DallIA] SUPABASE_URL o SUPABASE_ANON_KEY no están definidas en window.MIREST_CONFIG. " +
      "El RAG pipeline está deshabilitado. DallIA operará como chat simple."
    );
    ragDisabled = true;
    return [];
  }

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/rpc/match_documents`,
      {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query_embedding: embedding,
          match_threshold: 0.70,
          match_count: 5,
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Supabase respondió con estado ${response.status}`);
    }

    const chunks = await response.json();
    return filterAndSortChunks(chunks);
  } catch (err) {
    console.error("[DallIA] Error al recuperar contexto de Supabase:", err);
    supabaseWarning = true;
    return [];
  }
}

// ─── 7.3 callLLM(payload) ────────────────────────────────────────────────────
// Envía el payload al proxy LLM y retorna el texto de la respuesta.
// Requirements: 4.3, 4.4
async function callLLM(payload) {
  const endpoint = "/api/ai";
  const headers = {
    "Content-Type": "application/json",
    "x-gemini-key": getGeminiKey()
  };

  let response;
  try {
    response = await fetch(endpoint, { method: "POST", headers, body: JSON.stringify(payload) });
  } catch (_) {
    throw new Error("Problema de conexión. Verifica tu internet e intenta de nuevo.");
  }

  const data = await response.json();
  if (!response.ok) throw new Error("DallA no pudo procesar tu solicitud. Intenta de nuevo.");
  return extractResponseText(data.data);
}

// ─── 7.4 sendMessage(userText) ───────────────────────────────────────────────
// Orquesta el pipeline completo: embedding → contexto → payload → LLM.
// Requirements: 2.2, 3.4, 4.3, 6.1, 6.2, 6.3, 7.3
async function sendMessage(userText) {
  supabaseWarning = false;

  if (!isConfigured()) {
    renderMessage("assistant", "⚠️ Por favor, configura tu API Key antes de continuar.");
    return;
  }

  setLoadingState(true);
  renderMessage("user", userText);
  appendToHistory("user", userText);

  try {
    const embedding = await getEmbedding(userText);
    const chunks = await retrieveContext(embedding);

    // Truncar historial antes de enviar para no exceder límites de tokens
    const history = truncateHistory(conversationHistory);
    const payload = buildLLMPayload(chunks, userText, history);

    const assistantText = await callLLM(payload);

    appendToHistory("assistant", assistantText);
    renderMessage("assistant", assistantText);

    if (supabaseWarning) {
      renderMessage(
        "assistant",
        "⚠️ Advertencia: DallIA está respondiendo sin acceso a la base de conocimiento. " +
        "La respuesta puede ser menos precisa."
      );
    }
  } catch (err) {
    renderMessage(
      "assistant",
      `❌ ${err.message || "DallIA no pudo procesar tu solicitud en este momento."}`
    );
  } finally {
    setLoadingState(false);
  }
}

// ─── UI Helpers ───────────────────────────────────────────────────────────────

const WELCOME_MESSAGE =
  "¡Hola! Soy DallA, el asistente de MiRest. Puedo ayudarte con preguntas sobre recetas, proveedores, productos y operaciones del restaurante. ¿En qué puedo ayudarte hoy?";

// ─── 8.1 renderMessage(role, content) ────────────────────────────────────────
// Requirements: 1.1, 1.2, 1.4
function renderMessage(role, content) {
  const chatMessages = document.getElementById("chat-messages");
  const el = document.createElement("div");
  el.classList.add("message", role === "user" ? "message--user" : "message--assistant");

  // Avatar
  const avatarEl = document.createElement("div");
  avatarEl.classList.add("message__avatar");
  if (role === "assistant") {
    avatarEl.innerHTML = `<img src="./DalIA.webp" alt="DallA" width="270" height="266" decoding="async" onerror="this.onerror=null;this.src='./DalIA.png'" />`;
  } else {
    avatarEl.textContent = "Tú";
    avatarEl.style.fontSize = "10px";
  }

  // Body
  const bodyEl = document.createElement("div");
  bodyEl.classList.add("message__body");

  const senderEl = document.createElement("div");
  senderEl.classList.add("message__sender");
  senderEl.textContent = role === "assistant" ? "DallA" : "Tú";

  const bubble = document.createElement("div");
  bubble.classList.add("message__bubble");

  if (role === "assistant") {
    bubble.innerHTML = renderMarkdown(content);
  } else {
    bubble.textContent = content;
  }

  bodyEl.appendChild(senderEl);
  bodyEl.appendChild(bubble);
  el.appendChild(avatarEl);
  el.appendChild(bodyEl);
  chatMessages.appendChild(el);
  scrollToBottom();
}

// ─── scrollToBottom() ────────────────────────────────────────────────────────
// Desplaza el área de mensajes hasta el último mensaje.
// Requirements: 1.1
function scrollToBottom() {
  const chatMessages = document.getElementById("chat-messages");
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function setLoadingState(isLoading) {
  const chatInput = document.getElementById("chat-input");
  const btnSend = document.getElementById("btn-send");
  const typingIndicator = document.getElementById("typing-indicator");

  chatInput.disabled = isLoading;
  btnSend.disabled = isLoading;
  typingIndicator.style.display = isLoading ? "flex" : "none";

  if (!isLoading) {
    chatInput.focus();
  }
}

// ─── 8.6 updateCharCounter(length) ───────────────────────────────────────────
// Muestra los caracteres restantes en el contador.
// Requirements: 7.5
function updateCharCounter(length) {
  const charCounter = document.getElementById("char-counter");
  charCounter.textContent = 1000 - length;
}

// ─── 8.9 clearChat() ─────────────────────────────────────────────────────────
// Limpia el área de mensajes, reinicia el historial y muestra el mensaje de bienvenida.
// Requirements: 1.5, 6.4
function clearChat() {
  const chatMessages = document.getElementById("chat-messages");
  chatMessages.innerHTML = "";
  conversationHistory = [];
  renderMessage("assistant", WELCOME_MESSAGE);
}

// ─── Inicialización del módulo ────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  const chatInput = document.getElementById("chat-input");
  const btnSend = document.getElementById("btn-send");
  const btnNewChat = document.getElementById("btn-new-chat");

  // Evento: click en botón enviar
  btnSend.addEventListener("click", () => {
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    updateCharCounter(0);
    sendMessage(text);
  });

  // Evento: Enter sin Shift en el textarea
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      btnSend.click();
    }
  });

  // Evento: input → actualizar contador de caracteres
  chatInput.addEventListener("input", () => {
    updateCharCounter(chatInput.value.length);
  });

  // Evento: click en "Nueva conversación"
  btnNewChat.addEventListener("click", () => {
    clearChat();
    chatInput.focus();
  });

  // Inicializar: mostrar modal de proveedor si no está configurado
  if (!isConfigured()) {
    showApiKeyModal();
  } else {
    clearChat();
    chatInput.focus();
  }
});

// ─── Modal de API Key ─────────────────────────────────────────────────────────
function showApiKeyModal() {
  // Crear overlay
  const overlay = document.createElement("div");
  overlay.id = "api-key-overlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,.75); backdrop-filter:blur(6px);
    display:flex; align-items:center; justify-content:center; z-index:1000; padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:var(--color-surface,#1a1a1a); border:1px solid var(--color-border,#333);
      border-radius:20px; padding:28px; max-width:460px; width:100%;
      box-shadow:0 24px 64px rgba(0,0,0,.6);
    ">
      <!-- Header -->
      <div style="text-align:center; margin-bottom:24px;">
        <img src="./DalIA.webp" alt="DallA" style="width:72px;height:72px;border-radius:50%;border:3px solid #f07c2a;box-shadow:0 0 0 6px rgba(240,124,42,.15);margin-bottom:12px;" width="270" height="266" decoding="async" onerror="this.onerror=null;this.src='./DalIA.png'" />
        <h2 style="font-size:20px;font-weight:800;color:var(--color-text,#fff);margin:0 0 6px;">Configura DallA</h2>
        <p style="font-size:13px;color:var(--color-text-muted,#999);margin:0;">Elige tu proveedor de IA y pega tu API key</p>
      </div>

      <!-- Selector de proveedor -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:20px;">
        <button class="prov-btn" data-prov="groq" style="
          padding:10px 6px;border-radius:10px;border:2px solid var(--color-border,#444);
          background:var(--color-bg,#111);color:var(--color-text,#fff);cursor:pointer;
          font-size:12px;font-weight:700;transition:all .15s;text-align:center;
        ">
          <div style="font-size:20px;margin-bottom:4px;">⚡</div>
          Groq
          <div style="font-size:10px;color:#999;font-weight:400;margin-top:2px;">llama-3.3-70b</div>
        </button>
        <button class="prov-btn" data-prov="cloudflare" style="
          padding:10px 6px;border-radius:10px;border:2px solid var(--color-border,#444);
          background:var(--color-bg,#111);color:var(--color-text,#fff);cursor:pointer;
          font-size:12px;font-weight:700;transition:all .15s;text-align:center;
        ">
          <div style="font-size:20px;margin-bottom:4px;">☁️</div>
          Cloudflare
          <div style="font-size:10px;color:#999;font-weight:400;margin-top:2px;">llama-3.1-8b</div>
        </button>
        <button class="prov-btn" data-prov="gemini" style="
          padding:10px 6px;border-radius:10px;border:2px solid var(--color-border,#444);
          background:var(--color-bg,#111);color:var(--color-text,#fff);cursor:pointer;
          font-size:12px;font-weight:700;transition:all .15s;text-align:center;
        ">
          <div style="font-size:20px;margin-bottom:4px;">✨</div>
          Gemini
          <div style="font-size:10px;color:#999;font-weight:400;margin-top:2px;">gemini-1.5-flash</div>
        </button>
      </div>

      <!-- Campos dinámicos -->
      <div id="prov-fields" style="margin-bottom:16px;"></div>

      <button id="api-key-save" style="
        width:100%;padding:13px;border-radius:10px;border:none;cursor:pointer;
        background:linear-gradient(135deg,#f07c2a,#d96a1a);color:#fff;
        font-size:15px;font-weight:700;opacity:.5;pointer-events:none;transition:all .15s;
      ">Activar DallA</button>
    </div>
  `;

  document.body.appendChild(overlay);

  const saveBtn = overlay.querySelector("#api-key-save");
  const fieldsDiv = overlay.querySelector("#prov-fields");
  let selectedProv = "";

  const fieldStyle = `
    width:100%;padding:11px 14px;border-radius:10px;box-sizing:border-box;
    border:1px solid var(--color-border,#444);background:var(--color-bg,#111);
    color:var(--color-text,#fff);font-size:13px;font-family:monospace;
    transition:border-color .15s;margin-bottom:10px;
  `;

  const labelStyle = `display:block;font-size:12px;font-weight:600;color:var(--color-text-muted,#999);margin-bottom:5px;`;

  const provConfigs = {
    groq: {
      fields: `
        <label style="${labelStyle}">Groq API Key</label>
        <input id="f-groq-key" type="password" placeholder="gsk_..." style="${fieldStyle}" />
        <p style="font-size:11px;color:#777;margin:0;">Obtén tu key gratis en <a href="https://console.groq.com/keys" target="_blank" style="color:#f07c2a;">console.groq.com/keys</a></p>
      `,
      validate: () => overlay.querySelector("#f-groq-key").value.trim(),
      save: () => { saveGroqKey(overlay.querySelector("#f-groq-key").value.trim()); },
    },
    cloudflare: {
      fields: `
        <label style="${labelStyle}">Cloudflare Account ID</label>
        <input id="f-cf-account" type="text" placeholder="2263e816c670f9c3..." style="${fieldStyle}" />
        <label style="${labelStyle}">Cloudflare AI Token</label>
        <input id="f-cf-token" type="password" placeholder="cfut_..." style="${fieldStyle}" />
        <p style="font-size:11px;color:#777;margin:0;">Obtén tu token en <a href="https://dash.cloudflare.com/profile/api-tokens" target="_blank" style="color:#f07c2a;">dash.cloudflare.com</a></p>
      `,
      validate: () => overlay.querySelector("#f-cf-account").value.trim() && overlay.querySelector("#f-cf-token").value.trim(),
      save: () => {
        saveCfAccount(overlay.querySelector("#f-cf-account").value.trim());
        saveCfToken(overlay.querySelector("#f-cf-token").value.trim());
      },
    },
    gemini: {
      fields: `
        <label style="${labelStyle}">Google AI Studio API Key</label>
        <input id="f-gemini-key" type="password" placeholder="AIza..." style="${fieldStyle}" />
        <p style="font-size:11px;color:#777;margin:0;">Obtén tu key en <a href="https://aistudio.google.com/app/apikey" target="_blank" style="color:#f07c2a;">aistudio.google.com</a></p>
      `,
      validate: () => overlay.querySelector("#f-gemini-key").value.trim(),
      save: () => { saveGeminiKey(overlay.querySelector("#f-gemini-key").value.trim()); },
    },
  };

  // Seleccionar proveedor
  overlay.querySelectorAll(".prov-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      overlay.querySelectorAll(".prov-btn").forEach(b => {
        b.style.borderColor = "var(--color-border,#444)";
        b.style.background = "var(--color-bg,#111)";
      });
      btn.style.borderColor = "#f07c2a";
      btn.style.background = "rgba(240,124,42,.12)";
      selectedProv = btn.dataset.prov;
      fieldsDiv.innerHTML = provConfigs[selectedProv].fields;
      saveBtn.style.opacity = "1";
      saveBtn.style.pointerEvents = "auto";
      // Focus primer input
      const first = fieldsDiv.querySelector("input");
      if (first) first.focus();
    });
  });

  // Guardar
  saveBtn.addEventListener("click", () => {
    if (!selectedProv) return;
    const cfg = provConfigs[selectedProv];
    if (!cfg.validate()) {
      fieldsDiv.querySelectorAll("input").forEach(i => {
        if (!i.value.trim()) i.style.borderColor = "#ef4444";
      });
      return;
    }
    cfg.save();
    saveProvider(selectedProv);
    overlay.remove();
    clearChat();
    document.getElementById("chat-input").focus();
  });
}
