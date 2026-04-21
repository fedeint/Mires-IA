/**
 * Métricas del dashboard desde Supabase (RLS por tenant en JWT).
 * Sin datos operativos devuelve ceros. Fallos parciales por tabla/vista no anulan el resto.
 */

function dayRangeUtcFromLocalDate(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const prev = new Date(start);
  prev.setDate(prev.getDate() - 1);
  return {
    dayStart: start.toISOString(),
    dayEnd: end.toISOString(),
    prevStart: prev.toISOString(),
    prevEnd: start.toISOString(),
  };
}

function sumAmounts(rows) {
  if (!Array.isArray(rows)) return 0;
  return rows.reduce((acc, row) => acc + (Number(row.amount) || 0), 0);
}

/** @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} client */
export async function fetchDashboardSnapshot(client) {
  const empty = {
    salesToday: 0,
    salesYesterday: 0,
    avgTicketYesterday: 0,
    distinctPaidOrdersToday: 0,
    activeOrders: 0,
    activeSalon: 0,
    activeDelivery: 0,
    activeTakeaway: 0,
    closedOrdersToday: 0,
    avgTicketToday: 0,
    atRiskStockCount: 0,
    tablesOccupied: 0,
    tablesTotal: 0,
    deliveryActive: 0,
    kitchenOrders: 0,
    openCashSessions: 0,
    loadError: null,
    warnings: /** @type {string[]} */ ([]),
  };

  if (!client) return empty;

  const { dayStart, dayEnd, prevStart, prevEnd } = dayRangeUtcFromLocalDate();
  const warnings = [];

  function note(label, error) {
    const msg = error?.message || String(error || "");
    if (msg) warnings.push(`${label}: ${msg}`);
  }

  try {
    const [
      payToday,
      payYesterday,
      ordersActive,
      ordersClosedToday,
      payTodayRows,
      payYesterdayRows,
      tablesRes,
      stockRes,
      cashOpen,
      kitchenRes,
    ] = await Promise.all([
      client.from("payments").select("amount").gte("received_at", dayStart).lt("received_at", dayEnd),
      client.from("payments").select("amount").gte("received_at", prevStart).lt("received_at", prevEnd),
      client
        .from("orders")
        .select("id, channel, status")
        .in("status", ["open", "in_kitchen", "ready", "served"]),
      client
        .from("orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "closed")
        .not("closed_at", "is", null)
        .gte("closed_at", dayStart)
        .lt("closed_at", dayEnd),
      client
        .from("payments")
        .select("order_id, amount")
        .gte("received_at", dayStart)
        .lt("received_at", dayEnd),
      client
        .from("payments")
        .select("order_id, amount")
        .gte("received_at", prevStart)
        .lt("received_at", prevEnd),
      client.from("dining_tables").select("status"),
      client
        .from("inventory_current_stock")
        .select("inventory_item_id", { count: "exact", head: true })
        .in("status", ["critical", "low"]),
      client.from("cash_sessions").select("id", { count: "exact", head: true }).is("closed_at", null),
      client.from("orders").select("id", { count: "exact", head: true }).eq("status", "in_kitchen"),
    ]);

    if (payToday.error) note("Pagos hoy", payToday.error);
    if (payYesterday.error) note("Pagos ayer", payYesterday.error);
    if (ordersActive.error) note("Pedidos activos", ordersActive.error);
    if (ordersClosedToday.error) note("Pedidos cerrados hoy", ordersClosedToday.error);
    if (payTodayRows.error) note("Detalle cobros hoy", payTodayRows.error);
    if (payYesterdayRows.error) note("Detalle cobros ayer", payYesterdayRows.error);
    if (tablesRes.error) note("Mesas", tablesRes.error);
    if (stockRes.error) note("Inventario (vista)", stockRes.error);
    if (cashOpen.error) note("Caja", cashOpen.error);
    if (kitchenRes.error) note("Cocina", kitchenRes.error);

    const salesToday = payToday.error ? 0 : sumAmounts(payToday.data);
    const salesYesterday = payYesterday.error ? 0 : sumAmounts(payYesterday.data);

    const activeRows = ordersActive.error ? [] : ordersActive.data || [];
    const activeOrders = activeRows.length;
    let activeSalon = 0;
    let activeDelivery = 0;
    let activeTakeaway = 0;
    for (const row of activeRows) {
      if (row.channel === "salon") activeSalon += 1;
      else if (row.channel === "delivery") activeDelivery += 1;
      else if (row.channel === "takeaway") activeTakeaway += 1;
    }

    const closedOrdersToday = ordersClosedToday.error ? 0 : ordersClosedToday.count || 0;

    const paidRows = payTodayRows.error ? [] : payTodayRows.data || [];
    const orderIds = new Set(
      paidRows.map((r) => r.order_id).filter((id) => id != null && String(id).length > 0),
    );
    const distinctPaidOrdersToday = orderIds.size;
    const avgTicketToday =
      distinctPaidOrdersToday > 0 ? Math.round((salesToday / distinctPaidOrdersToday) * 100) / 100 : 0;

    const yRows = payYesterdayRows.error ? [] : payYesterdayRows.data || [];
    const yOrderIds = new Set(yRows.map((r) => r.order_id).filter((id) => id != null && String(id).length > 0));
    const distinctPaidOrdersYesterday = yOrderIds.size;
    const avgTicketYesterday =
      distinctPaidOrdersYesterday > 0
        ? Math.round((sumAmounts(yRows) / distinctPaidOrdersYesterday) * 100) / 100
        : 0;

    const tableRows = tablesRes.error ? [] : tablesRes.data || [];
    const tablesTotal = tableRows.length;
    const tablesOccupied = tableRows.filter((t) => t.status && String(t.status).toLowerCase() !== "libre").length;

    const atRiskStockCount = stockRes.error ? 0 : stockRes.count || 0;
    const openCashSessions = cashOpen.error ? 0 : cashOpen.count || 0;
    const kitchenOrders = kitchenRes.error ? 0 : kitchenRes.count || 0;
    const deliveryActive = activeDelivery;

    return {
      salesToday,
      salesYesterday,
      avgTicketYesterday,
      distinctPaidOrdersToday,
      activeOrders,
      activeSalon,
      activeDelivery,
      activeTakeaway,
      closedOrdersToday,
      avgTicketToday,
      atRiskStockCount,
      tablesOccupied,
      tablesTotal,
      deliveryActive,
      kitchenOrders,
      openCashSessions,
      loadError: null,
      warnings,
    };
  } catch (e) {
    console.warn("[Dashboard] Error al cargar métricas:", e);
    return { ...empty, loadError: e?.message || String(e) };
  }
}
