/**
 * Sistema de condiciones y bloqueos entre módulos (cliente + contrato con Supabase).
 * Las validaciones reales de negocio deben replicarse en API/Edge/DB; aquí: registro,
 * mensajes y persistencia de bloqueos.
 *
 * Tablas: public.modulo_condiciones, public.modulo_bloqueos
 * @see supabase/migrations/20260504140000_modulo_bloqueos_y_condiciones.sql
 */

/** @typedef {'bloqueo' | 'advertencia'} CondicionTipo */

/**
 * Códigos de regla alineados a la matriz de producto (usar en checks y seed).
 * Core: no desactivables en DB (no_desactivable = true).
 */
export const CODIGO_REGLA = {
  // Caja
  CAJA_ABRIR_SIN_CAJEROS: 'caja.abrir.sesion.sin_cajeros',
  CAJA_ABRIR_SESION_YA_ABIERTA: 'caja.abrir.sesion.ya_activa',
  CAJA_ABRIR_FUERA_HORARIO: 'caja.abrir.sesion.fuera_horario',
  CAJA_CERRAR_PEDIDOS_PENDIENTES: 'caja.cerrar.pedidos_pendientes',
  CAJA_CERRAR_COCINA_PENDIENTE: 'caja.cerrar.cocina_pendiente',
  CAJA_CERRAR_SIN_MONTO_CONTADO: 'caja.cerrar.sin_monto_contado',
  // Pedidos
  PEDIDOS_CREAR_SIN_CAJA: 'pedidos.crear.sin_sesion_caja',
  PEDIDOS_CREAR_SIN_PRODUCTOS: 'pedidos.crear.sin_productos_activos',
  PEDIDOS_CREAR_FUERA_HORARIO: 'pedidos.crear.fuera_horario',
  // Almacén
  ALMACEN_ENTRADA_SIN_PROVEEDOR: 'almacen.entrada.sin_proveedores',
  ALMACEN_ENTRADA_SIN_INSUMOS: 'almacen.entrada.sin_insumos',
  // Recetas
  RECETAS_CREAR_SIN_INSUMOS: 'recetas.crear.sin_insumos',
  // Core explícitos
  CORE_COBRO_SIN_CAJA: 'core.cobrar.sin_sesion_caja',
  CORE_STOCK_NEGATIVO: 'core.inventario.stock_no_negativo',
};

/**
 * @typedef {Object} RegistroBloqueoInput
 * @property {string} [modulo]
 * @property {string} [accion]
 * @property {string} [condicion_faltante]
 * @property {string} [condicionId] uuid condicion_id
 * @property {string} [restaurantId]
 * @property {string} [tenantId] requerido en jobs sin perfil (Edge); si no, se deduce de user_profiles
 * @property {Record<string, unknown>} [metadata]
 */

/**
 * Resultado de validación en UI
 * @typedef {Object} GuardResult
 * @property {boolean} ok
 * @property {string} [mensaje]
 * @property {CondicionTipo} [tipo]
 * @property {string} [enlaceSugerido] ruta o clave de módulo
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string | null} [userId]
 * @returns {Promise<string | null>}
 */
export async function resolveTenantIdForUser(supabase, userId) {
  const uid = userId;
  if (!uid) {
    const { data: s } = await supabase.auth.getUser();
    const id = s?.user?.id;
    if (!id) return null;
    const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', id).maybeSingle();
    return prof?.tenant_id ?? null;
  }
  const { data: prof } = await supabase.from('user_profiles').select('tenant_id').eq('id', uid).maybeSingle();
  return prof?.tenant_id ?? null;
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {RegistroBloqueoInput} input
 * @param {{ userId?: string | null, notifyLevel2?: (payload: object) => Promise<void> }} [options]
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function recordModuloBloqueo(supabase, input, options = {}) {
  const { data: sessionData } = await supabase.auth.getUser();
  const userId = options.userId ?? sessionData?.user?.id ?? null;
  const tenantId =
    input.tenantId ??
    (await resolveTenantIdForUser(supabase, userId));
  if (!tenantId) {
    return { data: null, error: new Error('recordModuloBloqueo: sin tenant (perfil o sesión)') };
  }

  const { data, error } = await supabase
    .from('modulo_bloqueos')
    .insert({
      tenant_id: tenantId,
      modulo: input.modulo ?? 'desconocido',
      accion: input.accion ?? 'accion',
      condicion_faltante: input.condicion_faltante ?? '',
      condicion_id: input.condicionId ?? null,
      restaurant_id: input.restaurantId ?? null,
      user_id: userId,
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (!error && typeof options.notifyLevel2 === 'function') {
    try {
      await options.notifyLevel2({ bloqueoId: data?.id, ...input, userId });
    } catch {
      /* notificación best-effort */
    }
  }

  return { data, error: error ? new Error(error.message) : null };
}

/**
 * Marca bloqueos como resueltos (p. ej. al crear la receta faltante).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ condicionId?: string, desde?: string }} [filtro]
 */
export async function markBloqueosResueltosPorCondicion(supabase, filtro = {}) {
  const desde = filtro.desde ? new Date(filtro.desde) : new Date(0);
  if (!filtro.condicionId) {
    return { data: null, error: new Error('markBloqueosResueltosPorCondicion: requiere condicionId') };
  }
  const { data, error } = await supabase
    .from('modulo_bloqueos')
    .update({ resuelto: true, fecha_resolucion: new Date().toISOString() })
    .eq('resuelto', false)
    .eq('condicion_id', filtro.condicionId)
    .gte('fecha_bloqueo', desde.toISOString())
    .select('id');
  return { data, error: error ? new Error(error.message) : null };
}

/**
 * Helper UI: colores sugeridos
 * @param {CondicionTipo} tipo
 */
export function toastClassForCondition(tipo) {
  return tipo === 'advertencia' ? 'toast--warning' : 'toast--danger';
}

/**
 * Plantilla de mensaje Nivel 2 (admin) — rellenar con i18n en producción
 * @param {object} p
 */
export function formatAdminBlockMessage(p) {
  const user = p.userName ?? p.userEmail ?? 'Usuario';
  return `${user} intentó ${p.accion} en ${p.modulo} pero falta: ${p.condicion_faltante}.`;
}
