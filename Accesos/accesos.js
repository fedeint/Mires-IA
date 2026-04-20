import {
  ACCESS_REQUEST_STATUS,
  approveAccessRequest,
  escapeHtml,
  formatRequestDate,
  getStatusLabel,
  listAccessRequests,
  notifyAccessRequestEvent,
  updateAccessRequest,
} from "../scripts/access-requests.js?v=20260420-resend1";
import {
  deleteUser,
  listUsers,
  restoreUser,
  revokeUser,
  updateUserPermissions,
} from "../scripts/user-access.js?v=20260420-perms5";
import {
  getAssignableModules,
  getRoleLabel,
  ROLE_PERMISSIONS,
} from "../scripts/navigation.js?v=20260420-perms5";

const tableBody = document.getElementById("requestsTableBody");
const feedback = document.getElementById("requestFeedback");
const refreshBtn = document.getElementById("refreshRequestsBtn");
const metricPending = document.getElementById("metricPending");
const metricReviewing = document.getElementById("metricReviewing");
const metricApproved = document.getElementById("metricApproved");

const usersTableBody = document.getElementById("usersTableBody");
const usersFeedback = document.getElementById("usersFeedback");
const refreshUsersBtn = document.getElementById("refreshUsersBtn");

let accessRequests = [];
let usersList = [];
let isRendering = false;
let isLoadingUsers = false;

const ASSIGNABLE_MODULES = getAssignableModules();
const ASSIGNABLE_KEYS = ASSIGNABLE_MODULES.map((m) => m.key);
const ROLE_OPTIONS = [
  { value: "admin", label: "Administrador" },
  { value: "caja", label: "Caja" },
  { value: "chef", label: "Chef / Cocina" },
  { value: "pedidos", label: "Pedidos / Delivery" },
  { value: "almacen", label: "Almacén" },
  { value: "marketing", label: "Marketing" },
];

function setFeedback(message, variant) {
  feedback.textContent = message;
  feedback.className = `request-feedback request-feedback--${variant}`;
  feedback.style.display = "block";
}

function clearFeedback() {
  feedback.style.display = "none";
  feedback.textContent = "";
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
  metricPending.textContent = String(requests.filter((item) => item.status === ACCESS_REQUEST_STATUS.PENDING).length);
  metricReviewing.textContent = String(requests.filter((item) => item.status === ACCESS_REQUEST_STATUS.REVIEWING).length);
  metricApproved.textContent = String(requests.filter((item) => item.status === ACCESS_REQUEST_STATUS.APPROVED).length);
}

function permissionsForRole(role) {
  const perms = ROLE_PERMISSIONS[role];
  if (!perms) return [];
  if (perms.includes("*")) return ASSIGNABLE_KEYS.slice();
  return perms.filter((key) => ASSIGNABLE_KEYS.includes(key));
}

function resolveInitialPermissions(request) {
  if (Array.isArray(request.approved_permissions) && request.approved_permissions.length > 0) {
    return request.approved_permissions.filter((key) => ASSIGNABLE_KEYS.includes(key));
  }
  return permissionsForRole(request.approved_role || "admin");
}

function renderPermGrid({ contextId, selected, disabled = false }) {
  const disabledClass = disabled ? " perm-chip--muted" : "";
  return `
    <div class="perm-grid" data-perm-grid="${contextId}">
      ${ASSIGNABLE_MODULES.map((mod) => `
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
      `).join("")}
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
    return perms
      .map((key) => ASSIGNABLE_MODULES.find((m) => m.key === key)?.label || key)
      .join(", ");
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

  const activationCta = request.status === ACCESS_REQUEST_STATUS.APPROVED
    ? `<button class="btn btn--secondary" type="button" onclick="window.resendActivation('${request.id}')">Reenviar activación</button>`
    : `<button class="btn btn--primary" type="button" onclick="window.approveRequest('${request.id}')">Aprobar y enviar activación</button>`;

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
        </div>
      </td>
    </tr>
  `;
}

function renderTable(requests) {
  if (requests.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">Todavía no hay solicitudes registradas.</td></tr>`;
    updateOverviewMetrics([]);
    return;
  }

  tableBody.innerHTML = requests.map(buildRow).join("");
  updateOverviewMetrics(requests);
}

async function loadRequests() {
  if (isRendering) return;

  isRendering = true;
  refreshBtn.disabled = true;
  clearFeedback();

  const { data, error } = await listAccessRequests();

  if (error) {
    tableBody.innerHTML = `<tr><td colspan="5" style="text-align: center;">No pudimos cargar las solicitudes.</td></tr>`;
    setFeedback("No pudimos leer las solicitudes desde Supabase. Revisa la sesión y las políticas RLS.", "error");
    refreshBtn.disabled = false;
    isRendering = false;
    return;
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

window.approveRequest = (requestId) => {
  const request = accessRequests.find((item) => item.id === requestId);
  if (!request) return;

  const role = request.approved_role || "admin";
  const permissions = resolveInitialPermissions(request);

  if (permissions.length === 0 && role !== "admin" && role !== "superadmin") {
    setFeedback("Primero configura los permisos de esta solicitud desde el botón Permisos.", "error");
    return;
  }

  if (!window.confirm(`¿Aprobar la solicitud de ${request.email} con la configuración actual?`)) {
    return;
  }

  (async () => {
    const { data, error } = await approveAccessRequest(requestId, role, "approve", permissions);
    if (error) {
      setFeedback(error.message || "No se pudo aprobar la solicitud ni enviar la activación.", "error");
      return;
    }
    setFeedback(data?.message || "Solicitud aprobada. La activación fue enviada por correo.", "success");
    await loadRequests();
  })();
};

window.resendActivation = (requestId) => {
  const request = accessRequests.find((item) => item.id === requestId);
  if (!request) return;

  const role = request.approved_role || "admin";
  const permissions = resolveInitialPermissions(request);

  if (!window.confirm(`¿Reenviar activación a ${request.email} usando la configuración actual?`)) {
    return;
  }

  (async () => {
    const { data, error } = await approveAccessRequest(requestId, role, "resend", permissions);
    if (error) {
      setFeedback(error.message || "No se pudo reenviar la activación.", "error");
      return;
    }
    setFeedback(data?.message || "La activación fue reenviada por correo.", "success");
    await loadRequests();
  })();
};

function isBanned(user) {
  if (!user?.banned_until) return false;
  const bannedUntil = new Date(user.banned_until).getTime();
  if (Number.isNaN(bannedUntil)) return false;
  return bannedUntil > Date.now();
}

function getUserStatusPill(user) {
  if (user.protected) {
    return `<span class="request-pill request-pill--reviewing">Demo</span>`;
  }
  if (isBanned(user)) {
    return `<span class="request-pill request-pill--rejected">Revocado</span>`;
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
    return perms
      .map((key) => ASSIGNABLE_MODULES.find((m) => m.key === key)?.label || key)
      .join(", ");
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
    actions = `
      <button class="btn btn--secondary" type="button" onclick="window.editUserPermissions('${user.id}')">Editar módulos</button>
      <small style="color: var(--color-text-muted);">Demo: no se puede revocar.</small>
    `;
  } else if (banned) {
    actions = `
      <button class="btn btn--primary" type="button" onclick="window.restoreUserAccess('${user.id}')">Restaurar acceso</button>
      <button class="btn btn--secondary" type="button" onclick="window.editUserPermissions('${user.id}')">Editar módulos</button>
      <button class="btn btn--secondary" type="button" onclick="window.deleteUserAccount('${user.id}')">Eliminar</button>
    `;
  } else {
    actions = `
      <button class="btn btn--primary" type="button" onclick="window.editUserPermissions('${user.id}')">Editar módulos</button>
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
    renderUsersTable(usersList);
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
  if (!window.confirm(`¿Revocar el acceso de ${label}? Podrá ser restaurado después.`)) {
    return;
  }

  try {
    const data = await revokeUser(userId);
    setUsersFeedback(data?.message || "Acceso revocado correctamente.", "success");
    await loadUsers();
  } catch (error) {
    setUsersFeedback(error.message || "No pudimos revocar el acceso.", "error");
  }
};

window.restoreUserAccess = async (userId) => {
  try {
    const data = await restoreUser(userId);
    setUsersFeedback(data?.message || "Acceso restaurado correctamente.", "success");
    await loadUsers();
  } catch (error) {
    setUsersFeedback(error.message || "No pudimos restaurar el acceso.", "error");
  }
};

window.deleteUserAccount = async (userId) => {
  const user = usersList.find((item) => item.id === userId);
  const label = user?.email || "este usuario";
  if (!window.confirm(`Eliminar permanentemente a ${label}. Esta acción no se puede deshacer. ¿Continuar?`)) {
    return;
  }

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
        ${ROLE_OPTIONS.map((opt) => `<option value="${opt.value}" ${opt.value === initialRole ? "selected" : ""}>${opt.label}</option>`).join("")}
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

document.addEventListener("DOMContentLoaded", () => {
  refreshBtn.addEventListener("click", loadRequests);
  if (refreshUsersBtn) refreshUsersBtn.addEventListener("click", loadUsers);
  loadRequests();
  loadUsers();
});
