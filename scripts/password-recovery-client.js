import { supabase } from "./supabase.js";

/**
 * Recuperación solo por Supabase Auth (correo SMTP configurado en el panel del proyecto).
 * Mismo flujo que el SDK en resetPasswordForEmail (correo lo envía Auth con tu SMTP).
 */
export async function requestPasswordRecoveryEmail(rawEmail) {
  const email = String(rawEmail || "")
    .trim()
    .toLowerCase();
  if (!email) {
    throw new Error("Indica un correo válido.");
  }

  const redirectTo = `${window.location.origin}/activate.html`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    throw new Error(
      error.message ||
        "No se pudo enviar la recuperación. Revisa en Supabase (Authentication → Emails / SMTP) que el envío esté bien configurado.",
    );
  }

  return {
    channel: "auth",
    message:
      "Si el correo está registrado, Supabase enviará el enlace al buzón (revisa spam y Promociones en Gmail). El remitente y el texto los defines en Authentication → Emails del panel de Supabase.",
  };
}
