import { ECON } from '../data/catalog';
import type { GameState } from './State';

/**
 * Honest offer mechanics (Critic ITERATE #2, Soul > spec):
 * - the Welcome Pack has a real deadline that starts the first time it is shown and never resets;
 * - every "value" number is computed from the same stated baseline.
 */
export const WELCOME_WINDOW_MS = 48 * 3600000;

/** Starts the clock the first time the offer is shown. Returns the absolute deadline. */
export function welcomeDeadline(s: GameState, now: number): number {
  if (!s.flags.welcomeClock) s.flags.welcomeClock = now;
  return s.flags.welcomeClock + WELCOME_WINDOW_MS;
}

/** Available until bought or until its real deadline passes. Unseen = still open. */
export function welcomeOpen(s: GameState, now: number): boolean {
  if (s.ent.welcome) return false;
  if (!s.flags.welcomeClock) return true;
  return now < s.flags.welcomeClock + WELCOME_WINDOW_MS;
}

/** Baseline for every value ribbon: the entry gem pack's gems per dollar. */
export const BASELINE = { gems: 200, price: 4.99 };
export const baselineRate = () => BASELINE.gems / BASELINE.price;

/**
 * Gem-equivalent of a bundle: gems + chests priced at their gem cost.
 * Gold and relics are deliberately NOT converted (no official exchange rate), so they are shown as "extras".
 */
export function gemEquivalent(gems: number, chests = 0) {
  return gems + chests * ECON.chestGemCost;
}

/** Percent of baseline value, e.g. 125 means 25% more gems per dollar than the entry pack. */
export function valuePct(gemEq: number, price: number) {
  return Math.round(((gemEq / price) / baselineRate()) * 100);
}
