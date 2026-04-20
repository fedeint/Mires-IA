// Public Edge Function: genera un enlace de recuperación en Supabase y lo envía
// con branding propio usando Resend. No requiere autenticación del cliente.
// Configura verify_jwt = false en supabase/config.toml para permitir llamadas desde el login.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.js";
import { buildRecoveryEmail } from "../_shared/email-templates.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Método no permitido" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return jsonResponse({ message: "Configuración incompleta de Supabase" }, 500);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Cuerpo JSON inválido" }, 400);
  }

  const rawEmail = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!rawEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(rawEmail)) {
    return jsonResponse({ message: "Correo inválido" }, 400);
  }

  const DEFAULT_REDIRECT_ORIGIN = "https://mires-ia.vercel.app";
  const configuredRecovery = Deno.env.get("RECOVERY_REDIRECT_ORIGIN")?.trim();
  const configuredActivation = Deno.env.get("ACTIVATION_REDIRECT_ORIGIN")?.trim();
  const safeOrigin = configuredRecovery || configuredActivation || DEFAULT_REDIRECT_ORIGIN;
  const redirectTo = `${safeOrigin.replace(/\/$/, "")}/activate.html`;

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Importante: siempre respondemos con éxito genérico para no filtrar si el correo
  // existe o no en la base (mitigación de user-enumeration).
  const successResponse = jsonResponse({
    message: "Si el correo existe, enviaremos un enlace de recuperación.",
  });

  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: rawEmail,
    options: { redirectTo },
  });

  if (linkError || !linkData?.properties?.action_link) {
    // No revelamos el motivo al cliente, pero lo registramos para debugging.
    console.warn("[send-recovery-email] No se pudo generar enlace:", linkError?.message);
    return successResponse;
  }

  const recoveryUrl = linkData.properties.action_link;
  const fullName = linkData?.user?.user_metadata?.full_name || null;

  const { subject, html, text } = buildRecoveryEmail({
    fullName,
    recoveryUrl,
  });

  try {
    await sendEmail({ to: rawEmail, subject, html, text });
  } catch (emailError) {
    console.error("[send-recovery-email] Resend falló:", emailError?.message, emailError?.resendBody);
    return jsonResponse(
      {
        message: "No pudimos enviar el correo de recuperación. Inténtalo en unos minutos.",
      },
      502,
    );
  }

  return successResponse;
});
