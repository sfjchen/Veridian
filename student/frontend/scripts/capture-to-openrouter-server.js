/**
 * Backend that receives captured work and sends it to OpenRouter free vision model as context.
 * Run: OPENROUTER_API_KEY=your_key node scripts/capture-to-openrouter-server.js
 * Get a free key at https://openrouter.ai (free models do not charge)
 * Set EXPO_PUBLIC_BACKEND_URL=http://localhost:3001 in the app .env
 *
 * Flow: POST /api/capture (image + documentId) → send image to OpenRouter → store as context (not returned to client)
 */
const http = require('http');

const PORT = Number(process.env.PORT) || 3001;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
// openrouter/free routes to a free model that supports your request (e.g. image). Specific free vision model ids often 404.
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openrouter/free';
const MAX_BODY = 50 * 1024 * 1024; // 50MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sendToOpenRouter(imageBase64, documentId) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const body = {
    model: OPENROUTER_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${imageBase64}`,
            },
          },
          {
            type: 'text',
            text: `Convert the mathematical or written content in this image (document ${documentId}) into LaTeX. Output only the LaTeX (equations, expressions, or text in LaTeX). No explanation or markdown.`,
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  return { summary: text };
}

const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] || '';

  if (req.method === 'GET' && (url === '/' || url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ ok: true, message: 'Capture-to-OpenRouter server running' }));
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

        if (!OPENROUTER_API_KEY) {
          console.error('[capture] Missing OPENROUTER_API_KEY');
          res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        if (!imageBase64 || typeof imageBase64 !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        const { summary } = await sendToOpenRouter(imageBase64, documentId);
        console.log('[capture] documentId:', documentId, '| LaTeX:', summary?.slice(0, 200) + (summary?.length > 200 ? '...' : ''));

        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('[capture] Error:', e.message);
        if (e.message.includes('404') && e.message.includes('image'))
          console.error('[capture] OpenRouter has no free vision endpoint right now. Try: npm run server:gemini with a new Google AI Studio key, or npm run test:capture-server for stub.');
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
  console.log(`Capture-to-OpenRouter server at http://localhost:${PORT} (model: ${OPENROUTER_MODEL})`);
  if (!OPENROUTER_API_KEY) console.warn('Warning: OPENROUTER_API_KEY not set — requests will fail.');
  console.log('  GET  /health     — check server is up');
  console.log('  POST /api/capture — receive image, send to OpenRouter free vision, store context (not returned to app)');
  console.log('Get a free API key: https://openrouter.ai');
});
