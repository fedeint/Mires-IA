// Public Edge Function: genera enlace recovery en Supabase Auth y envía correo con plantilla MiRest (Resend).
// Configura verify_jwt = false si llamas desde login / recuperar-contrasena con anon key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { deliverPasswordRecoveryBrandedEmail } from "../_shared/recovery-delivery.js";

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

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const genericOk = jsonResponse({
    message:
      "Si el correo está registrado en MiRest, enviamos un enlace para definir una nueva contraseña. Revisa también spam.",
  });

  try {
    const { sent, reason } = await deliverPasswordRecoveryBrandedEmail(adminClient, rawEmail);
    if (!sent && reason === "no_link") {
      return genericOk;
    }
  } catch (err) {
    console.error("[send-recovery-email]", err?.message, err?.mailError);
    return jsonResponse(
      {
        message:
          "No pudimos enviar el correo ahora. Revisa que Resend esté configurado (RESEND_API_KEY) o inténtalo en unos minutos.",
      },
      502,
    );
  }

  return genericOk;
});
