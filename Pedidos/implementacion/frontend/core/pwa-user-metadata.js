/**
 * Sincroniza flags de PWA con user_metadata (Supabase Auth) cuando hay sesión.
 * Mismo singleton que el shell: scripts/supabase.js
 * @param {boolean} [value=true]
 */
export async function setMirestPwaOnboardingCompletado(value = true) {
  const { supabase, getCurrentUser } = await import("../../../../scripts/supabase.js");
  const user = await getCurrentUser();
  if (!user) {
    return;
  }
  const prev = user.user_metadata && typeof user.user_metadata === "object" ? { ...user.user_metadata } : {};
  const { error } = await supabase.auth.updateUser({
    data: { ...prev, mirest_pwa_onboarding_completado: value },
  });
  if (error) {
    console.warn("[PWA] No se pudo actualizar mirest_pwa_onboarding_completado", error);
  }
}
