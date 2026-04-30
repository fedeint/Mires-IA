import { supabase } from "../lib/supabase-client.js";

export async function getCurrentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  return data.user || null;
}

export async function requireAuth(redirectTo = "/login.html") {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

export async function signOutAndRedirect(redirectTo = "/login.html") {
  await supabase.auth.signOut();
  window.location.href = redirectTo;
}
