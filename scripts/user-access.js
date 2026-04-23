import { supabase, supabaseUrl, supabaseKey } from "./supabase.js";

const ENDPOINT = `${supabaseUrl}/functions/v1/manage-user-access`;

async function callManageUser(payload) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Debes iniciar sesión como administrador para continuar.");
  }

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
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
