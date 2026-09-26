import { BOARD_SIZE, ECON } from '../data/catalog';
import { itemWork } from '../data/items';
import type { GameState } from './State';
import { STAND_IN_ITEMS } from './State';
import { spendGems, ladderGems } from './Economy';

/**
 * RV-M2a (AB#381, MONETIZATION.md RV-M2): power-ups, a gem sink for the middle horizon between the Welcome and a chest
 * at the bottom and a top-tier exact relic at the top. Every price comes from the exact-relic ladder (ladderGems), so
 * none is restated here (T-003) and none undercuts the ladder:
 *
 * - **Binding Stand-in**: counts as one missing binding in a merge, and is used up by it. It is sold for a named
 *   binding at that binding's ladder price. What it buys is not the relic (the ladder already sells relics) but the
 *   socket and the forging the binding would have taken, which is the planner's real constraint: a pair held while
 *   its binding is built.
 * - **Auto-Merge**: merges every pair on the board that can merge now, once each, in one action. Priced at the ladder's
 *   rate per action for a board of pairs: the ladder's anchor relic costs `exactT5Gems` and takes
 *   ANCHOR_ACTIONS to make by hand, and a 36-socket board holds at most 18 pairs.
 *
 * Deterministic for every player: neither has random contents, so both are offered at every age and region.
 */

/** Actions to make the ladder's anchor relic (the Emerald Scarab) by hand: a forge per unit of work, a merge per join. */
export const ANCHOR_ACTIONS = 2 * itemWork(5) - 1;
/** The most merges one Auto-Merge can make: every socket in a pair. */
export const AUTO_MERGE_MAX = Math.floor(BOARD_SIZE / 2);

export function autoMergeCost(): number {
  return Math.max(1, Math.ceil((ECON.exactT5Gems / ANCHOR_ACTIONS) * AUTO_MERGE_MAX));
}

export function standInCost(binding: number): number {
  return ladderGems(binding);
}

export function buyAutoMerge(s: GameState): boolean {
  if (!spendGems(s, autoMergeCost())) return false;
  s.powerUps.autoMerge += 1;
  return true;
}

export function buyStandIn(s: GameState, binding: number): boolean {
  if (!STAND_IN_ITEMS.includes(binding)) return false;
  if (!spendGems(s, standInCost(binding))) return false;
  s.powerUps.standIn[binding] = (s.powerUps.standIn[binding] ?? 0) + 1;
  return true;
}

export const standInsHeld = (s: GameState, binding: number) => s.powerUps?.standIn?.[binding] ?? 0;
