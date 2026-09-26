import { describe, it, expect } from 'vitest';
import { createState, migrate, sanitizePowerUps, STAND_IN_ITEMS } from './State';
import { merge, autoMerge, autoMergePairs } from './MergeSystem';
import { bindingReady } from './BoardSystem';
import { exactRelicCost, ladderGems, claimQuest, questPowerUpDue, QUESTS } from './Economy';
import { autoMergeCost, standInCost, buyAutoMerge, buyStandIn, ANCHOR_ACTIONS, AUTO_MERGE_MAX } from './PowerUps';
import { mulberry32 } from './Rng';
import { BINDINGS, itemWork } from '../data/items';
import { ECON, BOARD_SIZE } from '../data/catalog';

// RV-M2a (AB#381): power-ups, a gem sink for the middle horizon. Each rule has its own case.
const rng = () => mulberry32(381);
const RUBY_CROWN = 7, CANDLE_SKULL = BINDINGS[7];

describe('power-up prices come from the exact-relic ladder (T-003)', () => {
  it('a Stand-in costs its binding at the ladder price, and the ladder is the exact-relic price', () => {
    for (const b of STAND_IN_ITEMS) expect(standInCost(b)).toBe(ladderGems(b));
    for (let t = 1; t <= 9; t++) expect(exactRelicCost(t)).toBe(ladderGems(t));
    expect(STAND_IN_ITEMS).toEqual([...new Set(Object.values(BINDINGS))].sort((a, b) => a - b));
  });

  it('Auto-Merge costs the ladder rate per action for a board of pairs, and never less than one gem', () => {
    expect(ANCHOR_ACTIONS).toBe(2 * itemWork(5) - 1);
    expect(AUTO_MERGE_MAX).toBe(BOARD_SIZE / 2);
    expect(autoMergeCost()).toBe(Math.max(1, Math.ceil((ECON.exactT5Gems / ANCHOR_ACTIONS) * AUTO_MERGE_MAX)));
    // never under the ladder: the most actions it can save, at the ladder's rate, is at most its price
    expect(((AUTO_MERGE_MAX - 1) * ECON.exactT5Gems) / ANCHOR_ACTIONS).toBeLessThanOrEqual(autoMergeCost());
  });
});

describe('buying power-ups', () => {
  it('spends the price and adds one; refuses without the gems, spending nothing', () => {
    const s = createState();
    s.gems = autoMergeCost() + standInCost(CANDLE_SKULL);
    expect(buyAutoMerge(s)).toBe(true);
    expect(buyStandIn(s, CANDLE_SKULL)).toBe(true);
    expect(s.gems).toBe(0);
    expect(s.powerUps).toEqual({ autoMerge: 1, standIn: { [CANDLE_SKULL]: 1 } });
    expect(buyAutoMerge(s)).toBe(false);
    expect(buyStandIn(s, CANDLE_SKULL)).toBe(false);
    expect(s.powerUps.autoMerge).toBe(1);
  });

  it('sells a Stand-in only for a relic that is some merge\'s binding', () => {
    const s = createState();
    s.gems = 1000;
    expect(buyStandIn(s, 1)).toBe(false);
    expect(s.gems).toBe(1000);
  });
});

describe('Binding Stand-in', () => {
  const pairWaiting = () => { const s = createState(); s.board = s.board.map(() => 0); s.board[0] = RUBY_CROWN - 1; s.board[1] = RUBY_CROWN - 1; return s; };

  it('stands in for a missing binding once, and is used up', () => {
    const s = pairWaiting();
    expect(merge(s, 0, 1, rng()).reason).toBe('binding');
    s.powerUps.standIn[CANDLE_SKULL] = 1;
    expect(bindingReady(s, RUBY_CROWN - 1, 0, 1)).toBe(true);
    const r = merge(s, 0, 1, rng());
    expect(r.ok).toBe(true);
    expect(r.standIn).toBe(CANDLE_SKULL);
    expect(s.board[1]).toBe(RUBY_CROWN);
    expect(s.powerUps.standIn[CANDLE_SKULL]).toBeUndefined();
    expect(s.stats.bindings).toBe(1);
  });

  it('is kept when the binding is on the board: the relic is used first', () => {
    const s = pairWaiting();
    s.board[5] = CANDLE_SKULL;
    s.powerUps.standIn[CANDLE_SKULL] = 1;
    const r = merge(s, 0, 1, rng());
    expect(r.ok).toBe(true);
    expect(r.standIn).toBeUndefined();
    expect(s.board[5]).toBe(0);
    expect(s.powerUps.standIn[CANDLE_SKULL]).toBe(1);
  });
});

describe('Auto-Merge', () => {
  it('merges every pair once, the new relics included in nothing, and uses one charge', () => {
    const s = createState();
    s.board = s.board.map(() => 0);
    [2, 2, 2, 2, 3, 3, 4].forEach((t, i) => { s.board[i] = t; });
    s.powerUps.autoMerge = 2;
    const res = autoMerge(s, rng());
    expect(res?.length).toBe(3); // two pairs of 2s and one of 3s; the 3s and 4 it makes are not merged again
    expect(s.powerUps.autoMerge).toBe(1);
    expect(s.board.filter((t) => t).sort()).toEqual([3, 3, 4, 4]);
  });

  it('is refused, and spends nothing, when there is no pair', () => {
    const s = createState();
    s.board = s.board.map(() => 0);
    s.board[0] = 2; s.board[1] = 3;
    s.powerUps.autoMerge = 1;
    expect(autoMerge(s, rng())).toBeNull();
    expect(s.powerUps.autoMerge).toBe(1);
    s.powerUps.autoMerge = 0;
    s.board[1] = 2;
    expect(autoMerge(s, rng())).toBeNull(); // no charge held
  });

  it('never ascends a top tier, never spends a Stand-in, and gives each pair its own binding', () => {
    const s = createState();
    s.board = s.board.map(() => 0);
    s.board[0] = 9; s.board[1] = 9; // the Living Relic pair: the player's moment
    s.board[2] = 6; s.board[3] = 6; s.board[4] = 6; s.board[5] = 6; // two pairs waiting on a Candle Skull each
    s.board[6] = CANDLE_SKULL; // one on the board
    s.powerUps.standIn[CANDLE_SKULL] = 1;
    expect(autoMergePairs(s)).toEqual([[2, 3]]);
    s.powerUps.autoMerge = 1;
    const res = autoMerge(s, rng());
    expect(res?.length).toBe(1);
    expect(s.board.slice(0, 2)).toEqual([9, 9]);
    expect(s.powerUps.standIn[CANDLE_SKULL]).toBe(1);
  });
});

describe('power-ups in the save fail closed', () => {
  it('a save without them holds none', () => {
    const old = createState() as unknown as Record<string, unknown>;
    delete old.powerUps;
    expect(migrate(old).powerUps).toEqual({ autoMerge: 0, standIn: {} });
    expect(migrate({ v: 1, board: [] }).powerUps).toEqual({ autoMerge: 0, standIn: {} });
  });

  it('anything malformed counts as none: negatives, fractions, strings, huge numbers, non-bindings, arrays', () => {
    expect(sanitizePowerUps({ autoMerge: -3, standIn: { [CANDLE_SKULL]: 2.5 } })).toEqual({ autoMerge: 0, standIn: {} });
    expect(sanitizePowerUps({ autoMerge: '9', standIn: { 1: 5, [CANDLE_SKULL]: '1' } })).toEqual({ autoMerge: 0, standIn: {} });
    expect(sanitizePowerUps({ autoMerge: 1e9, standIn: [] })).toEqual({ autoMerge: 0, standIn: {} });
    expect(sanitizePowerUps(null)).toEqual({ autoMerge: 0, standIn: {} });
    expect(sanitizePowerUps([1, 2])).toEqual({ autoMerge: 0, standIn: {} });
    expect(migrate({ ...createState(), powerUps: 'lots' }).powerUps).toEqual({ autoMerge: 0, standIn: {} });
  });

  it('a good save keeps exactly what it held', () => {
    const s = createState();
    s.powerUps = { autoMerge: 3, standIn: { [CANDLE_SKULL]: 2 } };
    expect(migrate(JSON.parse(JSON.stringify(s))).powerUps).toEqual({ autoMerge: 3, standIn: { [CANDLE_SKULL]: 2 } });
  });
});

describe('the free path to power-ups (RV-M2b, AB#382)', () => {
  const DAY = 86_400_000;
  /** A day on which the player finishes the forge quest (the one the 12-minute casual profile finishes every day). */
  const playDay = (s: ReturnType<typeof createState>, now: number) => {
    s.quests = { day: Math.floor(now / DAY), claimed: [], forge: 0, t4: 0, chest: 0, orders: 0 };
    s.quests.forge = QUESTS[0].goal;
  };

  it("the day's first quest claim gives one Auto-Merge; later claims that day do not; the next day's first does", () => {
    const s = createState();
    const day1 = 20_000 * DAY + DAY / 2;
    playDay(s, day1);
    s.quests.orders = QUESTS[2].goal;
    expect(questPowerUpDue(s, day1)).toBe(true);
    expect(claimQuest(s, 0, day1)).toBe(true);
    expect(s.powerUps.autoMerge).toBe(ECON.questAutoMerges);
    expect(ECON.questAutoMerges).toBe(1);
    expect(questPowerUpDue(s, day1)).toBe(false);
    expect(claimQuest(s, 2, day1)).toBe(true);
    expect(s.powerUps.autoMerge).toBe(1);
    playDay(s, day1 + DAY);
    expect(claimQuest(s, 0, day1 + DAY)).toBe(true);
    expect(s.powerUps.autoMerge).toBe(2);
    expect(s.stats.freePowerUps).toBe(2);
  });

  it("a refused claim gives nothing: an unfinished quest, or yesterday's", () => {
    const s = createState();
    const now = 20_000 * DAY + DAY / 2;
    playDay(s, now);
    s.quests.forge = QUESTS[0].goal - 1;
    expect(claimQuest(s, 0, now)).toBe(false);
    expect(claimQuest(s, 0, now + DAY)).toBe(false);
    expect(s.powerUps.autoMerge).toBe(0);
  });

  it('is the same fixed grant for every profile: an under-16 player and a loot-box-off region get exactly what an adult gets', () => {
    // MONETIZATION.md (Board, 2026-09-19): features are made safe for every age, not restricted by age. There is no
    // roll to replace with a fixed item: claimQuest takes no random source, so the deterministic grant IS the grant.
    const run = (setup: (s: ReturnType<typeof createState>) => void) => {
      const s = createState();
      setup(s);
      for (let d = 0; d < 14; d++) { const now = (20_000 + d) * DAY + DAY / 2; playDay(s, now); claimQuest(s, 0, now); }
      return s.powerUps;
    };
    const adult = run((s) => { s.age = 'adult'; s.lootboxesAllowed = true; });
    expect(adult).toEqual({ autoMerge: 14, standIn: {} });
    expect(run((s) => { s.age = 'minor'; })).toEqual(adult);
    expect(run((s) => { s.age = 'adult'; s.lootboxesAllowed = false; })).toEqual(adult);
    expect(claimQuest.length).toBe(3); // (s, q, now): no rng parameter to make it random
  });
});
