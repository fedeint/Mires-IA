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

    const { text } = req.body || {};

    if (!text || typeof text !== "string" || text.trim() === "") {
      return res.status(400).json({ error: "Missing or empty text field" });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${encodeURIComponent(apiKey)}`;

    const resp = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "models/text-embedding-004",
        content: { parts: [{ text }] },
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Gemini error", data });
    }

    const embedding = data?.embedding?.values;

    return res.status(200).json({ ok: true, embedding });
  } catch (err) {
    return res
      .status(500)
      .json({ error: "Unhandled error", message: err?.message || String(err) });
  }
}
