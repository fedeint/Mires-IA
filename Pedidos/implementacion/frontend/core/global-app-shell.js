/**
 * Shell global: mismo sidebar de navegación (Menu principal + Módulos) que el dashboard base.
 * Usa `scripts/navigation.js#renderSidebar` y el mismo criterio móvil que `layout.css` (≤1180px cajón).
 * No se inyecta un segundo “dashboard” en Pedidos: se reutiliza la misma lista de módulos y estilos.
 */
import { renderMobileDock, renderSidebar, resolveUserRole, resolveUserPermissions } from '../../../../scripts/navigation.js';
import { getCurrentUser, supabase } from '../../../../scripts/supabase.js';

function getRootPath() {
  return (document.body?.dataset?.rootPath || './').replace(/\/+$/, '');
}

function wireLogout() {
  const loginHref = getRootPath() ? `${getRootPath()}/login.html` : 'login.html';
  const signOutAndGoLogin = async () => {
    await supabase.auth.signOut();
    window.location.href = loginHref;
  };
  document.getElementById('sidebarLogoutBtn')?.addEventListener('click', signOutAndGoLogin);
}

function ensureMobileDock() {
  let dock = document.getElementById('mobileAppDock');
  if (dock) return dock;

  dock = document.createElement('nav');
  dock.id = 'mobileAppDock';
  dock.className = 'mobile-dock mobile-dock--pedidos';
  dock.setAttribute('aria-label', 'Navegación inferior PWA MiRest');
  document.body.appendChild(dock);
  return dock;
}

/**
 * Sincroniza con `body.sidebar-open`, clases en `#appSidebar` (sidebar--open) y aria del toggle.
 * Lógica equivalente a `scripts/app.js#initializeResponsiveSidebar` para no cargar toda `app.js`.
 */
function initResponsiveNav() {
  const sidebar = document.getElementById('appSidebar');
  const toggle = document.getElementById('sidebarToggle');
  const backdrop = document.getElementById('sidebarBackdrop');
  if (!sidebar || !toggle || !backdrop) return;

  const setState = (open) => {
    document.body.classList.toggle('sidebar-open', open);
    sidebar.classList.toggle('sidebar--open', open);
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute(
      'aria-label',
      open ? 'Cerrar navegación lateral' : 'Abrir o cerrar la navegación de la plataforma',
    );
  };

  setState(false);

  toggle.addEventListener('click', () => {
    setState(!document.body.classList.contains('sidebar-open'));
  });

  backdrop.addEventListener('click', () => {
    setState(false);
  });

  sidebar.addEventListener('click', (e) => {
    if (e.target?.closest('a[href]') && window.innerWidth <= 1180) {
      setState(false);
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 1180) setState(false);
  });

  window.addEventListener('pageshow', () => setState(false));
}

export async function initGlobalAppShell() {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  let user = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  const isLogin = window.location.pathname.includes('login.html') || window.location.pathname.endsWith('/login');
  const role = user && !isLogin ? resolveUserRole(user) : 'admin';
  const permissions = user && !isLogin ? resolveUserPermissions(user, role) : null;

  renderSidebar(nav, 'pedidos', role, permissions);
  renderMobileDock(ensureMobileDock(), 'pedidos', role, permissions);
  if (window.lucide) {
    window.lucide.createIcons();
  }
  wireLogout();
  initResponsiveNav();
  window.lucide?.createIcons?.();
}
