// Records real gameplay footage of the preview build for the project video (Orchestrata VIDEO template).
// Usage: node apps/web/tools/record.mjs <url> <outDir>
// Produces one webm per shot so the edit can cut them to the shot list, plus telemetry.json.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, renameSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const url = process.argv[2] || 'http://127.0.0.1:4174/';
const out = process.argv[3] || 'video/raw';
mkdirSync(out, { recursive: true });
const size = { width: 1080, height: 1920 };
const browser = await chromium.launch({ channel: process.env.PW_CHANNEL || 'msedge' });

async function shotSession(name, fn, fresh = true, storage) {
  const tmp = join(out, '_tmp_' + name);
  rmSync(tmp, { recursive: true, force: true });
  const ctx = await browser.newContext({
    viewport: size, deviceScaleFactor: 1, hasTouch: true,
    recordVideo: { dir: tmp, size },
    storageState: storage,
  });
  const page = await ctx.newPage();
  const h = helpers(page);
  await fn(page, h);
  await page.evaluate(() => window.__rv?.persistNow()).catch(() => {});
  await page.waitForTimeout(400);
  const state = await ctx.storageState();
  await ctx.close();
  const f = readdirSync(tmp).find((x) => x.endsWith('.webm'));
  renameSync(join(tmp, f), join(out, name + '.webm'));
  rmSync(tmp, { recursive: true, force: true });
  return state;
}

function helpers(page) {
  const wait = (ms) => page.waitForTimeout(ms);
  const toCss = (x, y) => page.evaluate(([x, y]) => {
    const r = document.querySelector('#game canvas').getBoundingClientRect(); const g = window.__game;
    return { x: r.left + (x / g.scale.width) * r.width, y: r.top + (y / g.scale.height) * r.height };
  }, [x, y]);
  const settle = () => page.waitForFunction(() => { const c = window.__vault?.cameras.main; return !c || (Math.abs(c.zoom - 1) < 0.001 && Math.abs(c.scrollX) < 1); }, null, { timeout: 5000 }).catch(() => {});
  const tap = async (x, y) => { await settle(); const p = await toCss(x, y); await page.mouse.move(p.x, p.y, { steps: 6 }); await page.mouse.down(); await wait(70); await page.mouse.up(); };
  const drag = async (a, b) => {
    await settle();
    const p = await toCss(a.x, a.y), q = await toCss(b.x, b.y);
    await page.mouse.move(p.x, p.y, { steps: 5 }); await page.mouse.down(); await wait(80);
    for (let i = 1; i <= 14; i++) { await page.mouse.move(p.x + (q.x - p.x) * i / 14, p.y + (q.y - p.y) * i / 14); await wait(22); }
    await page.mouse.up();
  };
  const ev = (fn, a) => page.evaluate(fn, a);
  const cell = (i) => ev((i) => window.__vault.cellPos(i), i);
  const forge = async () => { const f = await ev(() => ({ x: window.__vault.forgeBtn.x, y: window.__vault.forgeBtn.y })); await tap(f.x, f.y); await wait(520); };
  const mergeAny = async () => { const p = await ev(() => window.__vault.pair); if (p) { await drag(await cell(p[0]), await cell(p[1])); await wait(700); return true; } return false; };
  const ready = () => page.waitForFunction(() => window.__vault?.hud, null, { timeout: 30000 });
  return { wait, tap, drag, ev, cell, forge, mergeAny, ready, settle };
}

// Shot 2: boot -> first verb (fresh profile)
let storage = await shotSession('02-boot-first-verb', async (page, h) => {
  await page.goto(url);
  await h.wait(1600);
  await page.locator('#age-gate button[data-a="adult"]').click({ delay: 120 });
  await h.ready(); await h.wait(2600);
  await h.forge(); await h.wait(1500);
  await h.mergeAny(); await h.wait(2600);
  await h.ev(() => window.__vault.modal?.close()); await h.wait(2600); // welcome pack arrives after the beat
  await h.wait(2500);
});

// Shot 3: the loop, once, with juice (continue the same profile)
storage = await shotSession('03-loop', async (page, h) => {
  await page.goto(url); await h.ready(); await h.wait(800);
  await h.ev(() => { const s = window.__rv.state; s.flags.tut = 3; window.__vault.modal?.close(); });
  for (let k = 0; k < 16; k++) {
    await h.ev(() => window.__vault.modal?.close());
    if (!(await h.mergeAny())) await h.forge();
    await h.wait(120);
  }
  // a big merge for the sarcophagus + shareable moment
  await h.ev(() => { const s = window.__rv.state; s.board[26] = 7; s.board[27] = 7; window.__vault.syncBoard(); window.__vault.modal?.close(); });
  await h.wait(500);
  await h.drag(await h.cell(26), await h.cell(27)); await h.wait(3200);
  await h.wait(1500);
}, false, storage);

// Shot 4: monetization surfaces we are judging
storage = await shotSession('04-monetization', async (page, h) => {
  await page.goto(url); await h.ready(); await h.wait(800);
  await h.ev(() => { window.__vault.modal?.close(); window.__vault.openShop('video'); }); await h.wait(2200);
  for (let k = 0; k < 6; k++) { await h.ev((y) => window.__vault.modal?.sc?.scrollTo(y), k * 330); await h.wait(420); }
  await h.ev(() => window.__vault.modal?.close()); await h.wait(500);
  await h.ev(() => { window.__rv.state.freeChests++; window.__vault.openChest('free', 'video'); }); await h.wait(3400);
  await h.ev(() => window.__vault.modal?.close()); await h.wait(600);
  await h.ev(() => window.__vault.debugFill()); await h.wait(400); await h.forge(); await h.wait(2600);
}, false, storage);

writeFileSync(join(out, 'storage.json'), JSON.stringify(storage));
await browser.close();
console.log('recorded');
