import { describe, it, expect } from 'vitest';
import { resolveBack, createBackHandler, EXIT_WINDOW_MS, type BackView } from './backButton';

// AB#4728: which surface is topmost decides what Android's back does.
const bare: BackView = { ageGate: false, ready: true, adVeil: null, sheet: false };

describe('the back button (AB#4728)', () => {
  it('closes the open sheet, whatever it is, and nothing under it', () => {
    expect(resolveBack({ ...bare, sheet: true }, null, 0)).toBe('close-sheet');
    // a warning from before the sheet opened does not turn this press into an exit
    expect(resolveBack({ ...bare, sheet: true }, 0, 100)).toBe('close-sheet');
  });

  it('skips an ad only once its skip is offered, and holds before that, even over a sheet', () => {
    expect(resolveBack({ ...bare, adVeil: 'playing', sheet: true }, null, 0)).toBe('hold');
    expect(resolveBack({ ...bare, adVeil: 'skippable', sheet: true }, null, 0)).toBe('skip-ad');
  });

  it('on the bare vault warns first, and leaves on a second press within the window', () => {
    expect(resolveBack(bare, null, 5000)).toBe('warn');
    expect(resolveBack(bare, 5000, 5000 + EXIT_WINDOW_MS)).toBe('exit');
    expect(resolveBack(bare, 5000, 5000 + EXIT_WINDOW_MS + 1)).toBe('warn');
  });

  it('leaves from the age gate and from the loading screen, which are above everything and hold no progress', () => {
    expect(resolveBack({ ...bare, ageGate: true, sheet: true, adVeil: 'playing' }, null, 0)).toBe('exit');
    expect(resolveBack({ ...bare, ready: false }, null, 0)).toBe('exit');
  });
});

describe('pressing back, carried out (AB#4728)', () => {
  const run = (views: BackView[], times: number[]) => {
    const did: string[] = [];
    let i = 0;
    const press = createBackHandler({
      now: () => times[i], view: () => views[i],
      closeSheet: () => did.push('close'), skipAd: () => did.push('skip'), warn: () => did.push('warn'), exit: () => did.push('exit'),
    });
    for (i = 0; i < views.length; i++) press();
    return did;
  };

  it('closes shop, then settings, then an offer, then leaves the vault on the second of two presses', () => {
    const sheet = { ...bare, sheet: true };
    expect(run([sheet, sheet, sheet, bare, bare], [0, 100, 200, 300, 900])).toEqual(['close', 'close', 'close', 'warn', 'exit']);
  });

  it('forgets the warning once anything else happens between the two presses', () => {
    expect(run([bare, { ...bare, sheet: true }, bare], [0, 500, 900])).toEqual(['warn', 'close', 'warn']);
  });

  it('does nothing while an ad cannot yet be skipped, then skips it', () => {
    expect(run([{ ...bare, adVeil: 'playing' }, { ...bare, adVeil: 'skippable' }], [0, 1300])).toEqual(['skip']);
  });
});
