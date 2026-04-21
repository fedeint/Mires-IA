import { supabase } from "./supabase.js";

const statusEl = document.getElementById("activateStatus");
const formEl = document.getElementById("activateForm");
const fallbackEl = document.getElementById("activateFallback");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const passwordConfirmEl = document.getElementById("passwordConfirm");
const submitBtn = document.getElementById("activateSubmit");
const profilePhotoInput = document.getElementById("profilePhoto");
const profilePhotoPreview = document.getElementById("profilePhotoPreview");

let profilePhotoDataUrl = null;

function fileToResizedJpegDataUrl(file, maxEdge = 400, quality = 0.85) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const scale = Math.min(1, maxEdge / Math.max(w, h));
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement("canvas");
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          reject(new Error("Tu navegador no permite procesar la imagen."));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        try {
          resolve(canvas.toDataURL("image/jpeg", quality));
        } catch {
          reject(new Error("No se pudo convertir la imagen."));
        }
      };
      img.onerror = () => reject(new Error("Formato de imagen no válido."));
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  });
}

profilePhotoInput?.addEventListener("change", async () => {
  if (profilePhotoPreview) {
    profilePhotoPreview.hidden = true;
    profilePhotoPreview.innerHTML = "";
  }
  profilePhotoDataUrl = null;
  const file = profilePhotoInput.files?.[0];
  if (!file) return;
  if (file.size > 2.5 * 1024 * 1024) {
    setStatus("La imagen es demasiado grande (máx. 2,5 MB). Elige otra.", "error");
    profilePhotoInput.value = "";
    return;
  }
  try {
    let dataUrl = await fileToResizedJpegDataUrl(file, 400, 0.85);
    if (dataUrl.length > 450000) {
      dataUrl = await fileToResizedJpegDataUrl(file, 260, 0.78);
    }
    profilePhotoDataUrl = dataUrl;
    if (profilePhotoPreview) {
      profilePhotoPreview.innerHTML = `<img src="${dataUrl}" alt="" />`;
      profilePhotoPreview.hidden = false;
    }
    setStatus("", "info");
    statusEl.style.display = "none";
  } catch (e) {
    setStatus(e?.message || "No pudimos usar esa imagen.", "error");
    profilePhotoInput.value = "";
  }
});

function hideLoadingOverlay() {
  const el = document.getElementById("activateLoadingPanel");
  if (el) el.hidden = true;
}

function getActivateSnapshot() {
  const raw = globalThis.__MIREST_ACTIVATE_RAW__;
  if (raw && typeof raw.hash === "string") {
    return { hash: raw.hash, search: raw.search || "" };
  }
  return {
    hash: window.location.hash || "",
    search: window.location.search || "",
  };
}

function setStatus(message, variant = "info") {
  statusEl.textContent = message;
  statusEl.style.display = "block";
  statusEl.dataset.variant = variant;
  statusEl.classList.remove("error-banner--success", "error-banner--info", "error-banner--error");
  if (variant === "success") statusEl.classList.add("error-banner--success");
  else if (variant === "info") statusEl.classList.add("error-banner--info");
  else statusEl.classList.add("error-banner--error");
}

function showFallback() {
  fallbackEl.hidden = false;
}

/** Usa la captura hecha en activate.html antes de cargar supabase.js (el SDK borra el hash). */
function parseAuthCallbackParams() {
  const snap = getActivateSnapshot();
  const query = new URLSearchParams(snap.search || "");
  const hashRaw = snap.hash?.startsWith("#") ? snap.hash.slice(1) : (snap.hash || "");
  const hash = new URLSearchParams(hashRaw);
  const pick = (key) => hash.get(key) ?? query.get(key);

  let errorDescription = pick("error_description");
  if (errorDescription) {
    try {
      errorDescription = decodeURIComponent(String(errorDescription).replace(/\+/g, " "));
    } catch {
      // mantener
    }
  }

  return {
    error: pick("error"),
    errorCode: pick("error_code"),
    errorDescription,
    type: pick("type"),
  };
}

function snapshotHadAuthTokens() {
  const snap = getActivateSnapshot();
  const h = snap.hash || "";
  return /access_token=/.test(h) && /refresh_token=/.test(h);
}

function snapshotHadPkceCode() {
  return Boolean(new URLSearchParams(getActivateSnapshot().search || "").get("code"));
}

function isAuthFailureParams(parsed) {
  if (parsed.error) return true;
  const code = String(parsed.errorCode || "").toLowerCase();
  return code === "otp_expired" || code === "flow_state_not_found";
}

async function clearLocalAuth() {
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // ignorar
  }
  try {
    Object.keys(localStorage)
      .filter((key) => key.startsWith("sb-") && key.endsWith("-auth-token"))
      .forEach((key) => localStorage.removeItem(key));
  } catch {
    // ignorar
  }
}

function bindPasswordToggles() {
  document.querySelectorAll(".password-toggle[data-toggle]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const targetId = btn.dataset.toggle;
      const input = document.getElementById(targetId);
      if (!input) return;
      const isHidden = input.type === "password";
      input.type = isHidden ? "text" : "password";
      btn.setAttribute("aria-label", isHidden ? "Ocultar contraseña" : "Mostrar contraseña");
    });
  });
}

function waitForSession(timeoutMs = 12000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (session) => {
      if (settled) return;
      settled = true;
      try {
        subscription?.unsubscribe?.();
      } catch {
        // ignore
      }
      clearTimeout(timer);
      resolve(session);
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    const subscription = data?.subscription;

    supabase.auth.getSession().then(({ data: payload }) => {
      if (payload?.session) finish(payload.session);
    }).catch(() => {});

    const timer = setTimeout(() => finish(null), timeoutMs);
  });
}

async function pollForSession(maxMs = 2500, stepMs = 80) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const { data: payload } = await supabase.auth.getSession();
    if (payload?.session?.user) return payload.session;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  return null;
}

async function bootstrap() {
  try {
    document.body.classList.add("page-ready");
    bindPasswordToggles();
    if (window.lucide) window.lucide.createIcons();

    const parsed = parseAuthCallbackParams();

    if (isAuthFailureParams(parsed)) {
      await clearLocalAuth();
      const desc = (parsed.errorDescription || "").toLowerCase();
      const expired =
        String(parsed.errorCode || "").toLowerCase() === "otp_expired" ||
        desc.includes("expired") ||
        desc.includes("invalid");
      const msg = expired
        ? "El enlace de activación caducó o ya se usó. Pide al administrador que reenvíe la invitación desde «Accesos». Si tu cuenta ya existe, usa «Olvidé mi contraseña» en el inicio de sesión."
        : parsed.errorDescription || "El enlace de activación no es válido. Solicita un nuevo enlace al administrador.";
      setStatus(msg, "error");
      showFallback();
      hideLoadingOverlay();
      window.history.replaceState({}, document.title, window.location.pathname);
      return;
    }

    const snapCode = new URLSearchParams(getActivateSnapshot().search || "").get("code");
    if (snapCode) {
      setStatus("Validando enlace de activación…", "info");
      let exchErr = (await supabase.auth.exchangeCodeForSession(snapCode)).error;
      if (exchErr) {
        await new Promise((r) => setTimeout(r, 400));
        exchErr = (await supabase.auth.exchangeCodeForSession(snapCode)).error;
      }
      if (exchErr) {
        const baseMsg = exchErr.message || "No pudimos validar el enlace.";
        const isPkceHint =
          /pkce|code verifier|flow_state|expired/i.test(String(exchErr.message || "")) ||
          String(exchErr.message || "").toLowerCase().includes("invalid");
        setStatus(
          `${baseMsg}${
            isPkceHint
              ? " Si el enlace llevaba ?code= (PKCE), caduca en pocos minutos: pide reenvío y ábrelo enseguida. En Supabase → Authentication → Providers → Email sube «Mailer OTP expiration» (p. ej. 86400 s) y revisa la plantilla «Invite user» ({{ .ConfirmationURL }} = flujo con más margen que un code corto)."
              : " Pide al administrador que reenvíe la invitación desde Accesos y abre el enlace en este dispositivo."
          }`,
          "error",
        );
        showFallback();
        hideLoadingOverlay();
        window.history.replaceState({}, document.title, window.location.pathname);
        return;
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }

    let session = (await supabase.auth.getSession()).data?.session ?? null;

    if (!session?.user && snapshotHadAuthTokens()) {
      setStatus("Preparando formulario…", "info");
      session = await pollForSession(3000, 80);
    }

    if (!session?.user) {
      session = await waitForSession(12000);
    }

    if (!session?.user) {
      const hadAnyLinkHint = snapshotHadPkceCode() || snapshotHadAuthTokens();
      if (!hadAnyLinkHint) {
        setStatus(
          "Para definir tu contraseña abre esta página con el botón del correo de invitación (no basta con entrar aquí sin el enlace). Si ya configuraste la cuenta, ve al inicio de sesión.",
          "info",
        );
      } else {
        setStatus(
          "No pudimos recuperar la sesión del enlace. Cierra otras pestañas de MiRest, vuelve a abrir el enlace del correo o pide un reenvío al administrador.",
          "error",
        );
      }
      showFallback();
      hideLoadingOverlay();
      return;
    }

    emailEl.value = session.user.email ?? "";
    formEl.hidden = false;
    document.getElementById("activateExpiryHint")?.setAttribute("hidden", "true");
    hideLoadingOverlay();

    const label = parsed.type === "recovery" ? "Restablece tu contraseña" : "Activa tu cuenta";
    const titleEl = document.getElementById("activateTitle");
    if (titleEl) titleEl.textContent = label;

    setStatus("", "info");
    statusEl.style.display = "none";

    window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  } catch (err) {
    console.error("[activate]", err);
    setStatus("Ocurrió un error al cargar la activación. Recarga la página o abre el enlace del correo de nuevo.", "error");
    showFallback();
    hideLoadingOverlay();
  }
}

formEl.addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = passwordEl.value.trim();
  const confirm = passwordConfirmEl.value.trim();

  if (password.length < 8) {
    setStatus("La contraseña debe tener al menos 8 caracteres.", "error");
    return;
  }

  if (password !== confirm) {
    setStatus("Las contraseñas no coinciden. Revisa e inténtalo de nuevo.", "error");
    return;
  }

  submitBtn.disabled = true;
  setStatus("Guardando tu contraseña...", "info");

  const { data: userPayload } = await supabase.auth.getUser();
  const mergedMeta = { ...(userPayload?.user?.user_metadata || {}) };
  if (profilePhotoDataUrl) {
    mergedMeta.avatar_url = profilePhotoDataUrl;
  }

  const { error: updateError } = await supabase.auth.updateUser({
    password,
    data: mergedMeta,
  });

  if (updateError) {
    setStatus(updateError.message || "No pudimos guardar tu contraseña. Vuelve a intentarlo.", "error");
    submitBtn.disabled = false;
    return;
  }

  setStatus("¡Listo! Te llevamos al inicio de sesión para que entres con tu correo y contraseña.", "success");

  const mail = emailEl.value.trim();
  try {
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // seguimos
  }

  const next = new URLSearchParams({ activado: "1" });
  if (mail) next.set("email", mail);

  window.setTimeout(() => {
    window.location.href = `./login.html?${next.toString()}`;
  }, 900);
});

bootstrap();
