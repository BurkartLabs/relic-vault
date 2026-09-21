import { describe, it, expect } from 'vitest';
import { createState, migrate, SAVE_VERSION, type GameState } from './State';
import { merge, canMerge } from './MergeSystem';
import { forge, rollForgeTier } from './ForgeSystem';
import { canForge, sell, empties, placeOrStash } from './BoardSystem';
import { applyPurchase } from './PurchaseService';
import { rollChest, openChest, gemClear, adSalvage, claimQuest, spinWheel, claimPass, claimEvent, fillCard, grantCard } from './Economy';
import { computeLuck } from './LuckSystem';
import { OfferDirector } from './OfferDirector';
import { mulberry32 } from './Rng';
import { Telemetry } from './Telemetry';
import { generateOrder, refillOrders, deliver, dismissOrder, tickOrders, matchOrder } from './OrderSystem';
import { upgradeGenerator, unlockGenerators, genUpgradeCost, buyExact, exactRelicCost, exactRelicOffer } from './Economy';
import { BINDINGS, CHAINS, itemWork, buildGold } from '../data/items';
import { grantReward, claimVipCrate, enforceChestRules } from './Economy';
import { welcomeOpen, welcomeDeadline, WELCOME_WINDOW_MS } from './Offers';
import { skuValuePct, GEMS_PER_DOLLAR_BASELINE, BASELINE_SKU } from '../data/catalog';
import { ECON, SKUS, SkuId, CARDS, MAX_TIER } from '../data/catalog';
import { standings, playerPlace, cyclePrize, keeperPoints } from './Standings';
import { TITLES, earnedTitles, unclaimedRankRewards, defaultProfile, profileName, CRESTS } from './Profile';
import { claimRankReward, claimCyclePrize } from './Economy';

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
    // T6 -> T7 needs its binding (a Candle Skull) on the board
    for (let i = 0; i < 12; i++) { s.board[0] = 6; s.board[1] = 6; s.board[2] = 13; expect(merge(s, 0, 1, rng()).ok).toBe(true); }
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
  /**
   * Bug #366: the So Close Bundle advertised 120 gems and 15,000 gold and paid out 60 and 1,500, because the
   * grant restated the numbers instead of reading the catalog. A test for that one SKU would not have helped —
   * the next SKU to change would break the same way — so this asserts the rule for every SKU that declares
   * contents: what the shop says it sells is what the player receives.
   */
  it('every SKU delivers exactly what the catalog advertises', () => {
    for (const sku of all) {
      const def = SKUS[sku];
      if (def.gems === undefined && def.gold === undefined) continue; // entitlement-only (pass, vip, noads)
      if (sku === 'piggy') continue; // the pig pays what it holds, which is not a catalog number
      const s = createState();
      const g = applyPurchase(s, sku, rng());
      expect(g.ok, sku).toBe(true);
      if (def.gems !== undefined) {
        expect(g.gems, `${sku} grant`).toBe(def.gems);
        expect(s.gems, `${sku} wallet`).toBe(createState().gems + def.gems);
      }
      if (def.gold !== undefined) {
        expect(g.gold, `${sku} grant`).toBe(def.gold);
        expect(s.gold, `${sku} wallet`).toBe(createState().gold + def.gold);
      }
    }
  });
  it('the shop names the pack its value ribbons are measured against', () => {
    // Bug #367: the footer said "the $4.99 pack (66.9 gems/$)" — one pack's name beside another's rate
    expect(BASELINE_SKU.gems! / BASELINE_SKU.price).toBe(GEMS_PER_DOLLAR_BASELINE);
    expect(skuValuePct(BASELINE_SKU.id)).toBe(100); // the baseline is by definition 100%
  });
  it('welcome pack: gems, gold, two T4 + one T3, free chest, one time only', () => {
    const s = createState();
    const g = applyPurchase(s, 'welcome', rng());
    expect(g.gems).toBe(120);
    expect(g.gold).toBe(100000);
    expect(s.board.filter((t) => t === 4).length).toBe(2);
    expect(s.board.filter((t) => t === 7).length).toBe(1); // Board RV-B1: a Ruby Crown, not a Silver Urn
    expect(s.freeChests).toBe(1);
    expect(applyPurchase(s, 'welcome', rng()).ok).toBe(false);
  });
  it('the pig fills with gems as you merge and the smash pays every whole gem (Board, #328)', () => {
    const s = createState();
    for (let i = 0; i < ECON.piggyMergesPerGem * 10; i++) { s.board[0] = 2; s.board[1] = 2; merge(s, 0, 1, rng()); }
    expect(Math.floor(s.piggy)).toBe(10);
    const g0 = s.gold, gem0 = s.gems;
    applyPurchase(s, 'piggy', rng());
    expect(s.gems - gem0).toBe(10);
    expect(s.gold).toBe(g0);
    expect(s.piggy).toBe(0);
    s.piggy = 10_000;
    for (let i = 0; i < 4; i++) { s.board[0] = 2; s.board[1] = 2; merge(s, 0, 1, rng()); }
    expect(s.piggy).toBe(ECON.piggyCap);
  });
  it('a v4 save drops its old gold pig instead of reading it as gems', () => {
    const s = createState() as any;
    s.v = 4; s.piggy = 600;
    expect(migrate(JSON.parse(JSON.stringify(s))).piggy).toBe(0);
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
    // Board, #332: Gold Mask (T4) is now the floor, not the top prize
    expect(Object.keys(counts).map(Number).every((t) => t >= 4 && t <= 8)).toBe(true);
    expect(counts[4] / 20000).toBeGreaterThan(0.3);
    expect(counts[8]).toBeGreaterThan(0);
  });
  it('every 15th dry chest guarantees a Sapphire Heart (T6) or better', () => {
    const s = createState();
    // Dry streak: rng picks the lowest row and fails the luck-upgrade roll.
    let n = 0;
    const dry = () => (n++ % 2 === 0 ? 0.0 : 0.99);
    for (let i = 0; i < 14; i++) {
      const r = rollChest(s, dry);
      expect(r.tier).toBeLessThan(6);
    }
    expect(s.pity).toBe(14);
    const r = rollChest(s, dry);
    expect(r.pityHit).toBe(true);
    expect(r.tier).toBeGreaterThanOrEqual(6);
    expect(s.pity).toBe(0);
  });
  it('gem chest costs its listed price and places a relic (Board, #345)', () => {
    const s = createState();
    s.gems = ECON.chestGemCost;
    const r = openChest(s, rng(), 'gems');
    expect(r.ok).toBe(true);
    expect(s.gems).toBe(0);
    expect(s.board[r.index]).toBe(r.tier);
    expect(openChest(s, rng(), 'gems').reason).toBe('gems');
  });
});

describe('exact relics', () => {
  it('an exact Emerald Scarab costs its anchor price and places exactly a T5 (Board, #331)', () => {
    const s = createState();
    s.gems = ECON.exactT5Gems;
    const i = buyExact(s, 5, rng());
    expect(i).not.toBeNull();
    expect(s.board[i!]).toBe(5);
    expect(s.gems).toBe(0);
    expect(buyExact(s, 5, rng())).toBeNull();
  });
  it('price follows what the relic is worth in merges, anchored on the Scarab (Board, RV-B4)', () => {
    expect(exactRelicCost(5)).toBe(ECON.exactT5Gems);
    // work doubles per tier, so the price does too, and a cheaper relic costs less
    expect(exactRelicCost(6)).toBe(ECON.exactT5Gems * 2);
    // a Ruby Crown also consumes a Crypt binding, so its work (and price) is more than a straight doubling
      expect(exactRelicCost(7)).toBeGreaterThan(ECON.exactT5Gems * 4);
    expect(exactRelicCost(4)).toBeLessThan(ECON.exactT5Gems);
    for (let t = 3; t < MAX_TIER; t++) expect(exactRelicCost(t + 1)).toBeGreaterThan(exactRelicCost(t));
  });
  it('the offer rotates near the best tier the player has reached, never below T3 (Board, RV-B4)', () => {
    const s = createState();
    s.best = [7, 0, 0];
    const seen = new Set<number>();
    for (let d = 0; d < 30; d++) seen.add(exactRelicOffer(s, d * 86400000));
    expect([...seen].every((t) => t >= 6 && t <= 8)).toBe(true);
    expect(seen.size).toBeGreaterThan(1);
    const fresh = createState();
    expect(exactRelicOffer(fresh, 0)).toBeGreaterThanOrEqual(3);
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
  it('a daily quest pays pass XP as well as gold and gems (RV-D6, AB#275)', () => {
    const s = createState();
    const now = Date.now();
    s.quests.forge = 10;
    const before = { xp: s.pass.xp, gems: s.gems, gold: s.gold };
    expect(claimQuest(s, 0, now)).toBe(true);
    expect(ECON.questPassXp).toBeGreaterThan(0);
    expect(s.pass.xp - before.xp).toBe(ECON.questPassXp);
    expect(s.gems - before.gems).toBe(ECON.questGems);
    expect(s.gold).toBeGreaterThan(before.gold);
    expect(claimQuest(s, 0, now)).toBe(false); // and only once
    expect(s.pass.xp - before.xp).toBe(ECON.questPassXp);
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
  it('renames the old gems80 SKU in purchase history (it always granted 200 gems)', () => {
    const s = createState();
    s.purchases = [{ sku: 'gems80', t: 1 }, { sku: 'pass', t: 2 }];
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.purchases.map((p) => p.sku)).toEqual(['gems200', 'pass']);
    expect(SKUS.gems200.gems).toBe(200);
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
  /**
   * The board-full sheet used to be the single exception to "minors are pushed nothing". The Board removed the
   * sheet on 2026-09-20, so the exception is gone with it and a minor now sees no offer of any kind, ever.
   */
  it('minors are pushed nothing at all, with no exception', () => {
    const s = createState();
    s.age = 'minor';
    const d = new OfferDirector(() => s);
    s.board[0] = 1; s.board[1] = 1;
    d.onMerge(merge(s, 0, 1, rng()));
    d.tick(Date.now(), Date.now() + 86400000);
    expect(d.queue).toEqual([]);
  });

  it('a full board opens no offer: there is nothing to sell into that moment', () => {
    const s = createState();
    const d = new OfferDirector(() => s);
    // whatever else happens, no code path can queue a board-full offer any more
    expect(JSON.stringify(d.queue)).not.toContain('jammed');
    expect('onBoardFull' in d).toBe(false);
  });

  it('the Rush Boost is never pushed, and nothing it pushes depends on the Rush deadline (RV-D6, AB#275)', () => {
    // Drive the director through every hook a session reaches, once with the Rush ending in a minute and once with
    // it ending in two days. A deadline pop-up is FOMO (RUBRIC: coercion), so the two runs must queue the same.
    const session = (untilEnd: number) => {
      const s = createState();
      s.age = 'adult';
      const d = new OfferDirector(() => s);
      const now = Date.now();
      for (let i = 0; i < 80; i++) {
        s.board[0] = 1; s.board[1] = 1;
        d.onMerge(merge(s, 0, 1, rng()));
        s.event.points += 60; // well past milestone 1 and on toward the top
        s.piggy += 5;
        d.tick(now + i * 1000, now + i * 1000 + untilEnd);
      }
      d.onAdComplete();
      return d.queue.map((q) => `${q.id}:${q.trigger}`);
    };
    const lastMinute = session(60_000), farOff = session(2 * 86_400_000);
    expect(lastMinute).toEqual(farOff);
    expect(lastMinute.length).toBeGreaterThan(0); // the director did run: this is not an empty comparison
    expect(lastMinute.join(' ')).not.toMatch(/boost|rush|deadline|ends/i);
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
    // the entry pack is the baseline by definition, and every bigger pack must beat it (Board RV-B2 re-priced them)
    expect(skuValuePct('gems200')).toBe(100);
    expect(skuValuePct('gems500')).toBe(Math.round(((500 / SKUS.gems500.price) / GEMS_PER_DOLLAR_BASELINE) * 100));
    expect(skuValuePct('gems500')).toBeGreaterThan(skuValuePct('gems200'));
    expect(skuValuePct('gems1200')).toBeGreaterThan(skuValuePct('gems500'));
    expect(skuValuePct('welcome')).toBe(Math.round((((120 + ECON.chestGemCost) / 1.99) / GEMS_PER_DOLLAR_BASELINE) * 100));
  });
});

describe('deepen cycle 1: chains, bindings, generators (RV-D3)', () => {
  it('top tiers need a binding from another chain and consume it', () => {
    const s = createState();
    s.board[0] = 6; s.board[1] = 6;
    const r = merge(s, 0, 1, rng());
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('binding');
    expect(r.binding).toBe(BINDINGS[7]);
    s.board[5] = BINDINGS[7];
    const ok = merge(s, 0, 1, rng());
    expect(ok.ok).toBe(true);
    expect(s.board[1]).toBe(7);
    expect(s.board[5]).toBe(0);
    expect(s.stats.bindings).toBe(1);
  });
  it('crypt and star chains merge within their own chain and ascend at their top', () => {
    const s = createState();
    s.board[0] = 11; s.board[1] = 11;
    expect(merge(s, 0, 1, rng()).item).toBe(12);
    s.board[2] = 27; s.board[3] = 27;
    const r = merge(s, 2, 3, rng());
    expect(r.ascended).toBe(true);
    expect(r.gold).toBe(Math.round(ECON.ascendGold * CHAINS[2].value));
    expect(merge(s, 1, 4, rng()).ok).toBe(false); // mismatch / empty never cross chains
  });
  it('generators unlock by rank and cannot be used while locked', () => {
    const s = createState();
    s.board = s.board.map(() => 0);
    expect(forge(s, rng(), undefined, 1).reason).toBe('locked');
    s.rank = CHAINS[1].unlockRank;
    expect(unlockGenerators(s)).toEqual([1]);
    const f = forge(s, rng(), undefined, 1);
    expect(f.ok).toBe(true);
    expect(Math.floor(f.item / 10)).toBe(1);
  });
  it('generator upgrades cost gold and never gate play', () => {
    const s = createState();
    s.gold = 0;
    expect(upgradeGenerator(s, 0)).toBe(false);
    s.gold = 100000;
    expect(upgradeGenerator(s, 0)).toBe(true);
    expect(s.gens[0]).toBe(2);
  });
  it('every generator upgrades to level 10, and no further (Board, #329)', () => {
    const s = createState();
    s.gens = [1, 1, 1];
    s.gold = 1e7;
    for (const ch of [0, 1, 2]) {
      while (upgradeGenerator(s, ch));
      expect(s.gens[ch]).toBe(10);
    }
    expect(genUpgradeCost(s, 1)).toBeNull();
    expect(1e7 - s.gold).toBe(3 * (300 + 900 + 2500 + 6000 + 12000 + 20000 + 32000 + 50000 + 80000));
  });
});

describe('deepen cycle 1: patron orders (RV-D2)', () => {
  it('orders ask for reachable relics and pay for what they consume', () => {
    const s = createState();
    for (let k = 0; k < 50; k++) {
      const o = generateOrder(s, mulberry32(k));
      expect(o.want.length).toBeGreaterThan(0);
      for (const id of o.want) { expect(Math.floor(id / 10)).toBe(0); expect(id % 10).toBeGreaterThanOrEqual(2); }
      expect(o.gold).toBeGreaterThanOrEqual(Math.round(o.want.reduce((a, id) => a + buildGold(id, ECON.mergeGold), 0) * ECON.orders.goldMultiplier));
    }
  });
  it('an order for a top relic pays more gold than keeping it for half an ascension (Bug #333)', () => {
    const s = createState();
    s.gens = [1, 1, 1]; s.best = [9, 7, 7]; s.rank = 20;
    const seen = new Set<number>();
    for (let k = 0; k < 3000 && seen.size < 3; k++) {
      const o = generateOrder(s, mulberry32(k));
      const tops = o.want.filter((id) => [9, 17, 27].includes(id));
      if (!tops.length) continue;
      tops.forEach((id) => seen.add(id));
      const halfAscensions = tops.reduce((a, id) => a + (ECON.ascendGold * CHAINS[Math.floor(id / 10)].value) / 2, 0);
      expect(o.gold, `order ${o.want}`).toBeGreaterThan(halfAscensions);
    }
    expect([...seen].sort()).toEqual([17, 27, 9]);
  });
  it('an order pays more than building the relics earned, so filling one is the better play (Board, RV-B9)', () => {
    // gold the merges themselves pay while building one relic of this tier from T1s
    const buildGold = (tier: number) => {
      let total = 0;
      for (let t = 2; t <= tier; t++) total += ECON.mergeGold[t] * Math.pow(2, tier - t);
      return total;
    };
    const s = createState();
    s.gens = [1, 1, 1]; s.best = [9, 7, 7]; s.rank = 20;
    let checked = 0;
    for (let k = 0; k < 200 && checked < 25; k++) {
      const o = generateOrder(s, mulberry32(k));
      if (o.want.some((id) => Math.floor(id / 10) !== 0)) continue; // Forge chain only: its tiers map to the table
      const forgone = o.want.reduce((a, id) => a + buildGold(id % 10), 0);
      expect(o.gold, `order ${o.want} paid ${o.gold} vs ${forgone} earned building it`).toBeGreaterThan(forgone * 2);
      checked++;
    }
    expect(checked).toBeGreaterThan(0);
  });
  it('delivering consumes exactly the wanted relics, pays, and refills the slot', () => {
    const s = createState();
    refillOrders(s, rng());
    const o = s.orders[0]!;
    s.board = s.board.map(() => 0);
    o.want.forEach((id, i) => { s.board[i] = id; });
    s.board[30] = 1;
    expect(matchOrder(s, o)).not.toBeNull();
    const g0 = s.gold, p0 = s.pass.xp, e0 = s.event.points;
    const r = deliver(s, 0, rng());
    expect(r.ok).toBe(true);
    expect(s.board.filter((t) => t > 0)).toEqual([1]);
    expect(s.gold).toBeGreaterThan(g0);
    expect(s.pass.xp - p0).toBe(o.pass);
    expect(s.event.points - e0).toBe(o.pts);
    expect(s.orders[0]).not.toBeNull();
    expect(s.orders[0]!.id).not.toBe(o.id);
    expect(s.stats.orders).toBe(1);
  });
  it('orders never expire on a clock; dismissing is free and refills after actions', () => {
    const s = createState();
    refillOrders(s, rng());
    expect(dismissOrder(s, 1)).toBe(true);
    expect(s.orders[1]).toBeNull();
    for (let k = 0; k < ECON.orders.dismissWait - 1; k++) { tickOrders(s, rng()); expect(s.orders[1]).toBeNull(); }
    tickOrders(s, rng());
    expect(s.orders[1]).not.toBeNull();
  });
  it('migrates a v3 save into chains: forge progress kept, generators by rank', () => {
    const v3 = { v: 3, board: [4, 4, 0], rank: 7, stats: { maxTier: 6 }, gold: 10 };
    const s = migrate(v3);
    expect(s.gens).toEqual([1, 1, 1]);
    expect(s.best[0]).toBe(6);
    expect(s.orders.length).toBe(3);
    expect(s.board.slice(0, 2)).toEqual([4, 4]);
  });
});

/**
 * Bug #326: one 22-minute boot produced 270 `session_end` events, one per tab hide, because the client re-armed
 * the end event every time the page came back. Any retention or session-length figure read from session counts
 * was wrong by two orders of magnitude — and those are the first numbers the company would have trusted.
 */
describe('telemetry sessions', () => {
  const fresh = () => new Telemetry('test', 'test'); // no endpoint: events stay in the local ring buffer

  it('a hide is a pause, not an end, however many times it happens', () => {
    const t = fresh();
    for (let i = 0; i < 10; i++) { t.pause(); t.resume(); }
    expect(t.count('session_pause')).toBe(10);
    expect(t.count('session_end')).toBe(0); // the bug produced 10 here, and 270 in the wild
  });

  it('numbers each pause, so a long play with interruptions is still one session', () => {
    const t = fresh();
    t.pause(); t.resume(); t.pause();
    const pauses = t.buf.filter((e) => e.event === 'session_pause');
    expect(pauses.map((e) => e.props.n_pause)).toEqual([1, 2]);
    expect(new Set(t.buf.map((e) => e.session_id)).size).toBe(1);
  });

  it('ends once on pagehide, and not again', () => {
    const t = fresh();
    t.sessionEnd('pagehide');
    t.sessionEnd('pagehide');
    expect(t.count('session_end')).toBe(1);
    expect(t.buf.find((e) => e.event === 'session_end')!.props.reason).toBe('pagehide');
  });

  it('ends the session when the tab has been hidden past the timeout', () => {
    const t = fresh();
    t.pause();
    // come back after the TELEMETRY.md timeout: that is a new session, not a continuation
    (t as unknown as { hiddenAt: number }).hiddenAt = Date.now() - Telemetry.HIDDEN_TIMEOUT_MS - 1;
    t.resume();
    expect(t.count('session_end')).toBe(1);
    expect(t.buf.find((e) => e.event === 'session_end')!.props.reason).toBe('timeout');
  });

  it('reports how many times a session was interrupted', () => {
    const t = fresh();
    t.pause(); t.resume(); t.pause(); t.resume();
    t.sessionEnd();
    expect(t.buf.find((e) => e.event === 'session_end')!.props.pauses).toBe(2);
  });
});

/**
 * Board requests, 2026-09-19: leaderboards ("you can fill it with dummy data for now"), Gold Rush rewards
 * ("both for completing the most milestones but also having the highest score compared to other players"),
 * and level-up rewards / account personalisation.
 */
describe('standings, cycle prizes and the profile', () => {
  it('the board is stable for a cycle, so it does not reshuffle between two looks', () => {
    const s = createState();
    const a = standings(s).map((r) => `${r.name}:${r.points}`);
    const b = standings(s).map((r) => `${r.name}:${r.points}`);
    expect(a).toEqual(b);
  });

  it('every rival is marked as not human, so the UI can never imply real players', () => {
    // Soul forbids fabricated social proof: dummy data is allowed, pretending it is people is not
    const rows = standings(createState());
    expect(rows.filter((r) => !r.isPlayer).every((r) => r.isHuman === false)).toBe(true);
    expect(rows.filter((r) => r.isHuman).length).toBe(1); // only the player
  });

  it('is beatable: a committed player can take first place', () => {
    const s = createState();
    s.event.points = 100000;
    expect(playerPlace(s)).toBe(1);
    expect(cyclePrize(s).placeLabel).toBe('Vault Champion');
  });

  it('a tie does not pass a keeper: you have to beat the score, not match it', () => {
    const s = createState();
    s.event.points = keeperPoints(s.event.cycle, 0);
    expect(playerPlace(s)).toBe(2);
    s.event.points += 1;
    expect(playerPlace(s)).toBe(1);
  });

  it('pays nothing for a cycle you did not enter', () => {
    const s = createState();
    s.event.points = 0;
    const p = cyclePrize(s);
    expect(p.placeRewards).toEqual([]);
    expect(p.diligenceRewards).toEqual([]);
    expect(claimCyclePrize(s, rng())).toBeNull(); // a prize everyone gets is not a prize
  });

  it('pays for milestones separately from placing, and only once per cycle', () => {
    const s = createState();
    s.event.points = 100000;
    const gems = s.gems;
    const g = claimCyclePrize(s, rng())!;
    expect(g.gems).toBe(300 + 120); // champion + the 10-milestone diligence award
    expect(s.gems).toBe(gems + 420);
    expect(claimCyclePrize(s, rng())).toBeNull();
  });

  it('rank rewards are claimed once, and only for ranks actually reached', () => {
    const s = createState();
    expect(claimRankReward(s, 3, rng())).toBeNull(); // rank 1: not yet
    s.rank = 6;
    const g = claimRankReward(s, 3, rng())!;
    expect(g.gold).toBe(1500);
    expect(claimRankReward(s, 3, rng())).toBeNull();
    expect(unclaimedRankRewards(s)).toEqual([2, 4, 5, 6]); // nothing is skipped by ranking past it
  });

  it('titles are earned by play and never sold', () => {
    const s = createState();
    expect(earnedTitles(s)).toEqual([]);
    s.rank = 5;
    expect(earnedTitles(s).map((t) => t.id)).toContain('keeper');
    for (const t of TITLES) expect(t.why.length).toBeGreaterThan(0); // every title says what earned it
  });

  it('the profile has no free-text field anywhere', () => {
    const p = defaultProfile();
    expect(typeof p.adjective).toBe('number');
    expect(typeof p.noun).toBe('number');
    expect(CRESTS).toContain(p.crest);
    expect(profileName({ ...p, adjective: 1, noun: 2 })).toMatch(/^[A-Z][a-z]+ [A-Z][a-z]+$/);
  });
});

/**
 * Bug #443: choosing a title bricked the save. `fill` decides what to do from the *default* value's type, and
 * `typeof null === 'object'`, so a nullable field fell into the object branch where `Object.keys(null)` throws —
 * inside the load path, so the game hung on "opening the vault" and the save could never be read again. The only
 * way back in was to clear site data, which threw the player's progress away.
 *
 * The gap that let it ship: every existing test starts from a fresh save, where `title` is still null. The
 * migration tests carried *old* saves forward; nothing round-tripped a *current* save through `migrate`, which is
 * what every single real load does. So the round trip is the test, and it is generic rather than about titles.
 */
describe('a save survives being saved and loaded (#443)', () => {
  const roundTrip = (s: GameState) => migrate(JSON.parse(JSON.stringify(s)));

  it('loads a save whose profile carries an earned title', () => {
    const s = createState();
    s.profile.title = 'keeper';
    expect(() => roundTrip(s)).not.toThrow();
  });

  it('keeps the title rather than quietly resetting it', () => {
    // returning the default would not crash, and would silently strip what the player chose: a quieter version
    // of the same bug, and the reason this assertion is separate from the one above
    const s = createState();
    s.profile.title = 'archivist';
    s.profile.crest = 'ic_luck';
    s.profile.adjective = 3;
    const back = roundTrip(s);
    expect(back.profile.title).toBe('archivist');
    expect(back.profile.crest).toBe('ic_luck');
    expect(back.profile.adjective).toBe(3);
  });

  it('refuses an object where a nullable field expects a value', () => {
    // a shape we cannot validate must not reach code that reads the field as a string
    const raw: any = JSON.parse(JSON.stringify(createState()));
    raw.profile.title = { nope: true };
    expect(roundTrip(raw as GameState).profile.title).toBeNull();
  });

  /**
   * The general form: a save that has been played is not a fresh one, so round-trip a state with every container
   * populated. Any field the loader mishandles shows up here rather than in a player's console.
   */
  it('round-trips a played save with every container populated', () => {
    const s = createState();
    s.profile.title = 'binder';
    s.rank = 12; s.xp = 40; s.gold = 99_000; s.gems = 640; s.crumbs = 7; s.piggy = 12.5;
    s.board = s.board.map((_, i) => (i % 3 === 0 ? 4 : i % 5 === 0 ? 13 : 0));
    s.satchel = [1, 4, 24];
    s.gens = [6, 3, 1];
    s.best = [9, 7, 5];
    s.album = s.album.map((_, i) => (i < 12 ? 1 : 0));
    s.pagesDone = [true, false, false];
    s.rankClaimed = [2, 3, 4];
    s.pass = { season: s.pass.season, xp: 900, free: [1, 2, 3], prem: [] };
    s.event = { cycle: s.event.cycle, points: 2400, claimed: [0, 1, 2], boostUntil: 0 };
    s.quests = { day: s.quests.day, forge: 4, t4: 1, chest: 2, orders: 3, claimed: [0] };
    s.flags = { tut: 3, 'cyclePrize:5': 1 };
    s.purchases = [{ sku: 'gems200', t: 1 }];
    s.stats = { ...s.stats, merges: 812, maxTier: 9, bindings: 30, orders: 64 };
    s.ent = { ...s.ent, welcome: true, passPremium: true, skin: true, skinOn: true };
    s.age = 'adult';
    s.settings = { muted: true, music: false, haptics: true };

    const back = roundTrip(s);
    expect(back.profile.title).toBe('binder');
    expect(back.rank).toBe(12);
    expect(back.gold).toBe(99_000);
    expect(back.satchel).toEqual([1, 4, 24]);
    expect(back.best).toEqual([9, 7, 5]);
    expect(back.rankClaimed).toEqual([2, 3, 4]);
    expect(back.flags.tut).toBe(3);
    expect(back.flags['cyclePrize:5']).toBe(1);
    expect(back.pass.free).toEqual([1, 2, 3]);
    expect(back.stats.merges).toBe(812);
    expect(back.ent.passPremium).toBe(true);
    expect(back.settings.muted).toBe(true);
    expect(back.purchases).toEqual([{ sku: 'gems200', t: 1 }]);
    expect(back.board).toEqual(s.board);
  });

  /**
   * Nothing in the state may be null-by-default without a test, because the next nullable field added would
   * reintroduce #443 exactly. This finds them by walking the defaults, so it covers fields nobody thought about.
   */
  it('every nullable field in the state survives holding a real value', () => {
    const nullable: string[] = [];
    const walk = (o: any, path: string) => {
      for (const [k, v] of Object.entries(o ?? {})) {
        const p = path ? `${path}.${k}` : k;
        if (v === null) nullable.push(p);
        else if (v && typeof v === 'object' && !Array.isArray(v)) walk(v, p);
      }
    };
    walk(createState(), '');
    // profile.title is the known one; the loop is what matters if that ever changes
    expect(nullable).toContain('profile.title');
    for (const path of nullable) {
      const raw: any = JSON.parse(JSON.stringify(createState()));
      const parts = path.split('.');
      let node = raw;
      for (const part of parts.slice(0, -1)) node = node[part];
      node[parts[parts.length - 1]] = 'a-real-value';
      expect(() => migrate(raw), `a saved value in ${path} must load`).not.toThrow();
      let out: any = migrate(raw);
      for (const part of parts) out = out[part];
      expect(out, `a saved value in ${path} must survive the load`).toBe('a-real-value');
    }
  });
});
