document.addEventListener('DOMContentLoaded', () => {
  // Inicialización de iconos (lucide)
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Soporte para evitar errores si lo integraste en tu proyecto principal con otra clase
  const sidebarMain = document.querySelector('.sidebar-main') || document.querySelector('.sidebar') || document.getElementById('appSidebar');

  const crmFlyout = document.getElementById('crm-flyout');


  if (crmFlyout && crmFlyout.parentNode !== document.body) {
    document.body.appendChild(crmFlyout);
  }

  let activeBtnNode = null;

  // Función para recalcular la posición en tiempo real
  function updateFlyoutPosition() {
    if (!activeBtnNode || !crmFlyout || !crmFlyout.classList.contains('flyout-visible')) return;

    const rect = activeBtnNode.getBoundingClientRect();
    const isMobile = window.innerWidth <= 768;
    const flyoutWidth = crmFlyout.offsetWidth || 280;
    
    if (isMobile) {
      crmFlyout.style.top = `${rect.bottom + 8}px`;
      const maxLeft = window.innerWidth - flyoutWidth - 10;
      crmFlyout.style.left = `${Math.max(10, Math.min(rect.left, maxLeft))}px`;
    } else {
      let topPos = rect.top;
      const flyoutHeight = crmFlyout.offsetHeight || 450;
      if (topPos + flyoutHeight > window.innerHeight) {
        topPos = window.innerHeight - flyoutHeight - 20;
      }
      crmFlyout.style.top = `${Math.max(10, topPos)}px`;
      crmFlyout.style.left = `${rect.right + 12}px`;
    }
  }

  // Reposicionar dinámicamente si el usuario hace scroll o cambia el tamaño de la ventana
  window.addEventListener('resize', updateFlyoutPosition);
  document.addEventListener('scroll', updateFlyoutPosition, true); // true para capturar el scroll de contenedores internos

  // Usamos delegación de eventos globales. 
  // Esto repara el error si el botón "Clientes" es inyectado dinámicamente por otro script.
  document.addEventListener('click', (event) => {
    let btnClientes = event.target.closest('#btn-clientes');

    // Respaldo: Si el botón no tiene ID pero su texto dice "Clientes", lo detectamos igual
    if (!btnClientes && sidebarMain && sidebarMain.contains(event.target)) {
      const clickedElement = event.target.closest('button, a, .nav-item');
      if (clickedElement && clickedElement.textContent.toLowerCase().includes('clientes')) {
        btnClientes = clickedElement;
      }
    }
    
    // 1. Si hicimos clic en el botón de Clientes
    if (btnClientes && crmFlyout) {
      event.preventDefault();
      event.stopPropagation();
      
      crmFlyout.style.display = 'flex'; // Forzar por si hay un display:none global ocultándolo

      const isVisible = crmFlyout.classList.toggle('flyout-visible');
      
      if (isVisible) {
        activeBtnNode = btnClientes;
        updateFlyoutPosition();
        
        crmFlyout.classList.remove('flyout-hidden');
        btnClientes.classList.add('active');
      } else {
        activeBtnNode = null;
        crmFlyout.classList.add('flyout-hidden');
        btnClientes.classList.remove('active');
      }
      return; // Detener evaluación aquí
    }

    // 2. Si hicimos clic fuera del panel (para cerrarlo)
    if (!crmFlyout) return;
    const isFlyoutOpen = crmFlyout.classList.contains('flyout-visible');
    const clickedInsideFlyout = crmFlyout.contains(event.target);
    const clickedInsideSidebar = sidebarMain ? sidebarMain.contains(event.target) : false;

    if (isFlyoutOpen && !clickedInsideFlyout && !clickedInsideSidebar) {
      crmFlyout.classList.remove('flyout-visible');
      crmFlyout.classList.add('flyout-hidden');
      activeBtnNode = null;
      const activeBtn = document.getElementById('btn-clientes');
      if (activeBtn) activeBtn.classList.remove('active');
    }
  }, true); // Añadimos 'true' (fase de captura) para detener el clic antes de que app.js fuerce la redirección.
});