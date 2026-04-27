import {
  ACCESS_REQUEST_STATUS,
  approveAccessRequest,
  deleteAccessRequest,
  escapeHtml,
  formatRequestDate,
  getStatusLabel,
  listAccessRequests,
  notifyAccessRequestEvent,
  updateAccessRequest,
} from "../scripts/access-requests.js?v=20260421-uxpolish";
import { supabase } from "../scripts/supabase.js";
import {
  deleteUser,
  inviteUser,
  listUsers,
  restoreUser,
  revokeUser,
  sendPasswordRecoveryToUser,
  updateUserPermissions,
} from "../scripts/user-access.js?v=20260426-access-proxy-5";
import {
  DIA_CORTO,
  DIAS_ORDEN,
  fetchTurnosForContext,
  groupByUserId,
  replaceUserTurnos,
  resumirTurnosParaArbol,
} from "../scripts/usuario-turnos.js?v=20260503-v1";
import {
  getAssignableModules,
  getRoleLabel,
  ROLE_PERMISSIONS,
  FEATURE_ACCESS_ITEMS,
  getAssignablePermissionKeys,
} from "../scripts/navigation.js?v=20260426-roles-onboarding";
import { loadRolesConfigMap, getModulesForRoleFromDb } from "../scripts/roles-config.js";
import { shellRoleToAppRole } from "../scripts/mirest-role-maps.js";
import { startMirestModuleOnboarding } from "../scripts/mirest-module-onboarding-runner.js";

const tableBody = document.getElementById("requestsTableBody");
const feedback = document.getElementById("requestFeedback");
const rlsHint = document.getElementById("accesosRlsHint");
const refreshBtn = document.getElementById("refreshRequestsBtn");
const metricPending = document.getElementById("metricPending");
const metricReviewing = document.getElementById("metricReviewing");
const metricApproved = document.getElementById("metricApproved");

const usersTableBody = document.getElementById("usersTableBody");
const usersFeedback = document.getElementById("usersFeedback");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");

let accessRequests = [];
let usersList = [];
/** @type {string | null} */
let accesosCallerTenant = null;
/** @type {Array<Record<string, unknown>>} */
let turnosRows = [];
let isRendering = false;
let isLoadingUsers = false;
let showRejected = false;
let showApproved = false;

const ASSIGNABLE_MODULES = getAssignableModules();
const ASSIGNABLE_KEYS = getAssignablePermissionKeys();

function permLabel(key) {
  return (
    ASSIGNABLE_MODULES.find((m) => m.key === key)?.label ||
    FEATURE_ACCESS_ITEMS.find((f) => f.key === key)?.label ||
    key
  );
}
const BASE_ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "caja", label: "Caja" },
  { value: "chef", label: "Chef / Cocina" },
  { value: "pedidos", label: "Pedidos / Salón y delivery" },
  { value: "almacen", label: "Almacén" },
  { value: "marketing", label: "Marketing" },
];

function getRoleOptions() {
  if (typeof window !== "undefined" && window.currentUserRole === "superadmin") {
    return [
      { value: "superadmin", label: "Super Admin" },
      ...BASE_ROLE_OPTIONS,
    ];
  }
  return BASE_ROLE_OPTIONS.slice();
}

function setFeedback(message, variant) {
  feedback.textContent = message;
  feedback.className = `request-feedback request-feedback--${variant}`;
  feedback.style.display = "block";
}

function clearFeedback() {
  feedback.style.display = "none";
  feedback.textContent = "";
}

function setRlsHint(html) {
  if (!rlsHint) return;
  if (!html) {
    rlsHint.style.display = "none";
    rlsHint.innerHTML = "";
    return;
  }
  rlsHint.innerHTML = html;
  rlsHint.style.display = "block";
}

function setUsersFeedback(message, variant) {
  if (!usersFeedback) return;
  usersFeedback.textContent = message;
  usersFeedback.className = `request-feedback request-feedback--${variant}`;
  usersFeedback.style.display = "block";
}

function clearUsersFeedback() {
  if (!usersFeedback) return;
  usersFeedback.style.display = "none";
  usersFeedback.textContent = "";
}

function getStatusClass(status) {
  switch (status) {
    case ACCESS_REQUEST_STATUS.REVIEWING:
      return "request-pill request-pill--reviewing";
    case ACCESS_REQUEST_STATUS.APPROVED:
      return "request-pill request-pill--approved";
    case ACCESS_REQUEST_STATUS.REJECTED:
      return "request-pill request-pill--rejected";
    case ACCESS_REQUEST_STATUS.PENDING:
    default:
      return "request-pill request-pill--pending";
  }
}

function updateOverviewMetrics(requests) {
  // Las métricas siempre se calculan sobre el total (incluidas rechazadas),
  // aunque la tabla se muestre filtrada por el toggle.
  metricPending.textContent = String(requests.filter((item) => item.status === ACCESS_REQUEST_STATUS.PENDING).length);
  metricReviewing.textContent = String(requests.filter((item) => item.status === ACCESS_REQUEST_STATUS.REVIEWING).length);
  metricApproved.textContent = String(requests.filter((item) => item.status === ACCESS_REQUEST_STATUS.APPROVED).length);
}

function getVisibleRequests(requests) {
  return requests.filter((item) => {
    if (item.status === ACCESS_REQUEST_STATUS.REJECTED && !showRejected) return false;
    if (item.status === ACCESS_REQUEST_STATUS.APPROVED && !showApproved) return false;
    return true;
  });
}

function updateRejectedToggleLabel() {
  const toggle = document.getElementById("toggleRejectedBtn");
  if (!toggle) return;
  const rejectedCount = accessRequests.filter((r) => r.status === ACCESS_REQUEST_STATUS.REJECTED).length;
  const suffix = rejectedCount > 0 ? ` (${rejectedCount})` : "";
  toggle.textContent = (showRejected ? "Ocultar rechazadas" : "Mostrar rechazadas") + suffix;
  toggle.style.display = rejectedCount > 0 ? "" : "none";
}

function updateApprovedToggleLabel() {
  const toggle = document.getElementById("toggleApprovedBtn");
  if (!toggle) return;
  const approvedCount = accessRequests.filter((r) => r.status === ACCESS_REQUEST_STATUS.APPROVED).length;
  const suffix = approvedCount > 0 ? ` (${approvedCount})` : "";
  toggle.textContent = (showApproved ? "Ocultar aprobadas" : "Mostrar aprobadas") + suffix;
  toggle.style.display = approvedCount > 0 ? "" : "none";
}

function applyChefMarketingFeatures(role, base) {
  if (role === "chef" && !base.includes("almacen_lectura")) {
    base.push("almacen_lectura");
  }
  if (role === "marketing" && !base.includes("productos_lectura")) {
    base.push("productos_lectura");
  }
  return base;
}

function permissionsForRole(role) {
  const fromDb = getModulesForRoleFromDb(role);
  if (Array.isArray(fromDb) && fromDb.length) {
    if (fromDb.includes("*")) {
      return ASSIGNABLE_KEYS.slice();
    }
    const base = fromDb.filter((key) => ASSIGNABLE_KEYS.includes(key));
    return applyChefMarketingFeatures(role, base);
  }
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.includes("*")) {
    return ASSIGNABLE_KEYS.slice();
  }
  const base = perms.filter((key) => ASSIGNABLE_KEYS.includes(key));
  return applyChefMarketingFeatures(role, base);
}

function resolveInitialPermissions(request) {
  if (Array.isArray(request.approved_permissions) && request.approved_permissions.length > 0) {
    return request.approved_permissions.filter((key) => ASSIGNABLE_KEYS.includes(key));
  }
  return permissionsForRole(request.approved_role || "admin");
}

function renderPermGrid({ contextId, selected, disabled = false }) {
  const disabledClass = disabled ? " perm-chip--muted" : "";
  const moduleChips = ASSIGNABLE_MODULES.map((mod) => `
        <label class="perm-chip${disabledClass}" title="${escapeHtml(mod.description || mod.label)}">
          <input
            type="checkbox"
            data-perm-checkbox="${contextId}"
            value="${mod.key}"
            ${selected.includes(mod.key) ? "checked" : ""}
            ${disabled ? "disabled" : ""}
          />
          <span>${escapeHtml(mod.label)}</span>
        </label>
      `).join("");
  const featureChips = FEATURE_ACCESS_ITEMS.map((f) => `
        <label class="perm-chip perm-chip--feature${disabledClass}" title="${escapeHtml(f.description || f.label)}">
          <input
            type="checkbox"
            data-perm-checkbox="${contextId}"
            value="${f.key}"
            ${selected.includes(f.key) ? "checked" : ""}
            ${disabled ? "disabled" : ""}
          />
          <span>${escapeHtml(f.label)}</span>
        </label>
      `).join("");
  return `
    <div class="perm-grid" data-perm-grid="${contextId}">
      ${moduleChips}
    </div>
    <p class="perm-section-hint" style="margin:0.75rem 0 0.35rem;font-size:0.8rem;color:var(--color-text-muted);font-weight:600;">Opciones por módulo</p>
    <div class="perm-grid perm-grid--features" data-perm-grid-features="${contextId}">
      ${featureChips}
    </div>
    <div class="perm-actions">
      <button class="perm-link" type="button" onclick="window.permSelectAll('${contextId}')">Todos</button>
      <button class="perm-link" type="button" onclick="window.permSelectNone('${contextId}')">Ninguno</button>
      <button class="perm-link" type="button" onclick="window.permApplyRole('${contextId}')">Aplicar rol</button>
    </div>
  `;
}

window.permSelectAll = (contextId) => {
  document.querySelectorAll(`[data-perm-checkbox="${contextId}"]`).forEach((el) => { el.checked = true; });
};
window.permSelectNone = (contextId) => {
  document.querySelectorAll(`[data-perm-checkbox="${contextId}"]`).forEach((el) => { el.checked = false; });
};
window.permApplyRole = (contextId) => {
  const roleSelect = document.querySelector(`[data-role-select="${contextId}"]`);
  const role = roleSelect?.value || "admin";
  const defaults = permissionsForRole(role);
  document.querySelectorAll(`[data-perm-checkbox="${contextId}"]`).forEach((el) => {
    el.checked = defaults.includes(el.value);
  });
};

function readPermissions(contextId) {
  return Array.from(document.querySelectorAll(`[data-perm-checkbox="${contextId}"]:checked`))
    .map((el) => el.value);
}

function summarizeRequestPermissions(request) {
  const role = request.approved_role || "admin";
  const perms = Array.isArray(request.approved_permissions) && request.approved_permissions.length > 0
    ? request.approved_permissions
    : permissionsForRole(role);

  if (role === "admin" || role === "superadmin") {
    return "Todos los módulos";
  }
  if (!perms.length) return "Sin módulos asignados";
  if (perms.length <= 3) {
    return perms.map((key) => permLabel(key)).join(", ");
  }
  return `${perms.length} módulos habilitados`;
}

function getInitials(name) {
  if (!name) return "?";
  const words = String(name).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function buildRow(request) {
  const applicant = escapeHtml(request.full_name || "Sin nombre");
  const initials = escapeHtml(getInitials(request.full_name));
  const email = escapeHtml(request.email);
  const phone = request.phone ? escapeHtml(request.phone) : "";
  const businessCount = request.business_count === 1 ? "1 negocio" : `${request.business_count} negocios`;
  const location = [request.city, request.country].filter(Boolean).map(escapeHtml).join(" · ");
  const businessMeta = [businessCount, location].filter(Boolean).join(" · ");
  const notes = request.notes ? `<small>${escapeHtml(request.notes)}</small>` : "<small>Sin notas registradas.</small>";
  const roleLabel = escapeHtml(getRoleLabel(request.approved_role || "admin") || "Administrador");
  const permsSummary = escapeHtml(summarizeRequestPermissions(request));

  const isRejected = request.status === ACCESS_REQUEST_STATUS.REJECTED;
  const isApproved = request.status === ACCESS_REQUEST_STATUS.APPROVED;

  let actionsHtml;
  if (isRejected) {
    // Solicitud rechazada: reabrirla o eliminarla definitivamente del panel.
    actionsHtml = `
      <button class="btn btn--secondary request-actions__wide" type="button" onclick="window.setRequestStatus('${request.id}', 'reviewing')">
        Reabrir (pasar a revisión)
      </button>
      <button class="btn btn--secondary request-actions__wide request-actions__danger" type="button" onclick="window.deleteAccessRequestRow('${request.id}')">
        <i data-lucide="trash-2" style="width:15px;height:15px;"></i>
        Eliminar definitivamente
      </button>
    `;
  } else {
    const activationCta = isApproved
      ? `<button class="btn btn--secondary" type="button" onclick="window.resendActivation('${request.id}')">Reenviar activación</button>`
      : `<button class="btn btn--primary" type="button" onclick="window.approveRequest('${request.id}')">Aprobar y enviar activación</button>`;

    actionsHtml = `
      <button class="btn btn--primary request-actions__wide" type="button" onclick="window.configureRequestPermissions('${request.id}')">
        <i data-lucide="shield-check" style="width:16px;height:16px;"></i>
        Definir permisos
      </button>
      <div class="request-actions__row">
        <button class="btn btn--secondary" type="button" onclick="window.setRequestStatus('${request.id}', 'reviewing')">En revisión</button>
        <button class="btn btn--secondary" type="button" onclick="window.setRequestStatus('${request.id}', 'rejected')">Rechazar</button>
      </div>
      <div class="request-actions__wide">
        ${activationCta}
      </div>
    `;
  }

  return `
    <tr>
      <td data-label="Solicitante">
        <div class="applicant-card">
          <div class="applicant-avatar" aria-hidden="true">${initials}</div>
          <div class="applicant-body">
            <strong>${applicant}</strong>
            <span class="applicant-body__email">${email}</span>
            ${phone ? `<small>${phone}</small>` : ""}
          </div>
        </div>
      </td>
      <td data-label="Negocio">
        <div class="request-meta">
          <strong>${escapeHtml(request.restaurant_name)}</strong>
          <span>${escapeHtml(request.legal_owner_name || "Sin razón social")}</span>
          <small>${escapeHtml(businessMeta || "Sin ubicación registrada")}</small>
        </div>
      </td>
      <td data-label="Seguimiento">
        <div class="request-meta">
          <span>Creada: ${escapeHtml(formatRequestDate(request.created_at))}</span>
          <small>${escapeHtml(request.applicant_role || "Rol no especificado")}</small>
          ${notes}
        </div>
      </td>
      <td data-label="Estado">
        <div class="request-status">
          <span class="${getStatusClass(request.status)}">${escapeHtml(getStatusLabel(request.status))}</span>
          <small>${escapeHtml(request.invite_sent_at ? `Invitación: ${formatRequestDate(request.invite_sent_at)}` : "Sin invitación enviada")}</small>
          <div class="request-access-summary">
            <span class="request-access-summary__label">Acceso configurado</span>
            <strong>${roleLabel}</strong>
            <small>${permsSummary}</small>
          </div>
        </div>
      </td>
      <td data-label="Acciones">
        <div class="request-actions--stack">
          ${actionsHtml}
        </div>
      </td>
    </tr>
  `;
}

function renderTable(requests) {
  updateOverviewMetrics(requests);
  updateRejectedToggleLabel();
  updateApprovedToggleLabel();

  const visible = getVisibleRequests(requests);

  if (requests.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Todavía no hay solicitudes registradas.</td></tr>`;
    return;
  }
  if (visible.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No hay solicitudes activas. Las aprobadas ya son usuarios con acceso y las rechazadas están ocultas.</td></tr>`;
    return;
  }

  tableBody.innerHTML = visible.map(buildRow).join("");
}

async function loadRequests() {
  if (isRendering) return;

  isRendering = true;
  refreshBtn.disabled = true;
  clearFeedback();
  setRlsHint("");

  let { data, error } = await listAccessRequests();

  // La RLS usa app_metadata.role en el JWT. Tras cambiar metadatos en Supabase,
  // el access_token guardado puede seguir antiguo: renovamos y reintentamos una vez.
  if (!error && (data?.length ?? 0) === 0) {
    const { data: sessionData } = await supabase.auth.getSession();
    const u = sessionData?.session?.user;
    const claimsSuperadmin =
      u?.app_metadata?.role === "superadmin" || u?.user_metadata?.role === "superadmin";
    if (claimsSuperadmin) {
      const { error: refreshErr } = await supabase.auth.refreshSession();
      if (!refreshErr) {
        const retry = await listAccessRequests();
        data = retry.data;
        error = retry.error;
      }
    }
  }

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No pudimos cargar las solicitudes.</td></tr>`;
    setFeedback("No pudimos leer las solicitudes desde Supabase. Revisa la sesión y las políticas RLS.", "error");
    refreshBtn.disabled = false;
    isRendering = false;
    return;
  }

  if ((data?.length ?? 0) === 0) {
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    const appRole = typeof user?.app_metadata?.role === "string" ? user.app_metadata.role.trim() : "";
    const userRole = typeof user?.user_metadata?.role === "string" ? user.user_metadata.role.trim() : "";
    if (userRole === "superadmin" && appRole !== "superadmin") {
      setRlsHint(
        "<strong>Rol de superadmin solo en User metadata.</strong> Las solicitudes se leen con RLS usando "
        + "<code>App metadata</code>. En Supabase: <strong>Authentication → Users → tu usuario → App metadata</strong> "
        + "añade <code>{\"role\":\"superadmin\"}</code>, guarda y luego <strong>cierra sesión y vuelve a entrar</strong> en MiRest.",
      );
    }
  }

  accessRequests = data ?? [];
  renderTable(accessRequests);
  if (window.lucide) window.lucide.createIcons();
  refreshBtn.disabled = false;
  isRendering = false;
}

window.setRequestStatus = async (requestId, status) => {
  const updates = {
    status,
    rejected_at: status === ACCESS_REQUEST_STATUS.REJECTED ? new Date().toISOString() : null,
  };

  const { error } = await updateAccessRequest(requestId, updates);
  if (error) {
    setFeedback("No se pudo actualizar el estado de la solicitud.", "error");
    return;
  }

  let notifySuffix = "";
  if (status === ACCESS_REQUEST_STATUS.REVIEWING || status === ACCESS_REQUEST_STATUS.REJECTED) {
    const notifyType = status === ACCESS_REQUEST_STATUS.REVIEWING ? "reviewing" : "rejected";
    const { error: notifyError } = await notifyAccessRequestEvent(notifyType, requestId);
    notifySuffix = notifyError
      ? " (el correo al solicitante no pudo enviarse)"
      : " y se notificó al solicitante por correo";
  }

  setFeedback(
    `Solicitud actualizada a ${getStatusLabel(status).toLowerCase()}${notifySuffix}.`,
    "success",
  );
  await loadRequests();
};

async function saveRequestPermissions(requestId, role, permissions) {
  const updates = {
    approved_role: role,
    approved_permissions: permissions,
  };

  const { error } = await updateAccessRequest(requestId, updates);
  if (error) {
    throw new Error("No se pudo guardar la configuración de permisos.");
  }

  const request = accessRequests.find((item) => item.id === requestId);
  if (request) {
    request.approved_role = role;
    request.approved_permissions = permissions;
  }
}

window.configureRequestPermissions = (requestId) => {
  const request = accessRequests.find((item) => item.id === requestId);
  if (!request) return;

  openConfigModal({
    title: "Configurar permisos",
    subject: `Solicitud de ${request.full_name} · ${request.email}`,
    initialRole: request.approved_role || "admin",
    initialPerms: resolveInitialPermissions(request),
    confirmLabel: "Guardar permisos",
    onConfirm: async (role, permissions) => {
      try {
        await saveRequestPermissions(requestId, role, permissions);
        setFeedback("Permisos guardados para esta solicitud.", "success");
        await loadRequests();
        return true;
      } catch (error) {
        setFeedback(error.message || "No se pudo guardar la configuración.", "error");
        return false;
      }
    },
  });
};

function buildActivationSummary(request, role, permissions) {
  const roleLabel = getRoleLabel(role) || "Administrador";
  const isFullAccess = role === "admin" || role === "superadmin";
  const permsHtml = isFullAccess
    ? `<span class="confirm-perm confirm-perm--all">Todos los módulos</span>`
    : permissions.length === 0
      ? `<span class="confirm-perm confirm-perm--warn">Sin módulos asignados</span>`
      : permissions
          .map((key) => {
            const label = permLabel(key);
            return `<span class="confirm-perm">${escapeHtml(label)}</span>`;
          })
          .join("");

  return `
    <div class="confirm-grid">
      <div class="confirm-row">
        <span class="confirm-row__label">Solicitante</span>
        <strong>${escapeHtml(request.full_name || "Sin nombre")}</strong>
        <small>${escapeHtml(request.email)}</small>
      </div>
      <div class="confirm-row">
        <span class="confirm-row__label">Negocio</span>
        <strong>${escapeHtml(request.restaurant_name || "Sin negocio")}</strong>
      </div>
      <div class="confirm-row">
        <span class="confirm-row__label">Rol asignado</span>
        <strong>${escapeHtml(roleLabel)}</strong>
      </div>
      <div class="confirm-row">
        <span class="confirm-row__label">Módulos habilitados</span>
        <div class="confirm-perms">${permsHtml}</div>
      </div>
    </div>
  `;
}

function openActivationConfirmModal({ request, role, permissions, mode }) {
  return new Promise((resolve) => {
    const isResend = mode === "resend";
    const title = isResend ? "Reenviar activación" : "Aprobar solicitud";
    const description = isResend
      ? "Volveremos a enviar el correo de activación a este solicitante con la configuración actual."
      : "Se creará la invitación y enviaremos el correo de activación al solicitante.";
    const confirmLabel = isResend ? "Sí, reenviar" : "Sí, aprobar y enviar";
    const confirmClass = isResend ? "btn--secondary" : "btn--primary";

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-card modal-card--confirm" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="confirm-header">
          <div class="confirm-icon" aria-hidden="true">
            <i data-lucide="${isResend ? "send" : "shield-check"}"></i>
          </div>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
          </div>
        </div>
        ${buildActivationSummary(request, role, permissions)}
        <div class="modal-actions">
          <button class="btn btn--secondary" type="button" data-confirm-cancel>Cancelar</button>
          <button class="btn ${confirmClass}" type="button" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;

    document.body.appendChild(backdrop);
    if (window.lucide) window.lucide.createIcons();

    const cleanup = (result) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };

    function onKey(event) {
      if (event.key === "Escape") cleanup(false);
      if (event.key === "Enter") cleanup(true);
    }

    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) cleanup(false);
    });
    backdrop.querySelector("[data-confirm-cancel]").addEventListener("click", () => cleanup(false));
    backdrop.querySelector("[data-confirm-ok]").addEventListener("click", () => cleanup(true));
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      backdrop.querySelector("[data-confirm-ok]")?.focus();
    }, 10);
  });
}

function openDangerConfirmModal({ title, description, detail, confirmLabel }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-card modal-card--confirm" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="confirm-header">
          <div class="confirm-icon confirm-icon--danger" aria-hidden="true">
            <i data-lucide="alert-triangle"></i>
          </div>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
          </div>
        </div>
        ${detail ? `<div class="confirm-detail">${escapeHtml(detail)}</div>` : ""}
        <div class="modal-actions">
          <button class="btn btn--secondary" type="button" data-confirm-cancel>Cancelar</button>
          <button class="btn btn--danger" type="button" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    if (window.lucide) window.lucide.createIcons();

    const cleanup = (result) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    function onKey(event) {
      if (event.key === "Escape") cleanup(false);
    }
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) cleanup(false);
    });
    backdrop.querySelector("[data-confirm-cancel]").addEventListener("click", () => cleanup(false));
    backdrop.querySelector("[data-confirm-ok]").addEventListener("click", () => cleanup(true));
    document.addEventListener("keydown", onKey);
  });
}

function openNeutralConfirmModal({ title, description, confirmLabel }) {
  return new Promise((resolve) => {
    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal-card modal-card--confirm" role="dialog" aria-label="${escapeHtml(title)}">
        <div class="confirm-header">
          <div class="confirm-icon" aria-hidden="true">
            <i data-lucide="mail"></i>
          </div>
          <div>
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(description)}</p>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn--secondary" type="button" data-confirm-cancel>Cancelar</button>
          <button class="btn btn--primary" type="button" data-confirm-ok>${escapeHtml(confirmLabel)}</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);
    if (window.lucide) window.lucide.createIcons();

    const cleanup = (result) => {
      backdrop.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    };
    function onKey(event) {
      if (event.key === "Escape") cleanup(false);
    }
    backdrop.addEventListener("click", (event) => {
      if (event.target === backdrop) cleanup(false);
    });
    backdrop.querySelector("[data-confirm-cancel]").addEventListener("click", () => cleanup(false));
    backdrop.querySelector("[data-confirm-ok]").addEventListener("click", () => cleanup(true));
    document.addEventListener("keydown", onKey);
    setTimeout(() => {
      backdrop.querySelector("[data-confirm-ok]")?.focus();
    }, 10);
  });
}

window.approveRequest = async (requestId) => {
  const request = accessRequests.find((item) => item.id === requestId);
  if (!request) return;

  const role = request.approved_role || "admin";
  const permissions = resolveInitialPermissions(request);

  if (permissions.length === 0 && role !== "admin" && role !== "superadmin") {
    setFeedback("Primero configura los permisos de esta solicitud desde \"Definir permisos\".", "error");
    return;
  }

  const confirmed = await openActivationConfirmModal({
    request,
    role,
    permissions,
    mode: "approve",
  });
  if (!confirmed) return;

  clearFeedback();
  setFeedback("Procesando aprobación y enviando correo de activación…", "success");

  const { data, error } = await approveAccessRequest(requestId, role, "approve", permissions);
  if (error) {
    setFeedback(error.message || "No se pudo aprobar la solicitud ni enviar la activación.", "error");
    return;
  }
  setFeedback(data?.message || "Solicitud aprobada. La activación fue enviada por correo.", "success");
  await loadRequests();
};

window.resendActivation = async (requestId) => {
  const request = accessRequests.find((item) => item.id === requestId);
  if (!request) return;

  const role = request.approved_role || "admin";
  const permissions = resolveInitialPermissions(request);

  const confirmed = await openActivationConfirmModal({
    request,
    role,
    permissions,
    mode: "resend",
  });
  if (!confirmed) return;

  clearFeedback();
  setFeedback("Reenviando correo de activación…", "success");

  const { data, error } = await approveAccessRequest(requestId, role, "resend", permissions);
  if (error) {
    setFeedback(error.message || "No se pudo reenviar la activación.", "error");
    return;
  }
  setFeedback(data?.message || "La activación fue reenviada por correo.", "success");
  await loadRequests();
};

window.deleteAccessRequestRow = async (requestId) => {
  const request = accessRequests.find((item) => item.id === requestId);
  if (!request) return;

  const confirmed = await openDangerConfirmModal({
    title: "Eliminar solicitud del panel",
    description: "Esta acción borra la solicitud de forma permanente. Si el solicitante vuelve a enviar el formulario se creará una solicitud nueva.",
    detail: `${request.full_name || "Sin nombre"} · ${request.email}`,
    confirmLabel: "Sí, eliminar",
  });
  if (!confirmed) return;

  const { error } = await deleteAccessRequest(requestId);
  if (error) {
    setFeedback(error.message || "No se pudo eliminar la solicitud.", "error");
    return;
  }
  setFeedback("Solicitud eliminada del panel.", "success");
  await loadRequests();
};

function isBanned(user) {
  if (!user?.banned_until) return false;
  const bannedUntil = new Date(user.banned_until).getTime();
  if (Number.isNaN(bannedUntil)) return false;
  return bannedUntil > Date.now();
}

function isPendingActivation(user) {
  return !user?.email_confirmed_at && !user?.last_sign_in_at;
}

function getUserStatusPill(user) {
  if (user.protected) {
    return `<span class="request-pill request-pill--reviewing">Demo</span>`;
  }
  if (isBanned(user)) {
    return `<span class="request-pill request-pill--rejected">Revocado</span>`;
  }
  if (isPendingActivation(user)) {
    return `<span class="request-pill request-pill--pending">Pendiente activación</span>`;
  }
  return `<span class="request-pill request-pill--approved">Activo</span>`;
}

function summarizePermissions(user) {
  if (user.role === "admin" || user.role === "superadmin") {
    return "Todos los módulos";
  }
  const perms = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : permissionsForRole(user.role);
  if (perms.length === 0) return "Sin módulos asignados";
  if (perms.length <= 3) {
    return perms.map((key) => permLabel(key)).join(", ");
  }
  return `${perms.length} módulos habilitados`;
}

function buildUserRow(user) {
  const email = escapeHtml(user.email || "Sin correo");
  const name = escapeHtml(user.full_name || "Sin nombre registrado");
  const role = escapeHtml(getRoleLabel(user.role) || "Sin rol");
  const createdAt = formatRequestDate(user.created_at);
  const lastSignIn = user.last_sign_in_at ? formatRequestDate(user.last_sign_in_at) : "Nunca ha iniciado sesión";
  const banned = isBanned(user);
  const permsSummary = escapeHtml(summarizePermissions(user));

  let actions = "";
  if (user.protected) {
    const recoveryDemo = user.email
      ? `<button class="btn btn--secondary" type="button" title="Correo con enlace seguro para nueva contraseña" onclick="window.sendUserPasswordRecoveryEmail('${user.id}')">Enviar recuperación</button>`
      : "";
    actions = `
      <button class="btn btn--secondary" type="button" onclick="window.editUserPermissions('${user.id}')">Editar módulos</button>
      ${recoveryDemo}
      <small style="color: var(--color-text-muted);">Demo: no se puede revocar.</small>
    `;
  } else if (banned) {
    const recoveryBtnBanned = user.email
      ? `<button class="btn btn--secondary" type="button" title="Correo con enlace seguro para nueva contraseña" onclick="window.sendUserPasswordRecoveryEmail('${user.id}')">Enviar recuperación</button>`
      : "";
    actions = `
      <button class="btn btn--primary" type="button" onclick="window.restoreUserAccess('${user.id}')">Restaurar acceso</button>
      <button class="btn btn--secondary" type="button" onclick="window.editUserPermissions('${user.id}')">Editar módulos</button>
      ${recoveryBtnBanned}
      <button class="btn btn--secondary" type="button" onclick="window.deleteUserAccount('${user.id}')">Eliminar</button>
    `;
  } else {
    const recoveryBtn = user.email
      ? `<button class="btn btn--secondary" type="button" title="Correo con enlace seguro para nueva contraseña" onclick="window.sendUserPasswordRecoveryEmail('${user.id}')">Enviar recuperación</button>`
      : "";
    actions = `
      <button class="btn btn--primary" type="button" onclick="window.editUserPermissions('${user.id}')">Editar módulos</button>
      ${recoveryBtn}
      <button class="btn btn--secondary" type="button" onclick="window.revokeUserAccess('${user.id}')">Revocar acceso</button>
      <button class="btn btn--secondary" type="button" onclick="window.deleteUserAccount('${user.id}')">Eliminar</button>
    `;
  }

  return `
    <tr>
      <td data-label="Usuario">
        <div class="request-meta">
          <strong>${name}</strong>
          <span>${email}</span>
          <small>Creado: ${escapeHtml(createdAt)}</small>
        </div>
      </td>
      <td data-label="Rol">
        <div class="request-meta">
          <strong>${role}</strong>
          <small>${permsSummary}</small>
        </div>
      </td>
      <td data-label="Último ingreso">
        <div class="request-meta">
          <span>${escapeHtml(lastSignIn)}</span>
        </div>
      </td>
      <td data-label="Estado">
        <div class="request-meta">
          ${getUserStatusPill(user)}
          ${banned ? `<small>Hasta ${escapeHtml(formatRequestDate(user.banned_until))}</small>` : ""}
        </div>
      </td>
      <td data-label="Acciones">
        <div class="request-actions">
          ${actions}
        </div>
      </td>
    </tr>
  `;
}

function renderUsersTable(users) {
  if (!usersTableBody) return;

  if (!users.length) {
    usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Aún no hay usuarios registrados.</td></tr>`;
    return;
  }

  usersTableBody.innerHTML = users.map(buildUserRow).join("");
  if (window.lucide) window.lucide.createIcons();
}

async function loadUsers() {
  if (!usersTableBody || isLoadingUsers) return;

  isLoadingUsers = true;
  if (refreshUsersBtn) refreshUsersBtn.disabled = true;
  clearUsersFeedback();

  try {
    const data = await listUsers();
    usersList = data?.users ?? [];
    accesosCallerTenant = data?.callerTenant ?? accesosCallerTenant;
    renderUsersTable(usersList);
    await loadCrono();
  } catch (error) {
    usersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No pudimos cargar los usuarios.</td></tr>`;
    setUsersFeedback(error.message || "Error cargando usuarios.", "error");
  } finally {
    if (refreshUsersBtn) refreshUsersBtn.disabled = false;
    isLoadingUsers = false;
  }
}

window.revokeUserAccess = async (userId) => {
  const user = usersList.find((item) => item.id === userId);
  const label = user?.email || "este usuario";
  const name = user?.full_name ? `${user.full_name} · ${label}` : label;

  const confirmed = await openDangerConfirmModal({
    title: "Revocar acceso",
    description: "El usuario no podrá iniciar sesión hasta que restaures su acceso. Podrás revertir esta acción cuando quieras.",
    detail: name,
    confirmLabel: "Sí, revocar acceso",
  });
  if (!confirmed) return;

  clearUsersFeedback();
  setUsersFeedback(`Revocando acceso de ${label}…`, "success");

  try {
    const data = await revokeUser(userId);
    setUsersFeedback(data?.message || "Acceso revocado correctamente.", "success");
    await loadUsers();
  } catch (error) {
    setUsersFeedback(error.message || "No pudimos revocar el acceso.", "error");
  }
};

window.restoreUserAccess = async (userId) => {
  const user = usersList.find((item) => item.id === userId);
  const label = user?.email || "este usuario";
  clearUsersFeedback();
  setUsersFeedback(`Restaurando acceso de ${label}…`, "success");

  try {
    const data = await restoreUser(userId);
    setUsersFeedback(data?.message || "Acceso restaurado correctamente.", "success");
    await loadUsers();
  } catch (error) {
    setUsersFeedback(error.message || "No pudimos restaurar el acceso.", "error");
  }
};

window.sendUserPasswordRecoveryEmail = async (userId) => {
  const user = usersList.find((item) => item.id === userId);
  if (!user?.email) {
    setUsersFeedback("Este usuario no tiene correo registrado.", "error");
    return;
  }
  const label = user.email;
  const confirmed = await openNeutralConfirmModal({
    title: "Enviar recuperación de contraseña",
    description:
      `Se enviará un correo a ${label} con un enlace seguro para que elija una nueva contraseña. Por diseño de seguridad, ni tú ni el sistema pueden ver la contraseña actual (solo existe un hash cifrado).`,
    confirmLabel: "Enviar correo",
  });
  if (!confirmed) return;

  clearUsersFeedback();
  setUsersFeedback(`Enviando recuperación a ${label}…`, "success");

  try {
    const data = await sendPasswordRecoveryToUser(userId);
    setUsersFeedback(data?.message || "Correo de recuperación enviado.", "success");
  } catch (error) {
    setUsersFeedback(error.message || "No se pudo enviar el correo de recuperación.", "error");
  }
};

window.deleteUserAccount = async (userId) => {
  const user = usersList.find((item) => item.id === userId);
  const label = user?.email || "este usuario";
  const name = user?.full_name ? `${user.full_name} · ${label}` : label;

  const confirmed = await openDangerConfirmModal({
    title: "Eliminar usuario permanentemente",
    description: "Esta acción borra la cuenta de autenticación de forma definitiva. No podrás deshacerla y el usuario deberá registrarse de nuevo para volver a tener acceso.",
    detail: name,
    confirmLabel: "Sí, eliminar usuario",
  });
  if (!confirmed) return;

  clearUsersFeedback();
  setUsersFeedback(`Eliminando a ${label}…`, "success");

  try {
    const data = await deleteUser(userId);
    setUsersFeedback(data?.message || "Usuario eliminado.", "success");
    await loadUsers();
  } catch (error) {
    setUsersFeedback(error.message || "No pudimos eliminar al usuario.", "error");
  }
};

window.editUserPermissions = (userId) => {
  const user = usersList.find((item) => item.id === userId);
  if (!user) return;

  const initialRole = user.role || "admin";
  const initialPerms = Array.isArray(user.permissions) && user.permissions.length > 0
    ? user.permissions
    : permissionsForRole(initialRole);

  openConfigModal({
    title: "Editar módulos del usuario",
    subject: `Usuario: ${user.email}`,
    initialRole,
    initialPerms,
    confirmLabel: "Guardar cambios",
    onConfirm: async (role, permissions) => {
      try {
        const data = await updateUserPermissions(user.id, permissions, role);
        const appR = shellRoleToAppRole(role);
        const { error: perr } = await supabase
          .from("usuarios")
          .update({ modulos_acceso: permissions, role: appR })
          .eq("id", user.id);
        if (perr) {
          console.warn("[accesos] user_profiles (sync tras guardar en Auth):", perr);
        }
        setUsersFeedback(data?.message || "Módulos actualizados.", "success");
        await loadUsers();
        return true;
      } catch (error) {
        setUsersFeedback(error.message || "No pudimos actualizar los módulos.", "error");
        return false;
      }
    },
  });
};

function openConfigModal({ title, subject, initialRole, initialPerms, confirmLabel, onConfirm }) {
  const contextId = `modal-${Date.now()}`;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <div class="modal-card" role="dialog" aria-label="${escapeHtml(title)}">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(subject)}</p>

      <label class="modal-label">Rol principal</label>
      <select class="request-role-select" data-role-select="${contextId}" style="width:100%; max-width: 320px; margin-bottom: var(--space-4);">
        ${getRoleOptions()
          .map((opt) => `<option value="${opt.value}" ${opt.value === initialRole ? "selected" : ""}>${opt.label}</option>`)
          .join("")}
      </select>

      <label class="modal-label">Módulos habilitados</label>
      ${renderPermGrid({ contextId, selected: initialPerms })}

      <div class="modal-actions">
        <button class="btn btn--secondary" type="button" data-modal-cancel>Cancelar</button>
        <button class="btn btn--primary" type="button" data-modal-save>${escapeHtml(confirmLabel)}</button>
      </div>
    </div>
  `;

  document.body.appendChild(backdrop);

  const roleSel = backdrop.querySelector(`[data-role-select="${contextId}"]`);
  if (roleSel) {
    roleSel.addEventListener("change", () => {
      window.permApplyRole(contextId);
    });
  }

  const close = () => backdrop.remove();
  const saveBtn = backdrop.querySelector("[data-modal-save]");

  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop) close();
  });
  backdrop.querySelector("[data-modal-cancel]").addEventListener("click", close);
  saveBtn.addEventListener("click", async () => {
    const role = backdrop.querySelector(`[data-role-select="${contextId}"]`).value;
    const permissions = readPermissions(contextId);

    if (permissions.length === 0 && role !== "admin" && role !== "superadmin") {
      setUsersFeedback("Selecciona al menos un módulo o cambia el rol a Administrador.", "error");
      setFeedback("Selecciona al menos un módulo o cambia el rol a Administrador.", "error");
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = "Procesando…";
    const ok = await onConfirm(role, permissions);
    if (ok) {
      close();
    } else {
      saveBtn.disabled = false;
      saveBtn.textContent = confirmLabel;
    }
  });

  document.addEventListener("keydown", function escHandler(event) {
    if (event.key === "Escape") {
      close();
      document.removeEventListener("keydown", escHandler);
    }
  });
}

// ── Turnos / cronograma (usuario_turnos) ───────────────────────────────────

function getRoleCronoClass(role) {
  const r = (role || "").toLowerCase();
  if (r === "caja") return "crono-cell--caja";
  if (r === "chef" || r === "cocinero" || r === "pedidos" || r === "mesero") return "crono-cell--ops";
  if (r === "almacen" || r === "almacenero") return "crono-cell--alm";
  if (r === "admin" || r === "superadmin" || r === "administrador") return "crono-cell--admin";
  return "crono-cell--def";
}

function buildWeekCell(user, dia, byUser) {
  const list = (byUser.get(user.id) || []).filter((t) => t.activo !== false);
  const t = list.find((r) => r.dia === dia);
  if (t) {
    const a = (t.hora_entrada || "").toString().slice(0, 5);
    const b = (t.hora_salida || "").toString().slice(0, 5);
    return `<div class="crono-cell ${getRoleCronoClass(user.role)}" data-dia="${dia}">${a}–${b}</div>`;
  }
  if (isPendingActivation(user) || user.banned_until) {
    return `<div class="crono-cell crono-cell--empty">—</div>`;
  }
  if (!list.length) {
    return `<div class="crono-cell crono-cell--warn" title="Turno pendiente: sin franja activa este día" data-dia="${dia}">⚠</div>`;
  }
  return `<div class="crono-cell crono-cell--empty">—</div>`;
}

async function loadCrono() {
  const treeEl = document.getElementById("cronoArbolTree");
  const weekEl = document.getElementById("cronoWeekGrid");
  if (!treeEl) return;
  const ids = usersList.map((u) => u.id);
  try {
    turnosRows = await fetchTurnosForContext(ids);
  } catch (e) {
    console.warn(e);
    turnosRows = [];
  }
  const byUser = groupByUserId(turnosRows);
  const tid =
    accesosCallerTenant ||
    usersList.find((u) => u.tenant_id)?.tenant_id ||
    null;
  let tenantName = "Restaurante";
  if (tid) {
    const { data: tn } = await supabase.from("tenants").select("name").eq("id", tid).maybeSingle();
    if (tn?.name) tenantName = tn.name;
  }
  const admin = usersList.find(
    (u) => (u.role === "admin" || u.role === "superadmin") && !u.protected,
  ) || usersList[0];
  const adminName =
    (window.currentUserProfile && window.currentUserProfile.firstName) ||
    admin?.full_name ||
    admin?.email ||
    "Admin";

  const lines = [];
  lines.push(`<div class="crono-tree-root"><span class="crono-tree-ico" aria-hidden="true">🏠</span> <strong>${escapeHtml(
    tenantName,
  )}</strong> <span class="crono-tree-sub">(Admin: ${escapeHtml(adminName)})</span></div>`);
  for (const u of usersList) {
    if (u.protected) continue;
    const tlist = byUser.get(u.id) || [];
    const hasActivo = tlist.some((r) => r.activo !== false);
    const res = resumirTurnosParaArbol(tlist);
    const isInactive = !!u.banned_until;
    const isGrey = isInactive;
    const turnoPendiente = !isInactive && !isPendingActivation(u) && !hasActivo;
    const badge = isGrey
      ? "⚫ <span class=\"crono-tree-badge crono-tree-badge--grey\">Inactivo</span>"
      : isPendingActivation(u)
        ? ""
        : turnoPendiente
          ? "<span class=\"crono-tree-badge crono-tree-badge--warn\" title=\"Sin turno asignado: ninguna fila activa en usuario_turnos\">Turno pendiente</span>"
          : "✅";
    const roleL = getRoleLabel(u.role) || u.role || "—";
    const head = `${isGrey ? "⚫" : "👤"} <strong>${escapeHtml(u.full_name || u.email || u.id)}</strong> — ${escapeHtml(
      roleL,
    )} ${badge ? ` ${badge}` : ""}
      <button type="button" class="btn btn--secondary" style="font-size: 11px; margin-left: 6px" data-edit-turno="${u.id}">${hasActivo ? "Editar turno" : "Asignar turno"}</button>
    `;
    let sub = "";
    if (hasActivo) {
      sub = `<ul class="crono-tree-feat">${res.map((x) => `<li>${escapeHtml(x)}</li>`).join("")}</ul>`;
    } else if (turnoPendiente) {
      const hint =
        tlist.length > 0
          ? "Tienes días guardados, pero el turno está desactivado o incompleto. Pulsa <strong>Asignar turno</strong>."
          : "Sin días u horas activas. Pulsa <strong>Asignar turno</strong>.";
      sub = `<p class="crono-tree-feat" style="color: #c2410c; margin: 4px 0 0 18px">${hint}</p>`;
    }
    lines.push(`<div class="crono-tree-user ${isGrey ? "crono-tree-user--grey" : ""}">${head}${sub ? `<div style="padding-left: 18px">${sub}</div>` : ""}</div>`);
  }
  treeEl.innerHTML = lines.join("");

  treeEl.querySelectorAll("[data-edit-turno]").forEach((btn) => {
    btn.addEventListener("click", () => openEditTurnoModal(/** @type {string} */ (btn.getAttribute("data-edit-turno"))));
  });

  if (weekEl) {
    let header = '<table class="crono-week-t"><thead><tr><th class="crono-w-name"></th>';
    for (const d of DIAS_ORDEN) {
      header += `<th>${DIA_CORTO[d]}</th>`;
    }
    header += "</tr></thead><tbody>";
    for (const u of usersList) {
      if (u.protected) continue;
      header += `<tr data-crono-user-id="${escapeHtml(u.id)}"><th class="crono-w-who"><span class="crono-w-namein">${escapeHtml(
        u.full_name || u.email || u.id,
      )}</span></th>`;
      for (const d of DIAS_ORDEN) {
        header += `<td>${buildWeekCell(u, d, byUser)}</td>`;
      }
      header += "</tr>";
    }
    header += "</tbody></table>";
    weekEl.innerHTML = header;
    weekEl.querySelectorAll(".crono-cell--warn").forEach((el) => {
      const tr = el.closest("tr");
      const uid = tr && tr.getAttribute("data-crono-user-id");
      if (uid) {
        el.addEventListener("click", () => openEditTurnoModal(uid));
        el.setAttribute("role", "button");
        el.setAttribute("tabindex", "0");
      }
    });
  }
  if (window.lucide) window.lucide.createIcons();
}

let invitePermContextId = "invite-perm-ctx";

function setupInviteDias() {
  const host = document.getElementById("inviteDiasRow");
  if (!host) return;
  host.innerHTML = DIAS_ORDEN.map((d) => {
    return `<label style="display: inline-flex; align-items: center; gap: 4px; font-size: 13px;">
      <input type="checkbox" class="crono-dia-cb" value="${d}" ${["lunes", "martes", "miercoles", "jueves", "viernes"].includes(d) ? "checked" : ""} />
      ${DIA_CORTO[d]}</label>`;
  }).join("");
}

function setupInviteForm() {
  const form = document.getElementById("formInviteUser");
  const roleSel = document.getElementById("inviteRole");
  const perms = document.getElementById("invitePermContainer");
  if (!form || !roleSel || !perms) return;
  roleSel.innerHTML = getRoleOptions()
    .map((o) => `<option value="${o.value}">${o.label}</option>`)
    .join("");
  invitePermContextId = "invite-" + Date.now();
  perms.innerHTML = `<label class="modal-label">Módulos habilitados</label>` + renderPermGrid({ contextId: invitePermContextId, selected: permissionsForRole("admin") });
  roleSel.addEventListener("change", () => {
    perms.innerHTML = `<label class="modal-label">Módulos habilitados</label>` + renderPermGrid({ contextId: invitePermContextId, selected: permissionsForRole(roleSel.value) });
    if (window.lucide) window.lucide.createIcons();
  });
  setupInviteDias();
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const fb = document.getElementById("inviteFormFeedback");
    if (fb) {
      fb.textContent = "Enviando invitación…";
      fb.style.color = "var(--color-text-muted)";
    }
    const email = document.getElementById("inviteEmail")?.value?.trim() || "";
    const fullName = document.getElementById("inviteNombre")?.value?.trim() || "";
    const role = roleSel.value;
    const permissions = readPermissions(invitePermContextId);
    if (permissions.length === 0 && role !== "admin" && role !== "superadmin") {
      if (fb) {
        fb.textContent = "Selecciona al menos un módulo o rol administrador.";
        fb.style.color = "var(--color-destructive, #dc2626)";
      }
      return;
    }
    const dias = [...document.querySelectorAll(".crono-dia-cb:checked")].map((c) => c.value);
    const hIn = document.getElementById("inviteHoraIn")?.value || "08:00";
    const hOut = document.getElementById("inviteHoraOut")?.value || "16:00";
    const cat = document.getElementById("inviteCategoria")?.value || "fijo";
    try {
      const payload = { email, fullName, role, permissions, shift: { days: dias, horaEntrada: hIn, horaSalida: hOut, categoria: cat } };
      if (window.currentUserRole === "superadmin") {
        const tid = accesosCallerTenant || usersList.find((u) => u.tenant_id)?.tenant_id;
        if (tid) payload.tenantId = tid;
      }
      const r = await inviteUser(payload);
      if (fb) {
        fb.textContent = r?.message || "Invitación creada.";
        fb.style.color = "#047857";
      }
      form.reset();
      setupInviteDias();
      await loadUsers();
    } catch (err) {
      if (fb) {
        fb.textContent = err?.message || "No se pudo invitar";
        fb.style.color = "var(--color-destructive, #dc2626)";
      }
    }
  });
}

function openEditTurnoModal(userId) {
  const u = usersList.find((x) => x.id === userId);
  if (!u) return;
  const byUser = groupByUserId(turnosRows);
  const current = (byUser.get(userId) || []).filter((t) => t.activo !== false);
  const ctx = `ed-turno-${userId}`;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  const diasChk = DIAS_ORDEN.map((d) => {
    const on = current.find((c) => c.dia === d) ? "checked" : "";
    return `<label style="display: inline-flex; align-items: center; gap: 4px; margin: 3px; font-size: 13px;"><input type="checkbox" class="crono-ed-m-dia" value="${d}" ${on}/>${DIA_CORTO[d]}</label>`;
  }).join(" ");
  const t0 = current[0];
  const hIn = (t0 && (t0.hora_entrada || "").toString().slice(0, 5)) || "08:00";
  const hOut = (t0 && (t0.hora_salida || "").toString().slice(0, 5)) || "16:00";
  backdrop.innerHTML = `<div class="modal-card" role="dialog" aria-label="Editar turno" style="max-width: 520px; max-height: 90vh; overflow-y: auto">
    <h3 style="margin-top:0">Turno: ${escapeHtml(u.full_name || u.email || "")}</h3>
    <p style="color: var(--color-text-muted); font-size: 14px; margin-top:0">Días, hora entrada/salida (mismo horario en todos los días seleccionados).</p>
    <div style="margin: 8px 0; display: flex; flex-wrap: wrap">${diasChk}</div>
    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin: 8px 0; align-items: end">
      <div><label class="modal-label">Entrada</label><input type="time" class="request-role-select" id="${ctx}-ent" value="${hIn}"/></div>
      <div><label class="modal-label">Salida</label><input type="time" class="request-role-select" id="${ctx}-sal" value="${hOut}"/></div>
    </div>
    <div id="${ctx}-copyrow" class="crono-modal-copy" style="font-size: 12px; color: var(--color-text-muted); display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-top: 8px">
        <span>Copiar de</span>
        <span id="${ctx}-msg" style="min-height:1.2em"></span>
    </div>
    <div class="modal-actions" style="margin-top: 16px; justify-content: space-between; flex-wrap: wrap">
      <div style="font-size: 12px; color: var(--color-text-muted)"></div>
      <div>
        <button class="btn btn--secondary" type="button" data-crono-close>Cancelar</button>
        <button class="btn btn--primary" type="button" data-crono-save>Guardar</button>
        <button class="btn request-actions__danger" type="button" data-crono-off style="font-size: 12px" title="Activar/Desactivar — conserva días; aquí: quitar días o guarda vacío para dejar en pendiente">Vaciar turno</button>
      </div>
    </div>
  </div>`;
  document.body.appendChild(backdrop);
  if (window.lucide) window.lucide.createIcons();
  const close = () => backdrop.remove();
  backdrop.querySelector("[data-crono-close]")?.addEventListener("click", close);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) close();
  });
  const copySel = document.createElement("select");
  copySel.id = `${ctx}-copy-sel`;
  copySel.className = "request-role-select";
  copySel.style.maxWidth = "200px";
  const peers = usersList.filter((o) => o.id !== userId && o.role === u.role);
  copySel.innerHTML = `<option value="">Copiar de… (mismo rol: ${(u.role || "—")})</option>` + peers.map((p) => `<option value="${p.id}">${(p.full_name || p.email || p.id).slice(0, 32)}</option>`).join("");
  const msgTarget = backdrop.querySelector(`#${ctx}-msg`);
  if (msgTarget) msgTarget.insertAdjacentElement("beforebegin", copySel);
  copySel.addEventListener("change", () => {
    const fromId = copySel.value;
    const msg = document.getElementById(`${ctx}-msg`);
    if (msg) msg.textContent = "";
    if (!fromId) return;
    const srcU = usersList.find((q) => q.id === fromId);
    if (!srcU) return;
    const src = (groupByUserId(turnosRows).get(srcU.id) || []).filter((t) => t.activo !== false);
    for (const d of DIAS_ORDEN) {
      const cb = backdrop.querySelector(`.crono-ed-m-dia[value="${d}"]`);
      if (cb) cb.checked = src.some((s) => s.dia === d);
    }
    const s0 = src[0];
    if (s0) {
      const ent = document.getElementById(`${ctx}-ent`);
      const sal = document.getElementById(`${ctx}-sal`);
      if (ent) ent.value = (s0.hora_entrada || "").toString().slice(0, 5) || "08:00";
      if (sal) sal.value = (s0.hora_salida || "").toString().slice(0, 5) || "16:00";
    }
    if (msg) msg.textContent = "Horas y días copiados. Pulsa Guardar para aplicar.";
  });
  if (peers.length === 0) {
    const m = document.getElementById(`${ctx}-msg`);
    if (m) m.textContent = "— No hay otro usuario con el mismo rol para copiar.";
  }
  backdrop.querySelector("[data-crono-off]")?.addEventListener("click", () => {
    for (const cb of backdrop.querySelectorAll(".crono-ed-m-dia")) {
      cb.checked = false;
    }
  });
  backdrop.querySelector("[data-crono-save]")?.addEventListener("click", async () => {
    const hIn2 = document.getElementById(`${ctx}-ent`)?.value;
    const hOut2 = document.getElementById(`${ctx}-sal`)?.value;
    const días = [...backdrop.querySelectorAll(".crono-ed-m-dia:checked")].map((c) => c.value);
    const rows = días
      .filter((d) => d && hIn2 && hOut2)
      .map((d) => ({ dia: d, hora_entrada: hIn2, hora_salida: hOut2, activo: true, categoria: "fijo" }));
    try {
      await replaceUserTurnos(userId, rows);
      setUsersFeedback("Turno actualizado.", "success");
      close();
      const ids = usersList.map((o) => o.id);
      turnosRows = await fetchTurnosForContext(ids);
      await loadCrono();
    } catch (err) {
      setUsersFeedback(err?.message || "No se pudo guardar el turno", "error");
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  void loadRolesConfigMap().catch((e) => console.warn("[accesos] roles_modulos", e));
  refreshBtn.addEventListener("click", loadRequests);
  if (refreshUsersBtn) refreshUsersBtn.addEventListener("click", loadUsers);

  const toggleRejectedBtn = document.getElementById("toggleRejectedBtn");
  if (toggleRejectedBtn) {
    toggleRejectedBtn.addEventListener("click", () => {
      showRejected = !showRejected;
      renderTable(accessRequests);
      if (window.lucide) window.lucide.createIcons();
    });
  }

  const toggleApprovedBtn = document.getElementById("toggleApprovedBtn");
  if (toggleApprovedBtn) {
    toggleApprovedBtn.addEventListener("click", () => {
      showApproved = !showApproved;
      renderTable(accessRequests);
      if (window.lucide) window.lucide.createIcons();
    });
  }

  document.getElementById("btnAccesosModuleOnb")?.addEventListener("click", () => {
    startMirestModuleOnboarding("accesos", { force: true });
  });
  document.getElementById("btnAccesosMarkPerfiles")?.addEventListener("click", () => {
    try {
      localStorage.setItem("mirest_onb_accesos_perfiles", "1");
    } catch {
      /* */
    }
    window.alert("Paso 2 del tour (perfiles) marcado. Vuelve al tour y pulsa «Verificar ahora».");
  });
  loadRequests();
  loadUsers();

  const tabArbol = document.getElementById("tabCronoArbol");
  const tabSem = document.getElementById("tabCronoSemana");
  const panA = document.getElementById("panelCronoArbol");
  const panS = document.getElementById("panelCronoSemana");
  if (tabArbol && tabSem && panA && panS) {
    tabArbol.addEventListener("click", () => {
      panA.style.display = "";
      panS.style.display = "none";
      tabArbol.classList.add("crono-tab--active");
      tabSem.classList.remove("crono-tab--active");
    });
    tabSem.addEventListener("click", () => {
      panA.style.display = "none";
      panS.style.display = "";
      tabSem.classList.add("crono-tab--active");
      tabArbol.classList.remove("crono-tab--active");
    });
  }
  setupInviteForm();
});
