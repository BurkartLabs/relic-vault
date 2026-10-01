// AB#444 slice 3 (docs/DEVICE_QA.md, "All ten floors painted"): the AB#4737 numbers for the worst case: a player on the Hollow Core, whose boot paints every
// floor's relics (bootChains paints each floor down to the player's own), and a session that has looked at every
// relic in the game (every master painted). Same method as apps/web/tools/perf.mjs: production preview, CPU 4x
// throttled, WebGL on the GPU, 412x915.
// Run it against a production build: `npm run build && npx vite preview --port 4176`, then
//   node apps/web/tools/perf-deep.mjs http://127.0.0.1:4176/ [runs]
import { chromium } from '@playwright/test';
const [url = 'http://127.0.0.1:4176/', runs = '3'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const context = await browser.newContext({ viewport: { width: 412, height: 915 } });
const page = await context.newPage();
await page.addInitScript(() => {
  window.__t = {};
  const tick = () => { const v = window.__vault; if (v && v.hud) window.__t.vaultReady = performance.now(); else requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});
const cdp = await context.newCDPSession(page);
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
// set up the save: past the age gate and Chapter 1, on the Hollow Core, unthrottled
await page.goto(url);
const gate = page.locator('#age-gate button[data-a="adult"]');
await gate.waitFor({ timeout: 60000 }); await gate.click();
await page.waitForFunction(() => window.__vault?.hud, null, { timeout: 60000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { const s = window.__rv.state; s.flags.tut = 3; s.flags.chapter1 = 1; s.floor = 9; s.rank = Math.max(s.rank, 12); window.__rv.persistNow(); });
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
const ready = [];
const bakes = [];
for (let i = 0; i < Number(runs); i++) {
  await page.reload();
  await page.waitForFunction(() => window.__t?.vaultReady != null, null, { timeout: 90000 });
  ready.push(await page.evaluate(() => Math.round(window.__t.vaultReady)));
  bakes.push(await page.evaluate(() => Object.fromEntries(performance.getEntriesByType('measure').filter((m) => m.name.startsWith('rv:bake')).map((m) => [m.name, Math.round(m.duration)]))));
  await page.waitForTimeout(500);
}
const median = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
// every relic in the game asked for once, as a session that opened every album page would
const all = await page.evaluate(() => {
  const tm = window.__vault.textures, t256 = tm.get('relic256'), t96 = tm.get('relic96');
  const names = t256.getFrameNames().filter((n) => /^R\d+$/.test(n));
  const t0 = performance.now();
  for (const n of names) { t256.get(n); t96.get('i' + n.slice(1)); }
  const ms = Math.round(performance.now() - t0);
  let gpu = 0, n = 0;
  for (const key of tm.getTextureKeys()) for (const s of tm.get(key).source) { gpu += (s.width || 0) * (s.height || 0) * 4; n++; }
  return { relics: names.length, paintAllMs: ms, gpuMB: +(gpu / 1048576).toFixed(1), textures: n, floor: window.__rv.state.floor };
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
// masters kept for the session: one 256x256 canvas per relic (the Living Relic has a second, without its iris)
const mastersMB = +(((all.relics + 1) * 256 * 256 * 4) / 1048576).toFixed(1);
console.log(JSON.stringify({ floor: all.floor, warmVaultReadyMs: ready, medianMs: median(ready), bakeMedian: bakes[Math.floor(bakes.length / 2)], everyRelic: { ...all, mastersCpuMB: mastersMB }, errors }, null, 1));
await browser.close();
