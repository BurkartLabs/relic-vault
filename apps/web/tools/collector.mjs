// Tiny self-hosted telemetry endpoint (Orchestrata TELEMETRY.md allows "a tiny self-hosted endpoint").
// Zero dependencies, zero cost. Appends every event as one NDJSON line per UTC day.
//
//   node apps/web/tools/collector.mjs [port] [dir]
//   POST /e        body: JSON array of events (sendBeacon or fetch, text/plain to skip CORS preflight)
//   GET  /stats    counts per event, distinct sessions and devices, for today's file
//   GET  /health   "ok"
//
// Build the game against it with:  VITE_TELEMETRY_URL=http://<host>:<port>/e npm run build
import { createServer } from 'node:http';
import { appendFileSync, mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const port = Number(process.argv[2] || process.env.COLLECTOR_PORT || 8787);
const dir = resolve(process.argv[3] || process.env.COLLECTOR_DIR || 'telemetry/events');
mkdirSync(dir, { recursive: true });
const today = () => join(dir, new Date().toISOString().slice(0, 10) + '.ndjson');

const cors = { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'POST, GET, OPTIONS', 'access-control-allow-headers': 'content-type' };

createServer((req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
  if (req.method === 'GET' && req.url === '/health') { res.writeHead(200, cors); return res.end('ok'); }
  if (req.method === 'GET' && req.url?.startsWith('/stats')) {
    const f = today();
    const lines = existsSync(f) ? readFileSync(f, 'utf8').trim().split('\n').filter(Boolean) : [];
    const counts = {}, sessions = new Set(), devices = new Set();
    for (const l of lines) {
      try { const e = JSON.parse(l); counts[e.event] = (counts[e.event] || 0) + 1; sessions.add(e.session_id); devices.add(e.distinct_id); } catch { /* skip */ }
    }
    res.writeHead(200, { ...cors, 'content-type': 'application/json' });
    return res.end(JSON.stringify({ file: f, events: lines.length, sessions: sessions.size, devices: devices.size, counts }));
  }
  if (req.method === 'POST' && req.url?.startsWith('/e')) {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try {
        const arr = JSON.parse(body);
        const rows = (Array.isArray(arr) ? arr : [arr]).filter((e) => e && typeof e.event === 'string').map((e) => JSON.stringify({ ...e, rx: Date.now() }));
        if (rows.length) appendFileSync(today(), rows.join('\n') + '\n');
        res.writeHead(204, cors);
      } catch { res.writeHead(400, cors); }
      res.end();
    });
    return;
  }
  res.writeHead(404, cors); res.end();
}).listen(port, () => console.log(`collector listening on :${port} -> ${dir}`));
