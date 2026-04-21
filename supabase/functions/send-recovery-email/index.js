// Público: dispara el correo de recuperación usando solo Supabase Auth (sin Resend).
// Requiere SUPABASE_ANON_KEY + SUPABASE_URL. verify_jwt = false si llamas desde el navegador con anon.

import { deliverPasswordRecoveryViaSupabaseAuth } from "../_shared/recovery-delivery.js";

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
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");

  if (!supabaseUrl || !supabaseAnonKey) {
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

  const { sent, reason, detail } = await deliverPasswordRecoveryViaSupabaseAuth(
    supabaseUrl,
    supabaseAnonKey,
    rawEmail,
  );

  if (!sent && reason === "recover_failed") {
    console.error("[send-recovery-email]", detail);
    return jsonResponse(
      {
        message:
          "No se pudo solicitar el correo de recuperación. Revisa SMTP y plantillas en Supabase (Authentication → Emails).",
      },
      502,
    );
  }

  return jsonResponse({
    message:
      "Si el correo está registrado, Supabase enviará el enlace de recuperación. Revisa spam, Promociones (Gmail) y que el SMTP del proyecto esté activo.",
  });
});
