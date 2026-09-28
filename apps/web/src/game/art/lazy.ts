/**
 * AB#4737: art painted the first time anything asks for it, and kept for the session.
 *
 * Every procedural texture used to be painted at boot, though most are not on the first screen (the shop's ribbons
 * and seals, the wheel, the piggy bank, the album's cards) and on a low-end phone each one costs frames the player
 * spends looking at a progress bar. A texture registered here is painted on its first lookup instead, through the
 * TextureManager's own get/getFrame, which every `add.image`, `add.particles` and `setTexture` goes through, so no
 * screen that draws one has to know it is lazy. `exists` answers yes for a registered key, as it did when every key
 * was painted at boot. Painted once: the texture stays in the manager for the rest of the session.
 */

export interface TextureLookup {
  list: Record<string, unknown>;
  get(key?: unknown): unknown;
  getFrame(key?: unknown, frame?: unknown): unknown;
  exists(key?: unknown): boolean;
}

const painters = new Map<string, () => void>();
const hooked = new WeakSet<object>();

/** Hooks the manager's lookups once; safe to call again. */
export function installLazyTextures(tm: TextureLookup): void {
  if (hooked.has(tm)) return;
  hooked.add(tm);
  const get = tm.get.bind(tm), getFrame = tm.getFrame.bind(tm), exists = tm.exists.bind(tm);
  const ensure = (key: unknown) => {
    if (typeof key !== 'string' || tm.list[key]) return;
    const paint = painters.get(key);
    if (!paint) return;
    painters.delete(key); // before painting: addCanvas refuses a key that exists() says is taken
    paint();
  };
  tm.get = (key?: unknown) => { ensure(key); return get(key); };
  tm.getFrame = (key?: unknown, frame?: unknown) => { ensure(key); return getFrame(key, frame); };
  tm.exists = (key?: unknown) => exists(key) || (typeof key === 'string' && painters.has(key));
}

/** Paints `key` on its first lookup rather than now. */
export function lazyTexture(key: string, paint: () => void): void {
  painters.set(key, paint);
}

/** Keys registered and not yet asked for. */
export const pendingTextures = (): string[] => [...painters.keys()];
