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

test('going to the background mid-drag puts the relic home, and the board comes back exactly (AB#4728)', async ({ page }) => {
  await boot(page);
  for (let i = 0; i < 6; i++) await tapForge(page);
  const before = (await state(page)).board;
  const from = before.findIndex((t: number) => t > 0);
  const [pa, pb] = await page.evaluate(([a, b]) => [(window as any).__vault.cellPos(a), (window as any).__vault.cellPos(b)], [from, (from + 7) % before.length]);
  const p = await toCss(page, pa.x, pa.y), q = await toCss(page, pb.x, pb.y);
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 4; i++) { await page.mouse.move(p.x + (q.x - p.x) * i / 8, p.y + (q.y - p.y) * i / 8); await page.waitForTimeout(16); }
  expect(await page.evaluate(() => (window as any).__vault.isDragging)).toBe(true);
  // the app goes to the background, as Android pausing it or a hidden tab: the same visibilitychange
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: true, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await page.evaluate(() => (window as any).__vault.isDragging)).toBe(false);
  await page.mouse.up(); // the finger that was still down lands nowhere
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { value: false, configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(400);
  expect((await state(page)).board).toEqual(before);
  await page.waitForTimeout(500); // the save written on the way out, then a cold start, as Android killing the app would be
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
  // The shop sells the gem chest, so its own table must be on screen before the spend (AB#380): 55% Star-Metal Ark.
  expect(texts).toMatch(/Star-Metal Ark 55%/);
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

/** Every string drawn in the open modal, from the Phaser text objects themselves. */
const modalTexts = (page: Page) => page.evaluate(() => {
  const out: string[] = [];
  const walk = (o: any) => { if (o?.type === 'Text') out.push(o.text); for (const c of o?.list ?? []) walk(c); };
  walk((window as any).__vault.modal.box);
  return out.join('\n');
});

for (const age of ['adult', 'minor'] as const) {
  test(`the Welcome ribbon and the sentence explaining it agree, in the modal and the shop: ${age} (Bug #678, #751)`, async ({ page }) => {
    const errors = await boot(page, age);
    await page.evaluate(() => (window as any).__vault.showOffer({ id: 'welcome', trigger: 'qa', delayMs: 0 }));
    await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'WelcomePack', null, { timeout: 6000 });
    const modal = await modalTexts(page);
    await page.evaluate(() => (window as any).__vault.modal.close());
    await page.waitForTimeout(300);
    await page.evaluate(() => (window as any).__vault.openShop('qa'));
    await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'ShopModal', null, { timeout: 6000 });
    const shop = await modalTexts(page);

    const pct = Number(modal.match(/(\d+)% VALUE/)![1]);
    const counted = modal.match(/counts its [A-Za-z ]+ at (\d+) gems/);
    expect(counted, 'the modal says what the chest was counted as').not.toBeNull();
    expect(shop).toContain(`${pct}% VALUE`);
    expect(shop).toContain(counted![0]); // one sentence, one number, both screens
    expect(modal).not.toMatch(/at 40 gems|\$4\.99 pack/);
    // The ribbon reproduces from what the two screens state: the pack's gems and price, the baseline's rate.
    const gems = Number(modal.match(/^(\d+)$/m)![1]);
    const price = Number(modal.match(/^\$(\d+\.\d\d)$/m)![1]);
    const rate = Number(shop.match(/\((\d+\.\d) gems\/\$\)/)![1]);
    const baseline = modal.match(/against the (\$\d+\.\d\d) pack/)![1];
    expect(shop).toContain(`against the ${baseline} pack`);
    expect(Math.abs(Math.round(((gems + Number(counted![1])) / price / rate) * 100) - pct)).toBeLessThanOrEqual(1);
    expect(errors).toEqual([]);
  });
}

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

test('the Keeper asks, the seal turns green, and the Chronicle pays out', async ({ page }) => {
  // docs/STORY.md: the badge on the Keeper's portrait, and the main line behind it
  const errors = await boot(page);
  // Bug #1819: the first forge an order can take schedules the Keeper's orders hint 500 ms later, and if it opens
  // before the tap below, the tap reaches the hint and the Chronicle never opens. Orders are random, so only some runs
  // scheduled it, and only a loaded machine let it win (1 in 20 under load). The hint is not this test's subject: it
  // is marked seen, and an order that wants the forged relic is set so the worst case runs every time.
  await page.evaluate(() => {
    const s = (window as any).__rv.state;
    s.flags.tut = 3;
    s.flags.hint_orders = 1;
    s.orders[0].want = [1];
  });

  // the first quest asks for 12 forges. Do them through the real generator button.
  const need = await page.evaluate(() => (window as any).__vault.currentQuestGoal());
  for (let i = 0; i < need; i++) {
    await page.evaluate(() => { const v = (window as any).__vault; v.debugClear(); v.doForge(); });
  }
  await page.waitForFunction(() => (window as any).__vault.bubbleState() === 'ready', null, { timeout: 4000 });
  expect(await page.evaluate(() => (window as any).__vault.modal?.kind ?? null)).toBe(null); // nothing between the player and the Keeper
  await page.screenshot({ path: 'screenshots/qa/keeper-ready.png' });

  // tapping the Keeper opens the Chronicle
  await page.evaluate(() => (window as any).__vault.keeperBtn.emit('pointerup'));
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'ChronicleModal', null, { timeout: 4000 });
  await page.waitForTimeout(500); // let the pop-in settle: a screenshot mid-tween is not what a player sees
  await page.screenshot({ path: 'screenshots/qa/chronicle.png' });

  const goldBefore = (await state(page)).gold;
  await page.evaluate(() => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => o?.label?.text === 'CLAIM' ? o : (o?.list ?? []).map(find).find(Boolean);
    find(m.box).onClick();
  });
  // the beat is delivered by the Keeper himself, then the reward flies in
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'KeeperDialog', null, { timeout: 4000 });
  await page.screenshot({ path: 'screenshots/qa/chronicle-beat.png' });
  await page.evaluate(() => (window as any).__vault.modal?.close());
  // the beat's close hands over to the reward fly-in; wait for the scene to be clear again, not for a fixed time
  await page.waitForFunction(() => (window as any).__vault.modal === null, null, { timeout: 4000 });

  const s = await state(page);
  expect(s.chronicle.claimed).toContain(0);
  expect(s.gold).toBeGreaterThan(goldBefore);
  expect(await events(page)).toContain('chronicle_claim');
  expect(await page.evaluate(() => (window as any).__vault.bubbleState())).toBe('active'); // on to the next
  expect(errors).toEqual([]);
});

test('clearing a floor opens two doors, and descending changes the ladder', async ({ page }) => {
  // docs/ROOMS.md: ascending the capstone clears the floor; both doors are free and neither is forced
  const errors = await boot(page);
  await page.evaluate(() => {
    const rv = (window as any).__rv, v = (window as any).__vault;
    rv.state.flags.tut = 3;
    v.debugClear();
    const cap = v.capstone();
    rv.state.board[0] = cap; rv.state.board[1] = cap;
    v.syncBoard();
  });
  await dragCells(page, 0, 1);
  await page.waitForTimeout(900);
  expect((await state(page)).clears[0]).toBeGreaterThan(0);

  // an ascension celebrates, and the Keeper will not talk over another sheet, so wait for a clear screen
  for (let i = 0; i < 12; i++) {
    const open = await modalName(page);
    if (!open) break;
    await page.evaluate(() => (window as any).__vault.modal?.close());
    await page.waitForTimeout(350);
  }
  expect(await modalName(page)).toBeNull();
  await page.evaluate(() => (window as any).__vault.offerFloorDoors());
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'FloorDoorsModal', null, { timeout: 6000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/qa/floor-doors.png' });

  const chainBefore = await page.evaluate(() => (window as any).__vault.chainOfSlot(0));
  await page.evaluate(() => {
    const m = (window as any).__vault.modal;
    const find = (o: any): any => o?.label?.text === 'GO DOWN' ? o : (o?.list ?? []).map(find).find(Boolean);
    find(m.box).onClick();
  });
  // the scene restarts on arrival, so wait for the new one to come up
  await page.waitForFunction(() => !!(window as any).__vault?.hud, null, { timeout: 15_000 });
  await page.waitForTimeout(600);

  const s = await state(page);
  expect(s.floor).toBe(1);
  expect(await page.evaluate(() => (window as any).__vault.chainOfSlot(0))).not.toBe(chainBefore);
  expect(await events(page)).toContain('floor_descend');

  // the floor's own generator forges the new floor's relics, not the old ones
  const forges = s.stats.forges;
  await page.evaluate(() => (window as any).__vault.doForge());
  const s2 = await state(page);
  expect(s2.stats.forges).toBe(forges + 1);
  expect(s2.board.some((id: number) => id >= 31 && id <= 39)).toBe(true);

  /**
   * And they are actually *drawn*. The board atlas only holds the floor you are on, so a floor change that
   * forgot to re-lay it would leave every socket empty with nothing in the console — the relics would be in the
   * save and invisible on screen, which is the failure this whole feature is most exposed to.
   */
  await page.evaluate(() => {
    const rv = (window as any).__rv, v = (window as any).__vault;
    [31, 33, 33, 35, 39].forEach((id, i) => { rv.state.board[i] = id; });
    v.syncBoard();
  });
  await page.waitForTimeout(900);
  const drawn = await page.evaluate(() => {
    const v = (window as any).__vault;
    return v.relics.filter(Boolean).map((r: any) => ({ frame: r.spr.frame.name, w: r.spr.displayWidth, visible: r.spr.visible }));
  });
  expect(drawn.length).toBeGreaterThanOrEqual(5);
  for (const d of drawn) {
    expect(d.frame, 'a relic with no atlas frame draws nothing').toMatch(/^r\d+_\d$/);
    expect(d.visible).toBe(true);
    expect(d.w).toBeGreaterThan(20);
  }
  await page.screenshot({ path: 'screenshots/qa/floor-2.png' });
  expect(errors).toEqual([]);
});

// Bug #2036: an unreadable save's Keeper line (about 180 characters, six lines) ran over "tap to continue". The repro is
// the Bug's: a save that migrate() cannot read, in a fresh browser (no IndexedDB copy), through the age gate.
test('the unreadable-save Keeper line and its "tap to continue" hint do not overlap (Bug #2036)', async ({ page }) => {
  await page.addInitScript(() => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('relic-vault-save', '{"v":1,"board":12345}'); sessionStorage.setItem('seeded', '1'); } });
  // Not boot(): on this path the age gate shows after the save has been read, later than boot() looks for it.
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.locator('#age-gate button[data-a="adult"]').click({ timeout: 20_000 });
  await page.waitForFunction(() => { const m = (window as any).__vault?.modal; return m?.kind === 'KeeperDialog' && JSON.stringify((m.box.list || []).map((o: any) => o.text)).includes('cannot read'); }, null, { timeout: 30_000 });
  await page.waitForTimeout(400); // the dialog's open tween
  const b = await page.evaluate(() => {
    const list = (window as any).__vault.modal.box.list as any[];
    const box = (o: any) => { const r = o.getBounds(); return { top: r.top, bottom: r.bottom }; };
    return { line: box(list.find((o) => String(o.text || '').includes('cannot read'))), hint: box(list.find((o) => o.text === 'tap to continue')), frame: box((window as any).__vault.modal.frame.list[0]) };
  });
  await page.screenshot({ path: 'screenshots/qa/keeper-unreadable.png' });
  expect(b.hint.top, 'the hint starts below the line').toBeGreaterThanOrEqual(b.line.bottom);
  expect(b.line.top, 'the line starts inside the dialog').toBeGreaterThanOrEqual(b.frame.top);
  expect(b.hint.bottom, 'the hint ends inside the dialog').toBeLessThanOrEqual(b.frame.bottom);
  expect(errors).toEqual([]);
});

// Bug #2025: the ?debug=1 panel's "jammed" button called an offer id AB#441 removed and did nothing. Its offer buttons
// open what they name, and "board full" shows the line that replaced Vault Jammed.
test("the debug panel's offer buttons open what they name (Bug #2025)", async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?debug=1');
  await page.locator('#age-gate button[data-a="adult"]').click({ timeout: 20_000 });
  await page.waitForFunction(() => (window as any).__vault?.hud, null, { timeout: 30_000 });
  await page.evaluate(() => { (window as any).__rv.state.flags.tut = 3; (window as any).__vault.modal?.close(); });
  await page.waitForTimeout(400);
  const panel = page.locator('#rv-debug');
  await expect(panel.getByRole('button', { name: 'jammed' })).toHaveCount(0);
  await panel.getByRole('button', { name: 'comeback', exact: true }).click();
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'OfferSheet', null, { timeout: 5000 });
  await page.waitForTimeout(500); // the sheet's open tween
  await page.screenshot({ path: 'screenshots/qa/debug-comeback.png' });
  await page.evaluate(() => (window as any).__vault.modal.close());
  await page.waitForTimeout(400);
  await panel.getByRole('button', { name: 'board full', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__vault.lastToast)).toBe('The dais is full. Merge two of a kind to make room.');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/qa/debug-board-full.png' });
  expect(errors).toEqual([]);
});

// RV-M2a (AB#381): the shop's Power-ups section, an Auto-Merge bought and used, and a merge a Stand-in completes.
test('power-ups: bought in the shop, Auto-Merge merges every pair, a Stand-in completes a merge (AB#381)', async ({ page }) => {
  const errors = await boot(page);
  await page.evaluate(() => {
    const rv = (window as any).__rv, v = (window as any).__vault;
    rv.state.flags.tut = 3; rv.state.gems = 200; v.modal?.close();
  });
  await page.waitForTimeout(400);
  await page.evaluate(() => (window as any).__vault.openShop('qa'));
  await page.waitForFunction(() => (window as any).__vault.modal?.kind === 'ShopModal', null, { timeout: 5000 });
  const scrollToPowerUps = () => page.evaluate(() => { const m = (window as any).__vault.modal; m.sc.scrollTo(m.anchors.powerups - 20); });
  await scrollToPowerUps();
  await page.waitForTimeout(400);
  const said = await page.evaluate(() => { const out: string[] = []; const walk = (o: any) => { if (o.text) out.push(o.text); (o.list || []).forEach(walk); }; walk((window as any).__vault.modal); return out.join(' | '); });
  expect(said).toContain('POWER-UPS');
  expect(said).toContain('AUTO-MERGE');
  expect(said).toContain('CANDLE SKULL STAND-IN');
  await page.screenshot({ path: 'screenshots/qa/powerups-shop.png' });

  // buy one Auto-Merge and a Candle Skull Stand-in through the shop's own handlers
  const before = (await state(page)).gems;
  await page.evaluate(() => { const m = (window as any).__vault.modal; m.buyPowerUp('auto'); });
  await page.evaluate(() => { const m = (window as any).__vault.modal; m.buyPowerUp(13); });
  const after = await state(page);
  expect(after.powerUps.autoMerge).toBe(1);
  expect(after.powerUps.standIn['13']).toBe(1);
  expect(before - after.gems).toBeGreaterThan(0);
  await page.waitForTimeout(400);
  await page.screenshot({ path: 'screenshots/qa/powerups-bought.png' });

  // a board with pairs, then USE from the shop
  await page.evaluate(() => { const rv = (window as any).__rv, v = (window as any).__vault; rv.state.board = rv.state.board.map(() => 0); [2, 2, 2, 2, 3, 3, 4].forEach((t: number, i: number) => { rv.state.board[i] = t; }); v.syncBoard(); });
  await page.evaluate(() => (window as any).__vault.modal.useAutoMerge());
  await page.waitForTimeout(900);
  const merged = await state(page);
  expect(merged.powerUps.autoMerge).toBe(0);
  expect(merged.board.filter((t: number) => t).sort()).toEqual([3, 3, 4, 4]);
  expect(await page.evaluate(() => (window as any).__vault.lastToast)).toBe('Auto-Merge: 3 merges.');
  await page.screenshot({ path: 'screenshots/qa/powerups-auto-merge.png' });

  // two Emerald Scarabs (T6) and no Candle Skull: dragging one onto the other merges through the Stand-in
  await page.evaluate(() => { const rv = (window as any).__rv, v = (window as any).__vault; rv.state.board = rv.state.board.map(() => 0); rv.state.board[7] = 6; rv.state.board[8] = 6; v.syncBoard(); });
  // the So Close offer answers two Scarabs on the board; it is not what this checks
  await page.waitForTimeout(1500);
  await page.evaluate(() => (window as any).__vault.modal?.close());
  await page.waitForTimeout(500);
  // every toast, since a card drop from the same merge can follow the Stand-in's and take lastToast
  await page.evaluate(() => { const v = (window as any).__vault, t = v.toast.bind(v); (window as any).__toasts = []; v.toast = (m: string) => { (window as any).__toasts.push(m); return t(m); }; });
  await dragCells(page, 7, 8);
  await page.waitForTimeout(500);
  const bound = await state(page);
  expect(bound.board[8]).toBe(7);
  expect(bound.powerUps.standIn['13']).toBeUndefined();
  expect(await page.evaluate(() => (window as any).__toasts)).toContain("A Stand-in took the Candle Skull's place.");
  await page.screenshot({ path: 'screenshots/qa/powerups-stand-in.png' });
  expect(errors).toEqual([]);
});
