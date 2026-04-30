import { Onboarding } from '../scripts/onboarding-engine.js';

const steps = [
  {
    title: "Panel de Cocina",
    text: "Bienvenido al centro de control. Aquí verás todos los pedidos que entran en tiempo real.",
    element: "#ckStatsContainer"
  },
  {
    title: "Búsqueda Rápida",
    text: "Encuentra platos específicos o mesas usando la barra de búsqueda inteligente.",
    element: "#ckSearchContainer"
  },
  {
    title: "Filtros de Estado",
    text: "Organiza tus tareas filtrando por pedidos en preparación, listos, entregados o rechazados.",
    element: "#ckFilterContainer"
  },
  {
    title: "Gestión de Pedidos",
    text: "Usa el botón de Nuevo Pedido para agregar comandas manualmente si es necesario.",
    element: "#btnAddDish"
  },
  {
    title: "Asistente IA",
    text: "Activa la IA para optimizar los tiempos de preparación y recibir sugerencias.",
    element: "#btnActivateIA"
  }
];

let onboardingInstance = null;

document.addEventListener('DOMContentLoaded', () => {
  onboardingInstance = new Onboarding(steps, 'mirest-cocina-guide-done');
  
  // Iniciar cocina automáticamente pero con un pequeño retraso para asegurar que todo el renderizado terminó
  setTimeout(() => {
    if (onboardingInstance) onboardingInstance.start();
  }, 1000);
});
