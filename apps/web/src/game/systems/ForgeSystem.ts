import type { GameState } from './State';
import type { Rng } from './Rng';
import { canForge, place } from './BoardSystem';
import { computeLuck } from './LuckSystem';

export interface ForgeResult { ok: boolean; reason?: 'full'; index: number; tier: number }

/** Tier roll: T1 normally; luck gives a chance at T2, a quarter of that at T3. */
export function rollForgeTier(luck: number, rng: Rng): number {
  const r = rng();
  if (r < luck * 0.25) return 3;
  if (r < luck) return 2;
  return 1;
}

/** Forge is always clickable. When the board is full it reports `full` so the UI opens Vault Jammed. */
export function forge(s: GameState, rng: Rng, prefer?: number): ForgeResult {
  if (!canForge(s)) return { ok: false, reason: 'full', index: -1, tier: 0 };
  const tier = prefer !== undefined ? 1 : rollForgeTier(computeLuck(s), rng);
  const index = place(s, tier, rng, prefer);
  s.stats.forges++;
  s.quests.forge++;
  return { ok: true, index, tier };
}
