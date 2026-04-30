/**
 * Catálogos de tipos y secciones (definición de producto). Métricas e historial: vacíos hasta conectar API.
 */

export const reportTypes = [
  { id: "resumen-dia", name: "Resumen del Día", description: "Ventas, platos, mesas, caja", icon: "📊" },
  { id: "inventario", name: "Inventario", description: "Stock actual y movimientos", icon: "📦" },
  { id: "movimientos-almacen", name: "Movimientos de Almacén", description: "Entradas y salidas de productos", icon: "🔄" },
  { id: "gastos", name: "Gastos", description: "Registro de gastos operativos", icon: "💸" },
];

export const reportSections = [
  { id: "ventas", label: "Ventas del día", description: "Total de ventas y desglose por canal" },
  { id: "platos", label: "Platos vendidos", description: "Detalle de platos y cantidades" },
  { id: "mesas", label: "Mesas atendidas", description: "Resumen de ocupación y servicio" },
  { id: "caja", label: "Caja", description: "Movimientos de caja y cierre" },
];

/** Estructura de vista previa; rellenar con respuesta de API. */
export const reportPreviewData = {
  restaurant: "—",
  ruc: "—",
  date: "—",
  type: "—",
  ventas: {
    total: 0,
    efectivo: 0,
    tarjeta: 0,
    delivery: 0,
    pedidos: 0,
    ticketPromedio: 0,
  },
  platos: [] as { nombre: string; cantidad: number; precio: number; total: number }[],
  mesas: {
    totalAtendidas: 0,
    mesaMayor: { mesa: "—", total: 0 },
    ocupacion: "—",
  },
  caja: {
    apertura: 0,
    ingresoEfectivo: 0,
    ingresoTarjeta: 0,
    egresos: 0,
    cierre: 0,
    diferencia: 0,
  },
};

export const reportHistory: { id: string; tipo: string; fecha: string; usuario: string; formato: string }[] = [];

export const savedTemplates: { id: string; nombre: string; tipo: string; secciones: string[] }[] = [];

export const filterOptions = {
  products: [] as string[],
  categories: [] as string[],
  channels: [] as string[],
  waiters: [] as string[],
};
