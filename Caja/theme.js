/**
 * theme.js — compartido Caja y Cocina
 * Toggle de tema claro/oscuro con sincronización al cargar página
 */

export function initTheme() {
  const themeBtn = document.getElementById('themeToggle');
  if (!themeBtn) return;

  // Aplicar tema guardado al body en el arranque (el <script> inline ya lo pone en <html>)
  const saved = localStorage.getItem('mirest-ui-theme') || 'light';
  document.body.dataset.theme = saved;

  const sync = (theme) => {
    themeBtn.textContent = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
  };
  sync(saved);

  themeBtn.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    const next    = current === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    document.body.dataset.theme            = next;
    localStorage.setItem('mirest-ui-theme', next);
    sync(next);
  });
}
