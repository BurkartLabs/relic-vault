import { test, expect, Page } from '@playwright/test';

/**
 * RV-M2b (AB#382): the free path to power-ups, in the production build. The quests sheet says the day's first claim
 * gives an Auto-Merge; claiming the forge quest gives one; the shop shows it held and uses it. The same steps run for an
 * adult and for an under-16 profile, which get the same fixed grant (MONETIZATION.md: made safe for every age).
 */
async function boot(page: Page, age: 'adult' | 'minor', errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  const gate = page.locator(`#age-gate button[data-a="${age}"]`);
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
}
const said = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const walk = (o: any) => { if (typeof o?.text === 'string') out.push(o.text); (o?.list || []).forEach(walk); };
  walk((window as any).__vault.modal);
  return out.join(' | ');
});

for (const age of ['adult', 'minor'] as const) {
  test(`the day's first quest claim gives a free Auto-Merge, used from the shop (${age})`, async ({ page }) => {
    const errors: string[] = [];
    await boot(page, age, errors);
    expect(await page.evaluate(() => (window as any).__rv.state.age)).toBe(age);
    await page.evaluate(() => {
      const rv = (window as any).__rv, v = (window as any).__vault;
      rv.state.flags.tut = 3; rv.state.flags.hint_orders = 1; v.modal?.close();
      rv.state.quests.forge = 10; // the forge quest done, as the 12-minute casual player does every day
    });
    await page.waitForTimeout(400);

    await page.evaluate(() => (window as any).__vault.openQuests());
    await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'QuestsModal', null, { timeout: 5000 });
    await page.waitForTimeout(500);
    expect(await said(page)).toContain('The first quest you claim today also gives a free Auto-Merge.');
    await page.screenshot({ path: `screenshots/qa/ab382-quests-${age}.png` });

    // claim the forge quest through its own button
    await page.evaluate(() => {
      const m = (window as any).__vault.modal;
      const find = (o: any): any => o?.label?.text === 'CLAIM' && !o.disabled ? o : (o?.list ?? []).map(find).find(Boolean);
      find(m.box).onClick();
    });
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as any).__rv.state.powerUps.autoMerge)).toBe(1);
    expect(await page.evaluate(() => (window as any).__vault.lastToast)).toBe("+1 Auto-Merge: use it from the Shop's Power-ups.");
    expect(await said(page)).not.toContain('also gives a free Auto-Merge'); // said once, while it is to come
    await page.screenshot({ path: `screenshots/qa/ab382-claimed-${age}.png` });

    // the shop holds it, and it merges a board of pairs
    await page.evaluate(() => (window as any).__vault.modal.close());
    await page.waitForTimeout(400);
    await page.evaluate(() => { const rv = (window as any).__rv, v = (window as any).__vault; rv.state.board = rv.state.board.map(() => 0); [2, 2, 3, 3].forEach((t: number, i: number) => { rv.state.board[i] = t; }); v.syncBoard(); });
    await page.evaluate(() => (window as any).__vault.openShop('qa'));
    await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'ShopModal', null, { timeout: 5000 });
    await page.evaluate(() => { const m = (window as any).__vault.modal; m.sc.scrollTo(m.anchors.powerups - 20); });
    await page.waitForTimeout(400);
    expect(await said(page)).toContain('You hold 1');
    await page.screenshot({ path: `screenshots/qa/ab382-shop-${age}.png` });
    await page.evaluate(() => (window as any).__vault.modal.useAutoMerge());
    await page.waitForTimeout(900);
    expect(await page.evaluate(() => (window as any).__rv.state.powerUps.autoMerge)).toBe(0);
    expect(await page.evaluate(() => (window as any).__vault.lastToast)).toBe('Auto-Merge: 2 merges.');
    expect(errors).toEqual([]);
  });
}
