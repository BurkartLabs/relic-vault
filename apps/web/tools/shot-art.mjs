// Dev helper: screenshot the art sheet (apps/web/art.html) for review.
import { chromium } from '@playwright/test';
const b = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const p = await b.newPage({ viewport: { width: 2304, height: 1300 } });
const errs = []; p.on('pageerror', (e) => errs.push(e.message)); p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
await p.goto(process.argv[2] || 'http://127.0.0.1:5173/art.html');
await p.waitForFunction(() => window.__done, null, { timeout: 30000 }).catch(() => {});
await p.screenshot({ path: process.argv[3] || 'screenshots/tmp/art.png' });
console.log(errs.length ? errs : 'ok');
await b.close();
