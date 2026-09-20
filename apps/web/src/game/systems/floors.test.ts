import { describe, it, expect } from 'vitest';
import { createState, migrate, type GameState } from './State';
import { mulberry32 } from './Rng';
import {
  FLOORS, FLOOR_COUNT, CAPSTONE_TIER, activeChain, canDescend, canRestore, capstoneOf, clearsOf, descend,
  isCleared, isLastFloor, liveChains, mementoChoices, noteAscension, reliquaryOnFloor, renownGold, renownLuck,
  restore, RENOWN_GOLD_CAP, RENOWN_LUCK_CAP,
} from './Floors';
import {
  MAIN_QUESTS, ERRANDS, ERRAND_SLOTS, bubble, claimErrand, claimMain, currentMain, liveErrands, mainDone,
  mainProgress, noteFloorAction, refillErrands, resetFloorStats, swapErrand, mainQuestsOnFloor,
} from './Chronicle';
import { merge } from './MergeSystem';
import { forge } from './ForgeSystem';
import { grantGold, unlockGenerators } from './Economy';
import { CHAINS, ITEMS, ITEM_IDS, BINDINGS, chainOf, tierOf, itemId } from '../data/items';
import { boardIds, BOARD_FRAME } from '../art/RelicFactory';
import { CHAIN_PAINTERS } from '../art/ChainArt';
import { errandGoal } from '../data/chronicle';
import { ECON } from '../data/catalog';
import { RANK_REWARDS } from './Profile';
import { generateOrder } from './OrderSystem';
import { itemWork } from '../data/items';

const rng = () => mulberry32(7);
/** A state that has cleared its current floor, so the two doors are open. */
function clearedState(floor = 0): GameState {
  const s = createState();
  s.floor = floor;
  s.clears[floor] = 1;
  return s;
}

describe('the ten floors (docs/ROOMS.md)', () => {
  it('has ten floors, each with nine relics and its own ladder', () => {
    expect(FLOORS).toHaveLength(10);
    expect(FLOOR_COUNT).toBe(10);
    for (const f of FLOORS) {
      expect(f.relics, f.name).toHaveLength(CAPSTONE_TIER);
      for (const r of f.relics) {
        expect(r.name.length, f.name).toBeGreaterThan(2);
        expect(r.lore.length, `${f.name} ${r.name}`).toBeGreaterThan(10); // every relic says something
      }
    }
  });

  it('gives every relic on every floor a distinct name', () => {
    const names = FLOORS.flatMap((f) => f.relics.map((r) => r.name));
    expect(new Set(names).size).toBe(names.length);
  });

  it('registers every floor ladder as a chain, indexed by its own id', () => {
    for (const f of FLOORS) {
      expect(CHAINS[f.chain].id, f.name).toBe(f.chain); // CHAINS[chainOf(id)] is used everywhere
      expect(CHAINS[f.chain].maxTier).toBe(CAPSTONE_TIER);
    }
    // ids stay inside the chain * 10 + tier scheme, so nothing about existing saves changes
    for (const f of FLOORS) for (let t = 1; t <= CAPSTONE_TIER; t++) {
      const id = itemId(f.chain, t);
      expect(ITEMS[id], `${f.name} t${t}`).toBeDefined();
      expect(chainOf(id)).toBe(f.chain);
      expect(tierOf(id)).toBe(t);
    }
  });

  it('pays more the deeper it goes, without a jump that makes a floor the only place to play', () => {
    for (let i = 1; i < FLOORS.length; i++) {
      const ratio = FLOORS[i].value / FLOORS[i - 1].value;
      expect(ratio, FLOORS[i].name).toBeGreaterThan(1);
      expect(ratio, FLOORS[i].name).toBeLessThan(1.8);
    }
  });

  it('keeps the Crypt and the Star Well live on every floor, so a saved relic still binds', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const s = createState();
      s.floor = f;
      expect(liveChains(s)).toEqual([FLOORS[f].chain, 1, 2]);
      // and the floor's top three tiers need one of them
      for (const t of [7, 8, 9]) {
        const need = BINDINGS[itemId(FLOORS[f].chain, t)];
        expect(need, `${FLOORS[f].name} t${t}`).toBeDefined();
        expect([1, 2]).toContain(chainOf(need));
      }
    }
  });

  it('never unlocks a floor generator by rank, however high the rank goes', () => {
    const s = createState();
    s.rank = 99;
    const unlocked = unlockGenerators(s);
    expect(unlocked).toEqual([1, 2]); // the Crypt and the Star Well, and nothing else
    for (const f of FLOORS.slice(1)) expect(s.gens[f.chain] ?? 0, f.name).toBe(0);
  });
});

describe('clearing a floor', () => {
  it('is ascending the floor capstone, not the Crypt or the Star Well', () => {
    const s = createState();
    expect(isCleared(s)).toBe(false);
    expect(noteAscension(s, 1)).toBe(false); // the Crypt's top tier is a good merge, not a floor
    expect(noteAscension(s, 2)).toBe(false);
    expect(isCleared(s)).toBe(false);
    expect(noteAscension(s, activeChain(s))).toBe(true);
    expect(isCleared(s)).toBe(true);
  });

  it('is reported by merge() when the capstone actually ascends', () => {
    const s = createState();
    const cap = capstoneOf(0);
    s.board = s.board.map(() => 0);
    s.board[0] = cap; s.board[1] = cap;
    const r = merge(s, 0, 1, rng());
    expect(r.ok).toBe(true);
    expect(r.ascended).toBe(true);
    expect(r.clearedFloor).toBe(true);
    expect(isCleared(s)).toBe(true);
  });

  it('opens both doors, and only Restore on the bottom floor', () => {
    const s = clearedState(0);
    expect(canDescend(s)).toBe(true);
    expect(canRestore(s)).toBe(true);
    const bottom = clearedState(FLOOR_COUNT - 1);
    expect(isLastFloor(bottom)).toBe(true);
    expect(canDescend(bottom)).toBe(false);
    expect(canRestore(bottom)).toBe(true); // the bottom is a place, not a wall
  });

  it('opens no door until the floor is cleared', () => {
    const s = createState();
    expect(canDescend(s)).toBe(false);
    expect(canRestore(s)).toBe(false);
    expect(descend(s).reason).toBe('not-cleared');
    expect(restore(s).reason).toBe('not-cleared');
    expect(s.floor).toBe(0);
    expect(s.renown).toBe(0);
  });
});

describe('descending', () => {
  it('opens the next floor with a fresh ladder and its generator running', () => {
    const s = clearedState(0);
    s.board[0] = 4;
    const before = activeChain(s);
    const r = descend(s);
    expect(r.ok).toBe(true);
    expect(s.floor).toBe(1);
    expect(activeChain(s)).not.toBe(before);
    expect(s.gens[activeChain(s)]).toBe(1); // the new generator is running immediately: no wait, no purchase
    expect(s.best[activeChain(s)]).toBe(0);
  });

  it('records everything on the board in the Reliquary and destroys none of it', () => {
    const s = clearedState(0);
    s.board = s.board.map(() => 0);
    s.board[0] = 4; s.board[1] = 5; s.board[2] = 4;
    const r = descend(s, 5);
    expect(r.recorded.sort()).toEqual([4, 5]);
    expect(s.reliquary).toContain(4);
    expect(s.reliquary).toContain(5);
    expect(reliquaryOnFloor(s, 0)).toEqual([4, 5]);
  });

  it('carries one chosen relic through as a memento, and puts it on the new board', () => {
    const s = clearedState(0);
    s.board = s.board.map(() => 0);
    s.board[3] = 7;
    const r = descend(s, 7);
    expect(r.memento).toBe(7);
    expect(s.board.filter((x) => x === 7)).toHaveLength(1);
  });

  it('can take the memento out of the satchel, and does not leave a copy behind', () => {
    const s = clearedState(0);
    s.board = s.board.map(() => 0);
    s.satchel = [6, 4];
    descend(s, 6);
    expect(s.satchel).toEqual([4]); // the rest of the satchel is never emptied by a floor change
    expect(s.board.filter((x) => x === 6)).toHaveLength(1);
  });

  it('suggests the best thing you are holding, because that is the real decision', () => {
    const s = clearedState(0);
    s.board = s.board.map(() => 0);
    s.board[0] = 2; s.board[1] = 8; s.board[2] = 5;
    expect(mementoChoices(s)[0]).toBe(8);
    expect(descend(s).memento).toBe(8);
  });

  it('leaves the generator levels bought on the floor above alone', () => {
    const s = clearedState(0);
    s.gens = [6, 3, 2];
    descend(s);
    expect(s.gens[0]).toBe(6); // taking them back would make descending a punishment
    expect(s.gens[1]).toBe(3);
    expect(s.gens[2]).toBe(2);
  });

  it('walks all ten floors and stops at the bottom', () => {
    const s = createState();
    for (let f = 0; f < FLOOR_COUNT - 1; f++) {
      s.clears[f] = 1;
      expect(descend(s).ok, `floor ${f}`).toBe(true);
    }
    expect(s.floor).toBe(FLOOR_COUNT - 1);
    s.clears[s.floor] = 1;
    expect(descend(s).reason).toBe('no-floor-below');
    expect(s.floor).toBe(FLOOR_COUNT - 1);
  });
});

describe('restoring (prestige)', () => {
  it('stays on the floor, pays a permanent Renown, and starts the ladder again', () => {
    const s = clearedState(2);
    s.best[activeChain(s)] = 9;
    s.gens[activeChain(s)] = 5;
    const r = restore(s);
    expect(r.ok).toBe(true);
    expect(s.floor).toBe(2); // same floor
    expect(s.renown).toBe(1);
    expect(s.best[activeChain(s)]).toBe(0);
    expect(s.gens[activeChain(s)]).toBe(1); // the ladder and its generator go back: that is the trade
  });

  it('keeps the floor clear in its history, so the doors do not close behind you', () => {
    const s = clearedState(0);
    restore(s);
    expect(clearsOf(s, 0)).toBe(1);
    expect(canRestore(s)).toBe(true);
  });

  it('pays luck and gold for ever, and both are capped', () => {
    const s = createState();
    expect(renownLuck(s)).toBe(0);
    expect(renownGold(s)).toBe(1);
    s.renown = 4;
    expect(renownLuck(s)).toBeGreaterThan(0);
    expect(renownGold(s)).toBeCloseTo(1.2, 5);
    s.renown = 9999;
    expect(renownLuck(s)).toBe(RENOWN_LUCK_CAP);
    expect(renownGold(s)).toBe(1 + RENOWN_GOLD_CAP); // faster, never untouchable
  });

  it('multiplies gold and never gems', () => {
    const s = createState();
    s.renown = 10; // +50%
    const gold = s.gold, gems = s.gems;
    grantGold(s, 1000);
    expect(s.gold).toBe(gold + 1500);
    expect(s.gems).toBe(gems);
  });

  it('can be done for ever on the bottom floor', () => {
    const s = clearedState(FLOOR_COUNT - 1);
    for (let i = 0; i < 5; i++) {
      s.clears[s.floor] = 1;
      expect(restore(s).ok).toBe(true);
    }
    expect(s.renown).toBe(5);
    expect(s.floor).toBe(FLOOR_COUNT - 1);
  });
});

describe("the Keeper's Chronicle (docs/STORY.md)", () => {
  it('has three main quests per floor, thirty in all, each with a beat', () => {
    expect(MAIN_QUESTS).toHaveLength(30);
    for (let f = 0; f < FLOOR_COUNT; f++) expect(mainQuestsOnFloor(f), `floor ${f}`).toHaveLength(3);
    for (const q of MAIN_QUESTS) {
      expect(q.beat.length, q.label).toBeGreaterThan(20);
      expect(q.rewards.length, q.label).toBeGreaterThan(0);
    }
  });

  it('closes every chapter on the floor capstone', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const qs = mainQuestsOnFloor(f);
      expect(qs[2].kind.type, `floor ${f}`).toBe('capstone');
      expect(qs[0].kind.type).not.toBe('capstone');
    }
  });

  /** RV-D5's constraint, and the one the Board named: the story is the reason to play, so it is never sold. */
  it('never asks for money or for luck', () => {
    for (const q of MAIN_QUESTS) {
      expect(['counter', 'tier', 'capstone']).toContain(q.kind.type);
      // no reward or goal may involve a purchase or a random drop the player cannot decide to get
      if (q.kind.type === 'counter') expect(['forges', 'merges', 'orders', 'bindings']).toContain(q.kind.counter);
    }
  });

  it('asks in order, and the badge says which state it is in', () => {
    const s = createState();
    expect(bubble(s)).toBe('active');
    const first = currentMain(s)!;
    expect(first.id).toBe(0);
    noteFloorAction(s, 'forges', first.goal);
    expect(mainDone(s, first)).toBe(true);
    expect(bubble(s)).toBe('ready'); // green seal with a check
    const c = claimMain(s, rng())!;
    expect(c.quest.id).toBe(first.id);
    expect(c.grant.gold).toBeGreaterThan(0);
    expect(currentMain(s)!.id).toBe(1); // the next one, in order
    expect(bubble(s)).toBe('active');
  });

  it('cannot be claimed twice, or before it is done', () => {
    const s = createState();
    expect(claimMain(s, rng())).toBeNull();
    noteFloorAction(s, 'forges', 999);
    expect(claimMain(s, rng())).not.toBeNull();
    const gold = s.gold;
    expect(claimMain(s, rng())?.quest.id).not.toBe(0);
    expect(s.gold).toBeGreaterThanOrEqual(gold);
  });

  it('derives progress from what the player did, so it can never disagree with the save', () => {
    const s = createState();
    const q = mainQuestsOnFloor(0)[1]; // raise a relic to tier 5
    expect(mainProgress(s, q)).toBe(1); // the boot relic is a tier 1, and the quest already knows it
    expect(mainDone(s, q)).toBe(false);
    s.best[activeChain(s)] = 5;
    expect(mainProgress(s, q)).toBe(5);
    expect(mainDone(s, q)).toBe(true);
  });

  it('reports the chapter closing, and says nothing more once a floor is finished', () => {
    const s = clearedState(0);
    for (const q of mainQuestsOnFloor(0)) {
      noteFloorAction(s, 'forges', q.goal);
      s.best[activeChain(s)] = 9;
      const c = claimMain(s, rng());
      expect(c, q.label).not.toBeNull();
      if (q.kind.type === 'capstone') expect(c!.chapterDone).toBe(true);
    }
    expect(currentMain(s)).toBeNull();
    expect(bubble(s)).toBe('none'); // the Keeper does not nag when he has nothing to ask
  });

  it('moves on to the next floor\'s chapter when you descend', () => {
    const s = clearedState(0);
    for (const q of mainQuestsOnFloor(0)) { noteFloorAction(s, 'forges', q.goal); s.best[activeChain(s)] = 9; claimMain(s, rng()); }
    descend(s);
    expect(currentMain(s)!.floor).toBe(1);
    expect(bubble(s)).toBe('active');
  });
});

describe('errands (side quests)', () => {
  it('opens two at a time, from two different patrons', () => {
    const s = createState();
    refillErrands(s);
    const live = liveErrands(s);
    expect(live.filter(Boolean)).toHaveLength(ERRAND_SLOTS);
    expect(live[0]!.def.patron).not.toBe(live[1]!.def.patron);
    for (const e of live) expect(e!.label).toContain(String(e!.goal));
  });

  it('measures only what you do after it is issued', () => {
    const s = createState();
    noteFloorAction(s, 'merges', 100); // done before any errand existed
    refillErrands(s);
    for (const e of liveErrands(s)) expect(e!.progress).toBe(0);
  });

  it('pays on completion, then replaces itself', () => {
    const s = createState();
    refillErrands(s);
    const e = liveErrands(s)[0]!;
    noteFloorAction(s, e.def.counter, e.goal);
    expect(liveErrands(s)[0]!.done).toBe(true);
    const gold = s.gold;
    const c = claimErrand(s, 0, rng())!;
    expect(c.total).toBe(1);
    expect(s.gold).toBeGreaterThan(gold);
    expect(liveErrands(s)[0]).not.toBeNull(); // a new one is waiting
    expect(liveErrands(s)[0]!.progress).toBe(0);
  });

  it('cannot be claimed unfinished', () => {
    const s = createState();
    refillErrands(s);
    expect(claimErrand(s, 0, rng())).toBeNull();
  });

  it('swaps for free, and the cost is the progress rather than a wait', () => {
    const s = createState();
    refillErrands(s);
    const before = liveErrands(s)[0]!;
    noteFloorAction(s, before.def.counter, 1);
    const after = swapErrand(s, 0)!;
    expect(after.progress).toBe(0);
    expect(liveErrands(s)[1]!.def.patron).not.toBe(after.def.patron);
  });

  it('asks for more, and pays more, the deeper the floor', () => {
    for (const def of ERRANDS) {
      expect(errandGoal(def, 5)).toBeGreaterThan(errandGoal(def, 0));
      const shallow = def.pay(0, errandGoal(def, 0)).find((r) => r.kind === 'gold') as { n: number } | undefined;
      const deep = def.pay(5, errandGoal(def, 5)).find((r) => r.kind === 'gold') as { n: number } | undefined;
      if (shallow && deep) expect(deep.n).toBeGreaterThan(shallow.n);
    }
  });
});

describe('a floor change and the save', () => {
  it('zeroes the per-floor counters without touching the lifetime ones', () => {
    const s = clearedState(0);
    noteFloorAction(s, 'merges', 40);
    s.stats.merges = 400;
    resetFloorStats(s);
    expect(s.floorStats.merges).toBe(0);
    expect(s.stats.merges).toBe(400); // "merges ever" is not a floor's business
  });

  it('migrates a v5 save onto floor 1 with nothing else changed', () => {
    const old: any = JSON.parse(JSON.stringify(createState()));
    old.v = 5;
    old.gold = 1234;
    old.stats.maxTier = 6;
    delete old.floor; delete old.clears; delete old.renown; delete old.chronicle; delete old.floorStats; delete old.reliquary;
    const s = migrate(old);
    expect(s.floor).toBe(0);
    expect(s.renown).toBe(0);
    expect(s.clears).toHaveLength(FLOOR_COUNT);
    expect(isCleared(s)).toBe(false);
    expect(s.gold).toBe(1234);
    expect(currentMain(s)!.id).toBe(0);
  });

  /** A returning player who has already ascended the Living Relic has cleared floor 1 by the new rules. */
  it('treats an old save that already ascended as having cleared floor 1', () => {
    const old: any = JSON.parse(JSON.stringify(createState()));
    old.v = 5;
    old.stats.maxTier = 9;
    delete old.clears;
    const s = migrate(old);
    expect(isCleared(s)).toBe(true);
    expect(canDescend(s)).toBe(true); // the doors are open, not asking them to do it again
  });

  it('round-trips a save that is deep in the vault', () => {
    const s = clearedState(4);
    s.renown = 3;
    s.reliquary = [4, 9, 34, 38];
    noteFloorAction(s, 'orders', 6);
    refillErrands(s);
    noteFloorAction(s, 'forges', 12);
    claimMain(s, rng());
    const back = migrate(JSON.parse(JSON.stringify(s)));
    expect(back.floor).toBe(4);
    expect(back.renown).toBe(3);
    expect(back.reliquary).toEqual([4, 9, 34, 38]);
    expect(back.floorStats.orders).toBe(6);
    expect(back.chronicle.claimed).toEqual(s.chronicle.claimed);
    expect(back.chronicle.side.filter(Boolean)).toHaveLength(ERRAND_SLOTS);
  });
});

describe('a floor, played through', () => {
  /**
   * The whole loop end to end, through the real systems: forge on the floor's own ladder, merge up, ascend the
   * capstone, hear the chapter close, then take a door. If this passes, a floor is playable.
   */
  it('forges, merges, clears and descends', () => {
    const s = createState();
    s.gens = [1, 1, 1];
    const r = rng();

    // forge on this floor's ladder and check the Chronicle is counting it
    s.board = s.board.map(() => 0);
    for (let i = 0; i < 12; i++) forge(s, r, undefined, activeChain(s));
    expect(s.floorStats.forges).toBe(12);
    const first = claimMain(s, r)!;
    expect(first.quest.label).toContain('Forge');

    // clear the floor with the capstone
    s.board = s.board.map(() => 0);
    const cap = capstoneOf(0);
    s.board[0] = cap; s.board[1] = cap;
    expect(merge(s, 0, 1, r).clearedFloor).toBe(true);

    // the capstone quest is claimable, and it is this floor's last beat
    s.best[activeChain(s)] = 9;
    claimMain(s, r); // the tier quest
    const last = claimMain(s, r)!;
    expect(last.quest.kind.type).toBe('capstone');
    expect(last.chapterDone).toBe(true);

    // and the door works
    s.board[5] = 6;
    expect(descend(s, 6).ok).toBe(true);
    expect(s.floor).toBe(1);
    expect(currentMain(s)!.floor).toBe(1);
    expect(s.floorStats.forges).toBe(12); // unchanged until the scene resets it on arrival
  });
});

/**
 * Two things that fail *silently* if nobody checks them, which is why they are tests and not a comment.
 *
 * The board atlas is one row of sheen frames per relic. With ten floors, baking every relic would make it 104
 * rows - over 16,000 pixels tall, past the maximum texture size on every phone this game targets - so it holds
 * only the relics the current floor can show. And a relic with no painter draws nothing at all: no error, no
 * warning, an empty socket where a relic should be.
 */
describe('a floor has to be able to draw itself', () => {
  it('keeps the board atlas to one floor of relics, well inside the texture limit', () => {
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const ids = boardIds(f);
      // the floor's nine, plus the Crypt's seven and the Star Well's seven
      expect(ids, `floor ${f}`).toHaveLength(9 + 7 + 7);
      expect(ids.every((id) => [FLOORS[f].chain, 1, 2].includes(chainOf(id)))).toBe(true);
      expect(ids.length * BOARD_FRAME, `floor ${f} atlas height`).toBeLessThan(4096);
    }
    // and the naive version really would have been too big, which is the reason this exists
    expect(ITEM_IDS.length * BOARD_FRAME).toBeGreaterThan(4096);
  });

  it('gives every relic in the game a way to be painted', () => {
    for (const id of ITEM_IDS) {
      const painted = id <= 9 || !!CHAIN_PAINTERS[id];
      if (painted) continue;
      // the fallback borrows a silhouette by tier and recolours it, so it needs both to exist
      expect(ITEMS[id]?.color, `item ${id} has no colour to paint with`).toBeGreaterThan(0);
      expect(tierOf(id), `item ${id} has no tier to borrow a silhouette from`).toBeGreaterThanOrEqual(1);
      expect(tierOf(id)).toBeLessThanOrEqual(9);
    }
  });
});

describe('the rest of the game follows you down', () => {
  /**
   * Descending keeps the generator levels you paid for on the floor above, so `gens[0]` stays above zero for
   * ever. A patron who reads that as "the Antechamber is available" asks for a relic the player cannot forge,
   * and an unfillable order is worse than no order — it sits in a slot paying nothing (T-005).
   */
  it('never asks a patron for a relic from a floor you have left', () => {
    const s = clearedState(0);
    s.gens = [6, 1, 1];
    descend(s);
    const live = liveChains(s);
    for (let i = 0; i < 200; i++) {
      s.orders = [null, null, null];
      const o = generateOrder(s, mulberry32(i));
      for (const id of o.want) expect(live, `order wanted item ${id}`).toContain(chainOf(id));
    }
  });

  it('pays the deeper floor more for the same work', () => {
    const shallow = itemId(FLOORS[0].chain, 5);
    const deep = itemId(FLOORS[6].chain, 5);
    expect(itemWork(deep)).toBeGreaterThan(itemWork(shallow));
  });
});

/**
 * The Chronicle pays in the same currencies as everything else, so it can quietly wreck the economy. The first
 * draft of the errands paid 300-700 gold *per item asked for*, which on floor 1 is two orders of magnitude over
 * what the work is worth - an early patron order pays single-digit gold. These pin both scales to constants the
 * game has already tuned, so a drift has to move those instead.
 */
describe('the Chronicle pays in proportion to the rest of the game', () => {
  const goldOf = (rs: { kind: string; n?: number }[]) => rs.filter((r) => r.kind === 'gold').reduce((a, r) => a + (r.n ?? 0), 0);

  it('pays an errand about what a daily quest pays, at floor 1', () => {
    for (const def of ERRANDS) {
      const g = goldOf(def.pay(0, errandGoal(def, 0)));
      expect(g, `${def.label(3)} pays ${g}`).toBeGreaterThanOrEqual(ECON.questGold);
      expect(g, `${def.label(3)} pays ${g}`).toBeLessThanOrEqual(ECON.questGold * 3);
    }
  });

  it('pays a main quest about what a rank landmark pays, at floor 1', () => {
    const landmarks = Object.values(RANK_REWARDS).map((r) => goldOf(r.rewards)).filter((n) => n > 0);
    const ceiling = Math.max(...landmarks);
    for (const q of mainQuestsOnFloor(0)) {
      expect(goldOf(q.rewards), q.label).toBeLessThanOrEqual(ceiling);
    }
  });

  it('never pays gems on a scale that competes with buying them', () => {
    // the entry pack is 200 gems; no single Chronicle reward may approach it
    const gemsOf = (rs: { kind: string; n?: number }[]) => rs.filter((r) => r.kind === 'gems').reduce((a, r) => a + (r.n ?? 0), 0);
    for (const q of MAIN_QUESTS) expect(gemsOf(q.rewards), q.label).toBeLessThan(200);
  });
});
