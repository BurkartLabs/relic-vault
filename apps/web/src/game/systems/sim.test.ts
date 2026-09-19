import { describe, it, expect } from 'vitest';
import { createState, migrate, SAVE_VERSION } from './State';
import { merge, canMerge } from './MergeSystem';
import { forge, rollForgeTier } from './ForgeSystem';
import { canForge, sell, empties, placeOrStash } from './BoardSystem';
import { applyPurchase } from './PurchaseService';
import { rollChest, openChest, gemClear, adSalvage, claimQuest, spinWheel, claimPass, claimEvent, fillCard, grantCard } from './Economy';
import { computeLuck } from './LuckSystem';
import { OfferDirector } from './OfferDirector';
import { mulberry32 } from './Rng';
import { grantReward, claimVipCrate, enforceChestRules } from './Economy';
import { welcomeOpen, welcomeDeadline, WELCOME_WINDOW_MS } from './Offers';
import { skuValuePct } from '../data/catalog';
import { ECON, SKUS, SkuId, CARDS, MAX_TIER } from '../data/catalog';

const rng = () => mulberry32(1234);
const fullBoard = (s: ReturnType<typeof createState>, t = 1) => { s.board = s.board.map((_, i) => ((i % 7) + t) % 8 + 1); };

describe('merge', () => {
  it('fuses two equal tiers into the next tier at the target', () => {
    const s = createState();
    s.board[0] = 3; s.board[1] = 3;
    const r = merge(s, 0, 1, rng());
    expect(r.ok).toBe(true);
    expect(s.board[0]).toBe(0);
    expect(s.board[1]).toBe(4);
    expect(r.gold).toBe(ECON.mergeGold[4]);
    expect(s.stats.merges).toBe(1);
    expect(s.quests.t4).toBe(1);
  });
  it('rejects mismatched, empty and self merges', () => {
    const s = createState();
    s.board[0] = 2; s.board[1] = 3;
    expect(merge(s, 0, 1, rng()).reason).toBe('mismatch');
    expect(merge(s, 0, 5, rng()).reason).toBe('empty');
    expect(merge(s, 0, 0, rng()).reason).toBe('same');
    expect(canMerge(s, 0, 1)).toBe(false);
  });
  it('ascends two max-tier relics into a jackpot and frees both sockets', () => {
    const s = createState();
    s.board[0] = MAX_TIER; s.board[1] = MAX_TIER;
    const g0 = s.gold, gem0 = s.gems;
    const r = merge(s, 0, 1, rng());
    expect(r.ascended).toBe(true);
    expect(s.board[0]).toBe(0);
    expect(s.board[1]).toBe(0);
    expect(s.gold - g0).toBe(ECON.ascendGold);
    expect(s.gems - gem0).toBeGreaterThanOrEqual(ECON.ascendGems);
  });
  it('fills the piggy, event points and pass xp', () => {
    const s = createState();
    s.board[0] = 5; s.board[1] = 5;
    merge(s, 0, 1, rng());
    expect(s.piggy).toBeGreaterThan(0);
    expect(s.event.points).toBe(ECON.eventPoints[6]);
    expect(s.pass.xp).toBe(ECON.passXp[6]);
  });
  it('boost doubles event points', () => {
    const s = createState();
    s.board[0] = 5; s.board[1] = 5;
    s.event.boostUntil = Date.now() + 60000;
    merge(s, 0, 1, rng());
    expect(s.event.points).toBe(ECON.eventPoints[6] * 2);
  });
  it('ranks up and grants gems', () => {
    const s = createState();
    const gems = s.gems;
    for (let i = 0; i < 6; i++) { s.board[0] = 6; s.board[1] = 6; merge(s, 0, 1, rng()); }
    expect(s.rank).toBeGreaterThan(1);
    expect(s.gems).toBeGreaterThan(gems);
  });
});

describe('forge', () => {
  it('boot board has exactly one T1', () => {
    const s = createState();
    expect(s.board.filter((t) => t > 0)).toEqual([1]);
  });
  it('places a relic in an empty socket', () => {
    const s = createState();
    const before = empties(s).length;
    const r = forge(s, rng());
    expect(r.ok).toBe(true);
    expect(s.board[r.index]).toBe(r.tier);
    expect(empties(s).length).toBe(before - 1);
    expect(s.stats.forges).toBe(1);
  });
  it('respects a preferred socket (tutorial) and forges T1 there', () => {
    const s = createState();
    const r = forge(s, rng(), 15);
    expect(r.index).toBe(15);
    expect(r.tier).toBe(1);
  });
  it('never throws on a full board: reports full so UI can open Vault Jammed', () => {
    const s = createState();
    fullBoard(s);
    expect(canForge(s)).toBe(false);
    const r = forge(s, rng());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('full');
  });
  it('luck shifts the tier distribution but stays capped', () => {
    const r = mulberry32(9);
    let hi = 0;
    for (let i = 0; i < 10000; i++) if (rollForgeTier(0.18, r) > 1) hi++;
    expect(hi / 10000).toBeGreaterThan(0.15);
    expect(hi / 10000).toBeLessThan(0.21);
    const s = createState();
    s.album = s.album.map(() => 1);
    s.ent.passPremium = true; s.ent.vip = true; s.rank = 50;
    expect(computeLuck(s)).toBe(ECON.luckCap);
  });
});

describe('sell & board-full recovery', () => {
  it('sells for gold', () => {
    const s = createState();
    s.board[3] = 4;
    const g = s.gold;
    const r = sell(s, 3);
    expect(r.ok).toBe(true);
    expect(s.gold - g).toBe(ECON.sellGold[4]);
    expect(s.board[3]).toBe(0);
    expect(sell(s, 3).ok).toBe(false);
  });
  it('gem-clear removes the lowest three and restores forging', () => {
    const s = createState();
    fullBoard(s);
    s.gems = 100;
    const r = gemClear(s);
    expect(r.cleared.length).toBe(3);
    expect(canForge(s)).toBe(true);
  });
  it('ad salvage removes one piece', () => {
    const s = createState();
    fullBoard(s);
    const r = adSalvage(s);
    expect(r.index).toBeGreaterThanOrEqual(0);
    expect(canForge(s)).toBe(true);
  });
  it('overflow goes to the satchel, never lost', () => {
    const s = createState();
    fullBoard(s);
    expect(placeOrStash(s, 5, rng())).toBe(-1);
    expect(s.satchel).toEqual([5]);
  });
});

describe('purchases', () => {
  const all = Object.keys(SKUS) as SkuId[];
  it('every SKU grants its entitlement in demo mode', () => {
    for (const sku of all) {
      const s = createState();
      s.piggy = 300;
      const before = JSON.stringify(s);
      const g = applyPurchase(s, sku, rng());
      expect(g.ok, sku).toBe(true);
      expect(JSON.stringify(s), sku).not.toBe(before);
      expect(s.purchases.at(-1)!.sku).toBe(sku);
    }
  });
  it('welcome pack: gems, gold, two T4 + one T3, free chest, one time only', () => {
    const s = createState();
    const g = applyPurchase(s, 'welcome', rng());
    expect(g.gems).toBe(120);
    expect(g.gold).toBe(800);
    expect(s.board.filter((t) => t === 4).length).toBe(2);
    expect(s.board.filter((t) => t === 3).length).toBe(1);
    expect(s.freeChests).toBe(1);
    expect(applyPurchase(s, 'welcome', rng()).ok).toBe(false);
  });
  it('piggy smash pays stored x4 + 15 gems and empties the pig', () => {
    const s = createState();
    s.piggy = 250;
    const g0 = s.gold, gem0 = s.gems;
    applyPurchase(s, 'piggy', rng());
    expect(s.gold - g0).toBe(1000);
    expect(s.gems - gem0).toBe(15);
    expect(s.piggy).toBe(0);
  });
  it('flags: pass, vip, noads raise luck / remove ads', () => {
    const s = createState();
    const l0 = computeLuck(s);
    applyPurchase(s, 'pass', rng());
    applyPurchase(s, 'vip', rng());
    applyPurchase(s, 'noads', rng());
    expect(s.ent.passPremium && s.ent.vip && s.ent.removeAds).toBe(true);
    expect(computeLuck(s)).toBeCloseTo(l0 + 0.06, 5);
  });
  it('minors cannot buy random paid chests', () => {
    const s = createState();
    s.age = 'minor';
    expect(applyPurchase(s, 'chest_cash', rng()).ok).toBe(false);
    s.gems = 999;
    expect(openChest(s, rng(), 'gems').reason).toBe('blocked');
    s.age = 'adult'; s.lootboxesAllowed = false;
    expect(openChest(s, rng(), 'gems').reason).toBe('blocked');
  });
});

describe('chests & pity', () => {
  it('rolls within the disclosed table', () => {
    const s = createState();
    const r = mulberry32(7);
    const counts: Record<number, number> = {};
    for (let i = 0; i < 20000; i++) { s.pity = 0; const t = rollChest(s, r).tier; counts[t] = (counts[t] || 0) + 1; }
    expect(Object.keys(counts).map(Number).every((t) => t >= 2 && t <= 6)).toBe(true);
    expect(counts[2] / 20000).toBeGreaterThan(0.35);
  });
  it('every 15th dry chest guarantees >= T4', () => {
    const s = createState();
    // Dry streak: rng picks T2 and fails the luck-upgrade roll.
    let n = 0;
    const dry = () => (n++ % 2 === 0 ? 0.0 : 0.99);
    for (let i = 0; i < 14; i++) {
      const r = rollChest(s, dry);
      expect(r.tier).toBeLessThan(4);
    }
    expect(s.pity).toBe(14);
    const r = rollChest(s, dry);
    expect(r.pityHit).toBe(true);
    expect(r.tier).toBeGreaterThanOrEqual(4);
    expect(s.pity).toBe(0);
  });
  it('gem chest costs 40 gems and places a relic', () => {
    const s = createState();
    s.gems = 40;
    const r = openChest(s, rng(), 'gems');
    expect(r.ok).toBe(true);
    expect(s.gems).toBe(0);
    expect(s.board[r.index]).toBe(r.tier);
    expect(openChest(s, rng(), 'gems').reason).toBe('gems');
  });
});

describe('meta', () => {
  it('quests claim once per day', () => {
    const s = createState();
    const now = Date.now();
    s.quests.forge = 10;
    expect(claimQuest(s, 0, now)).toBe(true);
    expect(claimQuest(s, 0, now)).toBe(false);
    expect(claimQuest(s, 1, now)).toBe(false);
  });
  it('wheel costs gems or an ad', () => {
    const s = createState();
    s.gems = 15;
    expect(spinWheel(s, rng(), 'gems').ok).toBe(true);
    expect(spinWheel(s, rng(), 'gems').ok).toBe(false);
    expect(spinWheel(s, rng(), 'ad').ok).toBe(true);
  });
  it('pass premium track requires the pass', () => {
    const s = createState();
    s.pass.xp = ECON.passXpPerTier * 3;
    expect(claimPass(s, 1, 'free', rng())).not.toBeNull();
    expect(claimPass(s, 1, 'prem', rng())).toBeNull();
    s.ent.passPremium = true;
    expect(claimPass(s, 1, 'prem', rng())).not.toBeNull();
    expect(claimPass(s, 4, 'free', rng())).toBeNull();
  });
  it('event milestones claim once', () => {
    const s = createState();
    s.event.points = 60;
    expect(claimEvent(s, 0, rng())).not.toBeNull();
    expect(claimEvent(s, 0, rng())).toBeNull();
    expect(claimEvent(s, 2, rng())).toBeNull();
  });
  it('album page completion', () => {
    const s = createState();
    s.album = s.album.map((_, i) => (i === 11 ? 0 : 1));
    s.gems = 80;
    const r = fillCard(s, rng())!;
    expect(r.id).toBe(11);
    expect(r.pageCompleted).toBe(0);
    expect(s.pagesDone[0]).toBe(true);
    expect(CARDS.length).toBe(36);
    const d = grantCard(s, () => 0);
    expect(d.duplicate).toBe(true); // album full -> duplicate pays gems
  });
  it('offer director: welcome after first merge exactly once', () => {
    const s = createState();
    const d = new OfferDirector(() => s);
    s.board[0] = 1; s.board[1] = 1;
    const r = merge(s, 0, 1, rng());
    d.onMerge(r);
    expect(d.next()?.id).toBe('welcome');
    d.onMerge(r);
    expect(d.queue.find((q) => q.id === 'welcome')).toBeUndefined();
  });
});

describe('save', () => {
  it('migrates a v1 save with null sockets', () => {
    const v1 = { v: 1, board: [null, 2, 2, null], gold: 99, gems: 7, passXp: 12, eventPoints: 40 };
    const s = migrate(v1);
    expect(s.v).toBe(SAVE_VERSION);
    expect(s.board.length).toBe(36);
    expect(s.board.slice(0, 4)).toEqual([0, 2, 2, 0]);
    expect(s.gold).toBe(99);
    expect(s.pass.xp).toBe(12);
  });
  it('round-trips exactly', () => {
    const s = createState();
    s.board[7] = 6; s.flags.tutorial = 3;
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.board).toEqual(s.board);
    expect(back.flags.tutorial).toBe(3);
  });
});

describe('no random rewards for minors / loot-box-free regions (Critic ITERATE #1)', () => {
  for (const setup of [(s: any) => { s.age = 'minor'; }, (s: any) => { s.lootboxesAllowed = false; }]) {
    it('every path that would give a chest gives an exact Gold Mask instead', () => {
      const s = createState();
      setup(s);
      applyPurchase(s, 'welcome', rng());
      expect(s.freeChests).toBe(0);
      expect(s.board.filter((t) => t === 4).length).toBe(3); // 2 masks + the chest stand-in
      const g = grantReward(s, { kind: 'chest', n: 2 }, rng());
      expect(g.chests).toBe(0);
      expect(g.relics.map((r) => r.tier)).toEqual([4, 4]);
      s.ent.vip = true;
      const v = claimVipCrate(s, Date.now(), rng());
      expect(v && v.length).toBe(1);
      expect(s.freeChests).toBe(0);
      expect(openChest(s, rng(), 'free').reason).toBe('blocked');
      s.gems = 100;
      expect(spinWheel(s, rng(), 'gems').ok).toBe(false);
      expect(spinWheel(s, rng(), 'ad').ok).toBe(true);
      expect(s.stats.chests).toBe(0);
    });
  }
  it('pending free chests convert to exact relics when a profile becomes restricted', () => {
    const s = createState();
    s.freeChests = 2; s.age = 'minor';
    enforceChestRules(s, rng());
    expect(s.freeChests).toBe(0);
    expect(s.satchel).toEqual([4, 4]);
  });
  it('minors are never pushed offers (jammed helper still shows)', () => {
    const s = createState();
    s.age = 'minor';
    const d = new OfferDirector(() => s);
    s.board[0] = 1; s.board[1] = 1;
    d.onMerge(merge(s, 0, 1, rng()));
    d.onBoardFull();
    expect(d.queue.map((q) => q.id)).toEqual(['jammed']);
  });
});

describe('honest offers (Critic ITERATE #2)', () => {
  it('welcome deadline is real: starts at first sight, never resets, then closes', () => {
    const s = createState();
    const t0 = 1_000_000;
    expect(welcomeOpen(s, t0)).toBe(true);
    const d = welcomeDeadline(s, t0);
    expect(d).toBe(t0 + WELCOME_WINDOW_MS);
    expect(welcomeDeadline(s, t0 + 3_600_000)).toBe(d);
    expect(welcomeOpen(s, d - 1)).toBe(true);
    expect(welcomeOpen(s, d + 1)).toBe(false);
  });
  it('value ribbons are computed from one baseline', () => {
    expect(skuValuePct('gems80')).toBe(100);
    expect(skuValuePct('gems500')).toBe(125);
    expect(skuValuePct('gems1200')).toBe(150);
    expect(skuValuePct('welcome')).toBe(Math.round(((160 / 1.99) / (200 / 4.99)) * 100));
  });
});
