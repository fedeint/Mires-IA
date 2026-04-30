export function isAlreadyRegisteredError(error) {
  if (!error) return false;
  const message = String(error.message || error.msg || "").toLowerCase();
  return (
    message.includes("already been registered") ||
    message.includes("already registered") ||
    message.includes("user already exists") ||
    message.includes("email address has already")
  );
}

export function isUserConfirmed(user) {
  if (!user) return false;
  return Boolean(user.email_confirmed_at || user.confirmed_at || user.last_sign_in_at);
}

/** GoTrue intentó enviar con SMTP del proyecto y falló (p. ej. Gmail 535 BadCredentials). */
export function isSupabaseMailerFailure(error) {
  if (!error) return false;
  const m = String(error.message || error.msg || "").toLowerCase();
  return (
    m.includes("error sending invite email") ||
    m.includes("sending invite") ||
    m.includes("535 ") ||
    m.includes("badcredentials") ||
    m.includes("smtp") ||
    m.includes("mailer") ||
    m.includes("gomail") ||
    m.includes("dial tcp") ||
    m.includes("connection refused") ||
    m.includes("rate limit exceeded")
  );
}
