import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  sendAccessRevokedToUser,
  sendAccessRestoredToUser,
  sendPermissionsUpdatedToUser,
} from "../_shared/mailer.js";
import { deliverPasswordRecoveryViaSupabaseAuth } from "../_shared/recovery-delivery.js";
import { canManageUserAccess, getAuthRole, isSuperadmin } from "../_shared/auth-roles.js";

const SHELL_TO_APP_ROLE = {
  superadmin: "superadmin",
  admin: "administrador",
  caja: "cajero",
  pedidos: "mesero",
  chef: "cocinero",
  almacen: "almacenero",
  marketing: "marketing",
};

const APP_TO_SHELL_ROLE = {
  superadmin: "superadmin",
  administrador: "admin",
  cajero: "caja",
  mesero: "pedidos",
  cocinero: "chef",
  almacenero: "almacen",
  marketing: "marketing",
};

const VALID_DIAS = new Set([
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
]);

const BAN_DURATION_REVOKE = "876000h";
const PROTECTED_EMAILS = new Set(["a@a.com"]);

/** CORS con reflejo de Origin (Vercel, localhost) para preflight/respuesta. */
function getCorsHeaders(request) {
  const base = {
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, accept, prefer, x-supabase-api-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
  };
  if (request) {
    const origin = request.headers.get("Origin");
    if (origin) {
      return { ...base, "Access-Control-Allow-Origin": origin, Vary: "Origin" };
    }
  }
  return { ...base, "Access-Control-Allow-Origin": "*" };
}

function jsonResponse(body, status, request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...getCorsHeaders(request), "Content-Type": "application/json" },
  });
}

function getFullName(user) {
  const name = user?.user_metadata?.full_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

/**
 * Un admin de organización no puede modificar a un usuario cuyo rol es superadmin.
 */
function isTargetSuperadmin(ut) {
  return getAuthRole(ut) === "superadmin";
}

Deno.serve(async (request) => {
  try {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: getCorsHeaders(request) });
    }

    if (request.method !== "POST") {
      return jsonResponse({ message: "Método no permitido" }, 405, request);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const authHeader = request.headers.get("Authorization");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
      return jsonResponse({ message: "Configuración incompleta del servicio" }, 500, request);
    }

    if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
      return jsonResponse({ message: "Falta encabezado de autorización" }, 401, request);
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
        { message: "Sesión inválida o expirada. Vuelve a iniciar sesión e inténtalo de nuevo.", detail: sessionError?.message ?? null },
        401,
        request,
      );
    }

    let body = null;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ message: "Cuerpo JSON inválido" }, 400, request);
    }

    const action = body?.action;
    const targetId = body?.userId?.trim();

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    /** Personal operativo (Caja, Pedidos): leer desde Accesos; cualquier sesión autenticada con tenant en JWT. */
    if (action === "list_operational_staff") {
      const OPERATIONAL_ROLES = new Set(["mesero", "cajero", "chef"]);
      const tenantFrom = (u) => {
        const t = u?.app_metadata?.tenant_id;
        return typeof t === "string" && t.trim() ? t.trim() : null;
      };
      const callerTid = tenantFrom(user);
      if (!callerTid) {
        return jsonResponse(
          {
            staff: [],
            empty: true,
            emptyReason: "no_tenant",
            onboardingStep: 1,
            message:
              "Aún no hay restaurante/tenant vinculado a tu sesión. Completa el paso 1 (Configuración) y vuelve a iniciar sesión con un usuario asignado al local.",
          },
          200,
          request,
        );
      }
      const { data, error } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 200 });
      if (error) return jsonResponse({ message: error.message }, 500, request);
      const staff = data.users
        .filter((u) => {
          if (tenantFrom(u) !== callerTid) return false;
          const r = getAuthRole(u);
          if (!r || u.banned_until) return false;
          return OPERATIONAL_ROLES.has(r);
        })
        .map((u) => {
          const meta = u.user_metadata ?? {};
          const mesa =
            (typeof meta.mesa === "string" && meta.mesa.trim() ? meta.mesa.trim() : null) ||
            (typeof meta.active_table === "string" && meta.active_table.trim() ? meta.active_table.trim() : null) ||
            (typeof meta.table === "string" && meta.table.trim() ? meta.table.trim() : null);
          const name =
            (typeof meta.full_name === "string" && meta.full_name.trim() ? meta.full_name.trim() : null) || u.email || u.id;
          return {
            id: u.id,
            name,
            role: getAuthRole(u) ?? "unknown",
            tableLabel: mesa ? (mesa.toLowerCase().includes("mesa") ? mesa : `Mesa ${mesa}`) : "—",
            productCount: 0,
            status: "unknown",
            email: u.email ?? null,
          };
        });
      if (staff.length === 0) {
        return jsonResponse(
          {
            staff: [],
            empty: true,
            emptyReason: "no_operational_users",
            onboardingStep: 2,
            message:
              "Aún no hay meseros, cajeros o chefs vinculados a este restaurante. Completa el paso 2 (Accesos) y asigna roles a los usuarios.",
          },
          200,
          request,
        );
      }
      return jsonResponse({ staff, empty: false }, 200, request);
    }

    if (!canManageUserAccess(user)) {
      return jsonResponse(
        {
          message:
            "Necesitas rol de administrador o superadmin. Si recién cambiaste la contraseña, cierra sesión y vuelve a entrar (el token debe actualizarse).",
        },
        403,
        request,
      );
    }

    if (action === "list") {
      const { data, error } = await adminClient.auth.admin.listUsers({
        page: 1,
        perPage: 200,
      });
      if (error) return jsonResponse({ message: error.message }, 500, request);

      const { data: profiles } = await adminClient
        .from("user_profiles")
        .select("id, tenant_id, full_name, role, modulos_acceso, usa_pwa");
      const byId = new Map((profiles || []).map((p) => [p.id, p]));

      const { data: profMe } = await adminClient
        .from("user_profiles")
        .select("tenant_id")
        .eq("id", user.id)
        .maybeSingle();
      const callerTenant = profMe?.tenant_id ?? null;

      let mapped = data.users
        .map((u) => {
          const p = byId.get(u.id);
          const metaRole =
            (typeof u.app_metadata?.role === "string" && u.app_metadata.role.trim() ? u.app_metadata.role : null) ||
            (typeof u.user_metadata?.role === "string" && u.user_metadata.role.trim() ? u.user_metadata.role : null) ||
            (p?.role && APP_TO_SHELL_ROLE[p.role] ? APP_TO_SHELL_ROLE[p.role] : p?.role ? p.role : null);
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            last_sign_in_at: u.last_sign_in_at ?? null,
            email_confirmed_at: u.email_confirmed_at ?? u.confirmed_at ?? null,
            invited_at: u.invited_at ?? null,
            banned_until: u.banned_until ?? null,
            role: metaRole,
            permissions: Array.isArray(u.user_metadata?.permissions) ? u.user_metadata.permissions
              : Array.isArray(p?.modulos_acceso) ? p.modulos_acceso
              : [],
            full_name: (p?.full_name && String(p.full_name)) ||
              (typeof u.user_metadata?.full_name === "string" ? u.user_metadata.full_name : null),
            protected: PROTECTED_EMAILS.has((u.email || "").toLowerCase()),
            tenant_id: p?.tenant_id ?? (typeof u.app_metadata?.tenant_id === "string" ? u.app_metadata.tenant_id : null),
            app_role: p?.role ?? null,
            usa_pwa: p?.usa_pwa ?? null,
          };
        })
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      if (!isSuperadmin(user) && callerTenant) {
        const tid = String(callerTenant);
        mapped = mapped.filter((m) => (m.tenant_id ? String(m.tenant_id) === tid : false));
      }

      return jsonResponse({ users: mapped, callerTenant: callerTenant ?? null }, 200, request);
    }

    if (action === "invite_user") {
      const email = (body?.email || "").trim().toLowerCase();
      const fullName = (body?.fullName || body?.full_name || "").trim();
      const role = (body?.role || "").trim();
      const rawPerms = Array.isArray(body?.permissions) ? body.permissions : [];
      const permissions = rawPerms.map((v) => (typeof v === "string" ? v.trim() : "")).filter((v) => v.length);
      const shift = body?.shift && typeof body.shift === "object" ? body.shift : {};
      const days = Array.isArray(shift?.days) ? shift.days : [];
      const horaEntrada = String(shift.horaEntrada || shift.hora_entrada || "").trim();
      const horaSalida = String(shift.horaSalida || shift.hora_salida || "").trim();
      const categoria = (shift.categoria || "fijo") === "rotativo" ? "rotativo" : "fijo";
      if (!email || !role) {
        return jsonResponse({ message: "Faltan email o rol" }, 400, request);
      }
      if (role === "superadmin" && !isSuperadmin(user)) {
        return jsonResponse(
          { message: "Solo un superadmin puede asignar el rol superadmin." },
          403,
          request,
        );
      }
      const { data: prof, error: pe } = await adminClient
        .from("user_profiles")
        .select("tenant_id, role")
        .eq("id", user.id)
        .maybeSingle();
      if (pe) {
        return jsonResponse({ message: "No se pudo leer tu perfil" }, 500, request);
      }
      const callerTenant = prof?.tenant_id;
      if (!isSuperadmin(user) && !callerTenant) {
        return jsonResponse(
          { message: "Tu usuario no está vinculado a un restaurante (falta tenant en perfil)." },
          400,
          request,
        );
      }
      const bodyTenant = (body?.tenantId || body?.tenant_id || "").toString().trim() || null;
      const targetTenant = isSuperadmin(user) && bodyTenant ? bodyTenant : callerTenant;
      if (!targetTenant) {
        return jsonResponse({ message: "Falta el restaurante (tenant) de destino." }, 400, request);
      }
      const appRole = SHELL_TO_APP_ROLE[role] || "mesero";

      const DEFAULT_REDIRECT_ORIGIN = "https://mires-ia.vercel.app";
      const configuredOrigin = Deno.env.get("ACTIVATION_REDIRECT_ORIGIN")?.trim();
      const safeOrigin = configuredOrigin || DEFAULT_REDIRECT_ORIGIN;
      const redirectTo = `${String(safeOrigin).replace(/\/$/, "")}/activate.html`;
      const inviteMetadata = { full_name: fullName || null, role, permissions };
      const { data: invData, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
        data: inviteMetadata,
        redirectTo,
      });
      if (inviteError) {
        return jsonResponse({ message: inviteError.message || "No se pudo enviar la invitación" }, 400, request);
      }
      const invited = invData?.user;
      if (!invited?.id) {
        return jsonResponse({ message: "No se pudo completar la invitación" }, 500, request);
      }
      const { error: updErr } = await adminClient.auth.admin.updateUserById(invited.id, {
        app_metadata: {
          ...(invited.app_metadata || {}),
          role,
          tenant_id: String(targetTenant),
        },
        user_metadata: { ...inviteMetadata, role, permissions },
      });
      if (updErr) {
        return jsonResponse({ message: `Usuario creado pero al actualizar metadatos: ${updErr.message}` }, 500, request);
      }
      const { error: profErr } = await adminClient
        .from("user_profiles")
        .upsert(
          {
            id: invited.id,
            tenant_id: targetTenant,
            full_name: fullName || null,
            role: appRole,
            modulos_acceso: permissions,
            usa_pwa: true,
          },
          { onConflict: "id" },
        );
      if (profErr) {
        return jsonResponse({ message: `Invitación enviada, pero al guardar perfil: ${profErr.message}` }, 500, request);
      }
      if (days.length > 0 && horaEntrada && horaSalida) {
        const rows = [];
        for (const d of days) {
          if (!VALID_DIAS.has(String(d))) continue;
          rows.push({
            tenant_id: targetTenant,
            user_id: invited.id,
            dia: String(d),
            hora_entrada: horaEntrada.length === 5 ? `${horaEntrada}:00` : horaEntrada,
            hora_salida: horaSalida.length === 5 ? `${horaSalida}:00` : horaSalida,
            activo: true,
            categoria,
            updated_at: new Date().toISOString(),
          });
        }
        if (rows.length) {
          const { error: tErr } = await adminClient.from("usuario_turnos").insert(rows);
          if (tErr) {
            return jsonResponse(
              { message: `Usuario creado; error al guardar turnos: ${tErr.message}` },
              500,
              request,
            );
          }
        }
      }
      return jsonResponse(
        { message: `Invitación enviada a ${email}. Revisa el correo de activación.`, userId: invited.id },
        200,
        request,
      );
    }

    if (!targetId) {
      return jsonResponse({ message: "Falta userId" }, 400, request);
    }

    if (targetId === user.id && (action === "revoke" || action === "delete")) {
      return jsonResponse(
        { message: "No puedes revocar ni eliminar tu propia cuenta de administrador." },
        400,
        request,
      );
    }

    const { data: targetData, error: targetError } = await adminClient.auth.admin.getUserById(targetId);
    if (targetError || !targetData?.user) {
      return jsonResponse({ message: "Usuario no encontrado" }, 404, request);
    }

    const targetUser = targetData.user;
    const targetEmail = (targetUser.email || "").toLowerCase();
    const targetFullName = getFullName(targetUser);
    const protectedAction = action === "revoke" || action === "delete";
    if (PROTECTED_EMAILS.has(targetEmail) && protectedAction) {
      return jsonResponse(
        { message: "Esta cuenta es de demostración y no puede ser revocada ni eliminada." },
        400,
        request,
      );
    }

    const mutating = [
      "revoke",
      "restore",
      "delete",
      "update_role",
      "update_permissions",
      "send_recovery_email",
    ];
    if (!isSuperadmin(user) && isTargetSuperadmin(targetUser) && mutating.includes(action)) {
      return jsonResponse(
        { message: "Solo un superadmin puede modificar a otro superadmin. Pide a quien tenga el rol completo de sistema." },
        403,
        request,
      );
    }

    if (action === "update_role" && (body?.role || "").trim() === "superadmin" && !isSuperadmin(user)) {
      return jsonResponse(
        { message: "Solo un superadmin puede asignar el rol superadmin." },
        403,
        request,
      );
    }

    if (action === "send_recovery_email") {
      if (!targetEmail) {
        return jsonResponse({ message: "Usuario sin correo" }, 400, request);
      }
      const { sent, reason, detail } = await deliverPasswordRecoveryViaSupabaseAuth(
        supabaseUrl,
        supabaseAnonKey,
        targetEmail,
      );
      if (!sent && reason === "recover_failed") {
        console.error("[manage-user-access] send_recovery_email", detail);
        return jsonResponse(
          { message: "No se pudo enviar el correo. Inténtalo más tarde o contacta soporte del sistema." },
          502,
          request,
        );
      }
      return jsonResponse(
        {
          message: `Enlace de recuperación enviado a ${targetEmail}.`,
          mail: { ok: true },
        },
        200,
        request,
      );
    }

    if (action === "revoke") {
      const { error } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: BAN_DURATION_REVOKE,
      });
      if (error) return jsonResponse({ message: error.message }, 500, request);

      const mail = targetEmail
        ? await sendAccessRevokedToUser({ email: targetEmail, fullName: targetFullName })
        : { ok: false, error: { message: "Usuario sin correo" } };

      return jsonResponse(
        {
          message: `Acceso revocado para ${targetEmail}.`,
          mail,
        },
        200,
        request,
      );
    }

    if (action === "restore") {
      const { error } = await adminClient.auth.admin.updateUserById(targetId, {
        ban_duration: "none",
      });
      if (error) return jsonResponse({ message: error.message }, 500, request);

      const mail = targetEmail
        ? await sendAccessRestoredToUser({ email: targetEmail, fullName: targetFullName })
        : { ok: false, error: { message: "Usuario sin correo" } };

      return jsonResponse(
        {
          message: `Acceso restaurado para ${targetEmail}.`,
          mail,
        },
        200,
        request,
      );
    }

    if (action === "delete") {
      const { error } = await adminClient.auth.admin.deleteUser(targetId);
      if (error) return jsonResponse({ message: error.message }, 500, request);
      return jsonResponse({ message: `Usuario ${targetEmail} eliminado permanentemente.` }, 200, request);
    }

    if (action === "update_role") {
      const newRole = body?.role?.trim();
      if (!newRole) return jsonResponse({ message: "Falta role" }, 400, request);

      const currentMetadata = targetUser.user_metadata ?? {};
      const currentApp = targetUser.app_metadata ?? {};
      const { error } = await adminClient.auth.admin.updateUserById(targetId, {
        app_metadata: { ...currentApp, role: newRole },
        user_metadata: { ...currentMetadata, role: newRole },
      });
      if (error) return jsonResponse({ message: error.message }, 500, request);

      const mail = targetEmail
        ? await sendPermissionsUpdatedToUser({
            email: targetEmail,
            fullName: targetFullName,
            role: newRole,
            permissions: Array.isArray(currentMetadata.permissions) ? currentMetadata.permissions : [],
          })
        : { ok: false, error: { message: "Usuario sin correo" } };

      return jsonResponse(
        {
          message: `Rol de ${targetEmail} actualizado a ${newRole}.`,
          mail,
        },
        200,
        request,
      );
    }

    if (action === "update_permissions") {
      const rawPermissions = body?.permissions;
      if (!Array.isArray(rawPermissions)) {
        return jsonResponse({ message: "permissions debe ser un arreglo" }, 400, request);
      }

      const cleaned = rawPermissions
        .map((value) => (typeof value === "string" ? value.trim() : ""))
        .filter((value) => value.length > 0);

      const currentMetadata = targetUser.user_metadata ?? {};
      const currentApp = targetUser.app_metadata ?? {};
      const nextRole = body?.role?.trim() || currentMetadata.role || currentApp.role;
      if ((nextRole || "") === "superadmin" && !isSuperadmin(user)) {
        return jsonResponse(
          { message: "Solo un superadmin puede dejar a un usuario con rol completo (superadmin)." },
          403,
          request,
        );
      }
      const nextMetadata = { ...currentMetadata, permissions: cleaned };
      if (nextRole) nextMetadata.role = nextRole;
      const nextApp = { ...currentApp };
      if (nextRole) nextApp.role = nextRole;

      const { error } = await adminClient.auth.admin.updateUserById(targetId, {
        user_metadata: nextMetadata,
        app_metadata: nextApp,
      });
      if (error) return jsonResponse({ message: error.message }, 500, request);

      const mail = targetEmail
        ? await sendPermissionsUpdatedToUser({
            email: targetEmail,
            fullName: targetFullName,
            role: nextRole,
            permissions: cleaned,
          })
        : { ok: false, error: { message: "Usuario sin correo" } };

      return jsonResponse(
        {
          message: `Módulos actualizados para ${targetEmail} (${cleaned.length} habilitados).`,
          mail,
        },
        200,
        request,
      );
    }

    return jsonResponse({ message: "Acción no permitida" }, 400, request);
  } catch (err) {
    console.error("[manage-user-access]", err);
    return jsonResponse(
      { message: err?.message || "Error interno del servicio" },
      500,
      request,
    );
  }
});
