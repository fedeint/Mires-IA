/**
 * Comprobación por consola: existencia de recursos en PostgREST (tablas/vistas)
 * usados por los módulos. No prueba lógica de negocio ni RLS con usuario real.
 *
 * Uso: node scripts/healthcheck-supabase.mjs
 * Env opcional: SUPABASE_URL, SUPABASE_ANON_KEY (si no, usa el mismo projecto que scripts/supabase.js)
 */
const url =
  process.env.SUPABASE_URL || "https://twneirdsvyxsdsneidhi.supabase.co";
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_A0yo_kDAGY3OamrUOOL9Bw_ShVWdBMF";

const MODULOS = {
  "Operación / catálogo (vistas)": [
    "pedidos",
    "pedido_items",
    "clientes",
    "mesas",
    "productos",
    "categorias_producto",
    "comprobantes",
  ],
  Caja: ["sesiones_caja", "caja_movimientos"],
  Almacén: [
    "insumos",
    "entradas_insumos",
    "salidas_insumos",
    "proveedores",
    "almacen_movimientos",
    "inventory_current_stock",
  ],
  "Cocina / recetas / carta": [
    "recetas",
    "receta_insumos",
    "menu_product_recipes",
  ],
  "Usuarios / accesos / permisos": [
    "usuarios",
    "roles_modulos",
    "access_requests",
  ],
};

const headers = {
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  Accept: "application/json",
};

function classify(status, text) {
  if (status === 200) return { ok: true, note: "expuesta (respuesta 200; puede ser [] con RLS)" };
  if (status === 401 || status === 403)
    return { ok: true, note: "existe; anon bloqueada por RLS o política (esperable)" };
  if (status === 404) {
    if (/PGRST205|schema cache|not find/i.test(text)) {
      return { ok: false, note: "recurso no en PostgREST (migración / nombre)" };
    }
    return { ok: false, note: "404" };
  }
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, note: `HTTP ${status}` };
  }
  if (json?.code === "PGRST205" || /not find.*table/i.test(String(json?.message || "")))
    return { ok: false, note: "tabla/vista no en caché de esquema" };
  if (json?.code === "42501" && status >= 400)
    return { ok: true, note: "acceso denegado (RLS); el recurso existe" };
  return { ok: false, note: json?.message || `HTTP ${status}` };
}

async function checkTable(table) {
  // limit=0 evita requerir columna `id`; basta con que el recurso exista en el esquema.
  const r = await fetch(
    `${url}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`,
    { method: "GET", headers }
  );
  const text = await r.text();
  return { table, status: r.status, ...classify(r.status, text) };
}

async function main() {
  console.log("=== MiRest / Supabase — healthcheck (PostgREST, anon) ===\n");
  console.log("URL:", url, "\n");

  const all = Object.entries(MODULOS).flatMap(([grupo, tablas]) =>
    tablas.map((t) => ({ grupo, t }))
  );

  let fail = 0;
  for (const { grupo, t } of all) {
    const row = await checkTable(t);
    if (!row.ok) fail += 1;
    const mark = row.ok ? "  OK" : "FAIL";
    console.log(`${mark}  [${grupo}] ${t.padEnd(28, " ")}  — ${row.note} (${row.status})`);
  }

  console.log("\n--- Cómo interpretar ---");
  console.log("• OK: el endpoint responde; 401/403 con anon indica RLS, no 'tabla rota'.");
  console.log("• FAIL: 404 o PGRST205 → revisa migraciones o nombre de recurso.\n");

  if (fail > 0) {
    console.error(`Resumen: ${fail} fallo(s).`);
    process.exit(1);
  }
  console.log("Resumen: todos los recursos comprobables respondieron sin 'tabla inexistente'.\n");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
