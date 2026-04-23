import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { isSuperadmin } from "../_shared/auth-roles.js";
import {
  isAlreadyRegisteredError,
  isSupabaseMailerFailure,
  isUserConfirmed,
} from "../_shared/invite-errors.js";

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

// Busca un usuario existente en auth.users por email. Supabase no expone un
// endpoint directo `getUserByEmail`, así que paginamos listUsers. Para el
// tamaño esperado de esta base es suficiente y evita usar SQL crudo.
async function findAuthUserByEmail(adminClient, email) {
  if (!email) return null;
  const target = email.trim().toLowerCase();
  const perPage = 200;
  let page = 1;
  while (page <= 50) {
    const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(error.message);
    const users = data?.users ?? [];
    const match = users.find((u) => (u.email || "").toLowerCase() === target);
    if (match) return match;
    if (users.length < perPage) return null;
    page += 1;
  }
  return null;
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

  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
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
    return jsonResponse(
      { message: "Sesión inválida o expirada", detail: sessionError?.message ?? null },
      401,
    );
  }

  if (!isSuperadmin(user)) {
    return jsonResponse(
      { message: "Solo el superadmin puede aprobar o reenviar activaciones." },
      403,
    );
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Cuerpo JSON inválido" }, 400);
  }

  const requestId = body?.requestId;
  const role = body?.role;
  const action = body?.action ?? "approve";
  const permissions = Array.isArray(body?.permissions)
    ? body.permissions
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0)
    : [];

  if (!requestId || !role) {
    return jsonResponse({ message: "Faltan requestId o role" }, 400);
  }

  if (action !== "approve" && action !== "resend") {
    return jsonResponse({ message: "Acción no permitida" }, 400);
  }

  const DEFAULT_REDIRECT_ORIGIN = "https://mires-ia.vercel.app";
  const configuredOrigin = Deno.env.get("ACTIVATION_REDIRECT_ORIGIN")?.trim();
  const safeOrigin = configuredOrigin || DEFAULT_REDIRECT_ORIGIN;
  const redirectTo = `${safeOrigin.replace(/\/$/, "")}/activate.html`;

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

  if (action === "approve" && accessRequest.status === "approved") {
    return jsonResponse(
      { message: "La solicitud ya fue aprobada. Usa reenvío si necesitas reenviar la activación." },
      409,
    );
  }

  const inviteMetadata = {
    role,
    full_name: accessRequest.full_name,
    access_request_id: accessRequest.id,
  };
  if (permissions.length > 0) {
    inviteMetadata.permissions = permissions;
  }

  // Estrategia (usa el SMTP configurado en Supabase Auth → Settings → SMTP,
  // actualmente Gmail). Supabase se encarga de enviar el correo branded usando
  // la plantilla "Invite user" del dashboard.
  //
  //   1. Si existe un usuario en auth.users: bloquear si ya está confirmado,
  //      o borrarlo si era una invitación previa sin activar, para reciclar.
  //   2. Llamar a admin.inviteUserByEmail(email, { data, redirectTo }).
  //      Esto crea el usuario en estado "invited" y dispara el email.
  //
  // El link de invitación redirige a /activate.html con #access_token y
  // #refresh_token en el hash. Ese flujo ya está soportado por activate.js.

  let existingUser = null;
  try {
    existingUser = await findAuthUserByEmail(adminClient, accessRequest.email);
  } catch (lookupError) {
    return jsonResponse(
      { message: "No pudimos verificar al usuario existente.", detail: lookupError?.message ?? null },
      500,
    );
  }

  if (existingUser && isUserConfirmed(existingUser)) {
    return jsonResponse(
      {
        message: `El correo ${accessRequest.email} ya tiene una cuenta activa. Edita sus módulos desde "Usuarios con acceso" en lugar de reinvitarlo.`,
      },
      409,
    );
  }

  if (existingUser) {
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(existingUser.id);
    if (deleteError) {
      return jsonResponse(
        {
          message: "Había una invitación previa sin activar y no pudimos reciclarla automáticamente.",
          detail: deleteError.message,
        },
        500,
      );
    }
  }

  console.log(
    "[approve-access-request] inviting user",
    JSON.stringify({ email: accessRequest.email, redirectTo }),
  );

  const { data: inviteData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    accessRequest.email,
    {
      data: inviteMetadata,
      redirectTo,
    },
  );

  let invitedUser = inviteData?.user ?? null;
  /** Solo si MIREST_DEV_INVITE_LINK_IN_RESPONSE=1: enlace en JSON para pruebas locales sin SMTP. */
  let devActivationUrl = null;

  if (inviteError) {
    console.error(
      "[approve-access-request] invite FAILED",
      JSON.stringify({
        email: accessRequest.email,
        status: inviteError.status ?? null,
        message: inviteError.message ?? null,
      }),
    );
    if (isAlreadyRegisteredError(inviteError)) {
      return jsonResponse(
        {
          message: `El correo ${accessRequest.email} ya estaba registrado en Auth. Revisa "Usuarios con acceso" o elimínalo desde Supabase y vuelve a aprobar.`,
        },
        409,
      );
    }

    const devReturnLink = Deno.env.get("MIREST_DEV_INVITE_LINK_IN_RESPONSE") === "1";
    if (devReturnLink && isSupabaseMailerFailure(inviteError)) {
      const { data: gen, error: genErr } = await adminClient.auth.admin.generateLink({
        type: "invite",
        email: accessRequest.email,
        options: {
          data: inviteMetadata,
          redirectTo,
        },
      });
      const actionLink = gen?.properties?.action_link;
      if (genErr || !actionLink || typeof actionLink !== "string") {
        return jsonResponse(
          {
            message: "SMTP de Auth falló; en modo dev, generateLink tampoco devolvió un enlace.",
            detail: [inviteError.message, genErr?.message].filter(Boolean).join(" | "),
          },
          502,
        );
      }
      devActivationUrl = actionLink;
      invitedUser = gen?.user ?? await findAuthUserByEmail(adminClient, accessRequest.email);
      console.warn(
        "[approve-access-request] MIREST_DEV_INVITE_LINK_IN_RESPONSE: entrega manual del enlace (no usar en producción)",
      );
    } else {
      return jsonResponse(
        {
          message:
            "No pudimos enviar la invitación: el SMTP de Supabase Auth rechazó el envío. En Auth logs suele aparecer «535 BadCredentials» con Gmail: usa una contraseña de aplicación o corrige usuario/contraseña en Authentication → Emails → SMTP Settings. " +
            "Para pruebas locales sin arreglar SMTP, ejecuta la función con MIREST_DEV_INVITE_LINK_IN_RESPONSE=1 y revisa el campo devActivationUrl en la respuesta JSON.",
          detail: inviteError.message ?? null,
        },
        502,
      );
    }
  }

  if (!invitedUser?.id && devActivationUrl) {
    invitedUser = await findAuthUserByEmail(adminClient, accessRequest.email);
  }

  if (invitedUser?.id) {
    const nextApp = { ...(invitedUser.app_metadata ?? {}), role };
    const { error: appMetaError } = await adminClient.auth.admin.updateUserById(invitedUser.id, {
      app_metadata: nextApp,
    });
    if (appMetaError) {
      console.error("[approve-access-request] app_metadata", appMetaError);
      return jsonResponse(
        {
          message: "La invitación se envió pero no se pudo registrar el rol en app_metadata (requerido por RLS).",
          detail: appMetaError.message ?? null,
        },
        500,
      );
    }
  }

  console.log("[approve-access-request] invite OK", JSON.stringify({ email: accessRequest.email, dev: Boolean(devActivationUrl) }));

  const now = new Date().toISOString();
  const updates = {
    status: "approved",
    approved_role: role,
    approved_at: accessRequest.approved_at || now,
    invite_sent_at: now,
    approved_by: user.id,
    rejected_at: null,
    approved_permissions: permissions.length > 0 ? permissions : null,
  };

  const { error: updateError } = await adminClient
    .from("access_requests")
    .update(updates)
    .eq("id", requestId);

  if (updateError) {
    return jsonResponse({ message: updateError.message }, 500);
  }

  // Limpieza: elimina solicitudes rechazadas previas del mismo email para que
  // no ensucien el panel una vez que ya aprobamos una nueva petición.
  try {
    await adminClient
      .from("access_requests")
      .delete()
      .eq("email", accessRequest.email)
      .eq("status", "rejected")
      .neq("id", requestId);
  } catch (cleanupError) {
    // La limpieza es best-effort; si falla no rompemos la aprobación.
    console.warn("No se pudieron limpiar solicitudes rechazadas previas:", cleanupError);
  }

  const baseMsg =
    action === "resend"
      ? `Activación registrada para ${accessRequest.email}.`
      : `Solicitud aprobada e invitación registrada para ${accessRequest.email}.`;
  const devNote = devActivationUrl
    ? " El correo no salió por SMTP; usa devActivationUrl solo en desarrollo."
    : "";

  return jsonResponse({
    message: `${baseMsg}${devNote}`,
    ...(devActivationUrl
      ? {
          devActivationUrl,
          devWarning: "No habilitar MIREST_DEV_INVITE_LINK_IN_RESPONSE en producción: expone el enlace de invitación en la API.",
        }
      : {}),
  });
});
