/**
 * theme.js — Cocina
 * Maneja el toggle de tema oscuro / claro
 */

export function initTheme() {
  const themeBtn = document.getElementById('themeToggle');
  if (!themeBtn) return;

  // Sincronizar texto del botón con el tema actual al cargar
  const currentTheme = document.documentElement.dataset.theme || 'light';
  themeBtn.textContent = currentTheme === 'dark' ? 'Modo claro' : 'Modo oscuro';

  themeBtn.addEventListener('click', () => {
    const root   = document.documentElement;
    const isDark = root.dataset.theme === 'dark';
    const next   = isDark ? 'light' : 'dark';
    root.dataset.theme          = next;
    document.body.dataset.theme = next;
    localStorage.setItem('mirest-ui-theme', next);
    themeBtn.textContent = isDark ? 'Modo oscuro' : 'Modo claro';
  });
}
