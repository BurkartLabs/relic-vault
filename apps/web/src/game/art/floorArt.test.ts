import { describe, it, expect } from 'vitest';
import { floorPainterFor, PAINTED_FORMS, CAPSTONE_IDS } from './FloorArt';
import { FLOORS } from '../data/floors';
import { ITEM_IDS } from '../data/items';

// AB#444 slice 1: every floor relic is composed (a form painter plus its floor's finish and ornament) or hand-painted
// (a capstone). Nothing falls through to a recoloured Antechamber relic, or to nothing at all (P-WIRED-NOTHING).
describe('floor relic art routing (AB#444)', () => {
  const floorIds = ITEM_IDS.filter((id) => id >= 30);

  it('every floor relic, ids 30 to 119, resolves to a form painter or a capstone painter', () => {
    expect(floorIds.length).toBe(81); // floors 2-10, nine each (the spec's ninety counts the Antechamber's nine too)
    expect(Math.min(...floorIds)).toBe(31);
    expect(Math.max(...floorIds)).toBe(119);
    for (const id of floorIds) expect(floorPainterFor(id), `relic ${id}`).not.toBeNull();
  });

  it('each relic is drawn by the form data/floors.ts names for it', () => {
    for (const id of floorIds) {
      const r = floorPainterFor(id)!;
      if (r.kind !== 'form') continue;
      const floor = FLOORS.findIndex((f) => f.chain === Math.floor(id / 10));
      expect(r.form, `relic ${id}`).toBe(FLOORS[floor].relics[(id % 10) - 1].form);
    }
  });

  it('every form a floor uses has a painter', () => {
    const used = new Set(FLOORS.slice(1).flatMap((f) => f.relics.map((r) => r.form)));
    for (const form of used) expect(PAINTED_FORMS).toContain(form);
    expect(PAINTED_FORMS).toHaveLength(12);
  });

  it('the Drowned Wing, the Glass Orchard and the Ash Kilns capstones are hand-painted', () => {
    expect([...CAPSTONE_IDS].sort()).toEqual([39, 49, 59]);
    for (const id of [39, 49, 59]) expect(floorPainterFor(id)).toEqual({ kind: 'capstone', id });
  });

  it('nothing outside the floor ladders routes here', () => {
    for (const id of [0, 1, 9, 11, 17, 21, 27, 30, 40, 120]) expect(floorPainterFor(id), `id ${id}`).toBeNull();
  });
});
