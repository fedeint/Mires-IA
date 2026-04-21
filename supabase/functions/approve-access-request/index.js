import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendEmail } from "../_shared/resend.js";
import { buildInvitationEmail } from "../_shared/email-templates.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROLE_LABELS = {
  superadmin: "Superadministrador",
  admin: "Administrador",
  caja: "Caja",
  chef: "Chef / Cocina",
  pedidos: "Pedidos / Delivery",
  almacen: "Almacén",
  marketing: "Marketing",
  demo: "Demo",
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

function isSuperadmin(user) {
  const role = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : undefined;
  return role === "superadmin";
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

function isAlreadyRegisteredError(error) {
  if (!error) return false;
  const message = String(error.message || error.msg || "").toLowerCase();
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists") ||
    message.includes("email address has already")
  );
}

function isUserConfirmed(user) {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at || user.last_sign_in_at);
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

  // Generate the invite link without sending Supabase's default email, so we can
  // deliver our own branded message through Resend.
  async function generateInviteLink() {
    return adminClient.auth.admin.generateLink({
      type: "invite",
      email: accessRequest.email,
      options: {
        data: inviteMetadata,
        redirectTo,
      },
    });
  }

  let { data: linkData, error: linkError } = await generateInviteLink();

  // Si el email ya figura en auth.users (invitación previa sin activar, o
  // solicitudes rechazadas que dejaron residuo), reciclamos al usuario en vez
  // de fallar con 400. Sólo lo hacemos si la cuenta NUNCA fue confirmada para
  // no destruir usuarios activos por accidente.
  if (linkError && isAlreadyRegisteredError(linkError)) {
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

      ({ data: linkData, error: linkError } = await generateInviteLink());
    }
  }

  if (linkError) {
    return jsonResponse({ message: linkError.message }, 400);
  }

  const activationUrl = linkData?.properties?.action_link;
  if (!activationUrl) {
    return jsonResponse({ message: "No pudimos generar el enlace de activación." }, 500);
  }

  const { subject, html, text } = buildInvitationEmail({
    fullName: accessRequest.full_name,
    restaurantName: accessRequest.restaurant_name,
    activationUrl,
    roleLabel: ROLE_LABELS[role] || role,
  });

  try {
    await sendEmail({
      to: accessRequest.email,
      subject,
      html,
      text,
    });
  } catch (emailError) {
    return jsonResponse(
      {
        message: "No pudimos enviar el correo de activación vía Resend.",
        detail: emailError?.message ?? null,
      },
      502,
    );
  }

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

  return jsonResponse({
    message:
      action === "resend"
        ? `Activación reenviada a ${accessRequest.email}.`
        : `Solicitud aprobada e invitación enviada a ${accessRequest.email}.`,
  });
});
