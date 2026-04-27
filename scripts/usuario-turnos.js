/**
 * Turnos en `usuario_turnos`: un registro por persona y por día. Reportes: join con
 * `user_profiles` (campos reales: full_name, role, is_active). “Sin turno asignado”
 * = ninguna fila con activo = true. Ver `supabase/migrations/20260503120000_usuario_turnos.sql`.
 */
import { supabase } from "./supabase.js";

export const DIAS_ORDEN = [
  "lunes",
  "martes",
  "miercoles",
  "jueves",
  "viernes",
  "sabado",
  "domingo",
];

export const DIA_CORTO = {
  lunes: "Lun",
  martes: "Mar",
  miercoles: "Mié",
  jueves: "Jue",
  viernes: "Vie",
  sabado: "Sáb",
  domingo: "Dom",
};

const WEEKDAY_EN_TO_DIA = {
  monday: "lunes",
  tuesday: "martes",
  wednesday: "miercoles",
  thursday: "jueves",
  friday: "viernes",
  saturday: "sabado",
  sunday: "domingo",
};

/**
 * Alinea con enum `public.dia_semana` (America/Lima por defecto).
 * @param {string} [timeZone] IANA, ej. America/Lima
 * @returns {string}
 */
export function diaSemanaHoyLima(timeZone = "America/Lima") {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long" })
    .formatToParts(new Date());
  const w = (parts.find((p) => p.type === "weekday")?.value || "monday").toLowerCase();
  return WEEKDAY_EN_TO_DIA[w] || "lunes";
}

/**
 * @param {string[]} [userIds] — filtra por usuarios; si se omite, carga el tenant (RLS) completo
 * @returns {Promise<Array<Record<string, unknown>>>}
 */
export async function fetchTurnosForContext(userIds) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  let q = supabase
    .from("usuario_turnos")
    .select("id, tenant_id, user_id, dia, hora_entrada, hora_salida, activo, categoria, updated_at");
  if (userIds && userIds.length) {
    q = q.in("user_id", userIds);
  }
  const { data, error } = await q;
  if (error) {
    console.warn("[usuario-turnos] fetch", error);
    return [];
  }
  return data || [];
}

/**
 * Sustituye turnos de un usuario (mismo tenant que la sesión).
 * @param {string} userId
 * @param {Array<{ dia: string, hora_entrada: string, hora_salida: string, activo?: boolean, categoria?: string }>} rows
 */
export async function replaceUserTurnos(userId, rows) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión requerida");
  const { data: me, error: meE } = await supabase
    .from("usuarios")
    .select("tenant_id")
    .eq("id", user.id)
    .maybeSingle();
  if (meE) throw meE;
  if (!me?.tenant_id) throw new Error("Sin tenant");
  const tid = me.tenant_id;
  const { error: delE } = await supabase.from("usuario_turnos").delete().eq("user_id", userId);
  if (delE) throw delE;
  if (!rows.length) return;
  const ins = rows
    .filter((r) => r.dia && r.hora_entrada && r.hora_salida)
    .map((r) => ({
      tenant_id: tid,
      user_id: userId,
      dia: r.dia,
      hora_entrada: r.hora_entrada.length === 5 ? r.hora_entrada + ":00" : r.hora_entrada,
      hora_salida: r.hora_salida.length === 5 ? r.hora_salida + ":00" : r.hora_salida,
      activo: r.activo !== false,
      categoria: r.categoria || "fijo",
      updated_at: new Date().toISOString(),
    }));
  if (ins.length === 0) return;
  const { error: inE } = await supabase.from("usuario_turnos").insert(ins);
  if (inE) throw inE;
}

/**
 * Marca filas inactivas sin borrar
 */
export async function setTurnoActivo(turnoId, activo) {
  const { error } = await supabase
    .from("usuario_turnos")
    .update({ activo: !!activo, updated_at: new Date().toISOString() })
    .eq("id", turnoId);
  if (error) throw error;
}

/**
 * @param {Array<Record<string, unknown>>} rows
 * @returns {Map<string, Array>}
 */
export function groupByUserId(rows) {
  const m = new Map();
  for (const r of rows || []) {
    const id = r.user_id;
    if (!id) continue;
    if (!m.has(id)) m.set(id, []);
    m.get(id).push(r);
  }
  for (const [, list] of m) {
    list.sort((a, b) => DIAS_ORDEN.indexOf(a.dia) - DIAS_ORDEN.indexOf(b.dia));
  }
  return m;
}

function diasConsecutivos(ordenDias) {
  if (ordenDias.length <= 1) return true;
  for (let i = 1; i < ordenDias.length; i++) {
    if (DIAS_ORDEN.indexOf(ordenDias[i]) !== DIAS_ORDEN.indexOf(ordenDias[i - 1]) + 1) return false;
  }
  return true;
}

/** Líneas legibles para el árbol, p. ej. "Lun–Vie: 08:00 – 16:00" o "Sáb: 10:00 – 14:00" */
export function resumirTurnosParaArbol(turns) {
  if (!turns || !turns.length) return [];
  const active = turns.filter((t) => t.activo !== false);
  if (active.length === 0) return ["(turno desactivado)"];

  const byHorario = new Map();
  for (const t of active) {
    const he = (t.hora_entrada || "").toString().slice(0, 5);
    const hs = (t.hora_salida || "").toString().slice(0, 5);
    const k = `${he}|${hs}`;
    if (!byHorario.has(k)) byHorario.set(k, []);
    byHorario.get(k).push(t.dia);
  }

  const out = [];
  for (const [k, rawDias] of byHorario) {
    const [he, hs] = k.split("|");
    const sorted = [...new Set(rawDias)].sort((a, b) => DIAS_ORDEN.indexOf(a) - DIAS_ORDEN.indexOf(b));
    if (sorted.length === 1) {
      out.push(`${DIA_CORTO[sorted[0]]}: ${he} – ${hs}`);
    } else if (diasConsecutivos(sorted)) {
      out.push(`${DIA_CORTO[sorted[0]]}–${DIA_CORTO[sorted[sorted.length - 1]]}: ${he} – ${hs}`);
    } else {
      for (const d of sorted) {
        out.push(`${DIA_CORTO[d]}: ${he} – ${hs}`);
      }
    }
  }
  return out;
}
