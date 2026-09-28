// AB#4737: Relic Vault's cold and warm start, and its steady frame rate, on desktop Chrome with the CPU throttled 4x:
// a stand-in for a low-end Android WebView until a device or an emulator is on this machine (docs/DEVICE_QA.md).
// Run it against a production build: `npm run build && npx vite preview --port 4176`, then
//   node apps/web/tools/perf.mjs http://127.0.0.1:4176/ screenshots/perf/<tag> [runs]
// It writes results.json there: medians of each milestone, the frame rate with 36 relics and 200 particles, texture
// memory, and the boot's own rv:* timings (performance.measure, set in main.ts and the boot scenes).
import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
const [url = 'http://127.0.0.1:4176/', OUT = 'screenshots/perf/run', runs = '3'] = process.argv.slice(2);
const tag = OUT.split('/').pop();
mkdirSync(OUT, { recursive: true });
const THROTTLE = 4;

// in-page clock: every milestone stamped with performance.now() (ms since navigation start) the moment it happens
const probe = () => {
  window.__t = {};
  const stamp = (k) => { if (window.__t[k] == null) window.__t[k] = performance.now(); };
  new MutationObserver(() => { if (document.querySelector('#age-gate button[data-a="adult"]')) stamp("ageGate"); })
    .observe(document, { childList: true, subtree: true });
  const tick = () => {
    const v = window.__vault;
    if (v && v.hud) stamp("vaultReady");
    if (window.__t.vaultReady == null) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
};

// the GPU, not SwiftShader: headless Chromium otherwise renders WebGL in software on the (throttled) CPU, which a phone
// does not; with these flags it uses the machine's GPU while the CPU is throttled 4x
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
const results = { cold: [], warm: [] };
let fpsResult = null, texResult = null, renderer = null;

async function once(context, kind, measureSteady) {
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: THROTTLE });
  await page.addInitScript(probe);
  await page.setViewportSize({ width: 412, height: 915 }); // a common Android phone viewport
  await page.goto(url, { waitUntil: "commit" });
  const gate = page.locator('#age-gate button[data-a="adult"]');
  // the gate shows on a first visit; a returning player (warm) has answered it
  const sawGate = await gate.waitFor({ state: "visible", timeout: kind === "cold" ? 30000 : 4000 }).then(() => true).catch(() => false);
  if (sawGate) { await page.evaluate(() => { window.__t.gateAnswered = performance.now(); }); await gate.click(); }
  await page.waitForFunction(() => window.__t.vaultReady != null, null, { timeout: 60000 });
  // the first forge: tap it and stamp when a relic lands on the board
  const before = await page.evaluate(() => window.__rv.state.board.filter(Boolean).length);
  await page.evaluate(() => { window.__t.forgeTapped = performance.now(); });
  const f = await page.evaluate(() => { const b = window.__vault.forgeBtn; const cam = window.__vault.cameras.main; const r = window.__vault.game.canvas.getBoundingClientRect(); return { x: r.left + (b.x - cam.scrollX) * r.width / window.__vault.scale.width, y: r.top + (b.y - cam.scrollY) * r.height / window.__vault.scale.height }; });
  await page.mouse.click(f.x, f.y);
  await page.waitForFunction((n) => window.__rv.state.board.filter(Boolean).length > n, before, { timeout: 20000 })
    .then(() => page.evaluate(() => { window.__t.firstForge = performance.now(); })).catch(() => {});
  const t = await page.evaluate(() => ({ ...window.__t, bake: performance.getEntriesByType("measure").filter((m) => m.name.startsWith("rv:")).map((m) => [m.name, Math.round(m.duration)]),
    codeStart: performance.getEntriesByName("rv:start")[0]?.startTime ?? null }));
  const row = {
    ageGate: t.ageGate ?? null, vaultReady: t.vaultReady, firstForge: t.firstForge ?? null,
    // what the player waits for, less the time the test spent clicking the gate
    toInteractive: t.vaultReady - (t.gateAnswered != null && t.ageGate != null ? t.gateAnswered - t.ageGate : 0),
    bake: t.bake, codeStart: t.codeStart, errors,
  };
  if (measureSteady) {
    renderer = await page.evaluate(() => { const g = document.createElement("canvas").getContext("webgl"); const d = g?.getExtension("WEBGL_debug_renderer_info"); return d ? g.getParameter(d.UNMASKED_RENDERER_WEBGL) : "unknown"; });
    await page.screenshot({ path: `${OUT}/vault-${kind}.png` });
    // 36 relics and 200 live particles, held for 5 s; frame times from requestAnimationFrame
    fpsResult = await page.evaluate(async () => {
      const v = window.__vault;
      v.debugFill();
      const relics = window.__rv.state.board.filter(Boolean).length;
      const cx = v.scale.width / 2, cy = v.scale.height / 2;
      const alive = () => v.fx.sparks.getAliveParticleCount() + v.fx.embers.getAliveParticleCount();
      const top = setInterval(() => {
        const s = 100 - v.fx.sparks.getAliveParticleCount(), e = 100 - v.fx.embers.getAliveParticleCount();
        if (s > 0) v.fx.sparks.explode(s, cx, cy); if (e > 0) v.fx.embers.explode(e, cx, cy + 200);
      }, 50);
      await new Promise((r) => setTimeout(r, 800));
      const frames = []; const counts = [];
      await new Promise((resolve) => {
        let last = performance.now(); const end = last + 5000;
        const step = (now) => { frames.push(now - last); counts.push(alive()); last = now; if (now < end) requestAnimationFrame(step); else resolve(); };
        requestAnimationFrame(step);
      });
      clearInterval(top);
      const sorted = [...frames].sort((a, b) => a - b);
      const mean = frames.reduce((a, b) => a + b, 0) / frames.length;
      return { relics, particlesMean: Math.round(counts.reduce((a, b) => a + b, 0) / counts.length), fps: +(1000 / mean).toFixed(1),
        p95FrameMs: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), frames: frames.length };
    });
    // texture memory: every texture source's pixels at 4 bytes each (the GPU copy; each canvas texture also keeps a
    // CPU canvas of the same size, counted separately)
    texResult = await page.evaluate(() => {
      const tm = window.__vault.textures; let gpu = 0, canvas = 0, n = 0; const big = [];
      for (const key of tm.getTextureKeys()) {
        const tex = tm.get(key);
        for (const s of tex.source) {
          const b = (s.width || 0) * (s.height || 0) * 4; gpu += b; n++;
          if (s.image instanceof HTMLCanvasElement) canvas += b;
          big.push([key, s.width, s.height, +(b / 1048576).toFixed(1)]);
        }
      }
      big.sort((a, b) => b[3] - a[3]);
      return { textures: n, gpuMB: +(gpu / 1048576).toFixed(1), canvasMB: +(canvas / 1048576).toFixed(1), largest: big.slice(0, 8) };
    });
    await page.screenshot({ path: `${OUT}/full-board-${kind}.png` });
  }
  await page.close();
  return row;
}

for (let i = 0; i < Number(runs); i++) {
  const context = await browser.newContext(); // a fresh profile: nothing cached, the age gate unanswered
  results.cold.push(await once(context, "cold", false));
  results.warm.push(await once(context, "warm", i === 0)); // a reload: cached, the gate answered
  await context.close();
}
await browser.close();

const med = (xs) => { const v = xs.filter((x) => x != null).sort((a, b) => a - b); return v.length ? Math.round(v[Math.floor(v.length / 2)]) : null; };
const summary = {};
for (const k of ["cold", "warm"]) summary[k] = Object.fromEntries(["ageGate", "vaultReady", "toInteractive", "firstForge"].map((m) => [m, med(results[k].map((r) => r[m]))]));
const report = { tag, throttle: THROTTLE, renderer, runs: Number(runs), summary, fps: fpsResult, textures: texResult, bake: results.warm[0]?.bake, raw: results };
writeFileSync(`${OUT}/results.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ renderer, summary, fps: fpsResult, textures: { gpuMB: texResult?.gpuMB, canvasMB: texResult?.canvasMB, n: texResult?.textures, largest: texResult?.largest?.slice(0, 5) }, bake: report.bake, errors: results.cold.concat(results.warm).flatMap((r) => r.errors).slice(0, 5) }, null, 1));
