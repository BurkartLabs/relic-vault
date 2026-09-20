import { FLOORS, FLOOR_COUNT, CAPSTONE_TIER, floorDef, type FloorDef } from '../data/floors';
import { chainOf, tierOf, itemId, itemWork } from '../data/items';
import { BOARD_SIZE } from '../data/catalog';
import type { GameState } from './State';

/**
 * The ten floors, and the choice at the bottom of each (docs/ROOMS.md).
 *
 * Pure: every function here takes the state and returns what changed. No Phaser, no I/O, no randomness that is
 * not handed in — the same shape as the rest of `systems/`, and the reason this can be tested at all.
 *
 * The one rule that governs the whole file: **nothing is ever lost.** A relic that leaves the board when you
 * change floors is recorded in the Reliquary, the satchel is never emptied, and neither door costs money.
 */

/** The ladder the player is working right now. The Crypt (1) and the Star Well (2) run every floor. */
export const activeChain = (s: GameState) => floorDef(s.floor ?? 0).chain;
export const currentFloor = (s: GameState): FloorDef => floorDef(s.floor ?? 0);
export const DEPTH_CHAINS = [1, 2];

/** Chains that can be forged on this floor: the floor's own ladder, plus the two that run the whole depth. */
export const liveChains = (s: GameState) => [activeChain(s), ...DEPTH_CHAINS];

/** How many times this floor's capstone has been ascended. Restoring keeps the count; it is a history, not a score. */
export const clearsOf = (s: GameState, floor = s.floor ?? 0) => s.clears?.[floor] ?? 0;
export const isCleared = (s: GameState) => clearsOf(s) > 0;

export const isLastFloor = (s: GameState) => (s.floor ?? 0) >= FLOOR_COUNT - 1;
/** The bottom floor has no floor below it, so its only door is Restore — which is why it can be restored for ever. */
export const canDescend = (s: GameState) => isCleared(s) && !isLastFloor(s);
export const canRestore = (s: GameState) => isCleared(s);

/**
 * Called by `merge()` when two top-tier relics ascend. Ascending the floor's own capstone clears the floor and
 * opens the two doors; ascending the Crypt's or the Star Well's top tier is just a good merge.
 */
export function noteAscension(s: GameState, chain: number): boolean {
  if (chain !== activeChain(s)) return false;
  const floor = s.floor ?? 0;
  if (!s.clears) s.clears = [];
  while (s.clears.length < FLOOR_COUNT) s.clears.push(0);
  s.clears[floor]++;
  return true;
}

// ---------------------------------------------------------------- Keeper's Renown

/**
 * What restoring a floor is worth, for ever. Renown is the only permanent power in the game that cannot be
 * bought — not in a pack, not in the pass, not with gems — because it is the reward for choosing to stay rather
 * than to move on, and a purchasable version of that is just a shortcut past the game.
 *
 * Capped, like luck itself: twenty restorations make a player faster, not untouchable.
 */
export const RENOWN_LUCK_EACH = 0.004;
export const RENOWN_LUCK_CAP = 0.05;
export const RENOWN_GOLD_EACH = 0.05;
export const RENOWN_GOLD_CAP = 0.75;

export const renownLuck = (s: GameState) => Math.min(RENOWN_LUCK_CAP, (s.renown ?? 0) * RENOWN_LUCK_EACH);
/** A multiplier on gold, so 4 restorations is +20%. Applied where gold is granted, never to gems. */
export const renownGoldAt = (renown: number) => 1 + Math.min(RENOWN_GOLD_CAP, Math.max(0, renown) * RENOWN_GOLD_EACH);
export const renownGold = (s: GameState) => renownGoldAt(s.renown ?? 0);

// ---------------------------------------------------------------- the memento

/**
 * One relic, chosen, carried down. Descending with nothing reads as losing your things; descending with
 * everything makes the next ladder pointless. One relic you picked is the difference between a reset and a move
 * — and because the Crypt and the Star Well run the whole depth, it is a binding down there too.
 *
 * Offered highest-value first, because that is the decision the player is actually making.
 */
export function mementoChoices(s: GameState): number[] {
  const ids = new Set<number>();
  for (const id of s.board) if (id > 0) ids.add(id);
  for (const id of s.satchel) if (id > 0) ids.add(id);
  return [...ids].sort((a, b) => itemWork(b) - itemWork(a));
}

/** The one the game suggests: the best thing you are holding. */
export const bestMemento = (s: GameState) => mementoChoices(s)[0];

// ---------------------------------------------------------------- leaving a floor

export interface FloorChange {
  ok: boolean;
  reason?: 'not-cleared' | 'no-floor-below';
  /** every distinct relic recorded on the way out */
  recorded: number[];
  /** the relic carried through, if any */
  memento?: number;
  floor: number;
  renown: number;
}

/** Record everything on the board in the Reliquary, then clear it. Nothing is destroyed, only put away. */
function recordAndClear(s: GameState, keep?: number): number[] {
  if (!s.reliquary) s.reliquary = [];
  const recorded: number[] = [];
  for (let i = 0; i < s.board.length; i++) {
    const id = s.board[i];
    if (!id) continue;
    if (!recorded.includes(id)) recorded.push(id);
    if (!s.reliquary.includes(id)) s.reliquary.push(id);
    s.board[i] = 0;
  }
  // the satchel is not emptied: it is the player's overflow, not the floor's furniture
  if (keep) {
    if (!s.reliquary.includes(keep)) s.reliquary.push(keep);
    s.board[Math.floor(BOARD_SIZE / 2)] = keep;
    const inSatchel = s.satchel.indexOf(keep);
    if (inSatchel >= 0) s.satchel.splice(inSatchel, 1);
  }
  return recorded;
}

/** A floor's ladder begins again: no best tier, and the generator back to level 1. */
function resetLadder(s: GameState, chain: number) {
  while (s.best.length <= chain) s.best.push(0);
  while (s.gens.length <= chain) s.gens.push(0);
  s.best[chain] = 0;
  s.gens[chain] = 1;
}

/**
 * Go down. A new ladder, new relics, the next chapter — and the generator levels you bought on the floor above
 * stay bought, because taking them back would make descending a punishment.
 */
export function descend(s: GameState, memento = bestMemento(s)): FloorChange {
  if (!isCleared(s)) return { ok: false, reason: 'not-cleared', recorded: [], floor: s.floor ?? 0, renown: s.renown ?? 0 };
  if (isLastFloor(s)) return { ok: false, reason: 'no-floor-below', recorded: [], floor: s.floor ?? 0, renown: s.renown ?? 0 };
  const recorded = recordAndClear(s, memento);
  s.floor = (s.floor ?? 0) + 1;
  resetLadder(s, activeChain(s));
  return { ok: true, recorded, memento, floor: s.floor, renown: s.renown ?? 0 };
}

/**
 * Stay, and start this floor again for a permanent Renown bonus. The trade is real: the floor's ladder and its
 * generator level go back to the beginning, which is what makes Renown worth something.
 */
export function restore(s: GameState, memento = bestMemento(s)): FloorChange {
  if (!isCleared(s)) return { ok: false, reason: 'not-cleared', recorded: [], floor: s.floor ?? 0, renown: s.renown ?? 0 };
  const recorded = recordAndClear(s, memento);
  resetLadder(s, activeChain(s));
  s.renown = (s.renown ?? 0) + 1;
  return { ok: true, recorded, memento, floor: s.floor ?? 0, renown: s.renown };
}

// ---------------------------------------------------------------- the Reliquary

/** Every relic this save has ever put away, newest floor last. */
export const reliquaryCount = (s: GameState) => (s.reliquary ?? []).length;
/** How much of a floor's ladder has been recorded, for the Reliquary's per-floor rows. */
export function reliquaryOnFloor(s: GameState, floor: number): number[] {
  const chain = floorDef(floor).chain;
  return (s.reliquary ?? []).filter((id) => chainOf(id) === chain).sort((a, b) => tierOf(a) - tierOf(b));
}

/** The floor's capstone item id, which is the thing that has to be ascended to clear it. */
export const capstoneOf = (floor: number) => itemId(floorDef(floor).chain, CAPSTONE_TIER);

/** Total floors the save has ever cleared, for titles and for the Chronicle's gates. */
export const floorsCleared = (s: GameState) => (s.clears ?? []).filter((n) => n > 0).length;
/** Every restoration on every floor. `renown` is the same number; this reads it from the history as a check. */
export const totalRestorations = (s: GameState) => Math.max(0, (s.clears ?? []).reduce((a, n) => a + Math.max(0, n - 1), 0));

export { FLOORS, FLOOR_COUNT, CAPSTONE_TIER, floorDef };
