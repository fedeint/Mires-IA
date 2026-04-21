import { Resend } from "npm:resend@4.0.1";

const FROM_DEFAULT = Deno.env.get("RESEND_FROM") ?? "MiRest con IA <onboarding@resend.dev>";
const SUPERADMIN_EMAIL =
  Deno.env.get("SUPERADMIN_NOTIFY_EMAIL") ?? "anthonyreyes12.06.25.dignitatec@gmail.com";
const APP_ORIGIN =
  Deno.env.get("ACTIVATION_REDIRECT_ORIGIN")?.replace(/\/$/, "") ?? "https://mires-ia.vercel.app";

const RESEND_API_KEY =
  Deno.env.get("RESEND_API_KEY") ?? "re_jEHq2yYE_8MxSEBi2S5fUar3jniCFEzZZ";

export const resend = new Resend(RESEND_API_KEY);

export const mailConfig = {
  from: FROM_DEFAULT,
  superadminEmail: SUPERADMIN_EMAIL,
  appOrigin: APP_ORIGIN,
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function layout({ title, preheader, bodyHtml, ctaLabel, ctaUrl, footerNote }) {
  const preheaderHtml = preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;visibility:hidden;">${escapeHtml(preheader)}</div>`
    : "";
  const cta = ctaLabel && ctaUrl
    ? `
      <tr>
        <td align="center" style="padding: 8px 0 24px;">
          <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 26px;border-radius:12px;background:#f07c2a;color:#ffffff;font-weight:700;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-decoration:none;">
            ${escapeHtml(ctaLabel)}
          </a>
        </td>
      </tr>`
    : "";
  const footer = footerNote
    ? `<p style="margin:24px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">${escapeHtml(footerNote)}</p>`
    : "";

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f4;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;">
    ${preheaderHtml}
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f4;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 30px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:28px 32px 16px;">
                <div style="display:inline-flex;align-items:center;gap:10px;">
                  <div style="width:38px;height:38px;border-radius:10px;background:linear-gradient(135deg,#f07c2a,#c0560a);color:#ffffff;display:flex;align-items:center;justify-content:center;font-weight:800;letter-spacing:0.04em;">IA</div>
                  <div>
                    <div style="font-size:12px;font-weight:700;color:#f07c2a;letter-spacing:0.14em;text-transform:uppercase;">MiRest</div>
                    <div style="font-size:15px;font-weight:700;color:#0f172a;">MiRest con IA</div>
                  </div>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 8px;">
                <h1 style="margin:0 0 8px;font-family:'Space Grotesk',Inter,sans-serif;font-size:24px;line-height:1.25;color:#0f172a;">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 8px;font-size:15px;line-height:1.6;color:#334155;">
                ${bodyHtml}
              </td>
            </tr>
            ${cta}
            <tr>
              <td style="padding:0 32px 28px;">
                ${footer}
                <hr style="margin:24px 0 0;border:none;border-top:1px solid #e2e8f0;" />
                <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;line-height:1.6;">
                  Este es un correo automático de <strong>MiRest con IA</strong>. Si no esperabas este mensaje, puedes ignorarlo.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

async function send({ to, subject, html, text, replyTo }) {
  try {
    const { data, error } = await resend.emails.send({
      from: mailConfig.from,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
      ...(replyTo ? { reply_to: replyTo } : {}),
    });
    if (error) {
      console.error("[mailer] Resend error:", error);
      return { ok: false, error };
    }
    return { ok: true, id: data?.id ?? null };
  } catch (err) {
    console.error("[mailer] Unexpected error:", err);
    return { ok: false, error: { message: err?.message ?? String(err) } };
  }
}

export async function sendRequestReceivedToApplicant(request) {
  const name = escapeHtml(request.full_name || "hola");
  const bodyHtml = `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Recibimos tu solicitud de acceso a <strong>MiRest con IA</strong> para <strong>${escapeHtml(request.restaurant_name || "tu restaurante")}</strong>.
    Nuestro equipo la revisará y te escribiremos en las próximas horas con los siguientes pasos.</p>
    <p>Mientras tanto, puedes conocer más sobre la plataforma en nuestro sitio. Si tienes preguntas urgentes,
    responde a este correo y te contactaremos.</p>
  `;
  return send({
    to: request.email,
    subject: "Recibimos tu solicitud de acceso — MiRest con IA",
    html: layout({
      title: "Tu solicitud fue recibida",
      preheader: "Revisaremos tu solicitud y te escribiremos pronto.",
      bodyHtml,
      ctaLabel: "Ir a MiRest con IA",
      ctaUrl: mailConfig.appOrigin,
      footerNote: `Solicitud registrada a nombre de ${request.full_name || "—"} · ${request.email}`,
    }),
  });
}

export async function sendRequestReceivedToAdmin(request) {
  const detailsRows = [
    ["Solicitante", request.full_name],
    ["Correo", request.email],
    ["Teléfono", request.phone],
    ["Restaurante", request.restaurant_name],
    ["Razón social", request.legal_owner_name],
    ["Negocios", request.business_count],
    ["Ciudad / País", [request.city, request.country].filter(Boolean).join(" · ")],
    ["Rol solicitante", request.applicant_role],
    ["Fuente", request.source],
    ["Notas", request.notes],
  ]
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:6px 10px;font-size:13px;color:#64748b;width:140px;vertical-align:top;">${escapeHtml(label)}</td>
          <td style="padding:6px 10px;font-size:14px;color:#0f172a;vertical-align:top;">${escapeHtml(String(value))}</td>
        </tr>`,
    )
    .join("");

  const bodyHtml = `
    <p>Llegó una nueva solicitud de acceso al sistema. Revísala desde el panel de Accesos.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:16px;width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      ${detailsRows}
    </table>
  `;

  return send({
    to: mailConfig.superadminEmail,
    replyTo: request.email,
    subject: `Nueva solicitud de acceso — ${request.restaurant_name || request.full_name}`,
    html: layout({
      title: "Nueva solicitud de acceso",
      preheader: `De ${request.full_name || request.email} (${request.restaurant_name || "sin restaurante"}).`,
      bodyHtml,
      ctaLabel: "Abrir panel de Accesos",
      ctaUrl: `${mailConfig.appOrigin}/Accesos/accesos.html`,
    }),
  });
}

export async function sendRequestReviewingToApplicant(request) {
  const name = escapeHtml(request.full_name || "hola");
  const bodyHtml = `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Te contamos que tu solicitud para <strong>${escapeHtml(request.restaurant_name || "tu restaurante")}</strong> ya está <strong>en revisión</strong> por nuestro equipo comercial.</p>
    <p>Validaremos la información y te enviaremos el acceso de activación en cuanto esté lista tu cuenta.</p>
  `;
  return send({
    to: request.email,
    subject: "Tu solicitud está en revisión — MiRest con IA",
    html: layout({
      title: "Tu solicitud está en revisión",
      preheader: "Estamos validando los datos y te avisaremos pronto.",
      bodyHtml,
      footerNote: `Referencia: ${request.id ?? "—"}`,
    }),
  });
}

export async function sendRequestRejectedToApplicant(request) {
  const name = escapeHtml(request.full_name || "hola");
  const bodyHtml = `
    <p>Hola <strong>${name}</strong>,</p>
    <p>Gracias por interesarte en <strong>MiRest con IA</strong>. Luego de revisar tu solicitud para <strong>${escapeHtml(request.restaurant_name || "tu restaurante")}</strong>,
    en esta oportunidad no pudimos avanzar con la activación.</p>
    <p>Si crees que esto fue un error o quieres más contexto, responde a este correo y te ayudaremos personalmente.</p>
  `;
  return send({
    to: request.email,
    subject: "Actualización sobre tu solicitud — MiRest con IA",
    html: layout({
      title: "Actualización sobre tu solicitud",
      preheader: "Por ahora no podemos avanzar con la activación.",
      bodyHtml,
      footerNote: `Referencia: ${request.id ?? "—"}`,
    }),
  });
}

export async function sendAccessRevokedToUser({ email, fullName }) {
  const bodyHtml = `
    <p>Hola <strong>${escapeHtml(fullName || "hola")}</strong>,</p>
    <p>Queremos informarte que tu acceso a <strong>MiRest con IA</strong> fue <strong>revocado</strong> por el administrador.</p>
    <p>Si crees que esto es un error, contacta al administrador de tu cuenta respondiendo a este correo.</p>
  `;
  return send({
    to: email,
    subject: "Tu acceso fue revocado — MiRest con IA",
    html: layout({
      title: "Tu acceso fue revocado",
      preheader: "El acceso a tu cuenta ha sido suspendido.",
      bodyHtml,
    }),
  });
}

export async function sendAccessRestoredToUser({ email, fullName }) {
  const bodyHtml = `
    <p>Hola <strong>${escapeHtml(fullName || "hola")}</strong>,</p>
    <p>¡Buenas noticias! Tu acceso a <strong>MiRest con IA</strong> fue <strong>restaurado</strong> y ya puedes iniciar sesión normalmente.</p>
  `;
  return send({
    to: email,
    subject: "Tu acceso fue restaurado — MiRest con IA",
    html: layout({
      title: "Bienvenido de vuelta",
      preheader: "Tu cuenta ya está activa nuevamente.",
      bodyHtml,
      ctaLabel: "Iniciar sesión",
      ctaUrl: `${mailConfig.appOrigin}/login.html`,
    }),
  });
}

/** Correo transaccional genérico (p. ej. recuperación de contraseña con plantilla HTML propia). */
export async function sendPasswordResetBrandedEmail({ to, subject, html, text }) {
  return send({ to, subject, html, text });
}

export async function sendPermissionsUpdatedToUser({ email, fullName, role, permissions }) {
  const roleLabel = escapeHtml(role || "sin rol definido");
  const permList = Array.isArray(permissions) && permissions.length > 0
    ? `<ul style="margin:8px 0 0 18px;padding:0;color:#0f172a;">${permissions
        .map((p) => `<li style="margin:2px 0;">${escapeHtml(p)}</li>`)
        .join("")}</ul>`
    : `<p style="margin:8px 0 0;color:#64748b;font-size:13px;">Sin módulos específicos asignados.</p>`;

  const bodyHtml = `
    <p>Hola <strong>${escapeHtml(fullName || "hola")}</strong>,</p>
    <p>El administrador actualizó tu configuración de acceso en <strong>MiRest con IA</strong>.</p>
    <p><strong>Rol:</strong> ${roleLabel}</p>
    <p><strong>Módulos habilitados:</strong></p>
    ${permList}
    <p style="margin-top:16px;">Los cambios ya están activos. Si tienes dudas, responde a este correo.</p>
  `;
  return send({
    to: email,
    subject: "Tu acceso fue actualizado — MiRest con IA",
    html: layout({
      title: "Tu acceso fue actualizado",
      preheader: "Se actualizaron tu rol o módulos.",
      bodyHtml,
      ctaLabel: "Abrir el sistema",
      ctaUrl: mailConfig.appOrigin,
    }),
  });
}
