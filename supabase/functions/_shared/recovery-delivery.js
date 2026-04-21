/**
 * Recuperación de contraseña solo vía Supabase Auth (SMTP / plantillas del panel).
 * No usa Resend: el enlace lo envía GoTrue con la configuración de Authentication → Emails.
 */

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

/**
 * POST /auth/v1/recover (mismo flujo que resetPasswordForEmail en el cliente).
 * redirect_to va en query string, igual que auth-js.
 */
export async function deliverPasswordRecoveryViaSupabaseAuth(supabaseUrl, anonKey, rawEmail) {
  const email = rawEmail.trim().toLowerCase();
  const redirectTo = getActivateRedirectUrl();
  const base = supabaseUrl.replace(/\/$/, "");
  const url = new URL(`${base}/auth/v1/recover`);
  url.searchParams.set("redirect_to", redirectTo);

  const res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email }),
  });

  const bodyText = await res.text();
  if (!res.ok) {
    console.warn("[recovery-delivery] /recover", res.status, bodyText);
    return { sent: false, reason: "recover_failed", detail: bodyText };
  }

  return { sent: true };
}
