// AB#4725 look: a play-mode web build with a fake RevenueCat store (EUR prices, de-DE browser), and the demo build.
// A proxy for the device + RevenueCat sandbox look, which needs an Android device and the Board's SDK key.
const { chromium } = await import("file:///T:/Orchestrata-worktrees/rv-4725/node_modules/playwright/index.mjs");
const fs = await import("node:fs");
const [mode = "play", base = "http://127.0.0.1:4191/"] = process.argv.slice(2);
const OUT = `T:/tmp/rv4725/look-${mode}`;
fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ["--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu"] });
const context = await browser.newContext({ viewport: { width: 412, height: 892 }, deviceScaleFactor: 2, locale: "de-DE", isMobile: true, hasTouch: true });
if (mode === "play") {
  await context.addInitScript(() => {
    const EUR = { welcome: 2.29, gems200: 3.49, gems500: 5.49, gems1200: 9.99, piggy: 3.49, pass: 10.99, noads: 8.99, vip: 10.99, comeback: 3.49 };
    const fmt = (n) => n.toFixed(2).replace(".", ",") + " €";
    let seq = 0;
    (window).__rvStoreBackend = {
      async start() {},
      async prices() { return Object.fromEntries(Object.entries(EUR).map(([k, v]) => [k, { label: fmt(v), amount: v, currency: "EUR" }])); },
      async buy(sku) { const t = { id: `GPA.fake-${++seq}`, sku, at: Date.now() }; return { ok: true, transaction: t, customer: { active: sku === "vip" ? { vip: Date.now() + 30 * 864e5 } : {}, transactions: [t], manageUrl: null } }; },
      async customer() { return { active: {}, transactions: [], manageUrl: null }; },
      async restore() { return { active: {}, transactions: [], manageUrl: null }; },
      onChange() {},
    };
  });
}
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
await page.goto(base);
const gate = page.locator('#age-gate button[data-a="adult"]');
if (await gate.waitFor({ state: "visible", timeout: 20000 }).then(() => true).catch(() => false)) await gate.click();
await page.waitForFunction(() => window.__vault && window.__vault.hud, null, { timeout: 60000 });
const closeAll = () => page.evaluate(() => { const v = window.__vault; while (v.modal) { v.modal.close?.(true) ?? v.modal.destroy(); if (v.modal && v.modal.active === false) v.modal = null; } });
const shot = async (name) => { await page.waitForTimeout(700); await page.screenshot({ path: `${OUT}/${name}.png` }); };
// every text object on screen, for the check that no "$" or "demo" is drawn
const texts = () => page.evaluate(() => { const out = []; const walk = (o) => { if (!o) return; if (typeof o.text === "string" && o.visible !== false) out.push(o.text); (o.list || []).forEach(walk); }; window.__vault.children.list.forEach(walk); return out; });

await page.evaluate(() => window.__vault.openShop("qa"));
await shot("shop-top");
await page.evaluate(() => window.__vault.openShop("qa", "gems"));
await shot("shop-gems");
await page.evaluate(() => window.__vault.openShop("qa", "offers"));
await shot("shop-offers");
await page.evaluate(() => { const m = window.__vault.modal; m.sc.scrollTo(1e6); });
await shot("shop-footer");
const shopTexts = await texts();
await page.evaluate(() => window.__vault.openSettings());
await page.evaluate(() => { const m = window.__vault.modal; m.sc.scrollTo(1e6); });
await shot("settings-bottom");
await page.evaluate(() => { const m = window.__vault.modal; m.sc.scrollTo(560); });
await shot("settings-store-rows");
const settingsTexts = await texts();
await page.evaluate(() => window.__vault.modal?.close());
await page.waitForTimeout(800);
await page.evaluate(() => { const v = window.__vault; window.__rv.director.queue.unshift({ id: "vip", trigger: "qa", delayMs: 0 }); v.tut.step = Math.max(v.tut.step, 3); v.pumpOffers(true); });
await page.waitForTimeout(1500);
console.log(mode, "modal after the VIP offer:", await page.evaluate(() => window.__vault.modal?.kind));
await shot("vip-sheet");
const vipTexts = await texts();
await page.evaluate(() => window.__vault.openPiggy("qa"));
await shot("piggy");
const all = [...shopTexts, ...settingsTexts, ...vipTexts];
const dollars = all.filter((t) => /\$/.test(t));
const demo = all.filter((t) => /demo|simulated|not charged|no real/i.test(t));
console.log(mode, "texts drawn:", all.length, "| with $:", JSON.stringify(dollars.slice(0, 6)), "| saying demo:", JSON.stringify(demo.slice(0, 6)));
console.log(mode, "prices drawn:", JSON.stringify([...new Set(all.filter((t) => /€|\$\d/.test(t)))].slice(0, 14)));
console.log("errors:", errors.length ? errors.slice(0, 5) : "none");
await browser.close();
