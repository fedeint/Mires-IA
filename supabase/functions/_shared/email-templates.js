// Branded HTML templates for transactional emails.
// Keep inline CSS (most mail clients strip <style> blocks).

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function baseLayout({ title, preheader, body, ctaLabel, ctaUrl, footnote }) {
  const safeTitle = escapeHtml(title);
  const safePreheader = escapeHtml(preheader || "");
  const safeCta = escapeHtml(ctaLabel || "");
  const safeFootnote = escapeHtml(footnote || "");

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f3f5f8;font-family:'Inter','Segoe UI',Arial,sans-serif;color:#0f172a;">
    <span style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;">${safePreheader}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f5f8;padding:40px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px rgba(15,23,42,0.08);">
            <tr>
              <td style="padding:28px 32px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td>
                      <div style="display:inline-flex;align-items:center;gap:10px;">
                        <span style="display:inline-grid;place-items:center;width:42px;height:42px;border-radius:14px;background:linear-gradient(135deg,#fb923c,#f97316);color:#ffffff;font-weight:800;font-size:14px;">IA</span>
                        <span style="font-weight:700;font-size:16px;color:#0f172a;">MiRest con IA</span>
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 8px;">
                <h1 style="margin:0 0 10px;font-size:24px;line-height:1.2;color:#0f172a;font-weight:800;">${safeTitle}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 16px;color:#334155;font-size:15px;line-height:1.6;">
                ${body}
              </td>
            </tr>
            ${ctaUrl ? `
            <tr>
              <td style="padding:8px 32px 24px;" align="left">
                <a href="${escapeHtml(ctaUrl)}"
                   style="display:inline-block;padding:14px 26px;border-radius:14px;background:linear-gradient(135deg,#fb923c,#f97316);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;box-shadow:0 10px 24px rgba(222,90,37,0.3);">
                  ${safeCta}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 22px;color:#64748b;font-size:13px;line-height:1.55;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br/>
                <a href="${escapeHtml(ctaUrl)}" style="color:#ea580c;word-break:break-all;">${escapeHtml(ctaUrl)}</a>
              </td>
            </tr>
            ` : ""}
            ${footnote ? `
            <tr>
              <td style="padding:0 32px 24px;color:#94a3b8;font-size:12px;line-height:1.55;">
                ${safeFootnote}
              </td>
            </tr>
            ` : ""}
            <tr>
              <td style="padding:20px 32px;background:#0f1324;color:#cbd5e1;font-size:12px;line-height:1.5;">
                <strong style="color:#ffffff;">MiRest con IA</strong><br/>
                Plataforma operativa para restaurantes. Si no reconoces este correo, puedes ignorarlo.
              </td>
            </tr>
          </table>
          <p style="color:#94a3b8;font-size:12px;margin-top:18px;">
            © ${new Date().getFullYear()} MiRest con IA · Enviado automáticamente, no respondas a este correo.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function buildInvitationEmail({ fullName, restaurantName, activationUrl, roleLabel }) {
  const greet = fullName ? `Hola ${escapeHtml(fullName.split(" ")[0])},` : "Hola,";
  const restaurantLine = restaurantName
    ? `<p style="margin:0 0 14px;">Acabamos de aprobar el acceso de <strong>${escapeHtml(restaurantName)}</strong> a MiRest con IA.</p>`
    : `<p style="margin:0 0 14px;">Acabamos de aprobar tu acceso a MiRest con IA.</p>`;
  const roleLine = roleLabel
    ? `<p style="margin:0 0 14px;color:#475569;">Rol asignado: <strong>${escapeHtml(roleLabel)}</strong>.</p>`
    : "";

  const body = `
    <p style="margin:0 0 14px;">${greet}</p>
    ${restaurantLine}
    ${roleLine}
    <p style="margin:0 0 14px;">Para activar tu cuenta y definir tu contraseña, haz clic en el siguiente botón. El enlace es personal y de un solo uso.</p>
  `;

  return {
    subject: "Activa tu cuenta en MiRest con IA",
    html: baseLayout({
      title: "Bienvenido a MiRest con IA",
      preheader: "Activa tu cuenta y define tu contraseña para empezar a usar MiRest.",
      body,
      ctaLabel: "Activar mi cuenta",
      ctaUrl: activationUrl,
      footnote: "Este enlace expira por seguridad. Si no solicitaste esta activación, puedes ignorar este correo.",
    }),
    text: [
      `${greet}`,
      "Acabamos de aprobar tu acceso a MiRest con IA.",
      `Activa tu cuenta aquí: ${activationUrl}`,
    ].join("\n\n"),
  };
}
