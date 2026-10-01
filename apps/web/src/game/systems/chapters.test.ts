import { describe, it, expect } from 'vitest';
import { createState } from './State';
import { chapterCard, firstChapterDue, markFirstChapter } from './Chapters';
import { COPY } from '../data/catalog';
import { FLOORS, FLOOR_COUNT } from '../data/floors';
import { ITEMS } from '../data/items';

// AB#444 slice 5: what the chapter card says, for every floor and every way of arriving.
describe('the chapter card (AB#444)', () => {
  it('every floor has its material line and its Keeper line, in COPY', () => {
    expect(COPY.chapterMaterials).toHaveLength(FLOOR_COUNT);
    expect(COPY.chapterKeeper).toHaveLength(FLOOR_COUNT);
    for (let f = 0; f < FLOOR_COUNT; f++) {
      const c = chapterCard(createState(), 'review', {}, f);
      expect(c.chapter).toBe(f + 1);
      expect(c.name).toBe(FLOORS[f].name);
      expect(c.gen).toBe(FLOORS[f].gen);
      expect(c.material.length).toBeGreaterThan(10);
      expect(c.keeper.length).toBeGreaterThan(10);
      expect(ITEMS[c.capstone].name).toBe(FLOORS[f].relics[8].name); // the veiled capstone is this floor's ninth
    }
  });

  it('a descent says the chapter, the Renown held and the relic carried down', () => {
    const s = createState();
    s.floor = 1; s.renown = 2;
    const c = chapterCard(s, 'descend', { memento: 14, renown: 2 });
    expect(c).toMatchObject({ chapter: 2, again: false, name: 'The Drowned Wing', renown: 2, renownGained: 0, memento: 14 });
    expect(c.keeper).toBe(COPY.chapterKeeper[1]);
  });

  it('a restore is the same chapter "again", with +1 Renown and its own Keeper line', () => {
    const s = createState();
    s.floor = 2; s.renown = 3;
    const c = chapterCard(s, 'restore', { renown: 3 });
    expect(c).toMatchObject({ chapter: 3, again: true, renown: 3, renownGained: 1, memento: undefined });
    expect(c.keeper).toBe(COPY.chapterAgainKeeper);
  });

  it('a fresh game and a re-read show no Renown or memento: nothing arrived', () => {
    expect(chapterCard(createState(), 'first')).toMatchObject({ chapter: 1, renown: null, memento: undefined, name: 'The Antechamber' });
    expect(chapterCard(createState(), 'review', { memento: 5 }, 3).memento).toBeUndefined();
  });

  it('Chapter 1 is due once, on a fresh game only', () => {
    const s = createState();
    expect(firstChapterDue(s)).toBe(true);
    markFirstChapter(s);
    expect(firstChapterDue(s)).toBe(false); // a reload does not show it again
    const played = createState();
    played.stats.merges = 12; // an existing save meets no Chapter 1
    expect(firstChapterDue(played)).toBe(false);
    const deeper = createState();
    deeper.floor = 3;
    expect(firstChapterDue(deeper)).toBe(false);
  });
});
