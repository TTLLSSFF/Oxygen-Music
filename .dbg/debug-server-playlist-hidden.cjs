const http = require('http');
const fs = require('fs');
const path = require('path');
const session = 'playlist-hidden';
const port = 37901;
const file = path.join(process.cwd(), `.dbg/trae-debug-log-${session}.ndjson`);
const envFile = path.join(process.cwd(), `.dbg/${session}.env`);
fs.writeFileSync(envFile, `VITE_DEBUG_ENDPOINT=http://127.0.0.1:${port}/log\nVITE_DEBUG_SESSION=${session}\n`);
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') return res.end('ok');
  if (req.method === 'GET' && req.url === '/health') return res.end(JSON.stringify({ ok: true, session }));
  if (req.method === 'DELETE' && req.url === '/logs') { fs.writeFileSync(file, ''); return res.end(JSON.stringify({ ok: true })); }
  if (req.method === 'GET' && req.url === '/logs') return res.end(fs.existsSync(file) ? fs.readFileSync(file) : '');
  if (req.method === 'POST' && req.url === '/log') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      fs.appendFileSync(file, JSON.stringify({ ts: Date.now(), body: JSON.parse(body || '{}') }) + '\n');
      res.end(JSON.stringify({ ok: true }));
    });
    return;
  }
  res.statusCode = 404;
  res.end('not found');
});
server.listen(port, '127.0.0.1', () => console.log(`debug server http://127.0.0.1:${port}`));
