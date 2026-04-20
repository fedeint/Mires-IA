import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendAccessRevokedToUser,
  sendAccessRestoredToUser,
  sendPermissionsUpdatedToUser,
} from "../_shared/mailer.js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BAN_DURATION_REVOKE = "876000h";
const PROTECTED_EMAILS = new Set(["a@a.com"]);

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isSuperadmin(user) {
  const role = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role : undefined;
  return role === "superadmin";
}

function getFullName(user) {
  const name = user?.user_metadata?.full_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
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
    global: { headers: { Authorization: authHeader } },
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
      { message: "Solo el superadmin puede gestionar accesos." },
      403,
    );
  }

  let body = null;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ message: "Cuerpo JSON inválido" }, 400);
  }

  const action = body?.action;
  const targetId = body?.userId?.trim();

  const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  if (action === "list") {
    const { data, error } = await adminClient.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (error) return jsonResponse({ message: error.message }, 500);

    const mapped = data.users
      .map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at ?? null,
        banned_until: u.banned_until ?? null,
        role: typeof u.user_metadata?.role === "string" ? u.user_metadata.role : null,
        permissions: Array.isArray(u.user_metadata?.permissions)
          ? u.user_metadata.permissions
          : [],
        full_name: typeof u.user_metadata?.full_name === "string" ? u.user_metadata.full_name : null,
        protected: PROTECTED_EMAILS.has((u.email || "").toLowerCase()),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return jsonResponse({ users: mapped });
  }

  if (!targetId) {
    return jsonResponse({ message: "Falta userId" }, 400);
  }

  if (targetId === user.id && (action === "revoke" || action === "delete")) {
    return jsonResponse(
      { message: "No puedes revocar ni eliminar tu propia cuenta de administrador." },
      400,
    );
  }

  const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetId);
  if (targetError || !targetData?.user) {
    return jsonResponse({ message: "Usuario no encontrado" }, 404);
  }

  const targetEmail = (targetData.user.email || "").toLowerCase();
  const targetFullName = getFullName(targetData.user);
  const protectedAction = action === "revoke" || action === "delete";
  if (PROTECTED_EMAILS.has(targetEmail) && protectedAction) {
    return jsonResponse(
      { message: "Esta cuenta es de demostración y no puede ser revocada ni eliminada." },
      400,
    );
  }

  if (action === "revoke") {
    const { error } = await adminClient.auth.admin.updateUserById(targetId, {
      ban_duration: BAN_DURATION_REVOKE,
    });
    if (error) return jsonResponse({ message: error.message }, 500);

    const mail = targetEmail
      ? await sendAccessRevokedToUser({ email: targetEmail, fullName: targetFullName })
      : { ok: false, error: { message: "Usuario sin correo" } };

    return jsonResponse({
      message: `Acceso revocado para ${targetEmail}.`,
      mail,
    });
  }

  if (action === "restore") {
    const { error } = await adminClient.auth.admin.updateUserById(targetId, {
      ban_duration: "none",
    });
    if (error) return jsonResponse({ message: error.message }, 500);

    const mail = targetEmail
      ? await sendAccessRestoredToUser({ email: targetEmail, fullName: targetFullName })
      : { ok: false, error: { message: "Usuario sin correo" } };

    return jsonResponse({
      message: `Acceso restaurado para ${targetEmail}.`,
      mail,
    });
  }

  if (action === "delete") {
    const { error } = await adminClient.auth.admin.deleteUser(targetId);
    if (error) return jsonResponse({ message: error.message }, 500);
    return jsonResponse({ message: `Usuario ${targetEmail} eliminado permanentemente.` });
  }

  if (action === "update_role") {
    const newRole = body?.role?.trim();
    if (!newRole) return jsonResponse({ message: "Falta role" }, 400);

    const currentMetadata = targetData.user.user_metadata ?? {};
    const { error } = await adminClient.auth.admin.updateUserById(targetId, {
      user_metadata: { ...currentMetadata, role: newRole },
    });
    if (error) return jsonResponse({ message: error.message }, 500);

    const mail = targetEmail
      ? await sendPermissionsUpdatedToUser({
          email: targetEmail,
          fullName: targetFullName,
          role: newRole,
          permissions: Array.isArray(currentMetadata.permissions) ? currentMetadata.permissions : [],
        })
      : { ok: false, error: { message: "Usuario sin correo" } };

    return jsonResponse({
      message: `Rol de ${targetEmail} actualizado a ${newRole}.`,
      mail,
    });
  }

  if (action === "update_permissions") {
    const rawPermissions = body?.permissions;
    if (!Array.isArray(rawPermissions)) {
      return jsonResponse({ message: "permissions debe ser un arreglo" }, 400);
    }

    const cleaned = rawPermissions
      .map((value) => (typeof value === "string" ? value.trim() : ""))
      .filter((value) => value.length > 0);

    const currentMetadata = targetData.user.user_metadata ?? {};
    const nextRole = body?.role?.trim() || currentMetadata.role;
    const nextMetadata = { ...currentMetadata, permissions: cleaned };
    if (nextRole) nextMetadata.role = nextRole;

    const { error } = await adminClient.auth.admin.updateUserById(targetId, {
      user_metadata: nextMetadata,
    });
    if (error) return jsonResponse({ message: error.message }, 500);

    const mail = targetEmail
      ? await sendPermissionsUpdatedToUser({
          email: targetEmail,
          fullName: targetFullName,
          role: nextRole,
          permissions: cleaned,
        })
      : { ok: false, error: { message: "Usuario sin correo" } };

    return jsonResponse({
      message: `Módulos actualizados para ${targetEmail} (${cleaned.length} habilitados).`,
      mail,
    });
  }

  return jsonResponse({ message: "Acción no permitida" }, 400);
});
