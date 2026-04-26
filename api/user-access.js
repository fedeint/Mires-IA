/**
 * Proxy hacia manage-user-access (Node en Vercel, sin Edge).
 * Vercel inyecta req.body (JSON). Evita leer el stream a mano (incompatible) y
 * el handler Edge que a veces no aplica en sitios estáticos → 400/405 raros.
 */
const { text: streamToText } = require("node:stream/consumers");
const UPSTREAM = "https://twneirdsvyxsdsneidhi.supabase.co/functions/v1/manage-user-access";
const BROWSER_TOKEN_KEY = "__mirest_bearer";

function withCors(res, origin) {
  const o = origin || "https://mires-ia.vercel.app";
  res.setHeader("Access-Control-Allow-Origin", o);
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "authorization, x-client-info, apikey, content-type, accept, prefer, x-supabase-api-version"
  );
  res.setHeader("Access-Control-Max-Age", "86400");
  res.setHeader("Vary", "Origin");
}

function sendJson(res, status, body) {
  if (!res.getHeader("content-type")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.statusCode = status;
  res.end(JSON.stringify(body));
}

/**
 * Vercel inyecta `req.body` (getter) — no uses hasOwnProperty; no está en "own" props.
 * Sólo seguimos con el stream si hace falta (local, etc.).
 */
async function readJsonBody(req) {
  let raw;
  try {
    raw = req.body;
  } catch {
    throw new Error("JSON inválido");
  }
  if (raw != null) {
    if (typeof raw === "string") return JSON.parse(raw);
    if (Buffer.isBuffer(raw)) return JSON.parse(String(raw) || "{}");
    return { ...raw };
  }
  try {
    const t = await streamToText(req);
    if (!t || !t.length) return {};
    return JSON.parse(t);
  } catch {
    throw new Error("JSON inválido");
  }
}

module.exports = async (req, res) => {
  withCors(res, req.headers.origin);
  const mDirect = String(req.method || req.httpMethod || "").toUpperCase();
  if (mDirect === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }
  // Nunca (req.method || "GET"): en algunas invocaciones, `req.method` llega vacío y
  // el cliente hizo POST de verdad → asumir POST, no GET (405 METHOD falso).
  const ovrH = req.headers["x-http-method-override"];
  const ovr = ovrH != null && String(ovrH) !== "" ? String(ovrH).toUpperCase() : "";
  const method = ovr || mDirect || "POST";

  if (method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return sendJson(res, 405, { code: "METHOD", message: "Método no permitido" });
  }

  const key = req.headers["apikey"] || req.headers["x-api-key"];
  if (!key) {
    return sendJson(res, 400, { code: "NO_APIKEY", message: "Falta encabezado apikey" });
  }

  let parsed;
  try {
    parsed = await readJsonBody(req);
  } catch (e) {
    return sendJson(res, 400, { code: "BAD_JSON", message: e.message || "JSON inválido" });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    parsed = {};
  }

  let bodyForUpstream = { ...parsed };
  let tokenFromHeader = req.headers.authorization;

  if (Object.prototype.hasOwnProperty.call(bodyForUpstream, BROWSER_TOKEN_KEY)) {
    const t = String(bodyForUpstream[BROWSER_TOKEN_KEY] || "");
    delete bodyForUpstream[BROWSER_TOKEN_KEY];
    if (t && t.toLowerCase().startsWith("bearer ")) {
      tokenFromHeader = t;
    } else if (t) {
      tokenFromHeader = `Bearer ${t}`;
    }
  }

  if (!tokenFromHeader || !String(tokenFromHeader).toLowerCase().startsWith("bearer ")) {
    return sendJson(res, 401, { code: "NO_AUTH", message: "Falta encabezado de autorización" });
  }

  const out = JSON.stringify(bodyForUpstream);
  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: "POST",
      headers: {
        apikey: String(key),
        Authorization: String(tokenFromHeader).trim(),
        "Content-Type": "application/json",
      },
      body: out && out !== "{}" ? out : "{}",
    });
  } catch (e) {
    return sendJson(res, 502, {
      code: "UPSTREAM_FETCH",
      message: "No se pudo contactar con el servicio (proxy).",
      detail: String(e?.message || e),
    });
  }

  const outText = await upstream.text();
  const ct = upstream.headers.get("content-type");
  if (ct) res.setHeader("Content-Type", ct);
  else if (outText && outText.trim().startsWith("{")) {
    res.setHeader("Content-Type", "application/json; charset=utf-8");
  }
  res.statusCode = upstream.status;
  return res.end(outText);
};
