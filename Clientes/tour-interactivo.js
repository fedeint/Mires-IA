/**
 * c:/Users/bruce/Downloads/MiRestConIAEsqueleto/MiRestConIAEsqueleto/Clientes/tour-interactivo.js
 * Componente <TourInteractivo /> adaptado a Vanilla JS.
 * Gestiona la captura de identidad y el enrutamiento del Onboarding.
 */

const TOUR_LS_NAMES = ['isFirstLogin', 'nombreUsuario', 'userRole', 'tourStepIndex', 'tourCompletado'];

function getTourUserScope() {
  try {
    return localStorage.getItem('mirest_user_id') || sessionStorage.getItem('mirest_user_id') || 'anon';
  } catch {
    return 'anon';
  }
}

function tourKey(name) {
  return `mirest_tu_${getTourUserScope()}_${name}`;
}

let tourLegacyMigrated = false;
function migrateLegacyTourKeys() {
  if (tourLegacyMigrated) return;
  tourLegacyMigrated = true;
  if (localStorage.getItem('mirest_tu_tour_unscoped_migrated') === '1') return;
  for (const n of TOUR_LS_NAMES) {
    const legacy = localStorage.getItem(n);
    if (legacy == null) continue;
    const k = tourKey(n);
    if (localStorage.getItem(k) == null) {
      localStorage.setItem(k, legacy);
    }
  }
  for (const n of TOUR_LS_NAMES) {
    localStorage.removeItem(n);
  }
  localStorage.setItem('mirest_tu_tour_unscoped_migrated', '1');
}

export class TourInteractivo {
  constructor() {
    migrateLegacyTourKeys();
    this.isFirstLogin = localStorage.getItem(tourKey('isFirstLogin')) !== 'false';
    this.nombreUsuario = localStorage.getItem(tourKey('nombreUsuario')) || '';
    this.userRole = localStorage.getItem(tourKey('userRole')) || '';
    this.currentTourStepIndex = parseInt(localStorage.getItem(tourKey('tourStepIndex')), 10) || 0;
    this.tourSteps = [];
  }

  iniciar() {
    console.log("Onboarding: Iniciando motor de Tour...", { isFirstLogin: this.isFirstLogin, role: this.userRole });
    if (this.isFirstLogin) {
      this.renderizarFaseCero();
    } else {
      this.enrutarTour();
    }
  }

  // ==========================================
  // FASE 0: CAPTURA DE IDENTIDAD
  // ==========================================
  renderizarFaseCero() {
    const overlay = document.createElement('div');
    overlay.id = 'onboarding-overlay';
    overlay.style.cssText = `
      position: fixed; inset: 0; background: rgba(10, 15, 36, 0.9); backdrop-filter: blur(10px);
      display: flex; align-items: center; justify-content: center; z-index: 2147483647;
      color: white; font-family: 'Space Grotesk', sans-serif; text-align: center;
    `;

    overlay.innerHTML = `
      <div style="background: var(--color-surface, #1e293b); padding: 40px; border-radius: 20px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); max-width: 400px; width: 90%; border: 1px solid rgba(255,255,255,0.1);">
        <div style="font-size: 48px; margin-bottom: 16px;">✨</div>
        <h2 style="margin: 0 0 12px; font-size: 24px;">¡Te damos la bienvenida a MiRest con IA!</h2>
        <p style="color: #94a3b8; font-family: 'Inter', sans-serif; font-size: 14px; margin-bottom: 24px; line-height: 1.5;">
          Estamos preparando tu espacio de trabajo personalizado. Para empezar...
        </p>
        <form id="form-identidad" style="display: flex; flex-direction: column; gap: 16px;">
          <input type="text" id="input-nombre" placeholder="¿Cómo te llamas?" required autocomplete="off"
            style="padding: 12px 16px; border-radius: 12px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 16px; outline: none; text-align: center;">
          
          <!-- Select simulado para pruebas de Rol -->
          <select id="select-rol" required style="padding: 12px 16px; border-radius: 12px; border: 1px solid #334155; background: #0f172a; color: white; font-size: 14px; outline: none; text-align: center;">
            <option value="" disabled selected>Selecciona tu rol operativo</option>
            <option value="General">Tour Módulo de Clientes (CRM)</option>
            <option value="Marketero">Marketero (Fidelización)</option>
            <option value="Administrador">Administrador (Global)</option>
          </select>

          <button type="submit" style="background: linear-gradient(135deg, #f97316, #ea580c); color: white; padding: 14px; border: none; border-radius: 12px; font-weight: bold; font-size: 16px; cursor: pointer; transition: transform 0.2s;">
            Comenzar mi recorrido
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(overlay);

    document.getElementById('form-identidad').addEventListener('submit', (e) => {
      e.preventDefault();
      const nombre = document.getElementById('input-nombre').value.trim();
      const rol = document.getElementById('select-rol').value;

      // Guardar identidad y cambiar flag
      localStorage.setItem(tourKey('nombreUsuario'), nombre);
      localStorage.setItem(tourKey('userRole'), rol);
      localStorage.setItem(tourKey('isFirstLogin'), 'false');
      localStorage.setItem(tourKey('tourStepIndex'), '0');
      
      this.nombreUsuario = nombre;
      this.userRole = rol;
      this.currentTourStepIndex = 0;

      // Remover overlay y arrancar router
      overlay.remove();
      this.enrutarTour();
    });
  }

  // ==========================================
  // ROUTER DEL ONBOARDING
  // ==========================================
  enrutarTour() {
    const pathActual = window.location.pathname;

    if (this.userRole === 'General') {
      this.prepararTourGeneral();
    } else if (this.userRole === 'Marketero') {
      this.prepararTourMarketero();
    } else if (this.userRole === 'Administrador') {
      this.prepararTourAdministrador();
    }

    if (this.tourSteps.length > 0) {
      this.procesarPasoActual();
    }
  }

  // ==========================================
  // RECORRIDOS INDIVIDUALES
  // ==========================================

  prepararTourMarketero() {
    this.tourSteps = [
      { isWelcome: true, texto: `¡Bienvenid@, ${this.nombreUsuario}! Omitiremos las rutinas operativas, tu trabajo aquí es estratégico.` },
      { url: 'Clientes/campanas.html', elemento: '.campaigns-grid', texto: `1. ${this.nombreUsuario}, aquí gestionas tus automatizaciones. Mira las campañas activas.` },
      { url: 'Clientes/campanas.html', elemento: '#btnNewCampaign', texto: `2. No redactes desde cero. Usa el Asistente IA aquí para generar una oferta persuasiva de WhatsApp.` },
      { url: 'Clientes/dashboard-crm.html', elemento: '.saas-top-kpis', texto: `3. ${this.nombreUsuario}, una vez enviada la campaña, monitorea aquí cuántos mensajes se convirtieron en ventas reales. ¡Ese es tu Aha! Moment!` }
    ];
  }

  prepararTourAdministrador() {
    this.tourSteps = [
      { isWelcome: true, texto: `¡Hola, ${this.nombreUsuario}! Este es tu centro de mando para orquestar y monitorear todo el restaurante.` },
      { url: 'Clientes/dashboard-crm.html', elemento: '.saas-top-kpis', texto: `1. ${this.nombreUsuario}, revisa diariamente estos números. Te dicen la salud real de tu negocio y si estás cumpliendo metas.` },
      { url: 'Clientes/clientes.html', elemento: '.btn-agent', texto: `2. Puedes usar nuestro Agente IA para analizar la base de datos de clientes con un solo clic.` },
      { url: 'Clientes/proveedores.html', elemento: '#provSearchInput', texto: `3. Revisa aquí tus cuentas por pagar y el rendimiento de tus proveedores para asegurar el suministro de cocina.` },
      { url: 'Clientes/inbox-whatsapp.html', elemento: '#chatMainArea', texto: `4. Si el Asistente IA no puede resolver una queja grave, toma el control de ese chat de WhatsApp aquí mismo.` }
    ];
  }

  prepararTourGeneral() {
    this.tourSteps = [
      { isWelcome: true, texto: `¡Bienvenid@, ${this.nombreUsuario}! Este es el recorrido del Módulo de Clientes. Te mostraremos todas las herramientas de gestión y fidelización paso a paso.` },
      { url: 'Clientes/dashboard-crm.html', elemento: '.saas-top-kpis', texto: `1. Dashboard CRM: Aquí monitoreas la salud de tu negocio, ingresos y conversión de campañas en tiempo real.` },
      { url: 'Clientes/clientes.html', elemento: '.crm-header-actions', texto: `2. Base de Clientes: Gestiona tus contactos, accede a perfiles 360° y usa nuestro Agente IA para consultas.` },
      { url: 'Clientes/lead-scoring.html', elemento: '#scoringDirectory', texto: `3. Lead Scoring RFM: La IA clasifica automáticamente a tus clientes desde "Ocasionales" hasta "VIP" según su valor real.` },
      { url: 'Clientes/nurturing.html', elemento: '#nurturingDirectory', texto: `4. Nurturing (Fidelización): En este panel gestionas secuencias automáticas. El sistema envía mensajes clave (ej. felicitaciones o promos de reactivación) para asegurar que tus clientes siempre regresen.` },
      { url: 'Clientes/proveedores.html', elemento: '#provSearchInput', texto: `5. Proveedores: Controla tu abastecimiento, visualiza cuentas por pagar y evalúa el desempeño logístico.` },
      { url: 'Clientes/inbox-whatsapp.html', elemento: '#chatMainArea', texto: `6. Inbox WhatsApp: Centraliza tu atención al cliente y toma el control cuando el Agente IA lo requiera.` },
      { url: 'Clientes/campanas.html', elemento: '.campaigns-grid', texto: `7. Campañas: Genera ofertas irresistibles con IA y envíalas por WhatsApp a segmentos específicos. ¡Con esto terminamos el recorrido!` }
    ];
  }

  // ==========================================
  // MOTOR VISUAL DE TOOLTIPS
  // ==========================================
  procesarPasoActual() {
    const paso = this.tourSteps[this.currentTourStepIndex];
    if (!paso) {
      this.endTour();
      return;
    }

    // 1. Navegación Multi-página: Verificar si estamos en la vista correcta
    if (paso.url) {
      const expectedFile = paso.url.split('/').pop();
      if (!window.location.pathname.includes(expectedFile)) {
        let rootPath = document.body.dataset.rootPath;
        if (typeof rootPath === 'undefined') {
          rootPath = window.location.pathname.split('/').length > 2 ? '../' : './';
        }
        window.location.href = rootPath + paso.url;
        return;
      }
    }

    // 2. Si estamos en la página correcta, inyectar y mostrar el tooltip
    this.injectTooltipStyles();

    let container = document.getElementById('tour-container');
    if (!container) {
      container = this.createTooltipElement();
      document.body.appendChild(container);
    }

    this.displayTooltip(paso);
  }

  injectTooltipStyles() {
    if (document.getElementById('onboarding-tooltip-styles')) return;

    const style = document.createElement('style');
    style.id = 'onboarding-tooltip-styles';
    style.textContent = `
      #onboarding-spotlight {
        position: fixed;
        border-radius: 8px;
        box-shadow: 0 0 0 9999px rgba(10, 15, 36, 0.85), 0 0 15px rgba(249, 115, 22, 0.5) inset;
        border: 2px solid #f97316;
        z-index: 2147483646;
        pointer-events: none;
        transition: all 0.3s ease;
        opacity: 0;
        visibility: hidden;
      }
      #onboarding-spotlight.show { opacity: 1; visibility: visible; }
      
      #onboarding-tooltip {
        position: fixed;
        background: rgba(15, 23, 42, 0.95);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        color: #f8fafc;
        border: 1px solid rgba(249, 115, 22, 0.3);
        border-radius: 16px;
        padding: 24px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255,255,255,0.05) inset;
        z-index: 2147483647;
        max-width: 340px;
        font-family: 'Inter', sans-serif;
        font-size: 14px;
        line-height: 1.6;
        text-align: left;
        visibility: hidden;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), visibility 0.4s;
        transform: translateY(15px) scale(0.95);
      }
      #onboarding-tooltip.show {
        visibility: visible;
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0) scale(1);
      }
      .tooltip-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .tooltip-step-text {
        font-size: 11px;
        font-weight: 700;
        color: #f97316;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }
      #onboarding-tooltip p {
        margin: 0 0 20px 0;
        color: #e2e8f0;
      }
      .tooltip-progress-container {
        display: flex;
        gap: 4px;
        margin-bottom: 16px;
      }
      .tooltip-dot {
        height: 4px;
        flex: 1;
        background: rgba(255, 255, 255, 0.15);
        border-radius: 2px;
        transition: background 0.3s ease, box-shadow 0.3s ease;
      }
      .tooltip-dot.active {
        background: #f97316;
        box-shadow: 0 0 8px rgba(249, 115, 22, 0.6);
      }
      #onboarding-tooltip .tooltip-nav-btns {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 12px;
      }
      #onboarding-tooltip .tooltip-nav-btns button {
        border: none;
        padding: 10px 16px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s ease;
      }
      #tooltip-skip-btn {
        background: transparent;
        color: #94a3b8;
        padding: 10px 8px;
      }
      #tooltip-skip-btn:hover {
        color: #f8fafc;
      }
      #tooltip-next-btn {
        background: linear-gradient(135deg, #f97316, #ea580c);
        color: white;
        box-shadow: 0 4px 10px rgba(234, 88, 12, 0.3);
      }
      #tooltip-next-btn:hover {
        box-shadow: 0 6px 15px rgba(234, 88, 12, 0.4);
        transform: translateY(-1px);
      }
      #onboarding-tooltip .tooltip-close {
        background: none;
        color: #64748b;
        font-size: 20px;
        line-height: 1;
        padding: 0;
      }
      #onboarding-tooltip .tooltip-close:hover {
        color: white;
      }
    `;
    document.head.appendChild(style);
  }

  createTooltipElement() {
    const container = document.createElement('div');
    container.id = 'tour-container';
    container.innerHTML = `
      <div id="onboarding-spotlight"></div>
      <div id="onboarding-tooltip">
        <div class="tooltip-header">
          <span class="tooltip-step-text" id="tooltip-step-text"></span>
          <button class="tooltip-close" title="Cerrar tour">&times;</button>
        </div>
        <div class="tooltip-progress-container" id="tooltip-progress"></div>
        <p id="tooltip-content"></p>
        <div class="tooltip-nav-btns">
          <button id="tooltip-skip-btn">Saltar tour</button>
          <button id="tooltip-next-btn">Siguiente</button>
        </div>
      </div>
    `;
    container.querySelector('.tooltip-close').onclick = () => this.endTour();
    container.querySelector('#tooltip-skip-btn').onclick = () => this.endTour();
    container.querySelector('#tooltip-next-btn').onclick = () => this.nextStep();
    return container;
  }

  displayTooltip(paso) {
    try {
      console.log("Onboarding: Renderizando paso actual...", paso);
      const tooltip = document.getElementById('onboarding-tooltip');
      const spotlight = document.getElementById('onboarding-spotlight');
      const content = document.getElementById('tooltip-content');
      const nextBtn = document.getElementById('tooltip-next-btn');
      const stepText = document.getElementById('tooltip-step-text');
      const progressContainer = document.getElementById('tooltip-progress');
      const skipBtn = document.getElementById('tooltip-skip-btn');

      if (!tooltip || !content || !spotlight) throw new Error("Faltan contenedores del DOM");

      // Ejecutar lógica forzada (ej. abrir Caja) ANTES de buscar el elemento
      if (paso.action) { try { paso.action(); } catch(e) { console.error("Error ejecutando acción previa", e); } }
      
      content.innerHTML = paso.texto;
      
      tooltip.classList.remove('show'); // Reset animación
      spotlight.classList.remove('show');

      // FORZAR FONDO OSCURO PARA BIENVENIDA Y ELEMENTOS OCULTOS
      spotlight.style.border = 'none';
      spotlight.style.boxShadow = '0 0 0 9999px rgba(10, 15, 36, 0.85)';
      spotlight.style.width = '0px';
      spotlight.style.height = '0px';
      spotlight.style.top = '50%';
      spotlight.style.left = '50%';

      if (paso.isWelcome) {
          stepText.textContent = '✨ BIENVENIDO A MIREST';
          progressContainer.style.display = 'none';
          skipBtn.style.display = 'none';
          nextBtn.textContent = 'Empezar recorrido';
          spotlight.classList.add('show');
          this.positionTooltipCenter(tooltip);
          setTimeout(() => tooltip.classList.add('show'), 50);
      } else {
          progressContainer.style.display = 'flex';
          skipBtn.style.display = 'block';
          
          const totalSteps = this.tourSteps.length - 1;
          const currentVisibleStep = this.currentTourStepIndex; // 1-based since 0 is welcome

          stepText.textContent = `PASO ${currentVisibleStep} DE ${totalSteps}`;
          progressContainer.innerHTML = Array.from({length: totalSteps}).map((_, i) => {
              let extraStyle = '';
              if (i < currentVisibleStep - 1) extraStyle = 'style="background: rgba(249, 115, 22, 0.4);"';
              let activeClass = i === currentVisibleStep - 1 ? 'active' : '';
              return `<div class="tooltip-dot ${activeClass}" ${extraStyle}></div>`;
          }).join('');

          nextBtn.innerHTML = (this.currentTourStepIndex === this.tourSteps.length - 1) ? '<i class="fa-solid fa-check"></i> Finalizar' : 'Siguiente &rarr;';

          const elementoDestino = document.querySelector(paso.elemento);

          if (elementoDestino) {
              const rect = elementoDestino.getBoundingClientRect();
              if (rect.width === 0 && rect.height === 0) {
                      this.mostrarFallbackOculto(content, paso, tooltip, spotlight);
              } else {
                  elementoDestino.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  setTimeout(() => {
                      const elRect = elementoDestino.getBoundingClientRect();
                      spotlight.style.top = `${elRect.top - 8}px`;
                      spotlight.style.left = `${elRect.left - 8}px`;
                      spotlight.style.width = `${elRect.width + 16}px`;
                      spotlight.style.height = `${elRect.height + 16}px`;
                      spotlight.style.border = '2px solid #f97316';
                      spotlight.style.boxShadow = '0 0 0 9999px rgba(10, 15, 36, 0.85), 0 0 15px rgba(249, 115, 22, 0.5) inset';
                      spotlight.classList.add('show');

                      this.positionTooltipNearElement(tooltip, elementoDestino);
                      tooltip.classList.add('show');
                  }, 400); // 400ms da tiempo al scroll suavizado de terminar
              }
          } else {
                  this.mostrarFallbackOculto(content, paso, tooltip, spotlight);
          }
      }
    } catch (error) {
        console.error("Fallo crítico en Onboarding:", error);
        alert("Ocurrió un fallo en el tour. Revisa la consola (F12) para más detalles: " + error.message);
    }
  }
  
  mostrarFallbackOculto(content, paso, tooltip, spotlight) {
      content.innerHTML = `<span style="color:#f97316; font-size:12px;">(El elemento está oculto, pero debes conocer esta acción)</span><br><br>${paso.texto}`;
      spotlight.style.border = 'none';
      spotlight.style.boxShadow = '0 0 0 9999px rgba(10, 15, 36, 0.85)';
      spotlight.style.width = '0px';
      spotlight.style.height = '0px';
      spotlight.style.top = '50%';
      spotlight.style.left = '50%';
      
      spotlight.classList.add('show'); // Encender fondo oscuro
      this.positionTooltipCenter(tooltip);
      setTimeout(() => tooltip.classList.add('show'), 50);
  }

  nextStep() {
    this.currentTourStepIndex++;
    localStorage.setItem(tourKey('tourStepIndex'), String(this.currentTourStepIndex));
    this.procesarPasoActual();
  }

  endTour() {
    const container = document.getElementById('tour-container');
    const spotlight = document.getElementById('onboarding-spotlight');
    if (spotlight) spotlight.classList.remove('show');
    
    if (container) {
        const tooltip = document.getElementById('onboarding-tooltip');
        if(tooltip) tooltip.classList.remove('show');
        setTimeout(() => container.remove(), 400);
    }
    localStorage.setItem(tourKey('tourCompletado'), 'true');
    localStorage.removeItem(tourKey('tourStepIndex'));
  }

  positionTooltipCenter(tooltip) {
    tooltip.style.position = 'fixed';
    tooltip.style.top = '50%';
    tooltip.style.left = '50%';
    tooltip.style.transform = 'translate(-50%, -50%)';
  }

  positionTooltipNearElement(tooltip, element) {
    const rect = element.getBoundingClientRect();
    tooltip.style.position = 'fixed';
    
    let top = rect.bottom + 15;
    let left = rect.left;

    if (rect.bottom + tooltip.offsetHeight + 20 > window.innerHeight) { 
        top = rect.top - tooltip.offsetHeight - 15;
    }

    if (rect.left + tooltip.offsetWidth + 20 > window.innerWidth) {
        left = window.innerWidth - tooltip.offsetWidth - 15; 
    }

    tooltip.style.top = `${Math.max(10, top)}px`;
    tooltip.style.left = `${Math.max(10, left)}px`;
    tooltip.style.transform = 'none'; // Quitar el centrado
  }
}

// ==========================================
// AUTO-INICIALIZACIÓN GLOBAL
// ==========================================
const initTour = () => {
  if (!window.tourInstance) {
    window.tourInstance = new TourInteractivo();
    
    // INYECTAR BOTÓN DE PRUEBA VISIBLE
    if(!document.getElementById('btn-debug-tour')) {
        const btn = document.createElement('button');
        btn.id = 'btn-debug-tour';
        btn.innerHTML = '✨ Reiniciar Tour';
        btn.style.cssText = 'position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; background: #f97316; color: #fff; border: none; padding: 12px 20px; border-radius: 50px; font-weight: bold; cursor: pointer; box-shadow: 0 4px 12px rgba(249, 115, 22, 0.4); font-family: Inter, sans-serif; transition: transform 0.2s;';
        btn.onmouseover = () => btn.style.transform = 'scale(1.05)';
        btn.onmouseout = () => btn.style.transform = 'scale(1)';
        btn.onclick = () => {
            migrateLegacyTourKeys();
            TOUR_LS_NAMES.forEach((n) => localStorage.removeItem(tourKey(n)));
            localStorage.removeItem('mirest_tu_tour_unscoped_migrated');
            window.location.reload();
        };
        document.body.appendChild(btn);
    }

    // Solo dispara si el usuario no ha terminado ni saltado el tour antes
    migrateLegacyTourKeys();
    if (localStorage.getItem(tourKey('tourCompletado')) !== 'true') {
      window.tourInstance.iniciar();
    }
  }
  // Comando de consola para reiniciar el tour al probar
  window.resetTour = () => { localStorage.clear(); window.location.reload(); };
};

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initTour); } else { initTour(); }