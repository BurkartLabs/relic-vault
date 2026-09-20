import { test, expect, Page } from '@playwright/test';

/**
 * Default-FAIL smoke checklist (Orchestrata CADENCE: QA smoke on every preview).
 * Every test drives the production build in a phone-sized headless Edge.
 */

async function boot(page: Page, age: 'adult' | 'minor' = 'adult', errors: string[] = []) {
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/');
  const gate = page.locator(`#age-gate button[data-a="${age}"]`);
  if (await gate.count().catch(() => 0)) await gate.click();
  else await page.waitForTimeout(500).then(async () => { if (await gate.count()) await gate.click(); });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  // let the onboarding camera punch settle
  await page.waitForFunction(() => { const c = (window as any).__vault.cameras.main; return Math.abs(c.zoom - 1) < 0.001 && Math.abs(c.scrollX) < 1; }, null, { timeout: 8000 });
  return errors;
}

async function toCss(page: Page, x: number, y: number) {
  return page.evaluate(([x, y]) => {
    const r = document.querySelector('#game canvas')!.getBoundingClientRect();
    const g = (window as any).__game;
    return { x: r.left + (x / g.scale.width) * r.width, y: r.top + (y / g.scale.height) * r.height };
  }, [x, y]);
}
async function tapForge(page: Page) {
  const f = await page.evaluate(() => { const v = (window as any).__vault; return { x: v.forgeBtn.x, y: v.forgeBtn.y }; });
  const p = await toCss(page, f.x, f.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(420);
}
async function dragCells(page: Page, a: number, b: number) {
  const [pa, pb] = await page.evaluate(([a, b]) => [(window as any).__vault.cellPos(a), (window as any).__vault.cellPos(b)], [a, b]);
  const p = await toCss(page, pa.x, pa.y), q = await toCss(page, pb.x, pb.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) { await page.mouse.move(p.x + (q.x - p.x) * i / 8, p.y + (q.y - p.y) * i / 8); await page.waitForTimeout(16); }
  await page.mouse.up();
  await page.waitForTimeout(350);
}
const state = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as any).__rv.state)));
const modalName = (page: Page) => page.evaluate(() => (window as any).__vault.modal?.kind ?? null);
const events = (page: Page) => page.evaluate(() => (window as any).__rv.telemetry.buf.map((e: any) => e.event));

test('clean boot: vault renders, no console errors, app_open fires', async ({ page }) => {
  const errors = await boot(page);
  const s = await state(page);
  expect(s.board.filter((t: number) => t > 0)).toEqual([1]); // cold vault, one T1
  expect(await events(page)).toContain('app_open');
  await page.screenshot({ path: 'screenshots/qa/boot.png' });
  expect(errors).toEqual([]);
});

test('first verb by touch: forge + drag-merge, verb_first, welcome pack exactly once', async ({ page }) => {
  const errors = await boot(page);
  await tapForge(page);
  let s = await state(page);
  expect(s.stats.forges).toBe(1);
  const ones = s.board.map((t: number, i: number) => (t === 1 ? i : -1)).filter((i: number) => i >= 0);
  expect(ones.length).toBe(2);
  await dragCells(page, ones[0], ones[1]);
  s = await state(page);
  expect(s.stats.merges).toBe(1);
  expect(s.board.filter((t: number) => t === 2).length).toBe(1);
  const ev = await events(page);
  expect(ev).toContain('verb_first');
  expect(ev).toContain('merge');
  // keeper line, then welcome pack after the beat
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'KeeperDialog', null, { timeout: 5000 });
  await page.evaluate(() => (window as any).__vault.modal.close());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'WelcomePack', null, { timeout: 6000 });
  await page.screenshot({ path: 'screenshots/qa/welcome.png' });
  await page.evaluate(() => (window as any).__vault.modal.close());
  // reload + merge again: must not re-open
  await page.evaluate(() => (window as any).__rv.persistNow());
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  await page.evaluate(() => { const s = (window as any).__rv.state; s.board[0] = 1; s.board[1] = 1; (window as any).__vault.syncBoard(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => (window as any).__vault.doMerge(0, 1));
  await page.waitForTimeout(2500);
  expect(await modalName(page)).not.toBe('WelcomePack');
  expect(errors).toEqual([]);
});

test('reload restores the exact board', async ({ page }) => {
  await boot(page);
  for (let i = 0; i < 6; i++) await tapForge(page);
  const before = (await state(page)).board;
  await page.evaluate(() => (window as any).__rv.persistNow());
  await page.waitForTimeout(500);
  await page.reload();
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  expect((await state(page)).board).toEqual(before);
});

test('a full dais says so and fades, and the advice it gives is true', async ({ page }) => {
  // Board, #441: the full-screen Vault Jammed sheet is gone. It offered to sell a way out of a state the player
  // can almost always clear themselves, which is why this test now checks the opposite: nothing opens, the
  // player is told, and the one thing the line tells them to do actually works.
  const errors = await boot(page);
  await page.evaluate(() => { (window as any).__rv.state.flags.tut = 3; (window as any).__vault.debugFill(); });
  await tapForge(page);
  await page.waitForFunction(() => !!(window as any).__vault.lastToast, null, { timeout: 4000 });

  expect(await events(page)).toContain('board_full'); // the friction is still measured
  expect(await modalName(page)).toBeNull(); // and play is never stopped to sell the way out of it
  expect(await page.evaluate(() => (window as any).__vault.lastToast)).toBe('The dais is full. Merge two of a kind to make room.');
  await page.screenshot({ path: 'screenshots/qa/board-full.png' });

  // "Merge two of a kind to make room" has to be true, not just reassuring
  const pair = await page.evaluate(() => (window as any).__vault.pair as [number, number] | null);
  expect(pair).not.toBeNull();
  const full = await state(page);
  expect(full.board.filter((t: number) => t === 0).length).toBe(0);

  await dragCells(page, pair![0], pair![1]);
  const after = await state(page);
  expect(after.board.filter((t: number) => t === 0).length).toBe(1);

  const forgesBefore = after.stats.forges;
  await tapForge(page);
  expect((await state(page)).stats.forges).toBe(forgesBefore + 1);
  expect(errors).toEqual([]);
});

test('no cooldown: 60 rapid core actions are never refused', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => { (window as any).__rv.state.flags.tut = 3; });
  const refused = await page.evaluate(() => {
    const v = (window as any).__vault, s = (window as any).__rv.state;
    let refused = 0;
    for (let i = 0; i < 60; i++) {
      const pair = v.pair;
      if (pair) { const m = s.stats.merges; v.doMerge(pair[0], pair[1]); if (s.stats.merges !== m + 1) refused++; }
      else if (s.board.some((t: number) => t === 0)) { const f = s.stats.forges; v.doForge(); if (s.stats.forges !== f + 1) refused++; }
      else { v.sellAt(s.board.findIndex((t: number) => t > 0)); }
    }
    return refused;
  });
  expect(refused).toBe(0);
});

test('every demo SKU grants its entitlement and is logged', async ({ page }) => {
  await boot(page);
  const skus = ['gems200', 'gems500', 'gems1200', 'noads', 'vip', 'pass', 'comeback', 'welcome', 'piggy'];
  for (const sku of skus) {
    await page.evaluate(() => { const rv = (window as any).__rv; rv.state.piggy = 250; (window as any).__vault.modal?.close(); });
    await page.waitForTimeout(250);
    await page.evaluate((sku) => (window as any).__vault.buy(sku, 'qa'), sku);
    await page.waitForTimeout(700);
  }
  const s = await state(page);
  expect(s.ent.removeAds && s.ent.vip && s.ent.passPremium && s.ent.comeback && s.ent.welcome).toBe(true);
  expect(s.purchases.map((p: any) => p.sku).sort()).toEqual([...skus].sort());
  const ev = await events(page);
  expect(ev.filter((e: string) => e === 'purchase_demo').length).toBe(skus.length);
  const ring = await page.evaluate(() => (window as any).__rv.analytics.buf.filter((e: any) => e.type === 'iap_click'));
  expect(ring.length).toBe(skus.length);
  for (const r of ring) for (const k of ['sku', 'trigger', 'sessionSeconds', 'rank', 'gems', 'gold']) expect(r).toHaveProperty(k);
});

test('under-16 path: random paid chests are off, exact offers remain', async ({ page }) => {
  const errors = await boot(page, 'minor');
  const s = await state(page);
  expect(s.age).toBe('minor');
  // the gem chest is the only random paid item left (#332): a minor's gems must not buy it
  await page.evaluate(() => { (window as any).__rv.state.gems = 500; (window as any).__vault.openChest('gems', 'qa'); });
  await page.waitForTimeout(600);
  const after = await state(page);
  expect(after.stats.chests).toBe(0);
  expect(after.gems).toBe(500);
  await page.evaluate(() => (window as any).__vault.openShop('qa', 'chest'));
  await page.waitForTimeout(900);
  await page.screenshot({ path: 'screenshots/qa/minor-shop.png' });
  expect(errors).toEqual([]);
});

test('chest odds are visible before spend', async ({ page }) => {
  await boot(page);
  await page.evaluate(() => (window as any).__vault.openShop('qa', 'chest'));
  await page.waitForTimeout(800);
  const texts = await page.evaluate(() => {
    const out: string[] = [];
    const walk = (o: any) => { if (o.text) out.push(o.text); (o.list || []).forEach(walk); };
    walk((window as any).__vault.modal);
    return out.join(' | ');
  });
  expect(texts).toMatch(/40%/);
  expect(texts).toMatch(/ODDS/);
});

test('telemetry reaches a real sink: app_open and verb_first arrive at the collector', async ({ page, request }) => {
  await boot(page);
  await page.evaluate(() => { (window as any).__rv.state.flags.tut = 3; });
  const sid = await page.evaluate(() => (window as any).__rv.telemetry.sessionId);
  await tapForge(page);
  const pair = await page.evaluate(() => (window as any).__vault.pair);
  await dragCells(page, pair[0], pair[1]);
  await page.waitForTimeout(1200);
  const lines = await (await request.get('http://127.0.0.1:8788/stats')).json();
  expect(lines.counts.app_open).toBeGreaterThan(0);
  expect(lines.counts.verb_first).toBeGreaterThan(0);
  expect(lines.sessions).toBeGreaterThan(0);
  void sid;
});

test('minor buying every SKU receives zero random rolls', async ({ page }) => {
  await boot(page, 'minor');
  for (const sku of ['welcome', 'pass', 'vip', 'gems500', 'comeback', 'noads']) {
    await page.evaluate(() => (window as any).__vault.modal?.close());
    await page.waitForTimeout(200);
    await page.evaluate((sku) => (window as any).__vault.buy(sku, 'qa'), sku);
    await page.waitForTimeout(650);
  }
  await page.evaluate(() => { const rv = (window as any).__rv; rv.state.pass.xp = 30 * 20; });
  const s = await state(page);
  expect(s.stats.chests).toBe(0);
  expect(s.freeChests).toBe(0);
  const auto = await page.evaluate(() => (window as any).__rv.analytics.buf.filter((e: any) => e.type === 'offer_impression' && !String(e.offer).startsWith('shop')).length);
  expect(auto).toBe(0);
});

test('patron order: tapping a complete card delivers the relics and pays', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { const rv = (window as any).__rv; rv.state.flags.tut = 3; const o = rv.state.orders[0]; rv.state.board = rv.state.board.map(() => 0); o.want.forEach((id: number, i: number) => { rv.state.board[i] = id; }); (window as any).__vault.syncBoard(); });
  await page.waitForTimeout(400);
  const before = await state(page);
  const a = await page.evaluate(() => (window as any).__vault.orders.anchor(0));
  const p = await toCss(page, a.x, a.y);
  await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(1500);
  const after = await state(page);
  expect(after.stats.orders).toBe(1);
  expect(after.gold).toBeGreaterThan(before.gold);
  expect(after.board.filter((t: number) => t > 0).length).toBe(0);
  expect(after.orders[0].id).not.toBe(before.orders[0].id);
  expect(await events(page)).toContain('order_filled');
  await page.screenshot({ path: 'screenshots/qa/order-filled.png' });
  expect(errors).toEqual([]);
});

test('the Keeper points out patron orders once, the first time one can be filled (Board, #327)', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { const rv = (window as any).__rv; rv.state.flags.tut = 3; const o = rv.state.orders[0]; rv.state.board = rv.state.board.map(() => 0); o.want.forEach((id: number, i: number) => { rv.state.board[i] = id; }); (window as any).__vault.syncBoard(); (window as any).__vault.afterAction(); });
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'KeeperDialog', null, { timeout: 5000 });
  const said = await page.evaluate(() => { const out: string[] = []; const walk = (o: any) => { if (o.text) out.push(o.text); (o.list || []).forEach(walk); }; walk((window as any).__vault.modal); return out.join(' '); });
  expect(said).toMatch(/patron/i);
  expect((await state(page)).flags.hint_orders).toBe(1);
  await page.evaluate(() => { (window as any).__vault.modal.close(); (window as any).__rv.persistNow(); });
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  await page.evaluate(() => (window as any).__vault.afterAction());
  await page.waitForTimeout(1200);
  expect(await modalName(page)).not.toBe('KeeperDialog');
  expect(errors).toEqual([]);
});

test('binding: a top-tier merge without its binding is refused and the relic returns', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { const s = (window as any).__rv.state; s.flags.tut = 3; s.board = s.board.map(() => 0); s.board[0] = 6; s.board[1] = 6; (window as any).__vault.syncBoard(); });
  await page.waitForTimeout(300);
  await dragCells(page, 0, 1);
  let s = await state(page);
  expect(s.board[0]).toBe(6); expect(s.board[1]).toBe(6);
  expect(await events(page)).toContain('binding_missing');
  await page.evaluate(() => { const s = (window as any).__rv.state; s.board[10] = 13; (window as any).__vault.syncBoard(); });
  await page.waitForTimeout(300);
  await dragCells(page, 0, 1);
  s = await state(page);
  expect(s.board[1]).toBe(7);
  expect(s.board[10]).toBe(0);
  expect(errors).toEqual([]);
});

test('the Crypt Brazier wakes at rank 3 and forges crypt relics', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => { const s = (window as any).__rv.state; s.flags.tut = 3; s.xp = 0; s.rank = 2; });
  // go through the real rank-up path: an order worth enough XP
  await page.evaluate(() => { const rv = (window as any).__rv; rv.state.xp = 0; rv.state.rank = 2; rv.state.gens = [1, 0, 0]; const o = rv.state.orders[0]; o.xp = 5000; rv.state.board = rv.state.board.map(() => 0); o.want.forEach((id: number, i: number) => { rv.state.board[i] = id; }); (window as any).__vault.syncBoard(); (window as any).__vault.onOrderTap(0); });
  await page.waitForTimeout(2500);
  const s = await state(page);
  expect(s.rank).toBeGreaterThanOrEqual(3);
  expect(s.gens[1]).toBe(1);
  await page.evaluate(() => (window as any).__vault.modal?.close());
  await page.waitForTimeout(400);
  const forges = s.stats.forges;
  await page.evaluate(() => (window as any).__vault.doForge(1));
  const s2 = await state(page);
  expect(s2.stats.forges).toBe(forges + 1);
  expect(s2.board.some((t: number) => t >= 11 && t <= 13)).toBe(true);
  expect(await events(page)).toContain('chain_unlock');
  await page.screenshot({ path: 'screenshots/qa/crypt-awake.png' });
  expect(errors).toEqual([]);
});
