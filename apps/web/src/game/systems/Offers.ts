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

// Bug #367: a second, stale copy of the value baseline lived here (BASELINE, baselineRate, gemEquivalent,
// valuePct) with no callers left. Two computations of one number is how the shop came to name the $4.99 pack
// while quoting the $2.99 pack's rate. The one that ships is catalog.ts: BASELINE_SKU, GEMS_PER_DOLLAR_BASELINE,
// and Economy.ts: skuValuePct().
