import { Resend } from "npm:resend@4.0.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

// Clave de API de Resend.
// IMPORTANTE: reemplaza `re_xxxxxxxxx` con tu API key real definiendo la variable
// de entorno RESEND_API_KEY en Supabase (supabase secrets set RESEND_API_KEY=...).
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "re_xxxxxxxxx";

const resend = new Resend(RESEND_API_KEY);

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse({ message: "Método no permitido" }, 405);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const to = body?.to ?? "anthonyreyes12.06.25.dignitatec@gmail.com";
  const subject = body?.subject ?? "Hello World";
  const html = body?.html ?? "<p>Congrats on sending your <strong>first email</strong>!</p>";
  const from = body?.from ?? "onboarding@resend.dev";

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      html,
    });

    if (error) {
      return jsonResponse({ message: error.message ?? "Error al enviar el correo", error }, 400);
    }

    return jsonResponse({ message: "Correo enviado", data });
  } catch (err) {
    return jsonResponse(
      { message: "Error inesperado al enviar el correo", detail: err?.message ?? String(err) },
      500,
    );
  }
});
