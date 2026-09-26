import { test, expect, Page } from '@playwright/test';

/**
 * Bug #341: at rank 3 the Board's game threw "can't access property drawImage, this.data is null" through
 * mergeJuice -> rankUp -> refreshGenerators -> setText. VaultScene restarts itself (250 ms after a resize, and on every
 * floor change), and Phaser's restart runs create() again on the same scene object: fields set once at construction
 * kept the last run's game objects, which the restart had destroyed. The first rank-up after a restart then wrote to a
 * destroyed generator label. These drive the production build, restart the scene both ways a player can, and rank up.
 */
async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(WAKE);
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
}

/** Wait until the scene has been rebuilt: a new create() ran, so its HUD is a new, unmarked object. */
async function waitForRestart(page: Page) {
  await page.waitForFunction(() => {
    const v = (window as any).__vault;
    return v?.sys?.isActive() && v.hud && !v.hud.__marked;
  }, null, { timeout: 15_000 });
  await page.waitForTimeout(300);
}

/** Mark this run's HUD (create() makes a new one), so the next create() is told apart by its absence. */
async function markScene(page: Page) {
  await page.evaluate(() => { (window as any).__vault.hud.__marked = true; });
}

/**
 * The crash's path: a merge that ranks up calls rankUp, which refreshes the generators. It only threw when the rank-up
 * woke a chain (Economy.ts sets gens[c] to 1 at its unlockRank): setText returns early on an unchanged label, so an
 * unchanged dead one never drew.
 */
declare function wakeAChainAndRankUp(v: any): void;
const WAKE = `window.wakeAChainAndRankUp = (v) => { const s = window.__rv.state; s.rank += 1; s.gens[1] = Math.max(1, s.gens[1] || 0); s.gens[2] = Math.max(1, s.gens[2] || 0); v.rankUp(1); };`;

/** The live generators: every one the scene keeps must be a game object that exists, and there are three. */
const generators = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vault;
  return { count: v.gens.length, allLive: v.gens.every((g: any) => g.active && g.scene && g.parts.lvlT.scene), forgeLive: Boolean(v.forgeBtn?.active) };
});

test('a resize restarts the scene, and the next rank-up does not write to the old one (Bug #341)', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await markScene(page);
  await page.setViewportSize({ width: 430, height: 932 }); // the resize the game answers with a restart, 250 ms on
  await waitForRestart(page);
  expect(await generators(page)).toEqual({ count: 3, allLive: true, forgeLive: true });
  // The crash's path: a merge that ranks up calls rankUp, which refreshes the generators.
  await page.evaluate(() => { const v = (window as any).__vault; wakeAChainAndRankUp(v); });
  await page.waitForTimeout(1500); // let the rank-up's tweens and delayed calls run
  await page.screenshot({ path: 'screenshots/qa/ab341-rankup-after-resize.png' });
  expect(errors).toEqual([]);
});

test('a floor change restarts the scene, and the next rank-up does not write to the old one (Bug #341)', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  // Two restarts, as a player who descends twice would have: each used to add three more dead generators.
  for (let i = 0; i < 2; i += 1) {
    await markScene(page);
    await page.evaluate(() => { (window as any).__vault.scene.restart(); }); // what onFloorChanged does
    await waitForRestart(page);
  }
  expect(await generators(page)).toEqual({ count: 3, allLive: true, forgeLive: true });
  await page.evaluate(() => { const v = (window as any).__vault; wakeAChainAndRankUp(v); });
  await page.waitForTimeout(1500);
  expect(errors).toEqual([]);
});
