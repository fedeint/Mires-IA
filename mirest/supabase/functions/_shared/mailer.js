// Sin proveedor de correo externo: no se envían emails desde las Edge Functions.
// Las invitaciones y recuperación dependen del SMTP configurado en Supabase Auth.

function logSkip(label, payload) {
  console.info(`[mailer] omitido (${label})`, JSON.stringify(payload ?? {}));
}

export async function sendRequestReceivedToApplicant(request) {
  logSkip("solicitud→solicitante", { email: request?.email });
  return { ok: true, skipped: true };
}

export async function sendRequestReceivedToAdmin(request) {
  logSkip("solicitud→admin", { email: request?.email });
  return { ok: true, skipped: true };
}

export async function sendRequestReviewingToApplicant(request) {
  logSkip("revisión→solicitante", { email: request?.email });
  return { ok: true, skipped: true };
}

export async function sendRequestRejectedToApplicant(request) {
  logSkip("rechazo→solicitante", { email: request?.email });
  return { ok: true, skipped: true };
}

export async function sendAccessRevokedToUser({ email, fullName }) {
  logSkip("acceso revocado", { email, fullName });
  return { ok: true, skipped: true };
}

export async function sendAccessRestoredToUser({ email, fullName }) {
  logSkip("acceso restaurado", { email, fullName });
  return { ok: true, skipped: true };
}

export async function sendPermissionsUpdatedToUser({ email, fullName, role, permissions }) {
  logSkip("permisos actualizados", { email, fullName, role, permissionsCount: permissions?.length ?? 0 });
  return { ok: true, skipped: true };
}
