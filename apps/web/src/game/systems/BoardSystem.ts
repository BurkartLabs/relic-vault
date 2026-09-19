import { BOARD_COLS, BOARD_SIZE, ECON } from '../data/catalog';
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

/** Place a relic in a random empty socket (or preferred). Returns index or -1. */
export function place(s: GameState, tier: number, rng: Rng, prefer?: number): number {
  if (prefer !== undefined && s.board[prefer] === 0) {
    s.board[prefer] = tier;
    return prefer;
  }
  const e = empties(s);
  if (!e.length) return -1;
  const i = e[Math.floor(rng() * e.length)];
  s.board[i] = tier;
  if (tier > s.stats.maxTier) s.stats.maxTier = tier;
  return i;
}

/** Place or, if full, queue into the satchel so nothing is ever lost. */
export function placeOrStash(s: GameState, tier: number, rng: Rng, prefer?: number): number {
  const i = place(s, tier, rng, prefer);
  if (i < 0) s.satchel.push(tier);
  return i;
}

export function sellValue(tier: number): number {
  return ECON.sellGold[tier] ?? 0;
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
    .sort((a, b) => a.t - b.t || a.i - b.i)
    .slice(0, n)
    .map((x) => x.i);
}

/** Any pair on the board that could merge right now. */
export function findPair(s: GameState): [number, number] | null {
  const seen = new Map<number, number>();
  for (let i = 0; i < BOARD_SIZE; i++) {
    const t = s.board[i];
    if (!t || t >= ECON.maxTier + 1) continue;
    if (seen.has(t)) return [seen.get(t)!, i];
    seen.set(t, i);
  }
  return null;
}
