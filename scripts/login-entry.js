import { supabase } from "./supabase.js?v=20260423-recovery-hybrid";
import { requestPasswordRecoveryEmail } from "./password-recovery-client.js?v=20260424-no-resend-recovery";
import { submitAccessRequest } from "./access-requests.js?v=20260420-rls401fix";
import { initializeThemeToggle } from "./navigation.js?v=20260420-resend1";
import { hydrateAuthIconPlaceholders, ICON, ICON_SPINNER } from "./auth-inline-icons.js?v=20260421-auth-icons";
import { initCookieConsentBar } from "./cookie-consent.js?v=20260421-cookies";

hydrateAuthIconPlaceholders();
initCookieConsentBar();

document.addEventListener("DOMContentLoaded", async () => {
  document.body.classList.add("page-ready");

  initializeThemeToggle(document.getElementById("themeToggle"));

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("activado") === "1") {
    const postBanner = document.getElementById("postActivateBanner");
    const emailInput = document.getElementById("email");
    if (postBanner) {
      postBanner.textContent = "Listo. Entra con tu correo y la contraseña que acabas de elegir.";
      postBanner.className = "error-banner error-banner--success";
      postBanner.style.display = "block";
    }
    const preEmail = urlParams.get("email");
    if (preEmail && emailInput) {
      try {
        emailInput.value = decodeURIComponent(preEmail);
      } catch {
        emailInput.value = preEmail;
      }
    }
    emailInput?.focus();
    window.history.replaceState({}, document.title, window.location.pathname);
  } else if (urlParams.get("activacion") === "solo-correo") {
    const postBanner = document.getElementById("postActivateBanner");
    if (postBanner) {
      postBanner.textContent =
        "Para activar la cuenta debes usar el enlace del correo que te enviaron. Si ya tienes contraseña, inicia sesión con tu correo.";
      postBanner.className = "error-banner error-banner--info";
      postBanner.style.display = "block";
    }
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (session) {
    window.location.replace("/mirest/src/apps/web/index.html");
    return;
  }

  const form = document.getElementById("loginForm");
  const submitBtn = document.getElementById("submitBtn");
  const errorMsg = document.getElementById("errorMessage");
  const passwordInput = document.getElementById("password");
  const passwordToggle = document.getElementById("passwordToggle");
  const requestModal = document.getElementById("requestModal");
  const requestForm = document.getElementById("requestAccessForm");
  const requestMessage = document.getElementById("requestMessage");
  const requestSubmitBtn = document.getElementById("requestSubmitBtn");
  const openRequestModalBtn = document.getElementById("openRequestModal");
  const requestCityInput = document.getElementById("request_city");
  const requestCountryInput = document.getElementById("request_country");
  const requestPhoneInput = document.getElementById("request_phone");
  const sanitizeRequestPhone = () => {
    if (!requestPhoneInput) return;
    requestPhoneInput.value = requestPhoneInput.value.replace(/\D/g, "").slice(0, 15);
  };
  requestPhoneInput?.addEventListener("input", sanitizeRequestPhone);
  requestPhoneInput?.addEventListener("paste", () => {
    window.setTimeout(sanitizeRequestPhone, 0);
  });
  const requestSteps = Array.from(document.querySelectorAll(".request-form__step"));
  const requestStepIndicators = Array.from(document.querySelectorAll("[data-step-indicator]"));
  const requestPrevBtn = document.getElementById("requestPrevBtn");
  const requestNextBtn = document.getElementById("requestNextBtn");
  const recoveryModal = document.getElementById("recoveryModal");
  const recoveryForm = document.getElementById("recoveryForm");
  const recoveryMessage = document.getElementById("recoveryMessage");
  const recoverySubmitBtn = document.getElementById("recoverySubmitBtn");
  const openRecoveryModalBtn = document.getElementById("openRecoveryModal");
  const recoveryEmailInput = document.getElementById("recovery_email");
  let currentRequestStep = 0;

  const setRequestStep = (nextStep) => {
    currentRequestStep = nextStep;
    requestSteps.forEach((step, index) => {
      const isActive = index === currentRequestStep;
      step.hidden = !isActive;
      step.classList.toggle("request-form__step--active", isActive);
    });

    requestStepIndicators.forEach((indicator, index) => {
      indicator.classList.toggle("request-progress__item--active", index === currentRequestStep);
      indicator.classList.toggle("request-progress__item--complete", index < currentRequestStep);
    });

    requestPrevBtn.hidden = currentRequestStep === 0;
    requestNextBtn.hidden = currentRequestStep === requestSteps.length - 1;
    requestSubmitBtn.hidden = currentRequestStep !== requestSteps.length - 1;
  };

  const validateCurrentRequestStep = () => {
    const activeStep = requestSteps[currentRequestStep];
    if (!activeStep) return true;

    const fields = Array.from(activeStep.querySelectorAll("input, textarea"));
    for (const field of fields) {
      if (!field.checkValidity()) {
        field.reportValidity();
        return false;
      }
    }
    return true;
  };

  const openRequestModal = () => {
    currentRequestStep = 0;
    setRequestStep(0);
    requestMessage.style.display = "none";
    requestModal.classList.add("request-modal--open");
    requestModal.removeAttribute("inert");
    window.requestAnimationFrame(() => {
      document.getElementById("request_full_name")?.focus({ preventScroll: true });
    });
  };

  const closeRequestModal = () => {
    if (requestModal?.contains(document.activeElement)) {
      openRequestModalBtn?.focus({ preventScroll: true });
    }
    requestModal?.classList.remove("request-modal--open");
    requestModal?.setAttribute("inert", "");
  };

  const openRecoveryModal = () => {
    recoveryMessage.style.display = "none";
    recoveryEmailInput.value = document.getElementById("email").value || "";
    recoveryModal.classList.add("request-modal--open");
    recoveryModal.removeAttribute("inert");
    window.requestAnimationFrame(() => {
      recoveryEmailInput?.focus({ preventScroll: true });
    });
  };

  const closeRecoveryModal = () => {
    if (recoveryModal?.contains(document.activeElement)) {
      openRecoveryModalBtn?.focus({ preventScroll: true });
    }
    recoveryModal?.classList.remove("request-modal--open");
    recoveryModal?.setAttribute("inert", "");
  };

  openRequestModalBtn?.addEventListener("click", openRequestModal);
  openRecoveryModalBtn?.addEventListener("click", openRecoveryModal);
  requestPrevBtn?.addEventListener("click", () => {
    setRequestStep(Math.max(0, currentRequestStep - 1));
  });
  requestNextBtn?.addEventListener("click", () => {
    if (!validateCurrentRequestStep()) return;
    setRequestStep(Math.min(requestSteps.length - 1, currentRequestStep + 1));
  });
  requestModal?.querySelectorAll("[data-close-request-modal]").forEach((button) => {
    button.addEventListener("click", closeRequestModal);
  });
  recoveryModal?.querySelectorAll("[data-close-recovery-modal]").forEach((button) => {
    button.addEventListener("click", closeRecoveryModal);
  });

  requestModal?.addEventListener("click", (event) => {
    if (event.target === requestModal) {
      closeRequestModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && requestModal?.classList.contains("request-modal--open")) {
      closeRequestModal();
    }
    if (event.key === "Escape" && recoveryModal?.classList.contains("request-modal--open")) {
      closeRecoveryModal();
    }
  });

  passwordToggle?.addEventListener("click", () => {
    const showPassword = passwordInput.type === "password";
    passwordInput.type = showPassword ? "text" : "password";
    passwordToggle.setAttribute("aria-label", showPassword ? "Ocultar contraseña" : "Mostrar contraseña");
    passwordToggle.innerHTML = showPassword ? ICON["eye-off"] : ICON.eye;
  });

  requestForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateCurrentRequestStep()) return;

    requestSubmitBtn.disabled = true;
    requestSubmitBtn.innerHTML = `${ICON_SPINNER} Enviando...`;
    requestMessage.style.display = "none";

    const { error } = await submitAccessRequest({
      fullName: document.getElementById("request_full_name").value,
      email: document.getElementById("request_email").value,
      restaurantName: document.getElementById("request_restaurant_name").value,
      businessCount: document.getElementById("request_business_count").value,
      phone: document.getElementById("request_phone").value,
      city: requestCityInput.value,
      country: requestCountryInput.value,
      applicantRole: document.getElementById("request_applicant_role").value,
      legalOwnerName: document.getElementById("request_legal_owner_name").value,
      notes: document.getElementById("request_notes").value,
      source: "login",
    });

    if (error) {
      requestMessage.textContent =
        "No pudimos registrar tu solicitud ahora mismo. Verifica los datos e intenta nuevamente.";
      requestMessage.className = "request-banner request-banner--error";
      requestMessage.style.display = "block";
      requestSubmitBtn.disabled = false;
      requestSubmitBtn.innerHTML = `${ICON.send} Enviar solicitud`;
      return;
    }

    requestForm.reset();
    setRequestStep(0);
    requestMessage.textContent =
      "Solicitud enviada. Nuestro equipo revisará tu información y te contactará por correo.";
    requestMessage.className = "request-banner request-banner--success";
    requestMessage.style.display = "block";
    requestSubmitBtn.disabled = false;
    requestSubmitBtn.innerHTML = `${ICON.send} Enviar solicitud`;

    window.setTimeout(() => {
      closeRequestModal();
    }, 1200);
  });

  recoveryForm?.addEventListener("submit", async (event) => {
    event.preventDefault();

    recoverySubmitBtn.disabled = true;
    recoverySubmitBtn.innerHTML = `${ICON_SPINNER} Enviando...`;
    recoveryMessage.style.display = "none";

    const email = recoveryEmailInput.value.trim().toLowerCase();

    try {
      const { message } = await requestPasswordRecoveryEmail(email);
      recoveryMessage.textContent = message;
      recoveryMessage.className = "request-banner request-banner--success";
      recoveryMessage.style.display = "block";
    } catch (err) {
      console.error("[recovery]", err);
      recoveryMessage.textContent =
        err?.message ||
        "No se pudo enviar el enlace. Inténtalo de nuevo en unos minutos.";
      recoveryMessage.className = "request-banner request-banner--error";
      recoveryMessage.style.display = "block";
    } finally {
      recoverySubmitBtn.disabled = false;
      recoverySubmitBtn.innerHTML = `${ICON.send} Enviar enlace`;
    }
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = document.getElementById("email").value.trim().toLowerCase();
    const password = document.getElementById("password").value;

    submitBtn.disabled = true;
    submitBtn.innerHTML = `${ICON_SPINNER} Verificando...`;
    errorMsg.style.display = "none";

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("[Login] Error de autenticación:", error.message);
      submitBtn.disabled = false;
      submitBtn.innerHTML = `${ICON["log-in"]} Ingresar al Sistema`;
      errorMsg.textContent =
        "Correo o contraseña incorrectos. Puedes usar «Olvidé mi contraseña» o pedir a tu local un nuevo enlace de acceso.";
      errorMsg.style.display = "block";
    } else {
      submitBtn.innerHTML = `${ICON.check} ¡Bienvenido!`;
      setTimeout(() => {
        window.location.replace("/mirest/src/apps/web/index.html");
      }, 300);
    }
  });
});
