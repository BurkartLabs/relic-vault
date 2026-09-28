import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * AB#4732: Settings shows the build's own version (package.json's, through __APP_VERSION__), where it used to print a
 * fixed "v1.0". The production build here is started with `npx vite build`, not `npm run`, which is the case
 * vite.config.ts now reads package.json for.
 */
const VERSION = JSON.parse(readFileSync('package.json', 'utf8')).version;

test("Settings shows the build's version (AB#4732)", async ({ page }) => {
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).__vault.openSettings());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'SettingsModal', null, { timeout: 5000 });
  const footer = await page.evaluate(() => {
    const m = (window as any).__vault.modal;
    m.sc.scrollTo(1e6); // the foot of the list, as a player's drag would reach it
    const find = (o: any): any => (typeof o?.text === 'string' && o.text.startsWith('Relic Vault v') ? o : (o?.list ?? []).map(find).find(Boolean));
    return find(m.box)?.text ?? null;
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/qa/ab4732-settings-version.png' });
  expect(footer).toBe(`Relic Vault v${VERSION} · DEMO STORE MODE · no real charges`);
});
