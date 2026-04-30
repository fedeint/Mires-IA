const { text: streamToText } = require('node:stream/consumers');

async function readJsonBody(req) {
    let raw;
    try { raw = req.body; } catch { throw new Error('JSON inválido'); }
    if (raw != null) {
        if (typeof raw === 'string') return JSON.parse(raw);
        if (Buffer.isBuffer(raw)) return JSON.parse(String(raw) || '{}');
        return { ...raw };
    }
    try {
        const t = await streamToText(req);
        if (!t || !t.length) return {};
        return JSON.parse(t);
    } catch { throw new Error('JSON inválido'); }
}

function setCors(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-gemini-key');
}

module.exports = async function handler(req, res) {
    setCors(res);
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    let parsed;
    try { parsed = await readJsonBody(req); } catch (e) {
        return res.status(400).json({ error: e.message || 'JSON inválido' });
    }
    const { text } = parsed || {};
    console.log('[ai-embedding] parsed body keys:', Object.keys(parsed || {}), '| text length:', text ? text.length : 'undefined');
    if (!text || text.trim().length === 0) {
        return res.status(400).json({ error: 'Missing or empty text field' });
    }

    // Se requiere obligatoriamente la clave del usuario
    const GEMINI_API_KEY = req.headers['x-gemini-key'];
    console.log('[ai-embedding] has gemini key:', !!GEMINI_API_KEY);

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
            console.error('[ai-embedding] Gemini error:', response.status, JSON.stringify(data));
            return res.status(response.status).json({ error: 'Gemini API error', data });
        }

        return res.status(200).json({ ok: true, embedding: data.embedding.values });
    } catch (error) {
        console.error('Embedding error:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
