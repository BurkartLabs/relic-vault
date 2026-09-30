import { test, expect, Page } from '@playwright/test';
import { passChapterCard } from './chapter'; // AB#444 slice 5

/**
 * RV-M8 (AB#383): one pushed offer per session. In the production build: the first merge brings the Keeper's Welcome,
 * the merges that would have brought the comeback offer bring nothing more that session, and the next boot brings the
 * comeback offer the cap held back. Each offer is logged as offer_shown with its trigger and nothing else.
 */
async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 }); await passChapterCard(page);
}
const modalKind = (page: Page) => page.evaluate(() => (window as any).__vault.modal?.kind ?? null);
const offersShown = (page: Page) => page.evaluate(() => (window as any).__rv.telemetry.buf.filter((e: any) => e.event === 'offer_shown'));
/** Merge two T1 relics in cells 0 and 1 through the scene's own merge, n times. */
const mergeTimes = (page: Page, n: number) => page.evaluate((n) => {
  const s = (window as any).__rv.state, v = (window as any).__vault;
  for (let i = 0; i < n; i++) { s.board[0] = 1; s.board[1] = 1; v.syncBoard(); v.doMerge(0, 1); }
}, n);
/** Close whatever is open until the screen is clear (Keeper lines, sheets). */
async function clearScreen(page: Page) {
  for (let i = 0; i < 10 && await modalKind(page); i++) {
    await page.evaluate(() => (window as any).__vault.modal?.close());
    await page.waitForTimeout(400);
  }
}

test('one pushed offer per session: the Welcome, nothing more that boot, the comeback on the next', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => { const s = (window as any).__rv.state; s.flags.tut = 3; s.flags.hint_orders = 1; (window as any).__vault.debugClear(); });

  // Boot 1: the first merge brings the Welcome.
  await mergeTimes(page, 1);
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'WelcomePack' || (window as any).__vault.modal?.kind === 'KeeperDialog', null, { timeout: 8000 });
  if (await modalKind(page) === 'KeeperDialog') {
    await page.evaluate(() => (window as any).__vault.modal.close());
    await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'WelcomePack', null, { timeout: 8000 });
  }
  await page.screenshot({ path: 'screenshots/qa/ab383-boot1-welcome.png' });
  await clearScreen(page);

  // Merge 10 more: merge 8 used to queue the comeback offer. Wait out the streak guard and the offer's delay.
  await mergeTimes(page, 10);
  await page.waitForTimeout(2200 + 900 + 2500);
  await clearScreen(page); // Keeper lines are not offers
  await page.waitForTimeout(1500);
  expect(await modalKind(page)).toBe(null);
  const boot1 = await offersShown(page);
  expect(boot1.map((e: any) => `${e.props.sku}:${e.props.trigger}`)).toEqual(['welcome:first_merge']);
  // offer_shown carries the offer and its trigger (docs/ANALYTICS.md), and the envelope the anonymous device id and
  // the per-boot session id, and nothing else: no gold, gems or rank.
  expect(Object.keys(boot1[0].props).sort()).toEqual(['sku', 'trigger']);
  expect(typeof boot1[0].distinct_id).toBe('string');
  expect(typeof boot1[0].session_id).toBe('string');
  expect(await page.evaluate(() => (window as any).__rv.state.flags.offer_comeback ?? 0)).toBe(0); // held back, not spent

  // Boot 2: the next merge brings the comeback offer the cap held back.
  await page.evaluate(() => (window as any).__rv.persistNow());
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 }); await passChapterCard(page);
  await clearScreen(page);
  await mergeTimes(page, 1);
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'OfferSheet', null, { timeout: 10_000 });
  await page.screenshot({ path: 'screenshots/qa/ab383-boot2-comeback.png' });
  const boot2 = await offersShown(page);
  expect(boot2.map((e: any) => `${e.props.sku}:${e.props.trigger}`)).toEqual(['comeback:merge_8']);
  expect(boot2[0].session_id).not.toBe(boot1[0].session_id);
  expect(errors).toEqual([]);
});
