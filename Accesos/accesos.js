import {
  ACCESS_REQUEST_STATUS,
  approveAccessRequest,
  escapeHtml,
  formatRequestDate,
  getStatusLabel,
  listAccessRequests,
  updateAccessRequest,
} from "../scripts/access-requests.js?v=20260420-accessfix2";

const tableBody = document.getElementById("requestsTableBody");
const feedback = document.getElementById("requestFeedback");
const refreshBtn = document.getElementById("refreshRequestsBtn");
const metricPending = document.getElementById("metricPending");
const metricReviewing = document.getElementById("metricReviewing");
const metricApproved = document.getElementById("metricApproved");

let accessRequests = [];
let isRendering = false;

function setFeedback(message, variant) {
  feedback.textContent = message;
  feedback.className = `request-feedback request-feedback--${variant}`;
  feedback.style.display = "block";
}

function clearFeedback() {
  feedback.style.display = "none";
  feedback.textContent = "";
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

function buildRow(request) {
  const applicant = escapeHtml(request.full_name);
  const email = escapeHtml(request.email);
  const phone = request.phone ? `<small>${escapeHtml(request.phone)}</small>` : "";
  const businessCount = request.business_count === 1 ? "1 negocio" : `${request.business_count} negocios`;
  const location = [request.city, request.country].filter(Boolean).map(escapeHtml).join(" · ");
  const businessMeta = [businessCount, location].filter(Boolean).join(" · ");
  const notes = request.notes ? `<small>${escapeHtml(request.notes)}</small>` : "<small>Sin notas registradas.</small>";
  const roleValue = request.approved_role || "admin";

  const activationCta = request.status === ACCESS_REQUEST_STATUS.APPROVED
    ? `<button class="btn btn--secondary" type="button" onclick="window.resendActivation('${request.id}')">Reenviar activación</button>`
    : `<button class="btn btn--primary" type="button" onclick="window.approveRequest('${request.id}')">Aprobar y enviar activación</button>`;

  return `
    <tr>
      <td>
        <div class="request-meta">
          <strong>${applicant}</strong>
          <span>${email}</span>
          ${phone}
        </div>
      </td>
      <td>
        <div class="request-meta">
          <strong>${escapeHtml(request.restaurant_name)}</strong>
          <span>${escapeHtml(request.legal_owner_name || "Sin razón social")}</span>
          <small>${escapeHtml(businessMeta || "Sin ubicación registrada")}</small>
        </div>
      </td>
      <td>
        <div class="request-meta">
          <span>Creada: ${escapeHtml(formatRequestDate(request.created_at))}</span>
          <small>${escapeHtml(request.applicant_role || "Rol no especificado")}</small>
          ${notes}
        </div>
      </td>
      <td>
        <div class="request-meta">
          <span class="${getStatusClass(request.status)}">${escapeHtml(getStatusLabel(request.status))}</span>
          <small>${escapeHtml(request.invite_sent_at ? `Invitación: ${formatRequestDate(request.invite_sent_at)}` : "Sin invitación enviada")}</small>
        </div>
      </td>
      <td>
        <div class="request-actions">
          <select class="request-role-select" data-role-select="${request.id}">
            <option value="admin" ${roleValue === "admin" ? "selected" : ""}>Administrador</option>
            <option value="caja" ${roleValue === "caja" ? "selected" : ""}>Caja</option>
            <option value="chef" ${roleValue === "chef" ? "selected" : ""}>Chef / Cocina</option>
            <option value="pedidos" ${roleValue === "pedidos" ? "selected" : ""}>Pedidos / Delivery</option>
            <option value="almacen" ${roleValue === "almacen" ? "selected" : ""}>Almacén</option>
            <option value="marketing" ${roleValue === "marketing" ? "selected" : ""}>Marketing</option>
          </select>
          <button class="btn btn--secondary" type="button" onclick="window.setRequestStatus('${request.id}', 'reviewing')">En revisión</button>
          ${activationCta}
          <button class="btn btn--secondary" type="button" onclick="window.setRequestStatus('${request.id}', 'rejected')">Rechazar</button>
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

  setFeedback(`Solicitud actualizada a ${getStatusLabel(status).toLowerCase()}.`, "success");
  await loadRequests();
};

window.approveRequest = async (requestId) => {
  const roleSelect = document.querySelector(`[data-role-select="${requestId}"]`);
  const role = roleSelect?.value || "admin";

  const { data, error } = await approveAccessRequest(requestId, role);
  if (error) {
    setFeedback(error.message || "No se pudo aprobar la solicitud ni enviar la activación.", "error");
    return;
  }

  setFeedback(data?.message || "Solicitud aprobada. La activación fue enviada por correo.", "success");
  await loadRequests();
};

window.resendActivation = async (requestId) => {
  const roleSelect = document.querySelector(`[data-role-select="${requestId}"]`);
  const role = roleSelect?.value || "admin";

  const { data, error } = await approveAccessRequest(requestId, role, "resend");
  if (error) {
    setFeedback(error.message || "No se pudo reenviar la activación.", "error");
    return;
  }

  setFeedback(data?.message || "La activación fue reenviada por correo.", "success");
  await loadRequests();
};

document.addEventListener("DOMContentLoaded", () => {
  refreshBtn.addEventListener("click", loadRequests);
  loadRequests();
});
