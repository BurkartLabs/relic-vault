import type { Page } from '@playwright/test';

/**
 * AB#444 slice 5: a fresh game opens on the Chapter 1 card, after the age gate. A test that starts a fresh game
 * reads it and presses Continue, as a player does; on a boot that shows no card (a reload, a save past Chapter 1)
 * this returns at once.
 */
export async function passChapterCard(page: Page) {
  await page.waitForFunction(() => {
    const v = (window as any).__vault;
    return v?.modal?.kind === 'FloorIntro' || (v && !v.chapterPending);
  }, null, { timeout: 15_000 });
  const open = await page.evaluate(() => (window as any).__vault?.modal?.kind === 'FloorIntro');
  if (!open) return;
  await page.waitForTimeout(350); // let it finish popping in
  await page.evaluate(() => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => (o?.label?.text === 'CONTINUE' ? o : (o?.list ?? []).map(find).find(Boolean));
    find(m.box).onClick();
  });
  await page.waitForFunction(() => (window as any).__vault?.modal?.kind !== 'FloorIntro', null, { timeout: 5000 });
}
