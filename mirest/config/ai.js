export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-gemini-key");

    if (req.method === "OPTIONS") {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const apiKey = req.headers["x-gemini-key"] || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "Missing Gemini API key. Provide it via x-gemini-key header or GEMINI_API_KEY env var." });
    }

    const payload = req.body || {};
    const { messages, system, tools, toolConfig, model } = payload;

    const finalModel = model || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(finalModel)}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const contents = [];
    if (system) {
      contents.push({ role: "user", parts: [{ text: `SYSTEM:\n${system}` }] });
    }

    if (Array.isArray(messages)) {
      for (const m of messages) {
        const role = m?.role === "assistant" ? "model" : "user";
        const text = String(m?.content ?? "");
        contents.push({ role, parts: [{ text }] });
      }
    }

    const body = { contents };
    if (Array.isArray(tools) && tools.length) body.tools = tools;
    if (toolConfig) body.toolConfig = toolConfig;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Gemini error", data });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Unhandled error", message: err?.message || String(err) });
  }
}
