import type { GameState } from './State';
import type { Reward } from '../data/catalog';
import { EVENT_MILESTONES } from '../data/catalog';
import { mulberry32 } from './Rng';

/**
 * Gold Rush standings, and the rewards for placing in them (Board request: "there should be special rewards for
 * Gold Rush as well — both for completing the most milestones, and for having the highest score compared to
 * other players over a given period of time").
 *
 * ------------------------------------------------------------------------------------------------------
 * THE KEEPERS ARE NOT PLAYERS, AND THE GAME SAYS SO.
 * ------------------------------------------------------------------------------------------------------
 * The Board asked for dummy data until real players exist. Soul forbids fabricated social proof, and a board
 * full of invented rivals presented as people is exactly that — so these are **Vault Keepers**: named
 * automatons, described as automatons everywhere they appear, competing on a published curve. The player is
 * told they are practising against the vault itself. When real players arrive they take the same slots and the
 * label changes; nothing else does.
 *
 * Names are generated, fixed, and contain no free text (the Board's standing all-ages choice for leaderboards:
 * generated names, no chat, no player-authored strings anywhere).
 */

export interface Standing {
  id: string;
  name: string;
  points: number;
  milestones: number;
  isPlayer: boolean;
  /** false for every Keeper: the UI must be able to say what this row is. */
  isHuman: boolean;
}

const FIRST = ['Ashen', 'Gilded', 'Hollow', 'Patient', 'Quiet', 'Iron', 'Amber', 'Salt', 'Ember', 'Pale', 'Old', 'Lucent'];
const SECOND = ['Archivist', 'Tallykeeper', 'Custodian', 'Warden', 'Curator', 'Registrar', 'Steward', 'Almoner', 'Sexton', 'Porter', 'Clerk', 'Verger'];

/** 24 keepers, stable for a cycle: the same names and the same curve every time the panel opens. */
export const KEEPER_COUNT = 24;

/**
 * A keeper's score for this cycle. Deterministic from the cycle and the keeper index, so the board does not
 * reshuffle under the player between two looks at it — a leaderboard that changes when you blink teaches the
 * player it is noise.
 *
 * The curve is deliberately beatable: the top keeper lands around the 7th milestone, not beyond the last one,
 * so a committed player can win a cycle and a casual one can place respectably. It is a practice ladder, not a
 * wall.
 */
export function keeperPoints(cycle: number, i: number): number {
  const rng = mulberry32(cycle * 1000 + i * 17 + 7);
  const top = EVENT_MILESTONES[6]?.pts ?? 1200; // the 7th milestone
  const place = i / Math.max(1, KEEPER_COUNT - 1); // 0 = strongest
  const curve = Math.pow(1 - place, 2.1); // a few strong, a long tail
  const jitter = 0.82 + rng() * 0.36;
  return Math.max(4, Math.round(top * curve * jitter));
}

export function keeperName(i: number): string {
  return `${FIRST[i % FIRST.length]} ${SECOND[(i * 5 + 3) % SECOND.length]}`;
}

const milestonesFor = (points: number) => EVENT_MILESTONES.filter((m) => points >= m.pts).length;

/** The full board for a cycle, highest first, with the player placed on merit. */
export function standings(s: GameState): Standing[] {
  const rows: Standing[] = [];
  for (let i = 0; i < KEEPER_COUNT; i++) {
    const points = keeperPoints(s.event.cycle, i);
    rows.push({ id: `keeper-${i}`, name: keeperName(i), points, milestones: milestonesFor(points), isPlayer: false, isHuman: false });
  }
  rows.push({ id: 'you', name: 'You', points: s.event.points, milestones: milestonesFor(s.event.points), isPlayer: true, isHuman: true });
  // ties go to the keeper: the player has to actually beat a score to pass it, never merely match it
  rows.sort((a, b) => b.points - a.points || (a.isPlayer ? 1 : -1));
  return rows;
}

/** Where the player sits right now, 1-based. */
export function playerPlace(s: GameState): number {
  return standings(s).findIndex((r) => r.isPlayer) + 1;
}

/**
 * What placing pays at the end of a cycle. Two separate awards, because the Board asked for two different
 * things and they reward different players: **placing** rewards the highest score, **diligence** rewards
 * completing the most milestones, which a steady player can win without a big final push.
 *
 * Nothing here is purchasable, and the top prize is worth roughly one large gem pack — enough to be worth
 * chasing, not so much that missing a cycle feels like a loss. Rewards for a cycle you did not enter are zero,
 * not a consolation prize: a prize everyone gets is not a prize.
 */
export const PLACE_REWARDS: { upTo: number; label: string; rewards: Reward[] }[] = [
  { upTo: 1, label: 'Vault Champion', rewards: [{ kind: 'gems', n: 300 }, { kind: 'chest', n: 3 }, { kind: 'relic', tier: 7 }] },
  { upTo: 3, label: 'Vault Laureate', rewards: [{ kind: 'gems', n: 150 }, { kind: 'chest', n: 2 }, { kind: 'relic', tier: 6 }] },
  { upTo: 10, label: 'Vault Honoured', rewards: [{ kind: 'gems', n: 60 }, { kind: 'chest', n: 1 }] },
  { upTo: 25, label: 'Vault Listed', rewards: [{ kind: 'gems', n: 20 }] },
];

/** Completing milestones pays on its own, so a steady player is not beaten purely by a late burst of points. */
export const DILIGENCE_REWARDS: { milestones: number; rewards: Reward[] }[] = [
  { milestones: 10, rewards: [{ kind: 'gems', n: 120 }, { kind: 'relic', tier: 6 }] },
  { milestones: 7, rewards: [{ kind: 'gems', n: 60 }, { kind: 'chest', n: 1 }] },
  { milestones: 4, rewards: [{ kind: 'gems', n: 25 }] },
];

export interface CyclePrize { place: number; placeLabel: string | null; placeRewards: Reward[]; milestones: number; diligenceRewards: Reward[] }

/** What the player has earned for the cycle as it stands. Entering at all means at least one point. */
export function cyclePrize(s: GameState): CyclePrize {
  const place = playerPlace(s);
  const ms = milestonesFor(s.event.points);
  const entered = s.event.points > 0;
  const band = entered ? PLACE_REWARDS.find((b) => place <= b.upTo) : undefined;
  const dil = entered ? DILIGENCE_REWARDS.find((d) => ms >= d.milestones) : undefined;
  return {
    place, placeLabel: band?.label ?? null, placeRewards: band?.rewards ?? [],
    milestones: ms, diligenceRewards: dil?.rewards ?? [],
  };
}
