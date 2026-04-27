/**
 * Presencia + cronograma (módulo Accesos / Turnos).
 * Depende de tablas usuario_presencia, usuario_sesiones y getCurrentTenantId en JWT.
 */
import { supabase } from "./supabase.js";
import { diaSemanaHoyLima, DIA_CORTO, DIAS_ORDEN } from "./usuario-turnos.js";

const DOT = {
  online: "🟢",
  offline: "🔴",
  inactivo: "🟡",
  notToday: "⚫",
  outside: "⚡",
};

/**
 * @param {Array<Record<string, unknown>>} turnosUser filas de usuario_turnos
 * @param {string} hoyDia
 */
export function hasTurnoHoy(turnosUser, hoyDia) {
  const list = (turnosUser || []).filter((r) => r.activo !== false);
  return list.some((t) => t.dia === hoyDia);
}

/**
 * @param {string} estado
 * @param {boolean} turnoHoy
 * @param {boolean} [turnoAhoraAprox] si hay entradas/salidas hoy
 */
export function presenciaIconAndHint(estado, turnoHoy) {
  if (!turnoHoy) {
    return { symbol: DOT.notToday, label: "No trabaja hoy", tone: "pres-dot--void" };
  }
  if (estado === "online") {
    return { symbol: DOT.online, label: "En línea", tone: "pres-dot--on" };
  }
  if (estado === "inactivo") {
    return { symbol: DOT.inactivo, label: "Inactivo", tone: "pres-dot--idle" };
  }
  if (estado === "offline") {
    return { symbol: DOT.offline, label: "Fuera de línea", tone: "pres-dot--off" };
  }
  return { symbol: DOT.offline, label: "—", tone: "pres-dot--off" };
}

/**
 * @param {string} tenantId
 * @param {string[]} userIds
 */
export async function fetchPresenciaMap(tenantId, userIds) {
  if (!userIds.length) return new Map();
  const { data, error } = await supabase
    .from("usuario_presencia")
    .select("user_id, estado, ultima_actividad, dispositivo, sesion_id, tenant_id")
    .eq("tenant_id", tenantId)
    .in("user_id", userIds);
  if (error) {
    console.warn("[presencia] fetch", error);
    return new Map();
  }
  const m = new Map();
  for (const r of data || []) {
    m.set(String(r.user_id), r);
  }
  return m;
}

/**
 * @param {string} userId
 * @param {string} tenantId
 * @param {number} [limit]
 */
export async function fetchHistorialSesiones(userId, tenantId, limit = 30) {
  const { data, error } = await supabase
    .from("usuario_sesiones")
    .select("id, fecha, hora_conexion, hora_desconexion, duracion_minutos, dispositivo, cierre_tipo")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId)
    .order("hora_conexion", { ascending: false })
    .limit(limit);
  if (error) {
    console.warn("[sesiones] fetch", error);
    return [];
  }
  return data || [];
}

/**
 * @param {object} p
 * @param {Map<string, any>} p.presMap
 * @param {string} p.hoyDia
 * @param {Map<string, any[]>} p.byUser
 * @param {any[]} p.usersList
 * @param {string} p.tenantTz
 */
export function buildPresenciaAlertas({ presMap, hoyDia, byUser, usersList, tenantTz = "America/Lima" }) {
  const out = /** @type {{ tipo: "ausencia" | "inactivo"; text: string; userName: string }[]} */ ([]);
  const ahora = Date.now();
  for (const u of usersList) {
    if (u.protected) continue;
    const tlist = byUser.get(u.id) || [];
    const tHoy = tlist.find((r) => r.activo !== false && r.dia === hoyDia);
    const pres = presMap.get(String(u.id));
    if (!tHoy || !tHoy.hora_entrada) continue;
    const entS = String(tHoy.hora_entrada);
    const entMin =
      (() => {
        const [h, m] = entS.split(":").map((x) => parseInt(x, 10));
        if (Number.isNaN(h)) return 0;
        return h * 60 + (m || 0);
      })();
    const partsN = new Intl.DateTimeFormat("en-US", {
      timeZone: tenantTz,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const nh = parseInt(partsN.find((p) => p.type === "hour")?.value || "0", 10);
    const nm = parseInt(partsN.find((p) => p.type === "minute")?.value || "0", 10);
    const nowMin = nh * 60 + nm;
    const endMin = tHoy.hora_salida ? parseHoraToMin(tHoy.hora_salida) : 24 * 60;
    if ((!pres || pres.estado === "offline") && nowMin > entMin + 60 && nowMin < endMin) {
      out.push({
        tipo: "ausencia",
        text: `${u.full_name || u.email} (rol ${u.role || "—"}) tenía turno a las ${entS.slice(0, 5)} h y aún no se conecta (alerta 1 h).`,
        userName: u.full_name || u.email,
      });
    } else if (pres && pres.estado === "inactivo" && tHoy) {
      const t = pres.ultima_actividad ? new Date(pres.ultima_actividad).getTime() : 0;
      if (t && ahora - t > 30 * 60 * 1000 && nowMin >= entMin && (tHoy.hora_salida ? nowMin < parseHoraToMin(tHoy.hora_salida) : true)) {
        out.push({
          tipo: "inactivo",
          text: `${u.full_name || u.email} (rol ${u.role || "—"}) lleva 30+ min inactivo en un día con turno asignado.`,
          userName: u.full_name || u.email,
        });
      }
    }
  }
  return out;
}

/**
 * @param {unknown} hora
 */
function parseHoraToMin(hora) {
  const s = String(hora || "22:00");
  const [h, m] = s.split(":").map((x) => parseInt(x, 10));
  if (Number.isNaN(h)) return 24 * 60;
  return h * 60 + (m || 0);
}

/**
 * @param {string} tenantId
 * @param {{ currentUserId?: string, onEvent?: () => void }} [opts]
 * @returns {import('@supabase/supabase-js').RealTimeChannel}
 */
export function subscribePresenciaCambios(tenantId, opts) {
  const { onEvent } = opts || {};
  const ch = supabase
    .channel(`db-usuario_presencia-${tenantId}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "usuario_presencia", filter: `tenant_id=eq.${tenantId}` },
      () => onEvent && onEvent(),
    )
    .subscribe();
  return ch;
}

export { DOT, diaSemanaHoyLima, DIA_CORTO, DIAS_ORDEN };
