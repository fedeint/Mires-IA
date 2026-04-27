module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { text } = req.body;
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Missing or empty text field' });
    }

    // Se requiere obligatoriamente la clave del usuario
    const GEMINI_API_KEY = req.headers['x-gemini-key'];

    if (!GEMINI_API_KEY) {
        return res.status(401).json({ error: 'API Key de usuario requerida.' });
    }

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "models/text-embedding-004",
                    content: { parts: [{ text }] }
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({ error: 'Gemini API error', data });
        }

        return res.status(200).json({ ok: true, embedding: data.embedding.values });
    } catch (error) {
        console.error('Embedding error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
