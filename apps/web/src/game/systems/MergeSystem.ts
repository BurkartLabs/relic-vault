import { ECON } from '../data/catalog';
import { BINDINGS, CHAINS, chainOf, tierOf, isTop, tierValue } from '../data/items';
import type { GameState } from './State';
import type { Rng } from './Rng';
import { grantGold, feedPiggy, addXp, grantCard, cardDropChance, CardResult } from './Economy';
import { noteAscension } from './Floors';
import { noteFloorAction } from './Chronicle';

export interface MergeResult {
  ok: boolean;
  reason?: 'same' | 'empty' | 'mismatch' | 'binding';
  from: number;
  to: number;
  /** resulting item id (0 when ascended) */
  item: number;
  /** resulting tier within its chain (maxTier + 1 = ascension) */
  tier: number;
  chain: number;
  ascended: boolean;
  /** true when this ascension cleared the floor: its capstone, not the Crypt's or the Star Well's top tier */
  clearedFloor?: boolean;
  gold: number;
  gems: number;
  xp: number;
  rankUps: number;
  eventPts: number;
  /** the binding relic this merge needs (on reason 'binding') or consumed (on success) */
  binding?: number;
  bindingIndex?: number;
  /** AB#381: the binding a Stand-in replaced, when there was none on the board */
  standIn?: number;
  card?: CardResult;
}

export function canMerge(s: GameState, a: number, b: number): boolean {
  return a !== b && s.board[a] > 0 && s.board[a] === s.board[b];
}

/** Where the binding for creating `next` sits on the board (never one of the two merging sockets). */
export function findBinding(s: GameState, next: number, a: number, b: number): number {
  const need = BINDINGS[next];
  if (!need) return -1;
  for (let i = 0; i < s.board.length; i++) if (i !== a && i !== b && s.board[i] === need) return i;
  return -1;
}

/**
 * Merge-2: two identical relics fuse into the next tier of their chain at `b`.
 * Top tiers need a binding relic from another chain, consumed on merge (items.ts BINDINGS).
 * Two relics at a chain's top ascend: both leave the board for a jackpot.
 */
export function merge(s: GameState, a: number, b: number, rng: Rng, now = Date.now()): MergeResult {
  const base: MergeResult = { ok: false, from: a, to: b, item: 0, tier: 0, chain: 0, ascended: false, gold: 0, gems: 0, xp: 0, rankUps: 0, eventPts: 0 };
  if (a === b) return { ...base, reason: 'same' };
  const ia = s.board[a], ib = s.board[b];
  if (!ia || !ib) return { ...base, reason: 'empty' };
  if (ia !== ib) return { ...base, reason: 'mismatch' };

  const chain = chainOf(ia);
  const ascended = isTop(ia);
  const next = ascended ? 0 : ia + 1;
  const need = ascended ? undefined : BINDINGS[next];
  let bindingIndex = -1;
  let standIn: number | undefined;
  if (need) {
    bindingIndex = findBinding(s, next, a, b);
    // AB#381: a relic on the board is used first; a Stand-in only stands in for one that is not there
    if (bindingIndex < 0 && (s.powerUps?.standIn?.[need] ?? 0) > 0) standIn = need;
    if (bindingIndex < 0 && standIn === undefined) return { ...base, chain, item: next, tier: tierOf(next), reason: 'binding', binding: need };
  }

  s.board[a] = 0;
  s.board[b] = next;
  if (bindingIndex >= 0) { s.board[bindingIndex] = 0; s.stats.bindings++; noteFloorAction(s, 'bindings'); }
  if (standIn !== undefined) {
    s.powerUps.standIn[standIn] -= 1;
    if (s.powerUps.standIn[standIn] <= 0) delete s.powerUps.standIn[standIn];
    s.stats.bindings++; noteFloorAction(s, 'bindings');
  }

  const value = CHAINS[chain].value;
  const tier = ascended ? tierOf(ia) + 1 : tierOf(next);
  const gold = ascended ? Math.round(ECON.ascendGold * value) : tierValue(ECON.mergeGold, next);
  const gems = ascended ? Math.round(ECON.ascendGems * value) : 0;
  grantGold(s, gold);
  s.gems += gems;
  const xp = ascended ? Math.round(120 * value) : tierValue(ECON.mergeXp, next);
  const rankUps = addXp(s, xp);

  const boosted = s.event.boostUntil > now;
  const eventPts = (ascended ? Math.round(200 * value) : tierValue(ECON.eventPoints, next)) * (boosted ? 2 : 1);
  s.event.points += eventPts;
  s.pass.xp += ascended ? 20 : tierValue(ECON.passXp, next);

  s.stats.merges++;
  noteFloorAction(s, 'merges');
  // ascending this floor's capstone is what clears the floor and opens the two doors (docs/ROOMS.md)
  const clearedFloor = ascended ? noteAscension(s, chain) : false;
  feedPiggy(s);
  if (!ascended) {
    if (tier > (s.best[chain] ?? 0)) s.best[chain] = tier;
    if (chain === 0 && tier > s.stats.maxTier) s.stats.maxTier = tier;
    if (next === 4) { s.quests.t4++; s.stats.t4Merges++; }
  }

  let card: CardResult | undefined;
  if (!ascended && rng() < cardDropChance(tier)) card = grantCard(s, rng);

  return {
    ok: true, from: a, to: b, item: next, tier: ascended ? CHAINS[chain].maxTier + 1 : tier, chain,
    ascended, clearedFloor, gold, gems, xp, rankUps, eventPts, card,
    binding: need, bindingIndex: bindingIndex >= 0 ? bindingIndex : undefined, standIn,
  };
}

/**
 * The pairs one Auto-Merge makes (AB#381): for every relic with a partner, pairs in board order, as many as its count
 * allows, each needing a binding on the board that no earlier pair in this use has taken. Stand-ins are not spent by
 * it (a player chooses where those go), and a chain's top tier is never ascended by it: that is the player's moment.
 */
export function autoMergePairs(s: GameState): [number, number][] {
  const pairs: [number, number][] = [];
  const taken = new Set<number>();
  const byItem = new Map<number, number[]>();
  s.board.forEach((t, i) => { if (t) byItem.set(t, [...(byItem.get(t) ?? []), i]); });
  for (const [item, cells] of [...byItem].sort((x, y) => x[0] - y[0])) {
    if (isTop(item)) continue;
    const need = BINDINGS[item + 1];
    for (let k = 0; k + 1 < cells.length; k += 2) {
      const a = cells[k], b = cells[k + 1];
      if (need) {
        const bi = s.board.findIndex((t, i) => t === need && i !== a && i !== b && !taken.has(i));
        if (bi < 0) break;
        taken.add(bi);
      }
      pairs.push([a, b]);
      taken.add(a); taken.add(b);
    }
  }
  return pairs;
}

/** Use one Auto-Merge: every pair autoMergePairs finds, merged. Refused, and nothing spent, when there is none. */
export function autoMerge(s: GameState, rng: Rng, now = Date.now()): MergeResult[] | null {
  if ((s.powerUps?.autoMerge ?? 0) <= 0) return null;
  const pairs = autoMergePairs(s);
  if (!pairs.length) return null;
  s.powerUps.autoMerge -= 1;
  const results: MergeResult[] = [];
  for (const [a, b] of pairs) {
    // an earlier merge in this use may have taken the binding it was counting on: skip it rather than spend a Stand-in
    const next = s.board[a] + 1;
    if (s.board[a] !== s.board[b] || !s.board[a] || (BINDINGS[next] && findBinding(s, next, a, b) < 0)) continue;
    const r = merge(s, a, b, rng, now);
    if (r.ok) results.push(r);
  }
  return results;
}
