/**
 * Guarda RPC `mirest_guard_pedido_crear` antes de abrir el flujo de menú / nuevo pedido.
 * Sin sesión o sin tenant: no bloquea (modo demo / catálogo local).
 */
import { supabase } from "../../../../scripts/supabase.js";
import { recordModuloBloqueo, resolveTenantIdForUser } from "../../../../scripts/module-conditions.js";

/**
 * @returns {Promise<{ ok: boolean, mensaje?: string, codigo?: string, skipped?: string }>}
 */
export async function assertPedidoCrearGuard() {
  const { data: s } = await supabase.auth.getUser();
  const user = s?.user;
  if (!user) {
    return { ok: true, skipped: "no_auth" };
  }
  const tid = await resolveTenantIdForUser(supabase, user.id);
  if (!tid) {
    return { ok: true, skipped: "no_tenant" };
  }
  const { data, error } = await supabase.rpc("mirest_guard_pedido_crear", { p_tenant: tid });
  if (error) {
    console.warn("[mirest-pedido-guard] RPC mirest_guard_pedido_crear:", error.message);
    return { ok: true, skipped: "rpc_unavailable" };
  }
  const r = data;
  if (r && r.ok) {
    return { ok: true };
  }
  const codigo = r?.codigo;
  const mensaje = r?.mensaje || "No se puede crear el pedido ahora.";
  void recordModuloBloqueo(supabase, {
    tenantId: tid,
    modulo: "pedidos",
    accion: "crear_pedido",
    condicion_faltante: String(codigo || "mirest_guard_pedido_crear"),
    metadata: { rpc: "mirest_guard_pedido_crear", response: r },
  });
  return { ok: false, mensaje, codigo };
}
