/**
 * Minimal test server for POST /api/capture.
 * Run: node scripts/test-capture-server.js
 * Then set EXPO_PUBLIC_BACKEND_URL=http://localhost:3001 (iOS sim)
 * or your machine's LAN IP for a physical device.
 *
 * Verify: curl http://localhost:3001/health
 * Test POST: curl -X POST http://localhost:3001/api/capture -H "Content-Type: application/json" -d '{"image":"e30=","documentId":"test"}'
 */
const http = require('http');

const PORT = Number(process.env.PORT) || 3001;
const MAX_BODY = 50 * 1024 * 1024; // 50MB for large base64 images

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const server = http.createServer((req, res) => {
  const url = req.url?.split('?')[0] || '';

  if (req.method === 'GET' && (url === '/' || url === '/health')) {
    res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
    res.end(JSON.stringify({ ok: true, message: 'Test capture server running' }));
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

    req.on('end', () => {
      console.log('[capture] body complete, size:', length);
      try {
        const data = JSON.parse(body);
        const imageLen = data.image ? data.image.length : 0;
        console.log('[capture] documentId:', data.documentId, '| image base64 length:', imageLen);
        res.writeHead(200, { 'Content-Type': 'application/json', ...CORS_HEADERS });
        res.end(JSON.stringify({ success: true }));
      } catch (e) {
        console.error('[capture] parse error:', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json', ...CORS_HEADERS });
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
  console.log(`Test capture server at http://localhost:${PORT}`);
  console.log('  GET  /health     — check server is up');
  console.log('  POST /api/capture — receive image + documentId');
  console.log('Set EXPO_PUBLIC_BACKEND_URL=http://localhost:' + PORT + ' (Android emulator: http://10.0.2.2:' + PORT + ')');
});
