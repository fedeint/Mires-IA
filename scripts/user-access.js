import { supabase, supabaseUrl, supabaseKey } from "./supabase.js";

const DIRECT = `${supabaseUrl}/functions/v1/manage-user-access`;

/** Mismo origen: evita CORS en fallos 5xx del edge (sin cabeceras CORS). Ver `api/user-access.js`. */
function getManageUserEndpoint() {
  if (typeof location === "undefined") return DIRECT;
  const h = location.hostname;
  if (h === "127.0.0.1" || h === "localhost") return DIRECT;
  // mires-ia.com, www, *.vercel.app, previews tipo mires-ia-*.vercel.app
  if (h.endsWith(".vercel.app") || h.includes("mires-ia")) {
    return `${location.origin}/api/user-access`;
  }
  return DIRECT;
}

const TOKEN_IN_BODY_KEY = "__mirest_bearer";

async function callManageUser(payload) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Debes iniciar sesión como administrador para continuar.");
  }

  const endpoint = getManageUserEndpoint();
  const useProxy = endpoint.includes("/api/user-access");
  // Proxy: no cookies (reduce 494) y JWT en el cuerpo para aligerar cabeceras.
  const requestBody = useProxy
    ? { ...payload, [TOKEN_IN_BODY_KEY]: session.access_token }
    : payload;
  const requestHeaders = useProxy
    ? {
        apikey: supabaseKey,
        "Content-Type": "application/json",
      }
    : {
        apikey: supabaseKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      };

  const response = await fetch(endpoint, {
    method: "POST",
    headers: requestHeaders,
    body: JSON.stringify(requestBody),
    credentials: "omit",
    cache: "no-store",
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_) {
    data = null;
  }

  if (!response.ok) {
    const message = data?.message || `Error ${response.status} al contactar el servicio.`;
    throw new Error(message);
  }

  return data;
}

export function listUsers() {
  return callManageUser({ action: "list" });
}

export function revokeUser(userId) {
  return callManageUser({ action: "revoke", userId });
}

export function restoreUser(userId) {
  return callManageUser({ action: "restore", userId });
}

export function deleteUser(userId) {
  return callManageUser({ action: "delete", userId });
}

export function updateUserRole(userId, role) {
  return callManageUser({ action: "update_role", userId, role });
}

export function updateUserPermissions(userId, permissions, role) {
  const payload = { action: "update_permissions", userId, permissions };
  if (role) payload.role = role;
  return callManageUser(payload);
}

/** Solo superadmin. Dispara el correo de recuperación vía Supabase Auth (SMTP del proyecto). */
export function sendPasswordRecoveryToUser(userId) {
  return callManageUser({ action: "send_recovery_email", userId });
}

/**
 * @param {{ email: string, role: string, fullName?: string, permissions?: string[], shift?: { days: string[], horaEntrada: string, horaSalida: string, categoria?: string } }} body
 */
export function inviteUser(body) {
  return callManageUser({ action: "invite_user", ...body });
}
