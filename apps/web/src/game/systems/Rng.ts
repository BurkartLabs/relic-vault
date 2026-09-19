export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const defaultRng: Rng = Math.random;

export function pickWeighted<T extends { weight: number }>(items: T[], rng: Rng): number {
  const total = items.reduce((a, b) => a + b.weight, 0);
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= items[i].weight;
    if (r < 0) return i;
  }
  return items.length - 1;
}
