import { describe, it, expect } from 'vitest';
import { boardIds } from './RelicFactory';
import { FLOORS } from '../data/floors';

// AB#444 slice 4: the board atlas holds this floor's relics, the Crypt's and the Star Well's, and now also whatever the
// player holds from another floor. A memento carried down (the Antechamber's capstone, id 9, on the Drowned Wing) had
// no frame in the new floor's atlas, so the board could not draw it: "Texture relics has no frame r9_0".
describe('the board atlas', () => {
  it('holds a relic carried down from the floor above', () => {
    const floor1 = FLOORS[1].chain;
    expect(boardIds(1)).not.toContain(9); // the Antechamber's chain is not the Drowned Wing's
    const ids = boardIds(1, [0, 9, 0, 9]);
    expect(ids).toContain(9);
    expect(ids.filter((id) => id === 9)).toHaveLength(1);
    expect(ids.some((id) => Math.floor(id / 10) === floor1)).toBe(true);
  });

  it('adds only what is held: empty cells and unknown ids add nothing, so it never grows past what the board can show', () => {
    expect(boardIds(1, [0, 0, 99999])).toEqual(boardIds(1));
    expect(boardIds(1, [9]).length).toBe(boardIds(1).length + 1);
  });
});
