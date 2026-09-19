import { BOARD_COLS, BOARD_SIZE, ECON } from '../data/catalog';
import { chainOf, tierOf, itemWork, tierValue, BINDINGS, isTop } from '../data/items';
import type { GameState } from './State';
import type { Rng } from './Rng';

export const idx = (c: number, r: number) => r * BOARD_COLS + c;
export const col = (i: number) => i % BOARD_COLS;
export const row = (i: number) => Math.floor(i / BOARD_COLS);

export function empties(s: GameState): number[] {
  const out: number[] = [];
  for (let i = 0; i < BOARD_SIZE; i++) if (s.board[i] === 0) out.push(i);
  return out;
}

export function canForge(s: GameState): boolean {
  return s.board.some((t) => t === 0);
}

export function fillRatio(s: GameState): number {
  return s.board.filter((t) => t > 0).length / BOARD_SIZE;
}

export function neighbours(i: number): number[] {
  const c = col(i), r = row(i), out: number[] = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + dc, nr = r + dr;
    if (nc >= 0 && nc < BOARD_COLS && nr >= 0 && nr < BOARD_SIZE / BOARD_COLS) out.push(idx(nc, nr));
  }
  return out;
}

/** Track the best tier per chain (and the Forge chain's legacy maxTier). `id` is an item id. */
export function noteBest(s: GameState, id: number) {
  const c = chainOf(id), t = tierOf(id);
  if (t > (s.best[c] ?? 0)) s.best[c] = t;
  if (c === 0 && t > s.stats.maxTier) s.stats.maxTier = t;
}

/** Place a relic (item id) in a random empty socket (or preferred). Returns index or -1. */
export function place(s: GameState, tier: number, rng: Rng, prefer?: number): number {
  if (prefer !== undefined && s.board[prefer] === 0) {
    s.board[prefer] = tier;
    return prefer;
  }
  const e = empties(s);
  if (!e.length) return -1;
  const i = e[Math.floor(rng() * e.length)];
  s.board[i] = tier;
  noteBest(s, tier);
  return i;
}

/** Place or, if full, queue into the satchel so nothing is ever lost. */
export function placeOrStash(s: GameState, tier: number, rng: Rng, prefer?: number): number {
  const i = place(s, tier, rng, prefer);
  if (i < 0) s.satchel.push(tier);
  return i;
}

export function sellValue(id: number): number {
  return tierValue(ECON.sellGold, id);
}

export function sell(s: GameState, i: number): { ok: boolean; gold: number; tier: number } {
  const tier = s.board[i];
  if (!tier) return { ok: false, gold: 0, tier: 0 };
  const gold = sellValue(tier);
  s.board[i] = 0;
  s.gold += gold;
  s.stats.sells++;
  return { ok: true, gold, tier };
}

export function move(s: GameState, from: number, to: number): boolean {
  if (from === to || !s.board[from]) return false;
  const a = s.board[from];
  s.board[from] = s.board[to];
  s.board[to] = a;
  return true;
}

/** Indices of the n lowest-tier relics (for gem-clear). */
export function lowest(s: GameState, n: number): number[] {
  return s.board
    .map((t, i) => ({ t, i }))
    .filter((x) => x.t > 0)
    .sort((a, b) => itemWork(a.t) - itemWork(b.t) || a.i - b.i)
    .slice(0, n)
    .map((x) => x.i);
}

/** Is a merge of item `id` possible right now (its binding, if any, is on the board)? */
export function bindingReady(s: GameState, id: number, a: number, b: number) {
  if (isTop(id)) return true;
  const need = BINDINGS[id + 1];
  if (!need) return true;
  return s.board.some((t, i) => t === need && i !== a && i !== b);
}

/** Any pair on the board that could merge right now (bindings respected). */
export function findPair(s: GameState): [number, number] | null {
  const seen = new Map<number, number>();
  for (let i = 0; i < BOARD_SIZE; i++) {
    const t = s.board[i];
    if (!t) continue;
    if (seen.has(t) && bindingReady(s, t, seen.get(t)!, i)) return [seen.get(t)!, i];
    if (!seen.has(t)) seen.set(t, i);
  }
  return null;
}
