import { describe, it, expect } from 'vitest';
import { keeperLayout } from './keeperLayout';

// Bug #2036: the hint never overlaps the Keeper's line, and a short line sits where it always did.
describe('keeperLayout (Bug #2036)', () => {
  const HINT = 40; // "tap to continue" at size 28 with its padding

  it('leaves a one- or two-line line and the hint where they always were', () => {
    for (const h of [60, 116]) expect(keeperLayout(h, HINT)).toEqual({ msgY: -60, hintY: 140, fits: true });
  });

  it('puts the hint below a six-line line, never over it, inside the box', () => {
    const msgH = 6 * 55 + 8; // six lines of size 44 and the text padding
    const l = keeperLayout(msgH, HINT);
    expect(l.hintY - HINT / 2).toBeGreaterThanOrEqual(l.msgY + msgH / 2);
    expect(l.msgY - msgH / 2).toBeGreaterThanOrEqual(-280 + 36);
    expect(l.fits).toBe(true);
  });

  it('says a line too tall for the box does not fit, so the dialog sets it smaller', () => {
    expect(keeperLayout(9 * 55, HINT).fits).toBe(false);
  });
});
