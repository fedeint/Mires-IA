/* Datos reales: Supabase. Este servicio de vista previa solo usa estructuras vacías. */
const initialTables = [];
const initialDeliveryOrders = [];
const initialTakeawayOrders = [];
const products = [];
const waiters = [];

const productsMap = new Map();
const waitersMap = new Map();

function formatCurrency(value = 0) {
  return new Intl.NumberFormat('es-PE', {
    style: 'currency',
    currency: 'PEN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0);
}

function countItems(items = []) {
  return items.reduce((total, item) => total + (Number(item?.quantity) || 0), 0);
}

function calculateOrderTotal(items = []) {
  return items.reduce((total, item) => {
    const product = productsMap.get(item?.productId);
    const price = Number(product?.price) || 0;
    const quantity = Number(item?.quantity) || 0;
    return total + (price * quantity);
  }, 0);
}

function normalizeTable(table) {
  const items = table.order?.items || [];
  const total = calculateOrderTotal(items);

  return {
    id: table.id,
    number: table.number,
    zone: table.zone,
    description: table.description,
    status: table.status,
    waiterName: waitersMap.get(table.waiterId)?.name || 'Sin asignar',
    itemsCount: countItems(items),
    total,
    totalLabel: formatCurrency(total),
  };
}

function getTurnStats() {
  return {
    ocupadas: initialTables.filter((table) => table.status === 'ocupada').length,
    libres: initialTables.filter((table) => table.status === 'libre').length,
    deliveryPendientes: initialDeliveryOrders.filter((order) => order.status !== 'entregado').length,
    takeawayPendientes: initialTakeawayOrders.filter((order) => order.status !== 'entregado').length,
  };
}

function getPedidosViewModel() {
  const tables = initialTables.map(normalizeTable);
  const turnTotal = tables.reduce((total, table) => total + table.total, 0);

  return {
    pageTitle: 'MiRestcon IA · Pedidos',
    greeting: 'Turno activo: prioriza mesas ocupadas, rondas pendientes y cobros rápidos.',
    sessionLabel: 'Turno activo',
    stats: getTurnStats(),
    tables,
    totals: {
      turnTotal,
      turnTotalLabel: formatCurrency(turnTotal),
    },
  };
}

module.exports = {
  calculateOrderTotal,
  countItems,
  formatCurrency,
  getPedidosViewModel,
};
