/**
 * AB#444 slice 5: the chapter card, what the player is told on arriving somewhere (a floor below, the same floor
 * again, or the Antechamber on a fresh game), as data. Pure: the card (ui/FloorIntro.ts) only draws this.
 */
import { COPY } from '../data/catalog';
import { floorDef, FLOOR_COUNT, CAPSTONE_TIER } from '../data/floors';
import { itemId } from '../data/items';
import type { GameState } from './State';

/** first: a fresh game's Chapter 1; descend / restore: an arrival; review: re-read from the Chronicle. */
export type ChapterKind = 'first' | 'descend' | 'restore' | 'review';

export interface ChapterCard {
  kind: ChapterKind;
  floor: number;
  /** "Chapter 2", and "again" on a restore */
  chapter: number;
  again: boolean;
  name: string;
  subtitle: string;
  material: string;
  gen: string;
  genBlurb: string;
  /** the capstone, shown veiled: what the player will make here */
  capstone: number;
  /** Renown after arriving, and what this arrival added (0 on a descent, 1 on a restore); null when not an arrival */
  renown: number | null;
  renownGained: number;
  /** the relic carried down or kept on the board, if one was */
  memento?: number;
  keeper: string;
}

/** What the card says for `kind` on `floor` (the current one by default). `change` is what descend/restore returned. */
export function chapterCard(s: GameState, kind: ChapterKind, change: { memento?: number; renown?: number } = {}, floor = s.floor ?? 0): ChapterCard {
  const f = Math.max(0, Math.min(FLOOR_COUNT - 1, floor));
  const def = floorDef(f);
  const arrival = kind === 'descend' || kind === 'restore';
  return {
    kind,
    floor: f,
    chapter: f + 1,
    again: kind === 'restore',
    name: def.name,
    subtitle: def.subtitle,
    material: COPY.chapterMaterials[f],
    gen: def.gen,
    genBlurb: def.genBlurb,
    capstone: itemId(def.chain, CAPSTONE_TIER),
    renown: arrival ? (change.renown ?? s.renown ?? 0) : null,
    renownGained: kind === 'restore' ? 1 : 0,
    memento: arrival ? change.memento : undefined,
    keeper: kind === 'restore' ? COPY.chapterAgainKeeper : COPY.chapterKeeper[f],
  };
}

/** A fresh game shows Chapter 1 once, after the age gate and before the first forge hint. */
export function firstChapterDue(s: GameState): boolean {
  return !s.flags?.chapter1 && (s.floor ?? 0) === 0 && (s.stats?.merges ?? 0) === 0 && (s.flags?.tut ?? 0) === 0;
}

export function markFirstChapter(s: GameState) {
  s.flags.chapter1 = 1;
}
