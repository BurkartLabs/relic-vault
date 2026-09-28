import { describe, it, expect } from 'vitest';
import { installLazyTextures, lazyTexture, pendingTextures, type TextureLookup } from './lazy';
import { bootChains, frameItem } from './RelicFactory';
import { floorDef } from '../data/floors';
import { BINDINGS, chainOf } from '../data/items';

/** A texture manager as Phaser's behaves for these three calls: a list, and get/getFrame/exists over it. */
function fakeManager() {
  const list: Record<string, { frames: Record<string, string> }> = { __MISSING: { frames: {} } };
  const tm = {
    list,
    get(key?: unknown) { return list[key as string] ?? list.__MISSING; },
    getFrame(key?: unknown, frame?: unknown) { return this.get(key).frames[frame as string]; },
    exists(key?: unknown) { return !!list[key as string]; },
  };
  return tm;
}

// AB#4737: art painted the first time anything asks for it, not at boot, and then kept.
describe('lazy textures (AB#4737)', () => {
  it('paints a texture on its first lookup, once, and keeps it', () => {
    const tm = fakeManager();
    installLazyTextures(tm as unknown as TextureLookup);
    let painted = 0;
    lazyTexture('t_wheel', () => { painted++; tm.list.t_wheel = { frames: { f: 'the wheel' } }; });
    expect(painted).toBe(0);
    expect(tm.exists('t_wheel')).toBe(true); // registered is as good as painted to anyone asking
    expect((tm.get('t_wheel') as { frames: Record<string, string> }).frames.f).toBe('the wheel');
    expect(tm.getFrame('t_wheel', 'f')).toBe('the wheel');
    tm.get('t_wheel');
    expect(painted).toBe(1);
    expect(pendingTextures()).not.toContain('t_wheel');
  });

  it('paints through getFrame as well, and leaves unregistered and non-string keys alone', () => {
    const tm = fakeManager();
    installLazyTextures(tm as unknown as TextureLookup);
    lazyTexture('t_cards', () => { tm.list.t_cards = { frames: { c3: 'card 3' } }; });
    expect(tm.getFrame('t_cards', 'c3')).toBe('card 3');
    expect(tm.get('nothing-here')).toBe(tm.list.__MISSING);
    expect(tm.exists('nothing-here')).toBe(false);
    expect(() => tm.get(undefined)).not.toThrow();
  });

  it('lets the painter add its own key: the key is no longer registered while it paints', () => {
    const tm = fakeManager();
    installLazyTextures(tm as unknown as TextureLookup);
    let seenDuringPaint: boolean | null = null;
    lazyTexture('t_seal', () => { seenDuringPaint = tm.exists('t_seal'); tm.list.t_seal = { frames: {} }; });
    tm.get('t_seal');
    expect(seenDuringPaint).toBe(false); // Phaser's addCanvas refuses a key exists() says is taken
  });

  it('hooks a manager once however often it is installed', () => {
    const tm = fakeManager();
    installLazyTextures(tm as unknown as TextureLookup);
    const get = tm.get;
    installLazyTextures(tm as unknown as TextureLookup);
    expect(tm.get).toBe(get);
  });
});

describe('which relics a boot paints (AB#4737)', () => {
  it('paints the Crypt, the Star Well and floors 0 to 2, and leaves floors 3 to 9 to their first lookup', () => {
    const first = [0, 1, 2].map((f) => floorDef(f).chain);
    expect(bootChains(0)).toEqual([...new Set([1, 2, ...first])].sort((a, b) => a - b));
    for (let f = 3; f <= 9; f++) expect(bootChains(0)).not.toContain(floorDef(f).chain);
  });

  it("paints every floor down to the player's own", () => {
    expect(bootChains(5)).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 6, 7].map((f) => floorDef(Math.min(f, 5)).chain)));
    expect(bootChains(5)).not.toContain(floorDef(6).chain);
  });

  it('never leaves a binding unpainted: every binding comes from a chain a boot paints', () => {
    for (const from of Object.values(BINDINGS)) expect(bootChains(0)).toContain(chainOf(from));
  });

  it('reads an atlas frame name as its item, and nothing else as one', () => {
    expect(frameItem('R53', 'R')).toBe(53);
    expect(frameItem('i7', 'i')).toBe(7);
    expect(frameItem('i7', 'R')).toBeNull();
    expect(frameItem('R999', 'R')).toBeNull(); // no such item
    expect(frameItem('Rx', 'R')).toBeNull();
    expect(frameItem(3, 'R')).toBeNull();
  });
});
