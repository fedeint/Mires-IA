import { Onboarding } from '../scripts/onboarding-engine.js';

const stepsAll = [
  {
    title: "Balance de Caja",
    text: "Aquí puedes ver el resumen de ingresos, egresos y el efectivo actual en tiempo real.",
    element: "#cajaStatsContainer",
  },
  {
    title: "Acciones Rápidas",
    text: "Usa estos botones para registrar nuevos ingresos o egresos rápidamente.",
    element: ".cj-actions",
  },
  {
    title: "Control de Meseros",
    text: "Visualiza qué meseros están disponibles y cuántos productos tienen asignados.",
    element: "#meserosGrid",
  },
  {
    title: "Historial Detallado",
    text: "Tus transacciones se separan automáticamente en ingresos y egresos para un mejor control.",
    element: "#cajaHistoryContainer",
  },
  {
    title: "Cambio de Tema",
    text: "Puedes alternar entre modo claro y oscuro aquí para mayor comodidad visual.",
    element: "#themeToggle",
  },
];

window.startCajaOnboarding = function startCajaOnboarding() {
  const showMeseros = window.__mirestCajaMeserosEnabled === true;
  const steps = showMeseros
    ? stepsAll
    : stepsAll.filter((s) => s.element !== "#meserosGrid");
  const instance = new Onboarding(steps, "mirest-caja-guide-done");
  instance.start();
};
