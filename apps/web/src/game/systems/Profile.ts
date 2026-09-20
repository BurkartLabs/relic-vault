import type { GameState } from './State';
import type { Reward } from '../data/catalog';
import { CHAINS } from '../data/items';

/**
 * Who the player is in the vault, and what ranking up actually gives them (Board: "Level up rewards? Account
 * personalization?").
 *
 * **Personalisation without a text field.** The Board's standing choice for anything player-facing is all ages
 * with safe design: generated names, no free text, no chat. So identity here is *chosen from* rather than
 * *typed*: a keeper name assembled from two word lists, a title earned by play, and a crest. Nothing a player
 * can write, so nothing anyone has to moderate — which is also the only version a studio of agents can operate
 * (see the same reasoning in idea AB#376).
 */

const ADJECTIVES = ['Ashen', 'Gilded', 'Hollow', 'Patient', 'Quiet', 'Iron', 'Amber', 'Salt', 'Ember', 'Pale', 'Lucent', 'Grave', 'Sable', 'Copper'];
const NOUNS = ['Archivist', 'Tallykeeper', 'Custodian', 'Warden', 'Curator', 'Registrar', 'Steward', 'Almoner', 'Sexton', 'Porter', 'Verger', 'Lampwright'];
/**
 * Crests reuse icons the game already draws (UiArt.ts) rather than adding eight new art assets for a cosmetic.
 * A crest the art team never has to make is a crest that ships.
 */
export const CRESTS = ['ic_vault', 'ic_album', 'ic_scroll', 'ic_wheel', 'ic_satchel', 'ic_luck', 'ic_chest', 'ic_boost'] as const;
export type Crest = typeof CRESTS[number];

export interface Profile { adjective: number; noun: number; crest: Crest; title: string | null }

export const defaultProfile = (): Profile => ({ adjective: 0, noun: 0, crest: 'ic_vault', title: null });
export const profileName = (p: Profile) => `${ADJECTIVES[p.adjective % ADJECTIVES.length]} ${NOUNS[p.noun % NOUNS.length]}`;
export const NAME_PARTS = { adjectives: ADJECTIVES, nouns: NOUNS };

/**
 * Titles are earned, never bought, and each one names a specific thing the player did. A title that anybody can
 * have by paying says nothing about them, which is the whole point of wearing one.
 */
export const TITLES: { id: string; label: string; why: string; earned: (s: GameState) => boolean }[] = [
  { id: 'keeper', label: 'Keeper', why: 'Reach Vault Rank 5', earned: (s) => s.rank >= 5 },
  { id: 'archivist', label: 'Archivist', why: 'Complete an album page', earned: (s) => s.pagesDone.some(Boolean) },
  { id: 'patron', label: 'Patron of the Vault', why: 'Fill 50 patron orders', earned: (s) => s.stats.orders >= 50 },
  { id: 'ascendant', label: 'Ascendant', why: 'Ascend a relic', earned: (s) => s.stats.maxTier >= 9 },
  { id: 'binder', label: 'Binder', why: 'Complete 25 bindings', earned: (s) => s.stats.bindings >= 25 },
  { id: 'lamplighter', label: 'Lamplighter', why: 'Wake every generator', earned: (s) => CHAINS.every((c) => (s.gens[c.id] ?? 0) > 0) },
  { id: 'deep', label: 'Of the Deep Vault', why: 'Reach Vault Rank 20', earned: (s) => s.rank >= 20 },
];

export const earnedTitles = (s: GameState) => TITLES.filter((t) => t.earned(s));

/**
 * What a rank-up gives. Ranking up used to pay a flat 3 gems and nothing else, which made the single most
 * frequent progression moment in the game the least interesting one.
 *
 * Every rank still pays its gems; these are on top, and they are deliberately uneven. A reward on every rank
 * becomes wallpaper — the player stops reading it. Landmarks at 3, 6 and 10 line up with what actually changes
 * (the Crypt Brazier wakes at 3, the Star Well at 6), so the reward arrives at the moment the game opens up.
 */
export const RANK_REWARDS: Record<number, { rewards: Reward[]; note: string }> = {
  2: { rewards: [{ kind: 'gold', n: 500 }], note: 'A little working capital.' },
  3: { rewards: [{ kind: 'chest', n: 1 }, { kind: 'gold', n: 1500 }], note: 'The Crypt Brazier wakes.' },
  4: { rewards: [{ kind: 'relic', tier: 4 }], note: 'A Gold Mask for the dais.' },
  5: { rewards: [{ kind: 'gems', n: 40 }, { kind: 'card', n: 1 }], note: 'The Keeper title is yours.' },
  6: { rewards: [{ kind: 'chest', n: 2 }, { kind: 'gold', n: 6000 }], note: 'The Star Well wakes.' },
  8: { rewards: [{ kind: 'relic', tier: 6 }], note: 'A Sapphire Heart.' },
  10: { rewards: [{ kind: 'gems', n: 120 }, { kind: 'chest', n: 2 }, { kind: 'relic', tier: 7 }], note: 'Ten ranks deep.' },
  15: { rewards: [{ kind: 'gems', n: 150 }, { kind: 'relic', tier: 7 }], note: 'Fifteen.' },
  20: { rewards: [{ kind: 'gems', n: 250 }, { kind: 'relic', tier: 8 }], note: 'Of the Deep Vault.' },
};

/** Every rank the player has passed that still owes them something. Ranks are never skipped or lost. */
export function unclaimedRankRewards(s: GameState): number[] {
  const claimed = new Set((s.rankClaimed ?? []) as number[]);
  return Object.keys(RANK_REWARDS).map(Number).filter((r) => s.rank >= r && !claimed.has(r)).sort((a, b) => a - b);
}
