import { RELICS, ECON } from './catalog';

/**
 * Deepen cycle 1 (DEPTH.md RV-D3): three relic chains, each fed by its own generator.
 * An item id encodes chain and tier: id = chain * 10 + tier. Chain 0 (the Forge) keeps ids 1..9,
 * so every save and every test written before chains existed stays valid.
 */

export interface ChainDef {
  id: number;
  name: string;
  gen: string;
  genBlurb: string;
  maxTier: number;
  unlockRank: number;
  color: number;
  /** multiplier on gold / xp values for this chain (later chains pay more) */
  value: number;
}

export const CHAINS: ChainDef[] = [
  { id: 0, name: 'Forge', gen: 'Forge', genBlurb: 'Metal and gold, hammered from nothing.', maxTier: 9, unlockRank: 1, color: 0xf4c45a, value: 1 },
  { id: 1, name: 'Crypt', gen: 'Crypt Brazier', genBlurb: 'Bone and candle-smoke. The dead are generous.', maxTier: 7, unlockRank: 3, color: 0x7dffb0, value: 1.25 },
  { id: 2, name: 'Star Well', gen: 'Star Well', genBlurb: 'Draw water, get starlight. Nobody asks why.', maxTier: 7, unlockRank: 6, color: 0x9ab8ff, value: 1.5 },
];

export interface ItemDef {
  id: number;
  chain: number;
  tier: number;
  name: string;
  material: string;
  color: number;
  lore: string;
}

const CRYPT: Omit<ItemDef, 'id' | 'chain' | 'tier'>[] = [
  { name: 'Bone Shard', material: 'Bone', color: 0xe8dcc0, lore: 'Someone’s. Once.' },
  { name: 'Grinning Skull', material: 'Bone', color: 0xf2ead8, lore: 'It laughs at the same joke every night.' },
  { name: 'Candle Skull', material: 'Bone & wax', color: 0xffc46a, lore: 'Lit from the inside. Do not ask with what.' },
  { name: 'Canopic Jar', material: 'Alabaster', color: 0x5fd0c0, lore: 'Holds a liver, a lung, or a grudge.' },
  { name: 'Wraith Lantern', material: 'Iron & ghostfire', color: 0x7dffb0, lore: 'The light walks a little behind you.' },
  { name: 'Ossuary Chest', material: 'Bone & bronze', color: 0xd6b27a, lore: 'A family, filed neatly.' },
  { name: 'Lich Phylactery', material: 'Soul-glass', color: 0xb57dff, lore: 'Break it and something, somewhere, finally rests.' },
];
const STAR: Omit<ItemDef, 'id' | 'chain' | 'tier'>[] = [
  { name: 'Stardust Vial', material: 'Glass & dust', color: 0xcfe6ff, lore: 'Shake it and it hums.' },
  { name: 'Meteorite', material: 'Sky-iron', color: 0xff9a5a, lore: 'Still cooling after four thousand years.' },
  { name: 'Brass Astrolabe', material: 'Brass', color: 0xe9c46a, lore: 'Points at stars that moved on long ago.' },
  { name: 'Moon Sickle', material: 'Moonsilver', color: 0xdfe8ff, lore: 'Harvests only at night. Only light.' },
  { name: 'Armillary Sphere', material: 'Gold & glass', color: 0x9ab8ff, lore: 'The sky, folded small enough to carry.' },
  { name: 'Star Lyre', material: 'Starlight', color: 0xc9a8ff, lore: 'Plays the note the universe started on.' },
  { name: 'Heart of the Sky', material: 'Captured star', color: 0xfff2a8, lore: 'Too bright to look at. Too valuable not to.' },
];

export const ITEMS: Record<number, ItemDef> = {};
for (let t = 1; t <= 9; t++) ITEMS[t] = { id: t, chain: 0, tier: t, name: RELICS[t].name, material: RELICS[t].material, color: RELICS[t].color, lore: RELICS[t].lore };
CRYPT.forEach((d, i) => { ITEMS[11 + i] = { id: 11 + i, chain: 1, tier: i + 1, ...d }; });
STAR.forEach((d, i) => { ITEMS[21 + i] = { id: 21 + i, chain: 2, tier: i + 1, ...d }; });
export const ITEM_IDS = Object.keys(ITEMS).map(Number).sort((a, b) => a - b);

export const chainOf = (id: number) => Math.floor(id / 10);
export const tierOf = (id: number) => id % 10;
export const itemId = (chain: number, tier: number) => chain * 10 + tier;
export const isTop = (id: number) => tierOf(id) >= CHAINS[chainOf(id)].maxTier;
export const item = (id: number): ItemDef => ITEMS[id];

/**
 * Bindings: the top tiers of every chain need a relic from another chain, consumed on merge.
 * This is the cross-system interplay the depth review asked for, and it makes keep-vs-merge real.
 * key = the item being created, value = the binding it consumes.
 */
export const BINDINGS: Record<number, number> = {
  7: 13,   // Ruby Crown      <- Candle Skull
  8: 24,   // Star-Metal Ark  <- Moon Sickle
  9: 16,   // Living Relic    <- Ossuary Chest
  15: 4,   // Wraith Lantern  <- Gold Mask
  16: 24,  // Ossuary Chest   <- Moon Sickle
  17: 6,   // Lich Phylactery <- Sapphire Heart
  25: 14,  // Armillary       <- Canopic Jar
  26: 6,   // Star Lyre       <- Sapphire Heart
  27: 16,  // Heart of the Sky <- Ossuary Chest
};

/** Value of an item in "T1 forges": the work it represents. Drives order rewards. */
export function itemWork(id: number): number {
  const t = tierOf(id);
  let w = Math.pow(2, t - 1);
  const b = BINDINGS[id];
  if (b) w += itemWork(b);
  return w * CHAINS[chainOf(id)].value;
}

/**
 * The gold the merges to build this relic have already paid out, bindings included (Board RV-B9). Patron orders are
 * priced from this rather than from abstract "work", because merge gold grows faster than work does: a flat rate per
 * work unit is generous at low tiers and insulting at the top, which is exactly what the Board kept hitting.
 */
export function buildGold(id: number, mergeGold: number[]): number {
  const tier = tierOf(id), v = CHAINS[chainOf(id)].value;
  let total = 0;
  for (let t = 2; t <= tier; t++) total += Math.round((mergeGold[t] ?? 0) * v) * Math.pow(2, tier - t);
  const b = BINDINGS[id];
  if (b) total += buildGold(b, mergeGold);
  return Math.round(total);
}

/** Gold/xp/event tables are per tier; later chains pay a little more. */
export function tierValue(table: number[], id: number) {
  return Math.round((table[tierOf(id)] ?? 0) * CHAINS[chainOf(id)].value);
}

export const GEN_UPGRADE_GOLD: number[] = ECON.genUpgradeGold; // cost to reach level index
export const GEN_MAX_LEVEL = GEN_UPGRADE_GOLD.length - 1;

// ---------------- Patrons (RV-D2) ----------------
export interface PatronDef { id: number; name: string; title: string; hue: number; likes: number; line: string }
export const PATRONS: PatronDef[] = [
  { id: 0, name: 'Marisol', title: 'the Widow', hue: 330, likes: 0, line: 'My husband left debts. I intend to leave jewellery.' },
  { id: 1, name: 'Brother Cask', title: 'of the Ossuary', hue: 120, likes: 1, line: 'The dead lend. The living repay. You understand.' },
  { id: 2, name: 'Lady Venn', title: 'Collector', hue: 45, likes: 0, line: 'I only buy what nobody else can find.' },
  { id: 3, name: 'Ilse', title: 'the Astronomer', hue: 220, likes: 2, line: 'The sky is missing a few pieces. You have them.' },
  { id: 4, name: 'Captain Ossery', title: 'Wreck-diver', hue: 15, likes: 1, line: 'I pay in gold that was underwater an hour ago.' },
  { id: 5, name: 'The Tin Prophet', title: '', hue: 270, likes: 2, line: 'I foresaw this order. I foresaw you would fill it.' },
];
