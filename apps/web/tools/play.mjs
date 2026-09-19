// Scripted playtest harness: drives the real game in headless Edge at phone size and saves screenshots.
// Usage: node apps/web/tools/play.mjs <url> <outDir> [scenario]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const url = process.argv[2] || 'http://localhost:5173/';
const out = process.argv[3] || 'screenshots/tmp';
const scenario = process.argv[4] || 'basic';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });
const ctxB = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2.5, hasTouch: true, isMobile: true });
const page = await ctxB.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message + ' :: ' + (e.stack || '').split('\n').slice(0, 6).join(' | ')));
page.on('requestfailed', (r) => errors.push('REQFAIL ' + r.url()));
page.on('response', (r) => { if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`); });

let n = 0;
const shot = async (name) => { await page.screenshot({ path: `${out}/${String(++n).padStart(2, '0')}-${name}.png` }); };
const wait = (ms) => page.waitForTimeout(ms);

// game-space -> css
async function toCss(x, y) {
  return page.evaluate(([x, y]) => {
    const c = document.querySelector('#game canvas');
    const r = c.getBoundingClientRect();
    const g = window.__game;
    return { x: r.left + (x / g.scale.width) * r.width, y: r.top + (y / g.scale.height) * r.height };
  }, [x, y]);
}
const settle = () => page.waitForFunction(() => { const c = window.__vault?.cameras.main; return !c || (Math.abs(c.zoom - 1) < 0.001 && Math.abs(c.scrollX) < 1 && Math.abs(c.scrollY) < 1); }, null, { timeout: 5000 }).catch(() => {});
async function tap(x, y) { await settle(); const p = await toCss(x, y); await page.mouse.click(p.x, p.y); }
async function drag(a, b) {
  await settle();
  const p = await toCss(a.x, a.y), q = await toCss(b.x, b.y);
  await page.mouse.move(p.x, p.y); await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(p.x + (q.x - p.x) * i / 8, p.y + (q.y - p.y) * i / 8); await wait(16); }
  await page.mouse.up();
}
const vs = (fn, arg) => page.evaluate(fn, arg);
const cell = (i) => vs((i) => window.__vault.cellPos(i), i);
const forge = async () => { const f = await vs(() => ({ x: window.__vault.forgeBtn.x, y: window.__vault.forgeBtn.y })); await tap(f.x, f.y); await wait(450); };
const closeModal = () => vs(() => window.__vault.modal?.close());

await page.goto(url);
await wait(900);
await shot('boot-splash');
const gate = page.locator('#age-gate button[data-a="adult"]');
if (await gate.count()) { await shot('age-gate'); await gate.click(); }
await page.waitForFunction(() => window.__vault && window.__vault.hud, null, { timeout: 20000 });
await wait(1500);
await shot('vault-cold');

if (scenario === 'basic' || scenario === 'full') {
  await forge();
  await wait(600);
  await shot('first-forge');
  // merge first pair via drag
  const pair = await vs(() => window.__vault.pair);
  if (pair) { await drag(await cell(pair[0]), await cell(pair[1])); await wait(120); await shot('merge-impact'); await wait(1600); }
  await shot('after-first-merge');
  await tap(540, 900); await wait(2200); // dismiss keeper line -> welcome pack after beat
  await shot('welcome-pack');
  await closeModal(); await wait(500);
}

if (scenario === 'full') {
  // play ~40 actions: forge + merge any pair
  for (let k = 0; k < 40; k++) {
    await vs(() => { const m = window.__vault.modal; if (m) m.close(); });
    await wait(250);
    const pair = await vs(() => window.__vault.pair);
    if (pair && Math.random() < 0.7) await drag(await cell(pair[0]), await cell(pair[1]));
    else await forge();
    await wait(380);
    if (k === 12) await shot('mid-session');
  }
  await vs(() => window.__vault.modal?.close()); await wait(600);
  await shot('after-40-actions');
  await vs(() => { window.__rv.state.gems += 400; window.__vault.hud.refresh(true); window.__vault.openShop('qa'); }); await wait(900); await shot('shop-top');
  await vs(() => window.__vault.modal.sc?.scrollTo(900)); await wait(400); await shot('shop-chests');
  await vs(() => window.__vault.modal.sc?.scrollTo(1500)); await wait(400); await shot('shop-offers');
  await closeModal(); await wait(400);
  await vs(() => { window.__rv.state.freeChests++; window.__vault.openChest('free', 'qa'); }); await wait(2600); await shot('chest-open');
  await closeModal(); await wait(600);
  await vs(() => { window.__rv.state.album[0] = 1; window.__rv.state.album[5] = 1; window.__vault.openTab('album'); }); await wait(900); await shot('album');
  await closeModal(); await wait(400);
  await vs(() => { window.__rv.state.pass.xp += 100; window.__rv.state.rank = Math.max(2, window.__rv.state.rank); window.__vault.openPass('qa'); }); await wait(900); await shot('pass');
  await closeModal(); await wait(400);
  await vs(() => { window.__rv.state.stats.merges = Math.max(5, window.__rv.state.stats.merges); window.__vault.openEvents('qa'); }); await wait(900); await shot('events');
  await closeModal(); await wait(400);
  await vs(() => { window.__rv.state.piggy = 320; window.__vault.openPiggy('qa'); }); await wait(900); await shot('piggy');
  await closeModal(); await wait(400);
  await vs(() => window.__vault.openWheel('qa')); await wait(900); await shot('wheel');
  await closeModal(); await wait(400);
  await vs(() => window.__vault.debugFill()); await wait(300); await forge(); await wait(900); await shot('jammed');
  await closeModal(); await wait(400);
  // T4+ merge VFX layers
  await vs(() => { const s = window.__rv.state; s.board[20] = 7; s.board[21] = 7; window.__vault.syncBoard(); });
  await drag(await cell(20), await cell(21)); await wait(160); await shot('t8-merge-vfx'); await wait(1500);
  await vs(() => window.__vault.openSettings()); await wait(800); await shot('settings');
  await closeModal(); await wait(400);
}

const tele = await vs(() => window.__rv.telemetry.buf.map((e) => e.event));
const counts = tele.reduce((a, e) => ((a[e] = (a[e] || 0) + 1), a), {});
console.log(JSON.stringify({ errors, telemetry: counts, analytics: await vs(() => window.__rv.analytics.buf.length) }, null, 1));
await browser.close();
