import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
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
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = request.headers.get("Authorization");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ message: "Configuración incompleta de Supabase" }, 500);
  }

  if (!authHeader) {
    return jsonResponse({ message: "Falta encabezado de autorización" }, 401);
  }

  const sessionClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: authHeader },
    },
  });

  const {
    data: { user },
    error: sessionError,
  } = await sessionClient.auth.getUser();

  if (sessionError || !user) {
    return jsonResponse({ message: "Sesión inválida o expirada" }, 401);
  }

  const { requestId, role, action = "approve" } = await request.json();
  if (!requestId || !role) {
    return jsonResponse({ message: "Faltan requestId o role" }, 400);
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: accessRequest, error: requestError } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !accessRequest) {
    return jsonResponse({ message: "No se encontró la solicitud de acceso" }, 404);
  }

  if (action !== "approve" && action !== "resend") {
    return jsonResponse({ message: "Acción no permitida" }, 400);
  }

  if (action === "approve" && accessRequest.status === "approved") {
    return jsonResponse({ message: "La solicitud ya fue aprobada. Usa reenvío si necesitas reenviar la activación." }, 409);
  }

  const { error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(accessRequest.email, {
    data: {
      role,
      full_name: accessRequest.full_name,
      access_request_id: accessRequest.id,
    },
  });

  if (inviteError) {
    return jsonResponse({ message: inviteError.message }, 400);
  }

  const now = new Date().toISOString();
  const { error: updateError } = await adminClient
    .from("access_requests")
    .update({
      status: "approved",
      approved_role: role,
      approved_at: accessRequest.approved_at || now,
      invite_sent_at: now,
      approved_by: user.id,
      rejected_at: null,
    })
    .eq("id", requestId);

  if (updateError) {
    return jsonResponse({ message: updateError.message }, 500);
  }

  return jsonResponse({
    message:
      action === "resend"
        ? `Activación reenviada a ${accessRequest.email}.`
        : `Solicitud aprobada e invitación enviada a ${accessRequest.email}.`,
  });
});
