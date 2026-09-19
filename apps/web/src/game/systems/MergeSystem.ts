import { ECON, MAX_TIER } from '../data/catalog';
import type { GameState } from './State';
import type { Rng } from './Rng';
import { grantGold, addXp, grantCard, cardDropChance, CardResult } from './Economy';

export interface MergeResult {
  ok: boolean;
  reason?: 'same' | 'empty' | 'mismatch';
  from: number;
  to: number;
  tier: number; // resulting tier (10 = ascension)
  ascended: boolean;
  gold: number;
  gems: number;
  xp: number;
  rankUps: number;
  eventPts: number;
  card?: CardResult;
}

export function canMerge(s: GameState, a: number, b: number): boolean {
  return a !== b && s.board[a] > 0 && s.board[a] === s.board[b];
}

/**
 * Merge-2: two relics of the same tier fuse into the next tier at `b`.
 * Two Living Relics (max tier) ascend: they leave the board for a jackpot.
 */
export function merge(s: GameState, a: number, b: number, rng: Rng, now = Date.now()): MergeResult {
  const base: MergeResult = { ok: false, from: a, to: b, tier: 0, ascended: false, gold: 0, gems: 0, xp: 0, rankUps: 0, eventPts: 0 };
  if (a === b) return { ...base, reason: 'same' };
  const ta = s.board[a], tb = s.board[b];
  if (!ta || !tb) return { ...base, reason: 'empty' };
  if (ta !== tb) return { ...base, reason: 'mismatch' };

  const newTier = ta + 1;
  const ascended = ta >= MAX_TIER;
  s.board[a] = 0;
  s.board[b] = ascended ? 0 : newTier;

  const effTier = Math.min(newTier, MAX_TIER);
  const gold = ascended ? ECON.ascendGold : ECON.mergeGold[effTier];
  const gems = ascended ? ECON.ascendGems : 0;
  grantGold(s, gold);
  s.gems += gems;
  const xp = ascended ? 200 : ECON.mergeXp[effTier];
  const rankUps = addXp(s, xp);

  const boosted = s.event.boostUntil > now;
  const eventPts = (ascended ? 400 : ECON.eventPoints[effTier]) * (boosted ? 2 : 1);
  s.event.points += eventPts;
  s.pass.xp += ascended ? 40 : ECON.passXp[effTier];

  s.stats.merges++;
  if (effTier > s.stats.maxTier) s.stats.maxTier = effTier;
  if (effTier === 4) { s.quests.t4++; s.stats.t4Merges++; }

  let card: CardResult | undefined;
  if (rng() < cardDropChance(effTier)) card = grantCard(s, rng);

  return { ok: true, from: a, to: b, tier: ascended ? MAX_TIER + 1 : newTier, ascended, gold, gems, xp, rankUps, eventPts, card };
}
