/**
 * Presencia: RPC + canales Realtime (Presence) + heartbeats.
 * Requiere migración 20260505120000_usuario_presencia_sesiones y JWT con tenant.
 */
import { supabase } from "./supabase.js";
import { getCurrentTenantId } from "./tenant-session.js";

const HEARTBEAT_MS = 5 * 60 * 1000;
const INACTIVO_CHECK_MS = 2 * 60 * 1000;
const INACTIVO_AFTER_MS = 15 * 60 * 1000;
const PRESENCE_TOPIC = (tid) => `mirest-presence-tenant-${tid}`;

/** @type {string | null} */
let _sesionId = null;
/** @type {ReturnType<import('@supabase/supabase-js').SupabaseClient['channel']> | null} */
let _presenceCh = null;
let _hbTimer = 0;
let _idleCheckTimer = 0;
/** @type {number} */
let _lastActivity = 0;

function detectarDispositivo() {
  const mq = window.matchMedia && window.matchMedia("(display-mode: standalone)").matches;
  if (mq) return "pwa";
  const u = (navigator.userAgent || "").toLowerCase();
  if (/iphone|android|mobile/.test(u) && !/windows/.test(u)) return "mobile";
  return "web";
}

function markActivity() {
  _lastActivity = Date.now();
}

async function heartbeat() {
  if (!_sesionId) return;
  const { data, error } = await supabase.rpc("mirest_presence_heartbeat", { p_sesion_id: _sesionId });
  if (error) console.debug("[presencia] heartbeat", error.message);
  else if (data && data.ok) markActivity();
}

async function maybeInactivo() {
  if (!_sesionId) return;
  if (Date.now() - _lastActivity < INACTIVO_AFTER_MS) return;
  const { data, error } = await supabase.rpc("mirest_presence_set_inactivo");
  if (error) console.debug("[presencia] inactivo", error.message);
  else if (data?.ok) markActivity();
}

function clearTimers() {
  if (_hbTimer) clearInterval(_hbTimer);
  if (_idleCheckTimer) clearInterval(_idleCheckTimer);
  _hbTimer = 0;
  _idleCheckTimer = 0;
}

function onUserActivity() {
  markActivity();
  void heartbeat();
}

let _activityBound = false;
function bindActivityPings() {
  if (_activityBound) return;
  _activityBound = true;
  let t = 0;
  const throttled = () => {
    const n = Date.now();
    if (n - t < 40000) return;
    t = n;
    onUserActivity();
  };
  document.addEventListener("pointerdown", throttled, { passive: true });
  document.addEventListener("keydown", throttled, { passive: true });
}

/**
 * Inicia presencia: RPC sesión, canal Realtime, heartbeat.
 * @returns {Promise<void>}
 */
export async function initMirestPresence() {
  if (typeof window === "undefined") return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const tid = await getCurrentTenantId();
  if (!tid) return;
  if (_sesionId) {
    return;
  }

  const dispositivo = detectarDispositivo();
  const { data, error } = await supabase.rpc("mirest_presence_sesion_iniciar", {
    p_dispositivo: dispositivo,
    p_client_ip: null,
  });
  if (error) {
    console.warn("[presencia] iniciar (¿migración aplicada?)", error.message);
    return;
  }
  if (!data?.ok || !data.sesion_id) {
    console.warn("[presencia] iniciar rechazó", data);
    return;
  }
  _sesionId = String(data.sesion_id);
  markActivity();

  bindActivityPings();
  _hbTimer = window.setInterval(() => void heartbeat(), HEARTBEAT_MS);
  _idleCheckTimer = window.setInterval(() => void maybeInactivo(), INACTIVO_CHECK_MS);

  const topic = PRESENCE_TOPIC(tid);
  const ch = supabase.channel(topic, { config: { presence: { key: user.id } } });
  _presenceCh = ch;
  ch.subscribe(async (status) => {
    if (status === "SUBSCRIBED" && ch) {
      const trackPayload = {
        user_id: user.id,
        tenant_id: tid,
        estado: "online",
        dispositivo,
        ultima_actividad: new Date().toISOString(),
      };
      const r = await ch.track(trackPayload);
      if (r && "error" in r && r.error) console.debug("[presencia] track", r);
    }
  });

  if (!window.__MIREST_PRESENCE_PAGEHIDE) {
    window.__MIREST_PRESENCE_PAGEHIDE = true;
    const onPageHide = (e) => {
      if (e && /** @type {PageTransitionEvent} */ (e).persisted) return;
      void (async () => {
        if (_sesionId) {
          try {
            await supabase.rpc("mirest_presence_sesion_cerrar", { p_sesion_id: _sesionId, p_motivo: "automatica" });
          } catch {
            /* */
          }
        }
        if (_presenceCh) {
          try {
            await _presenceCh.untrack();
          } catch {
            /* */
          }
          supabase.removeChannel(_presenceCh);
          _presenceCh = null;
        }
        _sesionId = null;
        clearTimers();
      })();
    };
    window.addEventListener("pagehide", onPageHide, { capture: true });
  }
}

/**
 * Detiene presencia (logout o antes de recargar).
 * @param {{ quick?: boolean }} [opts]
 * @returns {Promise<void>}
 */
export async function stopMirestPresence(opts = {}) {
  const motivo = opts.quick ? "logout" : "logout";
  clearTimers();
  if (_presenceCh) {
    try {
      await _presenceCh.untrack();
    } catch {
      /* */
    }
    supabase.removeChannel(_presenceCh);
    _presenceCh = null;
  }
  if (_sesionId) {
    try {
      const { data: s } = await supabase.auth.getUser();
      if (s.user) {
        await supabase.rpc("mirest_presence_sesion_cerrar", { p_sesion_id: _sesionId, p_motivo: motivo });
      }
    } catch (e) {
      console.debug("[presencia] cerrar", e);
    }
  }
  _sesionId = null;
}

export function getMirestPresenceSessionId() {
  return _sesionId;
}

export function mirestPresenceChannelName(tenantId) {
  return PRESENCE_TOPIC(tenantId);
}
