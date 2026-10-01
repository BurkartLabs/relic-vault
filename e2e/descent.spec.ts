import { test, expect, Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * AB#444 slice 4: descending is a transition, not a cut (docs/specs/444-..., acceptance 5 and 7). Ten descend/restore
 * cycles through the real doors, each held to exactly what descend()/restore() leave (the vault's predictFloorChange
 * runs the pure code on a copy first), and to the input budget: the transition never holds input past 4 s.
 */
mkdirSync('screenshots/qa', { recursive: true });

async function boot(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  // a relic the board atlas cannot draw (a memento from the floor above, before AB#444 s4) only warns in the console
  page.on('console', (m) => { if (/has no frame/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.goto('/');
  const gate = page.locator('#age-gate button[data-a="adult"]');
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  await page.waitForFunction(() => { const c = (window as any).__vault.cameras.main; return Math.abs(c.zoom - 1) < 0.001 && Math.abs(c.scrollX) < 1; }, null, { timeout: 8000 });
  await page.evaluate(() => { (window as any).__rv.state.flags.tut = 3; });
  return errors;
}

/** Clear the current floor with three relics on the board, open the doors, and return what the chosen door predicts. */
async function openDoors(page: Page, kind: 'descend' | 'restore') {
  // an arrival may still be talking (the Keeper's line, a discovery card): the doors wait for a clear screen
  await page.waitForTimeout(1100);
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!(window as any).__vault.modal))) break;
    await page.evaluate(() => (window as any).__vault.modal?.close());
    await page.waitForTimeout(300);
  }
  await page.evaluate(() => {
    const rv = (window as any).__rv, v = (window as any).__vault;
    v.debugClear();
    const cap = v.capstone();
    rv.state.clears[rv.state.floor ?? 0] = Math.max(1, rv.state.clears[rv.state.floor ?? 0] ?? 0);
    rv.state.board[0] = cap; rv.state.board[1] = cap - 1; rv.state.board[2] = cap - 2;
    v.syncBoard();
  });
  await page.evaluate(() => (window as any).__vault.offerFloorDoors());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'FloorDoorsModal', null, { timeout: 6000 });
  await page.waitForTimeout(250);
  return page.evaluate((k) => (window as any).__vault.predictFloorChange(k), kind);
}

/** Press the door's button, as a player does, and return when the transition has handed the vault back. */
async function goThrough(page: Page, kind: 'descend' | 'restore', { skipAt }: { skipAt?: number } = {}) {
  const label = kind === 'descend' ? 'GO DOWN' : 'BEGIN AGAIN';
  const before = await page.evaluate(() => ((window as any).__transitions ?? []).length);
  const clickedAt = await page.evaluate((l) => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => o?.label?.text === l ? o : (o?.list ?? []).map(find).find(Boolean);
    const t = performance.now();
    find(m.box).onClick();
    return t;
  }, label);
  if (skipAt !== undefined) {
    await page.waitForTimeout(skipAt);
    await page.evaluate(() => (window as any).__transition?.back());
  }
  await page.waitForFunction((n) => ((window as any).__transitions ?? []).length > n, before, { timeout: 8000 });
  const endedAt = await page.evaluate(() => performance.now());
  const t = await page.evaluate(() => (window as any).__transitions.at(-1));
  return { t, heldFor: endedAt - clickedAt };
}

const pick = (s: any) => ({ floor: s.floor ?? 0, renown: s.renown ?? 0, reliquary: [...(s.reliquary ?? [])].sort(), satchel: s.satchel ?? null });

test('ten descend/restore cycles leave exactly what descend()/restore() predict, and never hold input past 4 s', async ({ page }) => {
  test.setTimeout(180_000);
  const errors = await boot(page);
  const kinds: ('descend' | 'restore')[] = ['descend', 'restore', 'descend', 'descend', 'restore', 'descend', 'restore', 'restore', 'descend', 'restore'];
  for (const [i, kind] of kinds.entries()) {
    const predicted = await openDoors(page, kind);
    expect(predicted.ok, `cycle ${i + 1}: the ${kind} door is open`).toBe(true);
    const { t, heldFor } = await goThrough(page, kind);
    expect(heldFor, `cycle ${i + 1}: input held ${Math.round(heldFor)} ms`).toBeLessThan(4000);
    expect(t.kind).toBe(kind);
    expect(t.trace.map((x: any) => x.phase)).toEqual(expect.arrayContaining(['swap', 'ready', 'end']));
    // the board the new vault came up with is exactly the board the pure code left
    expect(t.boardAtArrival, `cycle ${i + 1}: board on arrival`).toEqual(predicted.board);
    const s = await page.evaluate(() => JSON.parse(JSON.stringify((window as any).__rv.state)));
    expect(pick(s), `cycle ${i + 1}: floor, Renown, Reliquary and satchel`).toEqual(pick(predicted));
    // the swap happened under the closed veil: after the relics lifted, before the new vault was ready
    const at = (p: string) => t.trace.find((x: any) => x.phase === p).at;
    expect(at('swap')).toBeLessThan(at('ready'));
  }
  expect(await page.evaluate(() => (window as any).__rv.state.floor)).toBe(5);
  expect(errors).toEqual([]);
});

test('a descent drops and builds the new floor in: its timing and frame rate, then three frames', async ({ page }) => {
  await page.setViewportSize({ width: 1080 / 2, height: 1920 / 2 });
  await boot(page);
  // a clean run first: nothing else on the page while it is timed (a screenshot stalls it)
  await openDoors(page, 'descend');
  await page.evaluate(() => { const w = window as any; w.__frames = 0; const tick = () => { w.__frames++; if (w.__counting) requestAnimationFrame(tick); }; w.__counting = true; requestAnimationFrame(tick); });
  const { t, heldFor } = await goThrough(page, 'descend');
  const fps = await page.evaluate((ms) => { const w = window as any; w.__counting = false; return Math.round(w.__frames / (ms / 1000)); }, heldFor);
  console.log(`[AB#444 s4] descent: ${Math.round(heldFor)} ms, ${fps} fps (headless Chromium on the build machine, not the DEVICE_QA phone); trace ${JSON.stringify(t.trace)}`);
  expect(t.trace.map((x: any) => x.phase)).toEqual(['start:descend', 'lift', 'drop', 'swap', 'ready', 'end']);
  const end = t.trace.at(-1).at;
  expect(end, 'the sequence itself is 2.5 to 3.5 s').toBeGreaterThanOrEqual(2500);
  expect(end).toBeLessThanOrEqual(3500);
  expect(heldFor).toBeLessThan(4000);

  // then the frames: the relics sinking into the Reliquary, the fall (the midpoint), and the new floor rising
  await openDoors(page, 'descend'); // the next floor down, cleared again by openDoors
  const run = goThrough(page, 'descend');
  let prev = 0;
  for (const [i, ms] of [600, 1200, 2300].entries()) {
    await page.waitForTimeout(ms - prev);
    prev = ms;
    await page.screenshot({ path: `screenshots/qa/ab444-s4-descend-${i + 1}.png` });
  }
  await run;
});

test('the midpoint at 375x812', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await boot(page);
  await openDoors(page, 'descend');
  const run = goThrough(page, 'descend');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: 'screenshots/qa/ab444-s4-descend-mid-375x812.png' });
  await run;
});

test('a restore is shorter and does not drop', async ({ page }) => {
  await boot(page);
  await openDoors(page, 'restore');
  const { t, heldFor } = await goThrough(page, 'restore');
  const phases = t.trace.map((x: any) => x.phase);
  expect(phases).not.toContain('drop');
  expect(phases).toContain('lift');
  expect(heldFor).toBeLessThan(2600);
});

test('reduced motion is a fade with the floor name: no lift, no drop', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await boot(page);
  await openDoors(page, 'descend');
  const { t, heldFor } = await goThrough(page, 'descend');
  expect(t.reduced).toBe(true);
  expect(t.trace.map((x: any) => x.phase)).toEqual(['start:reduced', 'swap', 'ready', 'end']);
  expect(heldFor).toBeLessThan(2200);
});

test('skip is refused before 1.2 s and ends the transition once the new floor is ready after it', async ({ page }) => {
  await boot(page);
  await openDoors(page, 'descend');
  const run = goThrough(page, 'descend', { skipAt: 1300 });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => (window as any).__transition.back()), 'back at 0.3 s is held').toBe(false);
  const { t, heldFor } = await run;
  expect(t.trace.map((x: any) => x.phase)).toContain('skip');
  expect(heldFor).toBeLessThan(2400);
});
