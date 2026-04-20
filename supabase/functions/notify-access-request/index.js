import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendRequestReceivedToAdmin,
  sendRequestReceivedToApplicant,
  sendRequestReviewingToApplicant,
  sendRequestRejectedToApplicant,
} from "../_shared/mailer.js";

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

// Tipos de notificación permitidos y qué actor puede dispararlos.
// `created` es público (lo dispara el propio solicitante tras el insert).
// `reviewing` y `rejected` requieren sesión de superadmin.
const PUBLIC_TYPES = new Set(["created"]);
const SUPERADMIN_TYPES = new Set(["reviewing", "rejected"]);

function isSuperadmin(user) {
  const role = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : undefined;
  return role === "superadmin";
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
  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    return jsonResponse({ message: "Configuración incompleta de Supabase" }, 500);
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Cuerpo JSON inválido" }, 400);
  }

  const type = body?.type;
  const requestId = body?.requestId;

  if (!type || (!PUBLIC_TYPES.has(type) && !SUPERADMIN_TYPES.has(type))) {
    return jsonResponse({ message: "Tipo de notificación no soportado" }, 400);
  }
  if (!requestId) {
    return jsonResponse({ message: "Falta requestId" }, 400);
  }

  if (SUPERADMIN_TYPES.has(type)) {
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ message: "Falta encabezado de autorización" }, 401);
    }
    const sessionClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: sessionError } = await sessionClient.auth.getUser();
    if (sessionError || !userData?.user) {
      return jsonResponse({ message: "Sesión inválida" }, 401);
    }
    if (!isSuperadmin(userData.user)) {
      return jsonResponse({ message: "Solo superadmin puede notificar este evento." }, 403);
    }
  }

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: accessRequest, error } = await adminClient
    .from("access_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (error || !accessRequest) {
    return jsonResponse({ message: "No se encontró la solicitud" }, 404);
  }

  const results = {};

  if (type === "created") {
    const [applicantResult, adminResult] = await Promise.all([
      sendRequestReceivedToApplicant(accessRequest),
      sendRequestReceivedToAdmin(accessRequest),
    ]);
    results.applicant = applicantResult;
    results.admin = adminResult;
  } else if (type === "reviewing") {
    results.applicant = await sendRequestReviewingToApplicant(accessRequest);
  } else if (type === "rejected") {
    results.applicant = await sendRequestRejectedToApplicant(accessRequest);
  }

  const anyFailed = Object.values(results).some((r) => r && r.ok === false);

  return jsonResponse(
    {
      message: anyFailed ? "Notificación enviada con errores parciales" : "Notificación enviada",
      results,
    },
    anyFailed ? 207 : 200,
  );
});
