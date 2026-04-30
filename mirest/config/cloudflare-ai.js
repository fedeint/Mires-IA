export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-cf-token, x-cf-account");

    if (req.method === "OPTIONS") return res.status(200).json({ ok: true });
    if (req.method !== "POST") return res.status(405).json({ error: "Method Not Allowed" });

    const token     = req.headers["x-cf-token"]   || process.env.CF_AI_TOKEN;
    const accountId = req.headers["x-cf-account"] || process.env.CF_ACCOUNT_ID;

    if (!token || !accountId) {
      return res.status(401).json({ error: "Missing Cloudflare credentials." });
    }

    const { messages, system, model } = req.body || {};
    const finalModel = model || "@cf/meta/llama-3.1-8b-instruct";

    const cfMessages = [];
    if (system) cfMessages.push({ role: "system", content: system });
    if (Array.isArray(messages)) {
      for (const m of messages) {
        cfMessages.push({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content ?? "") });
      }
    }

    const resp = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${finalModel}`,
      {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ messages: cfMessages }),
      }
    );

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(resp.status).json({ error: "Cloudflare AI error", data });

    const text = data?.result?.response || "";
    return res.status(200).json({
      ok: true,
      data: { candidates: [{ content: { parts: [{ text }] } }] },
    });
  } catch (err) {
    return res.status(500).json({ error: "Unhandled error", message: err?.message || String(err) });
  }
}
