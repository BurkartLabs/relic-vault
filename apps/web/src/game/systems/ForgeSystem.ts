import { ECON } from '../data/catalog';
import { itemId } from '../data/items';
import type { GameState } from './State';
import type { Rng } from './Rng';
import { canForge, place } from './BoardSystem';
import { computeLuck } from './LuckSystem';
import { noteFloorAction } from './Chronicle';

export interface ForgeResult { ok: boolean; reason?: 'full' | 'locked'; index: number; tier: number; item: number; chain: number }

/** Tier roll: T1 normally; luck gives a chance at T2, a quarter of that at T3. */
export function rollForgeTier(luck: number, rng: Rng): number {
  const r = rng();
  if (r < luck * 0.25) return 3;
  if (r < luck) return 2;
  return 1;
}

/** Generator level adds to luck for its own chain only (cap still applies to the base luck). */
export function generatorLuck(s: GameState, chain: number) {
  const lvl = s.gens[chain] || 0;
  return computeLuck(s) + Math.max(0, lvl - 1) * ECON.genLevelLuck;
}

/**
 * Generators are always clickable once unlocked. A full board reports `full` so the UI opens Vault Jammed.
 * Chain 0 is the Forge; 1 the Crypt Brazier; 2 the Star Well.
 */
export function forge(s: GameState, rng: Rng, prefer?: number, chain = 0): ForgeResult {
  if (!(s.gens[chain] > 0)) return { ok: false, reason: 'locked', index: -1, tier: 0, item: 0, chain };
  if (!canForge(s)) return { ok: false, reason: 'full', index: -1, tier: 0, item: 0, chain };
  const tier = prefer !== undefined ? 1 : rollForgeTier(generatorLuck(s, chain), rng);
  const id = itemId(chain, tier);
  const index = place(s, id, rng, prefer);
  if (tier > (s.best[chain] ?? 0)) s.best[chain] = tier;
  s.stats.forges++;
  s.quests.forge++;
  noteFloorAction(s, 'forges');
  return { ok: true, index, tier, item: id, chain };
}
