import { test, expect, Page } from '@playwright/test';
import { passChapterCard } from './chapter'; // AB#444 slice 5

/**
 * AB#4726: the privacy policy and terms are public pages that Settings opens, and Delete My Data leaves nothing of the
 * game's in IndexedDB or localStorage. It drives the production build, taps the real Settings buttons on the canvas,
 * and reads storage back with the browser's own APIs, holding the reload that follows the erase until it has looked.
 * The pages' anonymity on Azure is staticwebapp.config.json's routes (dataSafety.test.ts); vite preview has no auth.
 */
// The PWA's service worker answers navigations itself, where page.route cannot see them: this spec holds the reload.
test.use({ serviceWorkers: 'block' });

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 }); await passChapterCard(page);
}

async function openSettings(page: Page) {
  await page.evaluate(() => (window as any).__vault.openSettings());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'SettingsModal', null, { timeout: 5000 });
  await page.waitForTimeout(400);
}

/** Scrolls the Settings row labelled `label` into view and taps it where it is drawn on the canvas. */
async function tapRow(page: Page, label: string) {
  const at = await page.evaluate((label) => {
    const v = (window as any).__vault, m = v.modal;
    const find = (o: any): any => (o?.label?.text === label ? o : (o?.list ?? []).map(find).find(Boolean));
    const b = find(m.box);
    if (!b) return null;
    m.sc.scrollTo(Math.max(0, b.y - 400));
    const r = b.getBounds(), cam = v.cameras.main, canvas: HTMLCanvasElement = v.sys.game.canvas;
    const c = canvas.getBoundingClientRect(), k = c.width / v.sys.game.scale.width;
    return { x: c.left + ((r.centerX - cam.worldView.x) * cam.zoom + cam.x) * k, y: c.top + ((r.centerY - cam.worldView.y) * cam.zoom + cam.y) * k };
  }, label);
  expect(at, `the ${label} row`).not.toBeNull();
  await page.waitForTimeout(200);
  await page.touchscreen.tap(at!.x, at!.y);
}

test('Settings opens the privacy policy and the terms, public pages the game ships (AB#4726)', async ({ page, context }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await openSettings(page);
  await tapRow(page, 'PRIVACY POLICY');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/qa/ab4726-settings.png' });
  for (const [label, file, heading] of [['PRIVACY POLICY', 'privacy.html', 'Privacy policy'], ['TERMS', 'terms.html', 'Terms of play']]) {
    const popup = context.waitForEvent('page');
    await tapRow(page, label);
    const opened = await popup;
    await opened.waitForLoadState();
    expect(new URL(opened.url()).pathname).toBe(`/${file}`);
    await expect(opened.locator('h1')).toHaveText(heading);
    await opened.screenshot({ path: `screenshots/qa/ab4726-${file.replace('.html', '')}.png`, fullPage: true });
    await opened.close();
  }
  expect(errors).toEqual([]);
});

test('Delete My Data leaves no relic-vault key in IndexedDB or localStorage, then starts a new player (AB#4726)', async ({ page, context }) => {
  const errors: string[] = [];
  await boot(page, errors);
  // a player with progress: gold the new vault cannot have, saved, and a device id
  await page.evaluate(async () => { const rv = (window as any).__rv; rv.state.gold = 987654; await rv.save.save(rv.state); await rv.save.saveAnalytics(rv.analytics.buf); });
  const before = await page.evaluate(() => ({ did: localStorage.getItem('rv_did'), keys: Object.keys(localStorage) }));
  expect(before.did).toBeTruthy();
  expect(before.keys).toContain('relic-vault-save');

  await openSettings(page);
  await tapRow(page, 'DELETE MY DATA');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/qa/ab4726-delete-armed.png' });

  // hold the reload the erase ends with, and read the origin's storage from a second tab on a page that runs no game
  // code (privacy.html) before letting it through: the reloaded game would make a new device id and save at once
  const said: string[] = [];
  page.on('console', (m) => { if (m.text().startsWith('[rv] delete-my-data')) said.push(m.text()); });
  let left: any = null;
  let looked!: () => void;
  const lookedAt = new Promise<void>((res) => { looked = res; });
  const origin = new URL(page.url()).origin;
  await page.route((url) => url.origin === origin && (url.pathname === '/' || url.pathname === '/index.html'), async (route) => {
    if (route.request().isNavigationRequest() && !left) {
      const reader = await context.newPage();
      await reader.goto(origin + '/privacy.html');
      left = await reader.evaluate(async () => {
        const dbs = (await indexedDB.databases?.()) ?? [];
        const idb: Record<string, number> = {};
        for (const d of dbs) {
          if (!d.name) continue;
          const db: IDBDatabase = await new Promise((res, rej) => { const r = indexedDB.open(d.name!); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
          for (const store of Array.from(db.objectStoreNames)) {
            idb[`${d.name}/${store}`] = await new Promise((res) => { const q = db.transaction(store).objectStore(store).count(); q.onsuccess = () => res(q.result); q.onerror = () => res(-1); });
          }
          db.close();
        }
        return { localStorage: Object.keys(localStorage), sessionStorage: Object.keys(sessionStorage), idb };
      }).catch((e) => ({ error: String(e) }));
      await reader.close();
      looked();
    }
    await route.continue();
  });
  await tapRow(page, 'TAP AGAIN TO DELETE ALL YOUR DATA'); // armed by the first tap
  await Promise.race([lookedAt, page.waitForTimeout(20_000)]);
  await page.waitForLoadState('load');
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 }).catch(() => {}); // a new player: the card comes after the age gate, below
  await page.waitForTimeout(500);

  expect(left, 'storage read back before the reload').toBeTruthy();
  expect(left.error).toBeUndefined();
  expect(left.localStorage.filter((k: string) => /^(relic-vault|rv_)/.test(k))).toEqual([]);
  expect(left.sessionStorage.filter((k: string) => /^(relic-vault|rv_)/.test(k))).toEqual([]);
  expect(Object.values(left.idb).every((n) => n === 0), JSON.stringify(left.idb)).toBe(true);
  expect(said.at(-1)).toBe('[rv] delete-my-data remaining {"localStorage":[],"sessionStorage":[],"indexedDB":[]}');

  // the new session is a new player: a new device id, and none of the old vault
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count()) { await gate.click(); await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 }); await passChapterCard(page); }
  const after = await page.evaluate(() => ({ did: localStorage.getItem('rv_did'), gold: (window as any).__rv.state.gold }));
  expect(after.did).not.toBe(before.did);
  expect(after.gold).not.toBe(987654);
  expect(errors).toEqual([]);
});
