import { test, expect, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

// AB#444 slice 5: the chapter card appears exactly once per arrival (a fresh game's Chapter 1, a descent, a restore)
// and never on a plain page reload. Screenshots go to screenshots/ab444-s5/ at 1080x1920 and 375x812.
const SHOTS = 'screenshots/ab444-s5';
mkdirSync(SHOTS, { recursive: true });

async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  await gate.waitFor({ timeout: 30_000 });
  await gate.click();
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
}
const cards = (page: Page) => page.evaluate(() => ((window as any).__chapterCards ?? []) as { kind: string; chapter: number }[]);
const cardOpen = (page: Page) => page.waitForFunction(() => (window as any).__vault?.modal?.kind === 'FloorIntro', null, { timeout: 10_000 });
async function pressContinue(page: Page) {
  await page.evaluate(() => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => (o?.label?.text === 'CONTINUE' ? o : (o?.list ?? []).map(find).find(Boolean));
    find(m.box).onClick();
  });
  await page.waitForFunction(() => (window as any).__vault?.modal?.kind !== 'FloorIntro', null, { timeout: 5000 });
}
/** Reload and give any card every chance to appear; it must not. */
async function reloadExpectingNoCard(page: Page) {
  await page.reload();
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  await page.waitForTimeout(2500);
  expect(await cards(page), 'a plain reload shows no chapter card').toEqual([]);
  expect(await page.evaluate(() => (window as any).__vault.modal?.kind ?? null)).not.toBe('FloorIntro');
}
async function goThrough(page: Page, label: 'GO DOWN' | 'BEGIN AGAIN') {
  await page.waitForTimeout(600);
  for (let i = 0; i < 8 && (await page.evaluate(() => !!(window as any).__vault.modal)); i++) {
    await page.evaluate(() => (window as any).__vault.modal?.close());
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const rv = (window as any).__rv, v = (window as any).__vault;
    rv.state.flags.tut = 3;
    v.debugClear();
    const cap = v.capstone();
    rv.state.clears[rv.state.floor ?? 0] = Math.max(1, rv.state.clears[rv.state.floor ?? 0] ?? 0);
    rv.state.board[0] = cap; rv.state.board[1] = cap - 1;
    v.syncBoard();
  });
  await page.evaluate(() => (window as any).__vault.offerFloorDoors());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'FloorDoorsModal', null, { timeout: 6000 });
  await page.waitForTimeout(300);
  await page.evaluate((l) => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => (o?.label?.text === l ? o : (o?.list ?? []).map(find).find(Boolean));
    find(m.box).onClick();
  }, label);
}

test('the Chronicle reopens a floor\'s chapter card, and Continue comes back to the Chronicle', async ({ page }) => {
  const errors: string[] = [];
  await page.setViewportSize({ width: 375, height: 812 });
  await boot(page, errors);
  await cardOpen(page);
  await pressContinue(page);
  await page.evaluate(() => (window as any).__vault.openChronicle());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'ChronicleModal', null, { timeout: 5000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${SHOTS}/chronicle-chapter-link-375x812.png` });
  await page.evaluate(() => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => (o?.label?.text === 'CHAPTER' ? o : (o?.list ?? []).map(find).find(Boolean));
    find(m.box).onClick();
  });
  await cardOpen(page);
  expect((await cards(page)).at(-1)).toEqual({ kind: 'review', floor: 0, chapter: 1 });
  await pressContinue(page);
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'ChronicleModal', null, { timeout: 5000 });
  expect(errors).toEqual([]);
});

for (const [label, vp] of [['1080x1920', { width: 540, height: 960 }], ['375x812', { width: 375, height: 812 }]] as const) {
  test.describe(`at ${label}`, () => {
    test.use({ viewport: vp, deviceScaleFactor: label === '1080x1920' ? 2 : 3 });

    test('a fresh game opens on Chapter 1 once, after the age gate; the tutorial follows; a reload shows nothing', async ({ page }) => {
      const errors: string[] = [];
      await boot(page, errors);
      await cardOpen(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/chapter-1-${label}.png` });
      expect(await cards(page)).toEqual([{ kind: 'first', floor: 0, chapter: 1 }]);
      await pressContinue(page);
      // the first forge hint comes after the card, not under it
      await page.waitForFunction(() => ((window as any).__rv.state.flags.tut ?? 0) === 0 && (window as any).__vault?.modal == null, null, { timeout: 5000 });
      await reloadExpectingNoCard(page);
      expect(errors).toEqual([]);
    });

    test('a descent and a restore each open their card exactly once; a reload after either shows nothing', async ({ page }) => {
      test.setTimeout(90_000);
      const errors: string[] = [];
      await boot(page, errors);
      await cardOpen(page);
      await pressContinue(page);

      await goThrough(page, 'GO DOWN');
      await cardOpen(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/chapter-2-descend-${label}.png` });
      expect((await cards(page)).map((c) => `${c.kind}:${c.chapter}`)).toEqual(['first:1', 'descend:2']);
      await pressContinue(page);
      await page.waitForTimeout(1500);
      expect((await cards(page)).length, 'still one card for the descent').toBe(2);
      await reloadExpectingNoCard(page);

      await goThrough(page, 'BEGIN AGAIN');
      await cardOpen(page);
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOTS}/chapter-2-again-${label}.png` });
      expect((await cards(page)).map((c) => `${c.kind}:${c.chapter}`)).toEqual(['restore:2']);
      await pressContinue(page);
      await reloadExpectingNoCard(page);
      expect(errors).toEqual([]);
    });
  });
}
