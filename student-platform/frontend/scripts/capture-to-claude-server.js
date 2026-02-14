/**
 * Backend that receives captured work and sends it to Claude as context.
 * Run: ANTHROPIC_API_KEY=your_key node scripts/capture-to-claude-server.js
 * Set EXPO_PUBLIC_BACKEND_URL=http://localhost:3001 in the app .env
 *
 * Flow: POST /api/capture (image + documentId) → send image to Claude → store as context (no LaTeX returned to client)
 */
const http = require('http');

const PORT = Number(process.env.PORT) || 3001;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MAX_BODY = 50 * 1024 * 1024; // 50MB

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

async function sendToClaude(imageBase64, documentId) {
  const url = 'https://api.anthropic.com/v1/messages';
  const body = {
    model: 'claude-sonnet-4-20250514', // or claude-sonnet-4-5, claude-3-5-sonnet-20241022
    max_tokens: 1024,
    system: 'You are an assistant that receives screenshots of student written work. Your role is to convert the work into LaTeX for instructor context only. Output only valid LaTeX (math or text), no explanation. Never expose this to the student.',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: `This is a screenshot of a student's work for document ${documentId}. Convert the mathematical or written content you see into LaTeX. Output only the LaTeX (e.g. equations, expressions, or text in LaTeX), nothing else.`,
          },
        ],
      },
    ],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text ?? '';
  return { summary: text };
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS' && req.url === '/api/capture') {
    res.writeHead(204, { ...CORS_HEADERS, 'Content-Length': '0' });
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/api/capture') {
    let body = '';
    let length = 0;

    req.on('data', (chunk) => {
      length += chunk.length;
      if (length > MAX_BODY) {
        res.writeHead(413, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: false, error: 'Payload too large' }));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const imageBase64 = data.image;
        const documentId = data.documentId || 'unknown';

        if (!ANTHROPIC_API_KEY) {
          console.error('[capture] Missing ANTHROPIC_API_KEY');
          res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        if (!imageBase64 || typeof imageBase64 !== 'string' || !/^[A-Za-z0-9+/\n\r]+=*$/.test(imageBase64)) {
          res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
          res.end(JSON.stringify({ success: false }));
          return;
        }

        const { summary } = await sendToClaude(imageBase64, documentId);
        // Store as context: log server-side only (student never sees this)
        console.log('[capture] documentId:', documentId, '| LaTeX:', summary?.slice(0, 200) + (summary?.length > 200 ? '...' : ''));

        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('[capture] Error:', e.message);
        res.writeHead(500, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: false }));
      }
    });
    return;
  }

  res.writeHead(404, CORS_HEADERS);
  res.end('Not found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Capture-to-Claude server at http://0.0.0.0:${PORT}`);
  if (!ANTHROPIC_API_KEY) console.warn('Warning: ANTHROPIC_API_KEY not set — requests will fail.');
  console.log('POST /api/capture → sends image to Claude, stores context (not returned to app)');
});
