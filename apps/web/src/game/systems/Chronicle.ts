import {
  MAIN_QUESTS, MAIN_PER_FLOOR, ERRANDS, ERRAND_SLOTS, ERRAND_TITLE_AT, errandGoal,
  mainQuestsOnFloor, type MainQuest, type ErrandDef, type FloorCounter,
} from '../data/chronicle';
import { mulberry32, type Rng } from './Rng';
import { grantReward, emptyGrant, type Granted } from './Economy';
import { activeChain, clearsOf } from './Floors';
import type { GameState } from './State';

/**
 * The Keeper's Chronicle (docs/STORY.md): the main line that tells his story, and the patron errands beside it.
 *
 * Pure, and progress is **derived** rather than stored — a quest reads the per-floor counters the game already
 * keeps, so the save holds only which quests have been claimed and a quest can never disagree with what the
 * player did. The same rule is why an errand stores the counter value it was issued at instead of its own tally.
 */

export type Bubble = 'none' | 'active' | 'ready';

const counters = (s: GameState) => s.floorStats ?? { forges: 0, merges: 0, orders: 0, bindings: 0 };
export const floorCounter = (s: GameState, c: FloorCounter) => counters(s)[c] ?? 0;

/** Bump the per-floor counters. Called from the same places the daily quest counters are bumped. */
export function noteFloorAction(s: GameState, c: FloorCounter, n = 1) {
  if (!s.floorStats) s.floorStats = { forges: 0, merges: 0, orders: 0, bindings: 0 };
  s.floorStats[c] = (s.floorStats[c] ?? 0) + n;
}

/** Zeroed when the floor changes: these count what you did *on this floor*. */
export function resetFloorStats(s: GameState) {
  s.floorStats = { forges: 0, merges: 0, orders: 0, bindings: 0 };
}

// ---------------------------------------------------------------- the main line

const claimed = (s: GameState) => s.chronicle?.claimed ?? [];

/** How far along a main quest is, capped at its goal. */
export function mainProgress(s: GameState, q: MainQuest): number {
  if (q.kind.type === 'capstone') return Math.min(q.goal, clearsOf(s, q.floor));
  if (q.kind.type === 'tier') return Math.min(q.goal, s.best?.[activeChain(s)] ?? 0);
  return Math.min(q.goal, floorCounter(s, q.kind.counter));
}

export const mainDone = (s: GameState, q: MainQuest) => mainProgress(s, q) >= q.goal;
export const mainClaimed = (s: GameState, q: MainQuest) => claimed(s).includes(q.id);

/**
 * The quest the Keeper is currently asking for: the first unclaimed one on this floor, in order. Strictly in
 * order, because the beats are a story and reading chapter three first is not an improvement.
 */
export function currentMain(s: GameState): MainQuest | null {
  return mainQuestsOnFloor(s.floor ?? 0).find((q) => !mainClaimed(s, q)) ?? null;
}

/** What the badge on the Keeper's portrait shows (docs/STORY.md). */
export function bubble(s: GameState): Bubble {
  const q = currentMain(s);
  if (!q) return 'none';
  return mainDone(s, q) ? 'ready' : 'active';
}

export interface ClaimedMain { quest: MainQuest; grant: Granted; chapterDone: boolean }

/**
 * Take the reward and hear the beat. Claiming is the player's action, not something that happens to them: a
 * story beat that fires while they are mid-merge is a beat nobody reads.
 */
export function claimMain(s: GameState, rng: Rng): ClaimedMain | null {
  const q = currentMain(s);
  if (!q || !mainDone(s, q)) return null;
  if (!s.chronicle) s.chronicle = { claimed: [], side: [], sideSeq: 0, errandsDone: 0 };
  if (!s.chronicle.claimed) s.chronicle.claimed = [];
  s.chronicle.claimed.push(q.id);
  let grant = emptyGrant();
  for (const r of q.rewards) grant = grantReward(s, r, rng, grant);
  const chapterDone = mainQuestsOnFloor(q.floor).every((x) => mainClaimed(s, x));
  return { quest: q, grant, chapterDone };
}

/** Beats already heard, for the Chronicle screen: the story so far, re-readable. */
export function beatsHeard(s: GameState): MainQuest[] {
  return MAIN_QUESTS.filter((q) => mainClaimed(s, q));
}
export const chaptersDone = (s: GameState) =>
  Array.from({ length: MAIN_QUESTS.length / MAIN_PER_FLOOR }, (_, f) => mainQuestsOnFloor(f).every((q) => mainClaimed(s, q)));

// ---------------------------------------------------------------- errands

export interface ErrandSlot {
  /** index into ERRANDS */
  tpl: number;
  /** the counter's value when this errand was issued, so progress is derived rather than tallied */
  base: number;
}

export interface LiveErrand {
  slot: number;
  def: ErrandDef;
  goal: number;
  progress: number;
  done: boolean;
  label: string;
}

/**
 * Which errand a slot gets, deterministically from the floor and how many have been issued. Deterministic so
 * two players on the same floor meet errands of the same shape, and so the save does not have to store text.
 */
export function errandTemplate(floor: number, seq: number): number {
  const r = mulberry32(floor * 977 + seq * 31 + 7);
  return Math.floor(r() * ERRANDS.length);
}

/** Fill any empty slot. Never picks the errand already open in the other slot. */
export function refillErrands(s: GameState): void {
  if (!s.chronicle) s.chronicle = { claimed: [], side: [], sideSeq: 0, errandsDone: 0 };
  const c = s.chronicle;
  if (!c.side) c.side = [];
  while (c.side.length < ERRAND_SLOTS) c.side.push(null);
  for (let i = 0; i < ERRAND_SLOTS; i++) {
    if (c.side[i]) continue;
    let tpl = errandTemplate(s.floor ?? 0, c.sideSeq ?? 0);
    const other = c.side[1 - i];
    let guard = 0;
    while (other && ERRANDS[tpl].patron === ERRANDS[other.tpl].patron && guard++ < ERRANDS.length) {
      c.sideSeq = (c.sideSeq ?? 0) + 1;
      tpl = errandTemplate(s.floor ?? 0, c.sideSeq);
    }
    c.side[i] = { tpl, base: floorCounter(s, ERRANDS[tpl].counter) };
    c.sideSeq = (c.sideSeq ?? 0) + 1;
  }
}

export function liveErrands(s: GameState): (LiveErrand | null)[] {
  const c = s.chronicle;
  return Array.from({ length: ERRAND_SLOTS }, (_, slot) => {
    const e = c?.side?.[slot];
    if (!e) return null;
    const def = ERRANDS[e.tpl];
    const goal = errandGoal(def, s.floor ?? 0);
    const progress = Math.min(goal, Math.max(0, floorCounter(s, def.counter) - e.base));
    return { slot, def, goal, progress, done: progress >= goal, label: def.label(goal) };
  });
}

export interface ClaimedErrand { errand: LiveErrand; grant: Granted; total: number }

export function claimErrand(s: GameState, slot: number, rng: Rng): ClaimedErrand | null {
  const live = liveErrands(s)[slot];
  if (!live || !live.done || !s.chronicle) return null;
  let grant = emptyGrant();
  for (const r of live.def.pay(s.floor ?? 0, live.goal)) grant = grantReward(s, r, rng, grant);
  s.chronicle.errandsDone = (s.chronicle.errandsDone ?? 0) + 1;
  s.chronicle.side[slot] = null;
  refillErrands(s);
  return { errand: live, grant, total: s.chronicle.errandsDone };
}

/**
 * Swap an errand for a different one, free. The price of changing your mind is the progress you had, which is a
 * cost the player pays in actions rather than in waiting — the same reason order refills are action-based.
 */
export function swapErrand(s: GameState, slot: number): LiveErrand | null {
  if (!s.chronicle?.side?.[slot]) return null;
  s.chronicle.side[slot] = null;
  refillErrands(s);
  return liveErrands(s)[slot];
}

export const errandsDone = (s: GameState) => s.chronicle?.errandsDone ?? 0;
export const errandTitleEarned = (s: GameState) => errandsDone(s) >= ERRAND_TITLE_AT;

export { MAIN_QUESTS, ERRANDS, ERRAND_SLOTS, ERRAND_TITLE_AT, mainQuestsOnFloor };
export type { MainQuest, FloorCounter };
