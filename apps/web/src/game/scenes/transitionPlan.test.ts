import { describe, it, expect } from 'vitest';
import { INPUT_CAP_MS, SKIP_AFTER_MS, prefersReducedMotion, skippable, transitionPlan } from './transitionPlan';

// AB#444 slice 4 (docs/specs/444-..., acceptance 5): the descent's timings.
describe('the descent', () => {
  it('takes 2.5 to 3.5 s, drops, and swaps the vault only after the relics have lifted', () => {
    const p = transitionPlan('descend', false);
    expect(p.total).toBeGreaterThanOrEqual(2500);
    expect(p.total).toBeLessThanOrEqual(3500);
    expect(p.drop).toBe(true);
    expect(p.swapAt).toBeGreaterThan(p.lift * 0.8);
    expect(p.build).toBeGreaterThan(0);
  });

  it('is shorter on a restore, and never drops (this floor again, not a floor below)', () => {
    const d = transitionPlan('descend', false), r = transitionPlan('restore', false);
    expect(r.total).toBeLessThan(d.total);
    expect(r.drop).toBe(false);
  });

  it('is a fade with no lift, drop or build under reduced motion, for either door', () => {
    for (const kind of ['descend', 'restore'] as const) {
      const p = transitionPlan(kind, true);
      expect([p.lift, p.build, p.drop]).toEqual([0, 0, false]);
      expect(p.total).toBeLessThan(transitionPlan(kind, false).total);
    }
  });

  it('can be skipped from 1.2 s, and never holds input past 4 s', () => {
    expect(SKIP_AFTER_MS).toBe(1200);
    expect(skippable(1199)).toBe(false);
    expect(skippable(1200)).toBe(true);
    expect(INPUT_CAP_MS).toBeLessThan(4000);
    for (const kind of ['descend', 'restore'] as const) for (const reduced of [false, true]) expect(transitionPlan(kind, reduced).total).toBeLessThan(INPUT_CAP_MS);
  });

  it('reads reduced motion from the OS setting, and treats a missing matchMedia as no', () => {
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: true }) })).toBe(true);
    expect(prefersReducedMotion({ matchMedia: () => ({ matches: false }) })).toBe(false);
    expect(prefersReducedMotion({})).toBe(false);
  });
});
