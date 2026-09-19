import { ECON } from '../data/catalog';
import type { GameState } from './State';

/**
 * Hidden luck stat. Raises forge high-tier chance and chest upgrade chance.
 * Capped so whales are faster, not gods.
 */
export function computeLuck(s: GameState): number {
  const cards = s.album.reduce((a, b) => a + (b > 0 ? 1 : 0), 0);
  let luck = ECON.luckBase
    + 0.01 * cards
    + (s.ent.passPremium ? 0.04 : 0)
    + (s.ent.vip ? 0.02 : 0)
    + (0.01 * Math.min(s.rank, 10)) / 10
    + 0.01 * s.pagesDone.filter(Boolean).length
    + 0.002 * s.crumbs;
  return Math.min(ECON.luckCap, luck);
}
