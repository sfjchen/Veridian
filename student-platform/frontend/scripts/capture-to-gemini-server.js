/**
 * Backend that receives captured work and sends it to Gemini (free tier) as context.
 * Run: GEMINI_API_KEY=your_key node scripts/capture-to-gemini-server.js
 * Get a free key at https://aistudio.google.com/app/apikey
 * Set EXPO_PUBLIC_BACKEND_URL=http://localhost:3001 in the app .env
 *
 * Flow: POST /api/capture (image + documentId) → send image to Gemini → store as context (not returned to client)
 */
const http = require('http');

const PORT = Number(process.env.PORT) || 3001;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-lite-001'; // lightweight; if 429 try gemini-2.5-flash or gemini-2.0-flash
const MAX_BODY = 50 * 1024 * 1024; // 50MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sendToGemini(imageBase64, documentId) {
  // Use v1beta; model must be one returned by ListModels (e.g. gemini-2.0-flash-lite-001, gemini-2.5-flash)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: imageBase64,
            },
          },
          {
            text: `This is a screenshot of a student's work for document ${documentId}. Convert the mathematical or written content you see into LaTeX. Output only the LaTeX (e.g. equations, expressions, or text in LaTeX), nothing else. No explanation.`,
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 1024,
    },
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
  return { summary: text };
}

const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] || '';

  if (req.method === 'GET' && (url === '/' || url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ ok: true, message: 'Capture-to-Gemini server running' }));
    return;
  }

  if (req.method === 'OPTIONS' && url === '/api/capture') {
    res.writeHead(204, { ...CORS_HEADERS, 'Content-Length': '0' });
    res.end();
    return;
  }

  if (req.method === 'POST' && url === '/api/capture') {
    console.log('[capture] POST /api/capture received');
    let body = '';
    let length = 0;

    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY) {
        req.destroy();
        return;
      }
      body += chunk;
    });

    req.on('end', async () => {
      console.log('[capture] body complete, size:', length);
      try {
        const data = JSON.parse(body);
        const imageBase64 = data.image;
        const documentId = data.documentId || 'unknown';

        if (!GEMINI_API_KEY) {
          console.error('[capture] Missing GEMINI_API_KEY');
          res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        if (!imageBase64 || typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/\n\r]+=*$/.test(imageBase64)) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        const { summary } = await sendToGemini(imageBase64, documentId);
        console.log('[capture] documentId:', documentId, '| LaTeX:', summary?.slice(0, 200) + (summary?.length > 200 ? '...' : ''));

        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('[capture] Error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: false }));
      }
    });

    req.on('error', (e) => {
      console.error('[capture] request error:', e.message);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  console.log('[capture] 404', req.method, url);
  res.writeHead(404, CORS_HEADERS);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Capture-to-Gemini server at http://localhost:${PORT} (model: ${GEMINI_MODEL})`);
  if (!GEMINI_API_KEY) console.warn('Warning: GEMINI_API_KEY not set — requests will fail.');
  console.log('  GET  /health     — check server is up');
  console.log('  POST /api/capture — receive image, send to Gemini (free tier), store context (not returned to app)');
  console.log('Get a free API key: https://aistudio.google.com/app/apikey');
});
