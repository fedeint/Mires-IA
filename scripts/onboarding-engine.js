/**
 * MiRest con IA - Onboarding Engine
 * Motor genérico para crear guías interactivas con resaltado de elementos
 */
import { clearActiveOnboarding, registerOnboarding } from "./onboarding-controller.js";

export class Onboarding {
  constructor(steps, storageKey) {
    this.steps = steps;
    this.storageKey = storageKey;
    this.currentStep = 0;
    this.overlay = null;
    this._spotlightRaf = null;
    this._onScroll = () => this.scheduleSpotlightUpdate();
    this._onResize = () => this.scheduleSpotlightUpdate();
    this.init();
  }

  init() {
    // Reservado para futuras inicializaciones
  }

  start(force = true) {
    if (!force && localStorage.getItem(this.storageKey)) return;
    if (this.overlay) return;
    registerOnboarding(this, this.storageKey);
    this.createOverlay();
  }

  createOverlay() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'onboarding-overlay';
    this.overlay.innerHTML = `
      <div class="onboarding-spotlight" id="onboardingSpotlight"></div>
      <div class="onboarding-card" id="onboardingCard">
        <div class="onboarding-content">
          <div class="onboarding-header">
            <h2 id="onboardingTitle"></h2>
            <button class="onboarding-skip" id="onboardingSkip">Omitir guía</button>
          </div>
          <p id="onboardingText"></p>
          <div class="onboarding-footer">
            <span id="onboardingSteps"></span>
            <button class="onboarding-btn" id="onboardingNext">Siguiente</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(this.overlay);

    document.getElementById('onboardingSkip').onclick = () => this.finish();
    document.getElementById('onboardingNext').onclick = () => this.next();
    
    // Escuchar scroll y resize para reposicionar spotlight
    window.addEventListener('scroll', this._onScroll, { passive: true, capture: true });
    window.addEventListener('resize', this._onResize, { passive: true });

    this.showStep();
  }

  scheduleSpotlightUpdate() {
    if (!this.overlay) return;
    if (this._spotlightRaf != null) return;
    this._spotlightRaf = window.requestAnimationFrame(() => {
      this._spotlightRaf = null;
      this.updateSpotlightImpl();
    });
  }

  showStep() {
    const step = this.steps[this.currentStep];
    const title = document.getElementById('onboardingTitle');
    const text = document.getElementById('onboardingText');
    const progress = document.getElementById('onboardingSteps');
    const nextBtn = document.getElementById('onboardingNext');

    title.innerText = step.title;
    text.innerText = step.text;
    progress.innerText = `${this.currentStep + 1} de ${this.steps.length}`;
    nextBtn.innerText = this.currentStep === this.steps.length - 1 ? 'Comenzar' : 'Siguiente';

    this.overlay.classList.add('open');
    this.scheduleSpotlightUpdate();
  }

  updateSpotlight() {
    this.scheduleSpotlightUpdate();
  }

  updateSpotlightImpl() {
    if (!this.overlay) return;
    
    const step = this.steps[this.currentStep];
    const el = document.querySelector(step.element);
    const spotlight = document.getElementById('onboardingSpotlight');
    const card = document.getElementById('onboardingCard');

    // Si el elemento no existe o está oculto, centramos la tarjeta y ocultamos el foco
    if (!el || el.offsetParent === null) {
      spotlight.style.display = 'none';
      this.positionCardCentered(card);
      return;
    }

    const rect = el.getBoundingClientRect();
    const padding = 12;

    // Actualizar Spotlight
    spotlight.style.display = 'block';
    spotlight.style.top = `${rect.top - padding}px`;
    spotlight.style.left = `${rect.left - padding}px`;
    spotlight.style.width = `${rect.width + (padding * 2)}px`;
    spotlight.style.height = `${rect.height + (padding * 2)}px`;

    // Scroll inteligente: solo si el elemento no está bien visible
    const safeBottom = window.innerWidth < 1024 ? 150 : 0;
    const isVisible = (rect.top >= 88 && rect.bottom <= window.innerHeight - safeBottom);
    if (!isVisible && !this.scrolling) {
      this.scrolling = true;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => { this.scrolling = false; }, 500);
    }

    // Posicionar Tarjeta dinámicamente cerca del elemento
    this.positionCard(rect, card);
  }

  positionCardCentered(card) {
    card.style.top = '50%';
    card.style.left = '50%';
    card.style.transform = 'translate(-50%, -50%)';
    card.style.bottom = 'auto';
    card.style.right = 'auto';
  }

  positionCard(targetRect, card) {
    const margin = window.innerWidth < 1024 ? 12 : 20;
    const safeBottom = window.innerWidth < 1024 ? 150 : 20;
    // Escribir primero, luego leer geometría (evita reflow forzado lectura→escritura)
    card.style.transform = 'none';
    const cardRect = card.getBoundingClientRect();

    let top = targetRect.bottom + margin;
    let left = targetRect.left;

    // Si no cabe abajo, poner arriba
    if (top + cardRect.height > window.innerHeight - safeBottom) {
      top = targetRect.top - cardRect.height - margin;
    }

    // Ajustar horizontalmente para que no se salga de la pantalla
    if (left + cardRect.width > window.innerWidth) {
      left = window.innerWidth - cardRect.width - margin;
    }
    if (left < margin) left = margin;

    // Aplicar posiciones finales
    card.style.top = `${Math.max(margin, top)}px`;
    card.style.left = `${left}px`;
    card.style.bottom = 'auto';
    card.style.right = 'auto';
  }

  next() {
    this.currentStep++;
    if (this.currentStep < this.steps.length) {
      this.showStep();
    } else {
      this.finish();
    }
  }

  finish() {
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onResize);
    if (this._spotlightRaf != null) {
      cancelAnimationFrame(this._spotlightRaf);
      this._spotlightRaf = null;
    }
    this.overlay.classList.remove('open');
    localStorage.setItem(this.storageKey, 'true');
    setTimeout(() => {
      this.overlay?.remove();
      this.overlay = null;
      this.currentStep = 0;
      clearActiveOnboarding(this);
    }, 500);
  }

  cancel() {
    if (!this.overlay) return;
    window.removeEventListener('scroll', this._onScroll, { capture: true });
    window.removeEventListener('resize', this._onResize);
    this.overlay.remove();
    this.overlay = null;
    this.currentStep = 0;
    clearActiveOnboarding(this);
  }
}
