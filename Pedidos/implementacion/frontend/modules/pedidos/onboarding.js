/**
 * onboarding.js - MiRest con IA
 * Sistema de onboarding en 3 momentos:
 *   PRE  - Nombre + referencia de paga + checklist de apertura
 *   PRO  - Tour guiado con spotlight por la UI
 *   POST - Bienvenida rapida de inicio de turno
 */

import {
  saveOnboardingPre,
  getOnboardingPre,
  hasCompletedOnboardingPre,
  markOnboardingProSeen,
  hasSeenOnboardingPro,
  isLongAbsence,
  updateLastSeen,
} from '../../core/storage.js';
import { setMirestPwaOnboardingCompletado } from '../../core/pwa-user-metadata.js';

import { getTurnStats } from '../../core/app-state.js';
import { escapeHtml, formatCurrency } from '../../core/ui-helpers.js';

const PRE_PAY_REFERENCE = {
  dailySalary: 45,
  payFrequency: 'semanal',
};

const PRE_TASKS = [
  {
    id: 'uniforme',
    title: 'Llegue listo para iniciar turno',
    helper: 'Estoy uniformado, puntual y ya me ubique en mi area antes de recibir pedidos.',
  },
  {
    id: 'mesas',
    title: 'Revise mis mesas y el salon',
    helper: 'Confirme limpieza, orden, numeracion y que mis mesas esten listas para atender clientes.',
  },
  {
    id: 'estacion',
    title: 'Deje mi estacion abastecida',
    helper: 'Ya verifique cartas, cubiertos, servilletas y apoyo basico para no frenar el servicio.',
  },
  {
    id: 'flujo',
    title: 'Ya se como tomar pedido y cobrar',
    helper: 'Tengo claro como registrar pedidos, revisar la cuenta y cerrar el cobro desde el sistema.',
  },
];

const PRE_STEPS = [
  { id: 'welcome', render: renderStepWelcome },
  { id: 'pay-info', render: renderStepPayInfo },
  { id: 'checklist', render: renderStepChecklist },
];

function createDefaultPreDraft() {
  return {
    name: '',
    role: 'mesero',
    dailySalary: PRE_PAY_REFERENCE.dailySalary,
    payFrequency: PRE_PAY_REFERENCE.payFrequency,
  };
}

function createChecklistState() {
  return PRE_TASKS.map((task) => ({ ...task, done: false }));
}

let _preDraft = createDefaultPreDraft();
let _preChecklist = createChecklistState();

let _proStepIndex = 0;
let _cleanupProOverlaySync = null;

const PRO_STEPS = [
  {
    id: 'mode-switcher',
    target: '#modeSwitcher, #pwaModeChips',
    title: 'Aqui cambias de area',
    body: 'Salon para mesas, Delivery para despachos y Para llevar cuando el cliente recoge. Toca el nombre del area para cambiar.',
    position: 'bottom',
    align: 'center',
  },
  {
    id: 'summary-stats',
    target: '#summaryStats',
    title: 'Tu resumen del turno',
    body: 'De un vistazo ves mesas ocupadas, pedidos activos y la venta referencial del turno. Se actualiza mientras trabajas.',
    position: 'bottom',
    align: 'center',
  },
  {
    id: 'workspace-tables',
    target: '#workspaceCard, #workspaceContent',
    title: 'Las mesas del salon',
    body: 'Verde es libre, rojo es ocupada y azul es reservada. Toca una mesa para inspeccionarla o continuar su pedido.',
    position: 'top',
    align: 'center',
    spotlightPadding: 12,
    scrollIntoView: true,
  },
  {
    id: 'management-panel',
    target: '#managementPanel, #orderFAB',
    title: 'Inspeccion y pago a la derecha',
    body: 'Desde este panel revisas el pedido, ves rondas y registras el cobro sin abrir otro flujo. En movil lo veras desde el boton flotante.',
    position: 'left',
    align: 'center',
    spotlightPadding: 12,
    scrollIntoView: true,
  },
  {
    id: 'sidebar-menu',
    target: '#sidebarToggle',
    title: 'Menu de la plataforma',
    body: 'Aqui abres el mismo menu que en el panel principal: Inicio, modulos (Almacen, Caja, etc.) y cerrar sesion. En movil, el cajon se cierra al elegir un enlace.',
    position: 'bottom',
    align: 'start',
  },
  {
    id: 'delivery-mode',
    target: '[data-set-mode="delivery"]',
    title: 'Modo Delivery',
    body: 'Toca aqui para pasar a los pedidos de reparto. Desde esa vista sigues el estado de cada delivery con un clic.',
    position: 'bottom',
    align: 'center',
  },
  {
    id: 'takeaway-mode',
    target: '[data-set-mode="takeaway"]',
    title: 'Para llevar',
    body: 'Los pedidos de recojo se ordenan aqui por etapa. Cuando esten listos para entregar, avanzas el estado desde la misma vista.',
    position: 'bottom',
    align: 'center',
  },
];

function getOnboardingMount() {
  return document.getElementById('onboardingRoot') || document.body;
}

// =====================================================================
// 1. ONBOARDING PRE - Nombre + paga + checklist de apertura
// =====================================================================

/**
 * Iniciar el flujo PRE si el usuario no lo ha completado.
 */
export function initOnboardingPRE() {
  if (hasCompletedOnboardingPre()) return;

  const saved = getOnboardingPre();
  _preDraft = {
    ...createDefaultPreDraft(),
    ...(saved || {}),
    role: 'mesero',
  };
  _preDraft.dailySalary = Number(_preDraft.dailySalary) || PRE_PAY_REFERENCE.dailySalary;
  _preDraft.payFrequency = normalizePayFrequency(_preDraft.payFrequency);
  _preChecklist = createChecklistState();

  showPreScreen(0);
}

function showPreScreen(stepIndex) {
  document.getElementById('onboardingPre')?.remove();

  const step = PRE_STEPS[stepIndex];
  if (!step) return;

  const shell = document.createElement('div');
  shell.id = 'onboardingPre';
  shell.className = 'onboarding-pre';
  shell.setAttribute('role', 'dialog');
  shell.setAttribute('aria-modal', 'true');
  shell.setAttribute('aria-label', 'Configuracion inicial del turno');

  const card = document.createElement('div');
  card.className = 'onboarding-pre__card';
  card.innerHTML = step.render();
  shell.appendChild(card);

  getOnboardingMount().appendChild(shell);
  document.body.classList.add('onboarding-open');

  _bindPreNavigation(shell, stepIndex);
}

function _bindPreNavigation(shell, stepIndex) {
  const nextBtn = shell.querySelector('[data-pre-next]');
  const backBtn = shell.querySelector('[data-pre-back]');

  nextBtn?.addEventListener('click', () => {
    _capturePreStepData(shell);
    if (!_validatePreStep(stepIndex)) return;

    const isLast = stepIndex === PRE_STEPS.length - 1;
    if (isLast) {
      _finishOnboardingPRE(shell);
      return;
    }

    showPreScreen(stepIndex + 1);
  });

  backBtn?.addEventListener('click', () => {
    if (stepIndex > 0) showPreScreen(stepIndex - 1);
  });

  const nameInput = shell.querySelector('#preNameInput');
  if (nameInput instanceof HTMLInputElement) {
    nameInput.addEventListener('input', () => {
      _preDraft.name = nameInput.value.trim();
      _syncPrePrimaryButton(shell, stepIndex);
    });
    requestAnimationFrame(() => nameInput.focus());
  }

  shell.querySelectorAll('[data-pre-task]').forEach((checkbox) => {
    if (!(checkbox instanceof HTMLInputElement)) return;
    checkbox.addEventListener('change', () => {
      const taskId = checkbox.dataset.preTask || '';
      const task = _preChecklist.find((item) => item.id === taskId);
      if (task) task.done = checkbox.checked;
      _syncPrePrimaryButton(shell, stepIndex);
    });
  });

  _syncPrePrimaryButton(shell, stepIndex);
}

function _capturePreStepData(shell) {
  const nameInput = shell.querySelector('#preNameInput');
  if (nameInput instanceof HTMLInputElement) {
    _preDraft.name = nameInput.value.trim();
  }
}

function _validatePreStep(stepIndex) {
  if (PRE_STEPS[stepIndex]?.id === 'welcome' && !_preDraft.name.trim()) {
    _showToast('Escribe tu nombre para personalizar el turno.', 'warning');
    return false;
  }

  if (PRE_STEPS[stepIndex]?.id === 'checklist' && !_areAllPreTasksDone()) {
    _showToast('Marca todas las tareas antes de abrir el recorrido PRO.', 'warning');
    return false;
  }

  return true;
}

function _syncPrePrimaryButton(shell, stepIndex) {
  const nextBtn = shell.querySelector('[data-pre-next]');
  if (!(nextBtn instanceof HTMLButtonElement)) return;

  const stepId = PRE_STEPS[stepIndex]?.id;
  if (stepId === 'welcome') {
    nextBtn.disabled = !_preDraft.name.trim();
    return;
  }

  if (stepId === 'checklist') {
    nextBtn.disabled = !_areAllPreTasksDone();
    const progress = shell.querySelector('[data-pre-progress]');
    if (progress) {
      const completed = _preChecklist.filter((task) => task.done).length;
      progress.textContent = `${completed}/${_preChecklist.length} tareas listas`;
    }
    return;
  }

  nextBtn.disabled = false;
}

function _areAllPreTasksDone() {
  return _preChecklist.every((task) => task.done);
}

function _finishOnboardingPRE(shell) {
  const resolvedRole =
    (typeof globalThis !== 'undefined' && globalThis.__MIREST_PWA_RESOLVED_PWA_ROLE__) ||
    _preDraft.role ||
    'mesero';
  const payload = {
    name: _preDraft.name.trim(),
    role: typeof resolvedRole === 'string' ? resolvedRole : 'mesero',
    dailySalary: _preDraft.dailySalary,
    payFrequency: normalizePayFrequency(_preDraft.payFrequency),
  };

  saveOnboardingPre(payload);
  shell.remove();
  document.body.classList.remove('onboarding-open');

  window.dispatchEvent(new CustomEvent('mirest:onboarding-complete', { detail: payload }));

  _showToast(`Bienvenido/a, ${payload.name || 'equipo'}. Abrimos tu recorrido de trabajo.`, 'success');
  setTimeout(() => initOnboardingPRO(), 500);
}

function renderStepWelcome() {
  return `
    <span class="onboarding-pre__icon">🍽️</span>
    <h2 class="onboarding-pre__title">Preparamos tu turno de mesero</h2>
    <p class="onboarding-pre__subtitle">
      Esta cuenta entrara directo al flujo de salon. Primero, dinos como te llamas.
    </p>
    <div>
      <label class="field-label" for="preNameInput">Tu nombre</label>
      <input
        id="preNameInput"
        class="input"
        type="text"
        placeholder="Ej: Carlos"
        autocomplete="given-name"
        maxlength="40"
        value="${escapeHtml(_preDraft.name)}"
      />
    </div>
    <button class="btn btn--primary" data-pre-next style="width:100%">
      Continuar ->
    </button>
  `;
}

function renderStepPayInfo() {
  const frequencyLabel = getPayFrequencyLabel(_preDraft.payFrequency);

  return `
    <span class="onboarding-pre__icon">💸</span>
    <h2 class="onboarding-pre__title">Tu paga ya esta registrada</h2>
    <p class="onboarding-pre__subtitle">
      Este paso es solo informativo. No necesitas editar nada aqui para entrar al turno.
    </p>
    <div class="onboarding-pre__info-grid">
      <article class="onboarding-pre__info-card">
        <span class="onboarding-pre__info-label">Paga por dia</span>
        <strong>${escapeHtml(formatCurrency(_preDraft.dailySalary))}</strong>
        <p>Referencia operativa para esta cuenta de mesero.</p>
      </article>
      <article class="onboarding-pre__info-card">
        <span class="onboarding-pre__info-label">Frecuencia de pago</span>
        <strong>${escapeHtml(frequencyLabel)}</strong>
        <p>Si cambia, lo actualiza administracion antes del siguiente turno.</p>
      </article>
    </div>
    <div class="onboarding-pre__note">
      Esta referencia solo acompana tu bienvenida. La operacion diaria sigue centrada en tomar pedidos, inspeccionar mesas y cobrar.
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn--ghost btn--sm" data-pre-back><- Atras</button>
      <button class="btn btn--primary" data-pre-next style="flex:1">Continuar -></button>
    </div>
  `;
}

function renderStepChecklist() {
  const completed = _preChecklist.filter((task) => task.done).length;

  return `
    <span class="onboarding-pre__icon">✅</span>
    <h2 class="onboarding-pre__title">Checklist antes de empezar</h2>
    <p class="onboarding-pre__subtitle">
      Marca cada tarea cuando la tengas lista. Apenas termines, abrimos el onboarding PRO dentro de la web.
    </p>
    <div class="onboarding-pre__task-list">
      ${_preChecklist.map((task) => `
        <label class="onboarding-pre__task-item ${task.done ? 'is-complete' : ''}">
          <input
            class="onboarding-pre__task-checkbox"
            type="checkbox"
            data-pre-task="${escapeHtml(task.id)}"
            ${task.done ? 'checked' : ''}
          />
          <span class="onboarding-pre__task-copy">
            <strong>${escapeHtml(task.title)}</strong>
            <small>${escapeHtml(task.helper)}</small>
          </span>
        </label>
      `).join('')}
    </div>
    <div class="onboarding-pre__task-progress">
      <strong data-pre-progress>${completed}/${_preChecklist.length} tareas listas</strong>
      <span>Necesitas completar todo para seguir.</span>
    </div>
    <div style="display:flex;gap:8px;margin-top:4px">
      <button class="btn btn--ghost btn--sm" data-pre-back><- Atras</button>
      <button class="btn btn--primary" data-pre-next style="flex:1">
        Abrir onboarding PRO ->
      </button>
    </div>
  `;
}

function normalizePayFrequency(value = '') {
  const normalized = String(value || '').trim().toLowerCase();
  if (normalized === 'quincenal' || normalized === 'mensual') return normalized;
  return 'semanal';
}

function getPayFrequencyLabel(value = '') {
  const normalized = normalizePayFrequency(value);
  if (normalized === 'quincenal') return 'Quincenal';
  if (normalized === 'mensual') return 'Mensual';
  return 'Semanal';
}

// =====================================================================
// 2. ONBOARDING PRO - Tour guiado con spotlight
// =====================================================================

/**
 * Iniciar el tour PRO (si no lo ha visto antes).
 */
export function initOnboardingPRO() {
  if (hasSeenOnboardingPro()) return;
  _proStepIndex = 0;
  _showProOverlay();
}

/**
 * Forzar el tour PRO aunque ya se haya visto.
 */
export function restartOnboardingPRO() {
  _proStepIndex = 0;
  _showProOverlay();
}

function _showProOverlay() {
  _cleanupProOverlaySync?.();
  document.getElementById('onboardingOverlay')?.remove();

  if (_proStepIndex >= PRO_STEPS.length) {
    _finishOnboardingPRO();
    return;
  }

  const step = PRO_STEPS[_proStepIndex];
  const overlay = document.createElement('div');
  overlay.id = 'onboardingOverlay';
  overlay.className = 'onboarding-overlay is-active';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-label', 'Tour guiado de la aplicacion');

  const mask = document.createElement('div');
  mask.className = 'onboarding-mask';
  mask.innerHTML = `
    <div class="onboarding-mask__segment onboarding-mask__segment--top"></div>
    <div class="onboarding-mask__segment onboarding-mask__segment--left"></div>
    <div class="onboarding-mask__segment onboarding-mask__segment--right"></div>
    <div class="onboarding-mask__segment onboarding-mask__segment--bottom"></div>
    <div class="onboarding-focus-ring" aria-hidden="true" hidden></div>
  `;
  overlay.appendChild(mask);

  const tooltip = document.createElement('div');
  tooltip.className = 'onboarding-tooltip';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
      <p class="onboarding-step-label">Paso ${_proStepIndex + 1} de ${PRO_STEPS.length}</p>
      <button type="button" class="btn btn--ghost btn--sm" id="proSkip">Saltar tour</button>
    </div>
    <div class="onboarding-progress">
      ${PRO_STEPS.map((_, index) => `
        <span class="onboarding-progress__dot ${index === _proStepIndex ? 'is-active' : ''}"></span>
      `).join('')}
    </div>
    <h4 class="onboarding-title">${escapeHtml(step.title)}</h4>
    <p class="onboarding-body">${escapeHtml(step.body)}</p>
    <div class="onboarding-actions">
      ${_proStepIndex > 0 ? '<button type="button" class="btn btn--ghost btn--sm" id="proBack"><- Anterior</button>' : ''}
      <button type="button" class="btn btn--primary btn--sm" id="proNext">
        ${_proStepIndex < PRO_STEPS.length - 1 ? 'Entendido ->' : 'Listo'}
      </button>
    </div>
  `;
  overlay.appendChild(tooltip);

  getOnboardingMount().appendChild(overlay);
  document.body.classList.add('onboarding-open');

  const initialTarget = _resolveProTarget(step.target);
  if (initialTarget instanceof HTMLElement && step.scrollIntoView) {
    initialTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }

  const syncOverlay = () => {
    const currentTarget = _resolveProTarget(step.target);
    const spotlightRect = _getSpotlightRect(currentTarget, step);
    _applySpotlightMask(mask, spotlightRect);
    _positionProTooltip(step, tooltip, spotlightRect);
  };
  const syncOverlayOnNextFrame = () => requestAnimationFrame(syncOverlay);

  syncOverlayOnNextFrame();

  const handleViewportChange = () => syncOverlayOnNextFrame();
  window.addEventListener('resize', handleViewportChange, { passive: true });
  window.addEventListener('scroll', handleViewportChange, true);
  _cleanupProOverlaySync = () => {
    window.removeEventListener('resize', handleViewportChange);
    window.removeEventListener('scroll', handleViewportChange, true);
    _cleanupProOverlaySync = null;
  };

  overlay.querySelector('#proNext')?.addEventListener('click', () => {
    _proStepIndex += 1;
    _showProOverlay();
  });
  overlay.querySelector('#proBack')?.addEventListener('click', () => {
    _proStepIndex = Math.max(0, _proStepIndex - 1);
    _showProOverlay();
  });
  overlay.querySelector('#proSkip')?.addEventListener('click', _finishOnboardingPRO);
}

function _resolveProTarget(targetSelector = '') {
  return targetSelector
    .split(',')
    .map((selector) => selector.trim())
    .filter(Boolean)
    .map((selector) => document.querySelector(selector))
    .find((element) => element instanceof HTMLElement && _isVisibleTarget(element)) || null;
}

function _isVisibleTarget(element) {
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function _positionProTooltip(step, tooltip, targetRect) {
  requestAnimationFrame(() => {
    if (!(tooltip instanceof HTMLElement)) return;

    if (!targetRect) {
      tooltip.style.top = '50%';
      tooltip.style.left = '50%';
      tooltip.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const tipRect = tooltip.getBoundingClientRect();
    const viewport = {
      width: window.innerWidth,
      height: window.innerHeight,
    };
    const margin = 16;
    const gap = 18;
    const maxLeft = Math.max(margin, viewport.width - tipRect.width - margin);
    const maxTop = Math.max(margin, viewport.height - tipRect.height - margin);
    const placements = _getPlacementOrder(step.position);

    let bestCandidate = null;

    placements.forEach((placement) => {
      const proposed = _getTooltipPosition({
        placement,
        align: step.align,
        targetRect,
        tooltipRect: tipRect,
        gap,
      });
      const clamped = {
        left: clamp(proposed.left, margin, maxLeft),
        top: clamp(proposed.top, margin, maxTop),
      };

      const overlap = _rectsOverlap(
        { left: clamped.left, top: clamped.top, width: tipRect.width, height: tipRect.height },
        targetRect,
        10,
      );
      const fitsViewport =
        proposed.left >= margin &&
        proposed.top >= margin &&
        proposed.left + tipRect.width <= viewport.width - margin &&
        proposed.top + tipRect.height <= viewport.height - margin;
      const clampPenalty = Math.abs(clamped.left - proposed.left) + Math.abs(clamped.top - proposed.top);
      const score = (fitsViewport ? 1000 : 0) - (overlap ? 300 : 0) - clampPenalty;

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = { ...clamped, score };
      }
    });

    tooltip.style.top = `${bestCandidate?.top ?? margin}px`;
    tooltip.style.left = `${bestCandidate?.left ?? margin}px`;
    tooltip.style.transform = 'none';
  });
}

function _getPlacementOrder(preferred = 'bottom') {
  const normalized = ['top', 'right', 'bottom', 'left'].includes(preferred) ? preferred : 'bottom';
  const fallbackMap = {
    top: ['top', 'bottom', 'right', 'left'],
    right: ['right', 'left', 'bottom', 'top'],
    bottom: ['bottom', 'top', 'right', 'left'],
    left: ['left', 'right', 'top', 'bottom'],
  };
  return fallbackMap[normalized];
}

function _getTooltipPosition({ placement, align = 'center', targetRect, tooltipRect, gap }) {
  const horizontalAlign = align === 'start'
    ? targetRect.left
    : align === 'end'
      ? targetRect.right - tooltipRect.width
      : targetRect.left + (targetRect.width / 2) - (tooltipRect.width / 2);

  const verticalAlign = align === 'start'
    ? targetRect.top
    : align === 'end'
      ? targetRect.bottom - tooltipRect.height
      : targetRect.top + (targetRect.height / 2) - (tooltipRect.height / 2);

  if (placement === 'top') {
    return {
      top: targetRect.top - tooltipRect.height - gap,
      left: horizontalAlign,
    };
  }

  if (placement === 'right') {
    return {
      top: verticalAlign,
      left: targetRect.right + gap,
    };
  }

  if (placement === 'left') {
    return {
      top: verticalAlign,
      left: targetRect.left - tooltipRect.width - gap,
    };
  }

  return {
    top: targetRect.bottom + gap,
    left: horizontalAlign,
  };
}

function _rectsOverlap(a, b, padding = 0) {
  return !(
    a.left + a.width <= b.left - padding ||
    a.left >= b.right + padding ||
    a.top + a.height <= b.top - padding ||
    a.top >= b.bottom + padding
  );
}

function _getSpotlightRect(target, step = {}) {
  if (!(target instanceof HTMLElement) || !_isVisibleTarget(target)) return null;

  const rect = target.getBoundingClientRect();
  const padding = Number.isFinite(step.spotlightPadding) ? step.spotlightPadding : 10;
  const viewportMargin = 8;
  const left = Math.max(viewportMargin, rect.left - padding);
  const top = Math.max(viewportMargin, rect.top - padding);
  const right = Math.min(window.innerWidth - viewportMargin, rect.right + padding);
  const bottom = Math.min(window.innerHeight - viewportMargin, rect.bottom + padding);

  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
    radius: _getSpotlightRadius(target, step),
  };
}

function _getSpotlightRadius(target, step = {}) {
  if (Number.isFinite(step.spotlightRadius)) return step.spotlightRadius;

  const computedStyle = getComputedStyle(target);
  const corners = [
    computedStyle.borderTopLeftRadius,
    computedStyle.borderTopRightRadius,
    computedStyle.borderBottomRightRadius,
    computedStyle.borderBottomLeftRadius,
  ]
    .map((value) => Number.parseFloat(value))
    .filter((value) => Number.isFinite(value));

  const baseRadius = corners.length ? Math.max(...corners) : 18;
  return clamp(baseRadius + 6, 18, 30);
}

function _applySpotlightMask(mask, spotlightRect) {
  if (!(mask instanceof HTMLElement)) return;

  const hasSpotlight = Boolean(spotlightRect && spotlightRect.width > 0 && spotlightRect.height > 0);
  const focusRing = mask.querySelector('.onboarding-focus-ring');

  mask.style.setProperty('--spotlight-top', `${spotlightRect?.top ?? 0}px`);
  mask.style.setProperty('--spotlight-left', `${spotlightRect?.left ?? 0}px`);
  mask.style.setProperty('--spotlight-width', `${spotlightRect?.width ?? 0}px`);
  mask.style.setProperty('--spotlight-height', `${spotlightRect?.height ?? 0}px`);
  mask.style.setProperty('--spotlight-radius', `${spotlightRect?.radius ?? 24}px`);

  if (focusRing instanceof HTMLElement) {
    focusRing.hidden = !hasSpotlight;
  }
}

function _finishOnboardingPRO() {
  _cleanupProOverlaySync?.();
  document.getElementById('onboardingOverlay')?.remove();
  document.body.classList.remove('onboarding-open');
  markOnboardingProSeen();
  updateLastSeen();
  void setMirestPwaOnboardingCompletado(true);
  _showToast('Tour completado. Ya conoces tu flujo principal de pedidos.', 'success');
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

// =====================================================================
// 3. ONBOARDING POST - Bienvenida de turno
// =====================================================================

/**
 * Mostrar bienvenida de turno si pasaron mas de 4 horas.
 */
export function initOnboardingPOST() {
  if (!isLongAbsence(4)) return;

  const preData = getOnboardingPre();
  const name = preData?.name || 'equipo';
  const stats = getTurnStats();
  const now = new Date();
  const timeStr = now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const greeting = now.getHours() < 12 ? 'Buenos dias' : now.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

  document.getElementById('postWelcomeOverlay')?.remove();
  document.getElementById('postWelcomeModal')?.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'postWelcomeOverlay';

  const card = document.createElement('div');
  card.id = 'postWelcomeModal';
  card.className = 'modal';
  card.style.maxWidth = '420px';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-label', 'Bienvenida de turno');
  card.innerHTML = `
    <div class="welcome-modal">
      <div>
        <div class="welcome-modal__greeting">${escapeHtml(greeting)}, ${escapeHtml(name)} 👋</div>
        <div class="welcome-modal__time">Son las ${escapeHtml(timeStr)} · ${escapeHtml(_getTurnLabel(now.getHours()))}</div>
      </div>

      <div class="welcome-modal__stats">
        <p style="font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--app-color-text-secondary);margin-bottom:4px">
          Estado actual
        </p>
        <div class="welcome-modal__stat">
          <span>🍽️ Mesas ocupadas</span>
          <strong>${stats.ocupadas}</strong>
        </div>
        <div class="welcome-modal__stat">
          <span>🛵 Delivery activos</span>
          <strong>${stats.dlPending}</strong>
        </div>
        <div class="welcome-modal__stat">
          <span>📦 Para llevar pendientes</span>
          <strong>${stats.twPending}</strong>
        </div>
        <div class="welcome-modal__stat">
          <span>🧾 Dashboard listo</span>
          <strong>Facturas e impresoras</strong>
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end">
        <button type="button" class="btn btn--ghost btn--sm" id="postDismiss">Cerrar</button>
        <button type="button" class="btn btn--primary btn--sm" id="postGoTables">
          🍽️ Ver mesas
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  document.body.appendChild(card);
  document.body.classList.add('modal-open');

  updateLastSeen();

  const close = () => {
    overlay.remove();
    card.remove();
    document.body.classList.remove('modal-open');
  };

  card.querySelector('#postDismiss')?.addEventListener('click', close);
  overlay.addEventListener('click', close);
  card.querySelector('#postGoTables')?.addEventListener('click', () => {
    close();
    window.dispatchEvent(new CustomEvent('mirest:set-mode', { detail: 'salon' }));
  });
}

function _getTurnLabel(hour) {
  if (hour >= 6 && hour < 14) return 'Turno manana';
  if (hour >= 14 && hour < 22) return 'Turno tarde';
  return 'Turno noche';
}

// =====================================================================
// 4. INIT GLOBAL
// =====================================================================

/**
 * Punto de entrada. Llama a los 3 flujos en orden correcto.
 */
export function initOnboarding() {
  if (!hasCompletedOnboardingPre()) {
    initOnboardingPRE();
    return;
  }

  initOnboardingPOST();
}

function _showToast(message, type = 'info') {
  const stack = document.getElementById('toastRoot');
  if (!stack) return;

  const toast = document.createElement('div');
  toast.className = `toast toast--${type}`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `<p>${escapeHtml(message)}</p>`;
  stack.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(8px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
