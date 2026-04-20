// Shared Resend helper used by Supabase Edge Functions.
// Uses fetch against Resend's REST API — no SDK import needed, works on Deno.
// Configure via env secrets:
//   RESEND_API_KEY        (required)
//   RESEND_FROM_EMAIL     (optional, defaults to "onboarding@resend.dev")
//   RESEND_FROM_NAME      (optional, defaults to "MiRest con IA")

const RESEND_ENDPOINT = "https://api.resend.com/emails";

export async function sendEmail({ to, subject, html, text, replyTo, from } = {}) {
  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) {
    throw new Error("RESEND_API_KEY no está configurada en las Edge Functions.");
  }

  if (!to || !subject || (!html && !text)) {
    throw new Error("sendEmail requiere 'to', 'subject' y 'html' o 'text'.");
  }

  const fromEmail = Deno.env.get("RESEND_FROM_EMAIL") || "onboarding@resend.dev";
  const fromName = Deno.env.get("RESEND_FROM_NAME") || "MiRest con IA";
  const sender = from || `${fromName} <${fromEmail}>`;

  const payload = {
    from: sender,
    to: Array.isArray(to) ? to : [to],
    subject,
  };

  if (html) payload.html = html;
  if (text) payload.text = text;
  if (replyTo) payload.reply_to = replyTo;

  const response = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = body?.message || body?.error || `Resend respondió ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.resendBody = body;
    throw err;
  }

  return body;
}
