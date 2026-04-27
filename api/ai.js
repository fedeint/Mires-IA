export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { model, system, messages } = req.body;
    // Se requiere obligatoriamente la clave del usuario enviada desde el frontend
    const GEMINI_API_KEY = req.headers['x-gemini-key'];

    if (!GEMINI_API_KEY) {
        return res.status(401).json({ error: 'API Key de usuario requerida.' });
    }

    try {
        // Formatear para la API de Google Gemini
        const contents = messages.map(m => ({
            role: m.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: m.content }]
        }));

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model || 'gemini-1.5-flash'}:generateContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: [{ text: system }] },
                    contents: contents,
                    generationConfig: {
                        temperature: 0.7,
                        maxOutputTokens: 800,
                    }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Gemini API error', data });
        }

        // Formatear respuesta para que el frontend la entienda
        return res.status(200).json({ ok: true, data });
    } catch (error) {
        console.error('AI Proxy error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
