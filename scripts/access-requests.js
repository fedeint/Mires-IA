import { supabase, supabaseKey, supabaseUrl } from "./supabase.js";

const ACCESS_REQUEST_COLUMNS = `
  id,
  full_name,
  email,
  phone,
  restaurant_name,
  legal_owner_name,
  business_count,
  city,
  country,
  applicant_role,
  notes,
  source,
  status,
  approved_role,
  approved_permissions,
  follow_up_notes,
  approved_at,
  rejected_at,
  invite_sent_at,
  approved_by,
  created_at,
  updated_at
`;

export const ACCESS_REQUEST_STATUS = {
  PENDING: "pending",
  REVIEWING: "reviewing",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export function normalizeAccessRequestPayload(payload) {
  return {
    full_name: payload.fullName.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone.trim() || null,
    restaurant_name: payload.restaurantName.trim(),
    legal_owner_name: payload.legalOwnerName.trim() || null,
    business_count: Number(payload.businessCount || 1),
    city: payload.city.trim() || null,
    country: payload.country.trim() || null,
    applicant_role: payload.applicantRole.trim() || null,
    notes: payload.notes.trim() || null,
    source: payload.source || "login",
  };
}

export async function submitAccessRequest(payload) {
  return supabase
    .from("access_requests")
    .insert(normalizeAccessRequestPayload(payload));
}

export async function listAccessRequests() {
  return supabase
    .from("access_requests")
    .select(ACCESS_REQUEST_COLUMNS)
    .order("created_at", { ascending: false });
}

export async function updateAccessRequest(id, changes) {
  return supabase
    .from("access_requests")
    .update(changes)
    .eq("id", id)
    .select(ACCESS_REQUEST_COLUMNS)
    .single();
}

export async function approveAccessRequest(requestId, role, action = "approve", permissions = []) {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    return {
      data: null,
      error: {
        message: "Tu sesión de administrador expiró. Vuelve a iniciar sesión antes de gestionar activaciones.",
      },
    };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/approve-access-request`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requestId, role, action, permissions }),
    });

    const text = await response.text();
    const payload = text ? JSON.parse(text) : null;

    if (!response.ok) {
      return {
        data: null,
        error: {
          message: payload?.message || `No se pudo completar la activación (${response.status}).`,
        },
      };
    }

    return { data: payload, error: null };
  } catch (error) {
    return {
      data: null,
      error: {
        message: error instanceof Error ? error.message : "Error inesperado al contactar la función de activación.",
      },
    };
  }
}

export function getStatusLabel(status) {
  switch (status) {
    case ACCESS_REQUEST_STATUS.PENDING:
      return "Pendiente";
    case ACCESS_REQUEST_STATUS.REVIEWING:
      return "En revisión";
    case ACCESS_REQUEST_STATUS.APPROVED:
      return "Aprobada";
    case ACCESS_REQUEST_STATUS.REJECTED:
      return "Rechazada";
    default:
      return "Desconocido";
  }
}

export function formatRequestDate(value) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
