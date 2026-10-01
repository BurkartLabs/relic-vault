import { describe, it, expect } from 'vitest';
import { FLOOR_LABEL_MAX, FORGE_X, fitScale } from './forgeLabels';

// Bug #4897: the Mirror Stair's SILVERING TROUGH ran into CRYPT and STARS.
describe('the forge row labels', () => {
  it('leave a short floor label at full size and scale a long one down to the room it has', () => {
    expect(fitScale(200)).toBe(1);
    expect(fitScale(FLOOR_LABEL_MAX)).toBe(1);
    expect(fitScale(FLOOR_LABEL_MAX * 1.25) * FLOOR_LABEL_MAX * 1.25).toBeCloseTo(FLOOR_LABEL_MAX);
  });

  it('a label at the maximum stops short of the neighbours on both sides', () => {
    const half = FLOOR_LABEL_MAX / 2, neighbour = 56;
    expect(FORGE_X[0] - half).toBeGreaterThan(FORGE_X[1] + neighbour);
    expect(FORGE_X[0] + half).toBeLessThan(FORGE_X[2] - neighbour);
  });
});
