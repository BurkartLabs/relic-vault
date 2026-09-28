import { test, expect, Page } from '@playwright/test';

/**
 * AB#4723: in the Android app, Capacitor's SystemBars plugin writes the status bar's and the gesture bar's insets on
 * <html> as --safe-area-inset-* once the page is running (docs/ANDROID.md, "Edge to edge"). measureSafe() reads them
 * with env(), and the vault lays itself out again. This does in the web build exactly what the plugin does, and
 * checks the HUD moves below the status bar and the Dock above the gesture bar.
 *
 * What it cannot see: the insets a real phone reports, and a real WebView's own env() values. Those need the app on
 * Android 10 and 16 (the story's device check).
 */
async function boot(page: Page, errors: string[]) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  await gate.waitFor({ timeout: 30_000 });
  await gate.click();
  await page.waitForFunction(() => (window as any).__vault?.hud && (window as any).__vault?.dock, null, { timeout: 30_000 });
}
const layout = (page: Page) => page.evaluate(() => {
  const v = (window as any).__vault;
  return { safeTop: (window as any).__safeTop, safeBottom: (window as any).__safeBottom, hudY: v.hud.y as number, dockY: v.dock.y as number, H: v.H as number };
});

test('the insets Capacitor writes on <html> move the HUD below the status bar and the Dock above the gesture bar', async ({ page }) => {
  const errors: string[] = [];
  await boot(page, errors);
  const before = await layout(page);
  expect(before.safeTop).toBe(0); // the web build, no notch: as before
  expect(before.safeBottom).toBe(0);
  await page.screenshot({ path: 'screenshots/qa/ab4723-insets-none.png' });

  // what SystemBars.injectSafeAreaCSS runs in the WebView, with a phone's status bar and gesture bar
  await page.evaluate(() => {
    document.documentElement.style.setProperty('--safe-area-inset-top', '32px');
    document.documentElement.style.setProperty('--safe-area-inset-bottom', '24px');
  });
  await page.waitForFunction(() => (window as any).__safeTop === 32 && (window as any).__safeBottom === 24, null, { timeout: 5000 });
  // the vault restarts, as on a resize (Phaser restarts the same scene object), and lays out with the insets
  await page.waitForFunction(() => (window as any).__vault?.safeTop > 0 && (window as any).__vault?.hud?.active, null, { timeout: 10_000 });
  await page.waitForTimeout(600);
  const after = await layout(page);
  expect(after.hudY).toBeGreaterThan(before.hudY);
  expect(after.dockY).toBeLessThan(before.dockY);
  await page.screenshot({ path: 'screenshots/qa/ab4723-insets-phone.png' });
  expect(errors).toEqual([]);
});
