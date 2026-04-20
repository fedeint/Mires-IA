import { supabase } from "./supabase.js";

const statusEl = document.getElementById("activateStatus");
const formEl = document.getElementById("activateForm");
const fallbackEl = document.getElementById("activateFallback");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const passwordConfirmEl = document.getElementById("passwordConfirm");
const submitBtn = document.getElementById("activateSubmit");

function setStatus(message, variant = "info") {
  statusEl.textContent = message;
  statusEl.style.display = "block";
  statusEl.dataset.variant = variant;
  statusEl.classList.toggle("error-banner--success", variant === "success");
}

function showFallback() {
  fallbackEl.hidden = false;
}

function parseHashParams() {
  const hash = window.location.hash?.startsWith("#") ? window.location.hash.slice(1) : "";
  const params = new URLSearchParams(hash);
  return {
    accessToken: params.get("access_token"),
    refreshToken: params.get("refresh_token"),
    type: params.get("type"),
    error: params.get("error"),
    errorDescription: params.get("error_description"),
  };
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

async function bootstrap() {
  bindPasswordToggles();
  if (window.lucide) window.lucide.createIcons();

  const { accessToken, refreshToken, type, error, errorDescription } = parseHashParams();

  if (error) {
    setStatus(errorDescription || "El enlace de activación no es válido o expiró.", "error");
    showFallback();
    return;
  }

  if (!accessToken || !refreshToken) {
    setStatus(
      "No detectamos un enlace de activación válido. Revisa el correo que recibiste y vuelve a abrir el enlace.",
      "error",
    );
    showFallback();
    return;
  }

  const { data, error: sessionError } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });

  if (sessionError || !data?.user) {
    setStatus(sessionError?.message || "No pudimos validar tu enlace de activación.", "error");
    showFallback();
    return;
  }

  emailEl.value = data.user.email ?? "";
  formEl.hidden = false;

  const label = type === "recovery" ? "Restablece tu contraseña" : "Activa tu cuenta";
  document.getElementById("activateTitle").textContent = label;

  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
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

  const { error: updateError } = await supabase.auth.updateUser({ password });

  if (updateError) {
    setStatus(updateError.message || "No pudimos guardar tu contraseña. Vuelve a intentarlo.", "error");
    submitBtn.disabled = false;
    return;
  }

  setStatus("¡Listo! Redirigiendo al panel...", "success");

  window.setTimeout(() => {
    window.location.href = "./index.html";
  }, 900);
});

bootstrap();
