export default async function handler(req, res) {
  try {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-groq-key");

    if (req.method === "OPTIONS") {
      return res.status(200).json({ ok: true });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method Not Allowed" });
    }

    const apiKey = req.headers["x-groq-key"] || process.env.GROQ_API_KEY;
    if (!apiKey) {
      return res.status(401).json({ error: "Missing Groq API key. Provide it via x-groq-key header." });
    }

    const { messages, system, model } = req.body || {};

    const finalModel = model || "llama-3.3-70b-versatile";

    // Construir mensajes en formato OpenAI
    const openaiMessages = [];
    if (system) {
      openaiMessages.push({ role: "system", content: system });
    }
    if (Array.isArray(messages)) {
      for (const m of messages) {
        openaiMessages.push({
          role: m.role === "assistant" ? "assistant" : "user",
          content: String(m.content ?? ""),
        });
      }
    }

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: finalModel,
        messages: openaiMessages,
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return res.status(resp.status).json({ error: "Groq error", data });
    }

    // Normalizar respuesta al mismo formato que usaba Gemini
    const text = data?.choices?.[0]?.message?.content || "";
    return res.status(200).json({
      ok: true,
      data: {
        candidates: [{ content: { parts: [{ text }] } }],
      },
    });
  } catch (err) {
    return res.status(500).json({ error: "Unhandled error", message: err?.message || String(err) });
  }
}
