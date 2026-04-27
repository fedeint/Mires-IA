/**
 * Solo reglas de UI (flujos, etiquetas, formas de pago). Sin entidades de negocio simuladas.
 * Datos reales: Supabase.
 */

export const documentTypeOptions = [
  { value: "boleta", label: "Ticket" },
  { value: "factura", label: "Factura" },
];

export const paymentMethodOptions = [
  { value: "yape", label: "Yape" },
  { value: "efectivo", label: "Efectivo" },
  { value: "tarjeta", label: "Tarjeta" },
  { value: "transferencia", label: "Transferencia" },
];

export const zones = ["Interior", "Terraza", "Barra", "VIP"];

export const statusOptions = [
  { value: "libre", label: "Libre" },
  { value: "ocupada", label: "Ocupada" },
  { value: "reservada", label: "Reservada" },
];

export const TAKEAWAY_PACKAGING_RATE = 0.1;

export const deliveryStatusFlow = ["pendiente", "preparando", "listo-salir", "en-ruta", "entregado"];
export const takeawayStatusFlow = ["recibido", "en-preparacion", "listo-recoger", "entregado"];

export const deliveryStatusOptions = [
  { value: "pendiente", label: "Pendiente" },
  { value: "preparando", label: "Preparando" },
  { value: "listo-salir", label: "Listo para salir" },
  { value: "en-ruta", label: "En ruta" },
  { value: "entregado", label: "Entregado" },
];

export const takeawayStatusOptions = [
  { value: "recibido", label: "Recibido" },
  { value: "en-preparacion", label: "En preparación" },
  { value: "listo-recoger", label: "Listo para recoger" },
  { value: "entregado", label: "Entregado" },
];

export const categories = [{ id: "all", name: "Todos" }];

export const statusMeta = {
  libre: { label: "Libre", tone: "success", icon: "check-circle", helper: "Disponible para nueva atención" },
  ocupada: { label: "Ocupada", tone: "danger", icon: "dot-circle", helper: "Tiene un pedido activo" },
  reservada: { label: "Reservada", tone: "info", icon: "clock", helper: "Preparada para atención próxima" },
};

export const deliveryStatusMeta = {
  pendiente: { label: "Pendiente", tone: "warning", icon: "clock", helper: "Aún no inicia preparación" },
  preparando: { label: "Preparando", tone: "info", icon: "flame", helper: "Pedido en cocina" },
  "listo-salir": { label: "Listo para salir", tone: "accent", icon: "package", helper: "Esperando salida" },
  "en-ruta": { label: "En ruta", tone: "neutral", icon: "bike", helper: "Pedido asignado a reparto" },
  entregado: { label: "Entregado", tone: "success", icon: "check-circle", helper: "Pedido finalizado" },
};

export const takeawayStatusMeta = {
  recibido: { label: "Recibido", tone: "warning", icon: "clock", helper: "Pedido recién confirmado" },
  "en-preparacion": { label: "En preparación", tone: "info", icon: "flame", helper: "Cocina trabajando" },
  "listo-recoger": { label: "Listo para recoger", tone: "accent", icon: "bag", helper: "Listo para entrega" },
  entregado: { label: "Entregado", tone: "success", icon: "check-circle", helper: "Entrega completada" },
};

export const desktopPaymentMethods = [
  { id: "efectivo", label: "Efectivo", shortLabel: "Efectivo", brand: "cash", requiresProof: false, icon: "wallet" },
  { id: "yape", label: "Yape", shortLabel: "Yape", brand: "yape", requiresProof: true, icon: "qr" },
  { id: "plin", label: "Plin", shortLabel: "Plin", brand: "plin", requiresProof: true, icon: "smartphone" },
  { id: "transferencia", label: "Transferencia", shortLabel: "Transferencia", brand: "bank", requiresProof: true, icon: "bank" },
];

export const desktopTipOptions = [10, 15, 20, 0];

export const desktopRoundStatusMeta = {
  enviada: { label: "En cocina", tone: "warning" },
  servida: { label: "Servido", tone: "success" },
  abierta: { label: "Abierta", tone: "accent" },
};

export const initialTables = [];
export const initialDeliveryOrders = [];
export const initialTakeawayOrders = [];
export const kitchenBoardSeed = [];
export const takeawayChatFeed = [];

export const desktopTableJourneys = {};
export const desktopDeliveryWorkspace = { highlightOrderId: null, proofTemplates: [] };
export const desktopTakeawayWorkspace = { activeOrderId: null, pickupReadyMessage: "" };
export const courtesyCatalog = [];
export const courtesyDashboard = { monthTotal: 0, monthCost: 0, foodCostImpact: 0, split: { cliente: 0, staff: 0, prueba: 0 }, topItems: [], deltaVsPreviousMonth: "—" };
export const staffMealConsumption = { todayMeals: 0, todayCost: 0, dailyLimit: 0, remaining: 0, staff: [] };

export const courtesyLimits = [
  { id: "limit-clientes", label: "Cortesías a clientes", enabled: true, limit: "5 por día", maxCost: "S/ 250" },
  { id: "limit-staff", label: "Consumo de personal", enabled: true, limit: "1 por turno", maxCost: "S/ 80" },
  { id: "limit-prueba", label: "Degustación / Prueba", enabled: true, limit: "3 por día", maxCost: "" },
];

export const tipsDashboard = {
  todayAmount: 0,
  ordersCount: 0,
  avgTicket: 0,
  byMethod: [],
  byWaiter: [],
  distributionModes: ["Partes iguales", "Por horas trabajadas", "Personalizado"],
};

export const creditNoteDrafts = [];

export const takeawaySourceOptions = [
  { value: "Salon", label: "Desde salón" },
  { value: "WhatsApp", label: "WhatsApp" },
];
