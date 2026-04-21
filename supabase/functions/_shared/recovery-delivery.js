import { buildRecoveryEmail } from "./email-templates.js";
import { sendPasswordResetBrandedEmail } from "./mailer.js";

const DEFAULT_ORIGIN = "https://mires-ia.vercel.app";

export function getAppBaseOrigin() {
  const configured =
    Deno.env.get("RECOVERY_REDIRECT_ORIGIN")?.trim() ||
    Deno.env.get("ACTIVATION_REDIRECT_ORIGIN")?.trim() ||
    DEFAULT_ORIGIN;
  return configured.replace(/\/$/, "");
}

export function getActivateRedirectUrl() {
  return `${getAppBaseOrigin()}/activate.html`;
}

export function getRecoveryHelpPageUrl() {
  return `${getAppBaseOrigin()}/recuperar-contrasena.html`;
}

/**
 * Genera el enlace de recuperación en Auth y envía el correo con plantilla MiRest (Resend).
 * Si el correo no existe en Auth, no envía nada (sin filtrar enumeración al llamador público).
 */
export async function deliverPasswordRecoveryBrandedEmail(adminClient, rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  const redirectTo = getActivateRedirectUrl();
  const helpPageUrl = getRecoveryHelpPageUrl();

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.warn("[recovery-delivery] generateLink:", linkError?.message);
    return { sent: false, reason: "no_link" };
  }

  const recoveryUrl = linkData.properties.action_link;
  const fullName =
    typeof linkData?.user?.user_metadata?.full_name === "string"
      ? linkData.user.user_metadata.full_name
      : null;

  const { subject, html, text } = buildRecoveryEmail({
    fullName,
    recoveryUrl,
    helpPageUrl,
  });

  const result = await sendPasswordResetBrandedEmail({
    to: email,
    subject,
    html,
    text,
  });

  if (!result.ok) {
    const msg = result.error?.message || "Error al enviar correo";
    const err = new Error(msg);
    err.mailError = result.error;
    throw err;
  }

  return { sent: true };
}
