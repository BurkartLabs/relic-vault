import { test, expect, Page } from '@playwright/test';

/**
 * Bug #1814: the Keeper's Welcome is a $1.99 offer. Its modal drew two Gold Masks and a Silver Urn and said so in its
 * small print, while the purchase places two Gold Masks and a Ruby Crown (Board RV-B1) and the Shop said Ruby Crown.
 * This opens the modal in the production build, as the bug's repro does, and reads what the game drew and wrote.
 */
async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
}

test('the Welcome modal draws and names the Ruby Crown the pack grants (Bug #1814)', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  await page.evaluate(() => { (window as any).__vault.showOffer({ id: 'welcome', trigger: 'qa' }); });
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'WelcomePack', null, { timeout: 6000 });
  await page.waitForTimeout(600); // the modal's entrance

  const drawn = await page.evaluate(() => {
    const all: any[] = [];
    const walk = (o: any) => { all.push(o); (o.list || []).forEach(walk); };
    walk((window as any).__vault.modal.box);
    return {
      relics: all.filter((o) => o.texture?.key === 'relic256').map((o) => o.frame.name),
      smallPrint: all.filter((o) => typeof o.text === 'string' && o.text.includes('dropped straight onto your board')).map((o) => o.text),
    };
  });
  // The loot art: two Gold Masks (R4) and a Ruby Crown (R7), what applyPurchase places; no Silver Urn (R3).
  expect(drawn.relics.slice(0, 3)).toEqual(['R4', 'R4', 'R7']);
  expect(drawn.relics).not.toContain('R3');
  expect(drawn.smallPrint).toHaveLength(1);
  expect(drawn.smallPrint[0]).toContain('+ two Gold Masks and a Ruby Crown dropped straight onto your board.');
  expect(drawn.smallPrint[0]).not.toContain('Silver Urn');
  await page.screenshot({ path: 'screenshots/qa/ab1814-welcome-modal.png' });

  // And what the Shop sells under the same name says the same.
  const blurb = await page.evaluate(() => (window as any).__rv?.skus?.welcome?.blurb ?? null);
  if (blurb !== null) expect(blurb).toContain('a Ruby Crown');
  expect(errors).toEqual([]);
});
