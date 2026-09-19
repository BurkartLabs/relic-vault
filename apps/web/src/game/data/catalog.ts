import econ from './economy.json';

export const ECON = econ;

export interface RelicDef {
  tier: number;
  name: string;
  material: string;
  color: number; // accent / glow color
  lore: string;
}

export const RELICS: RelicDef[] = [
  { tier: 0, name: '', material: '', color: 0, lore: '' },
  { tier: 1, name: 'Flint Shard', material: 'Flint', color: 0xc9b8a4, lore: 'Chipped from the vault floor. Still warm from whatever struck it.' },
  { tier: 2, name: 'Copper Idol', material: 'Copper', color: 0xe08a4c, lore: 'A squat little god. It prefers to be carried face-down.' },
  { tier: 3, name: 'Silver Urn', material: 'Silver', color: 0xcfe0f0, lore: 'Sealed. Rattles when no one is holding it.' },
  { tier: 4, name: 'Gold Mask', material: 'Gold', color: 0xf4c45a, lore: 'Worn by a king who paid in advance for his own burial.' },
  { tier: 5, name: 'Emerald Scarab', material: 'Emerald', color: 0x3fe39a, lore: 'It pushes the sun. It would like to push yours.' },
  { tier: 6, name: 'Sapphire Heart', material: 'Sapphire', color: 0x7ee0ff, lore: 'Beats once a century. You are early.' },
  { tier: 7, name: 'Ruby Crown', material: 'Ruby', color: 0xff4d6d, lore: 'Every head it rested on was very briefly the richest.' },
  { tier: 8, name: 'Star-Metal Ark', material: 'Star-metal', color: 0xc7b8ff, lore: 'Forged from something that fell. Something else is still falling.' },
  { tier: 9, name: 'Living Relic', material: 'Living gold', color: 0xff7ad9, lore: 'It watches the vault. The vault, for once, watches back.' },
];

export const MAX_TIER = econ.maxTier;
export const BOARD_COLS = econ.boardCols;
export const BOARD_ROWS = econ.boardRows;
export const BOARD_SIZE = BOARD_COLS * BOARD_ROWS;

// ---- Chest odds (disclosed) ----
export const CHEST_ODDS: { tier: number; chance: number }[] = [
  { tier: 2, chance: 0.45 },
  { tier: 3, chance: 0.33 },
  { tier: 4, chance: 0.14 },
  { tier: 5, chance: 0.06 },
  { tier: 6, chance: 0.02 },
];

// ---- SKUs ----
export type SkuId =
  | 'welcome' | 'gems200' | 'gems500' | 'gems1200' | 'chest_cash' | 'piggy'
  | 'pass' | 'noads' | 'vip' | 'comeback';

export interface Sku {
  id: SkuId;
  title: string;
  price: number; // USD
  gems?: number;
  gold?: number;
  badge?: 'POPULAR' | 'BEST VALUE' | 'ONE TIME' | 'SALE';
  blurb: string;
  oneTime?: boolean;
  random?: boolean; // contains randomized contents (loot box)
}

export const SKUS: Record<SkuId, Sku> = {
  welcome: { id: 'welcome', title: 'Keeper’s Welcome', price: 1.99, gems: 120, gold: 10000, badge: 'ONE TIME', oneTime: true,
    blurb: '120 gems, 10,000 gold, two Gold Masks, a Silver Urn and a Lucky Chest on the house.' },
  gems200: { id: 'gems200', title: 'Pouch of Gems', price: 4.99, gems: 200, blurb: 'A modest tithe.' },
  gems500: { id: 'gems500', title: 'Chest of Gems', price: 9.99, gems: 500, badge: 'POPULAR', blurb: 'The vault’s preferred offering.' },
  gems1200: { id: 'gems1200', title: 'Hoard of Gems', price: 19.99, gems: 1200, badge: 'BEST VALUE', blurb: 'For keepers who intend to stay.' },
  chest_cash: { id: 'chest_cash', title: 'Lucky Chest', price: 2.99, random: true, blurb: 'One Lucky Chest, opened now. Odds are on the card.' },
  piggy: { id: 'piggy', title: 'Smash the Pig', price: 2.99, blurb: 'Everything it swallowed, times four. Plus 15 gems.' },
  pass: { id: 'pass', title: 'Keeper’s Pass', price: 9.99, blurb: 'Premium track: gems, a wildcard card, the Gilded skin, +4% luck.' },
  noads: { id: 'noads', title: 'Silence the Criers', price: 7.99, blurb: 'Removes interstitials and the shop banner. Rewarded ads stay optional.' },
  vip: { id: 'vip', title: 'Vault VIP', price: 9.99, blurb: 'Monthly. Daily crate, +2% luck, a crown, no ads.' },
  comeback: { id: 'comeback', title: 'So Close Bundle', price: 2.99, gems: 60, gold: 1500, badge: 'SALE', oneTime: true,
    blurb: 'An Emerald Scarab, 60 gems and 1,500 gold. The next tier is right there.' },
};

/** Baseline gem rate for every "value" ribbon: the entry $4.99 pack (see systems/Offers.ts). */
export const GEMS_PER_DOLLAR_BASELINE = 200 / 4.99;

/** Computed, never hardcoded: gem-equivalent per dollar vs the baseline. Welcome counts its chest at 40 gems. */
export function skuValuePct(id: SkuId): number {
  const s = SKUS[id];
  if (!s.gems) return 0;
  const gemEq = s.gems + (id === 'welcome' ? econ.chestGemCost : 0);
  return Math.round(((gemEq / s.price) / GEMS_PER_DOLLAR_BASELINE) * 100);
}

// ---- Album ----
export interface CardDef { id: number; page: number; name: string; tier: number; hue: number }
export const ALBUM_PAGES = [
  { name: 'The Forge Road', color: 0xe08a4c, reward: 'Forge Banner', luck: 0.01 },
  { name: 'The Drowned Crypt', color: 0x3fb8c8, reward: 'Crypt Chandelier', luck: 0.01 },
  { name: 'The Star Choir', color: 0xb58cff, reward: 'Star Orrery', luck: 0.01 },
];
// Card names are "<page theme> <relic noun>" so every name matches the relic painted on its card.
const CARD_PREFIX = [
  ['Ember', 'Soot', 'Bellows', 'Slag', 'Anvil', 'Rivet', 'Hammer', 'Quench', 'Coal', 'Tin', 'Smelter’s', 'First-Spark'],
  ['Brine', 'Kelp', 'Pearl', 'Drowned', 'Silt', 'Tide', 'Barnacle', 'Salt', 'Moon', 'Coral', 'Wreck', 'Sunken'],
  ['Comet', 'Orbit', 'Void', 'Halo', 'Starling', 'Nebula', 'Zenith', 'Meteor', 'Night', 'Astral', 'Choir', 'Last-Star'],
];
const RELIC_NOUN = ['', 'Shard', 'Idol', 'Urn', 'Mask', 'Scarab', 'Heart', 'Crown', 'Ark', 'Eye'];
export const CARDS: CardDef[] = Array.from({ length: 36 }, (_, i) => {
  const page = Math.floor(i / 12);
  const tier = 1 + ((i * 5 + page) % 9);
  return { id: i, page, tier, hue: (i * 37) % 360, name: `${CARD_PREFIX[page][i % 12]} ${RELIC_NOUN[tier]}` };
});
export const CARDS_PER_PAGE = 12;

// ---- Season pass ----
export type Reward =
  | { kind: 'gold'; n: number }
  | { kind: 'gems'; n: number }
  | { kind: 'chest'; n: number }
  | { kind: 'card'; n: number }
  | { kind: 'relic'; tier: number }
  | { kind: 'skin' }
  | { kind: 'crumb'; n: number };

export const PASS_FREE: Reward[] = Array.from({ length: econ.passTiers }, (_, i): Reward => {
  const t = i + 1;
  if (t % 5 === 0) return { kind: 'chest', n: 1 };
  if (t % 3 === 0) return { kind: 'crumb', n: 1 };
  return { kind: 'gold', n: 80 + t * 30 };
});
export const PASS_PREMIUM: Reward[] = Array.from({ length: econ.passTiers }, (_, i): Reward => {
  const t = i + 1;
  if (t === 8) return { kind: 'card', n: 1 };
  if (t === 20) return { kind: 'skin' };
  if (t % 4 === 0) return { kind: 'chest', n: 1 };
  if (t % 5 === 0) return { kind: 'relic', tier: 5 };
  return { kind: 'gems', n: 10 + Math.floor(t / 2) * 5 };
});

// ---- Event: Gold Rush milestones ----
export const EVENT_MILESTONES: { pts: number; reward: Reward }[] = [
  { pts: 15, reward: { kind: 'gold', n: 150 } },
  { pts: 50, reward: { kind: 'gems', n: 5 } },
  { pts: 120, reward: { kind: 'chest', n: 1 } },
  { pts: 250, reward: { kind: 'gold', n: 800 } },
  { pts: 450, reward: { kind: 'card', n: 1 } },
  { pts: 750, reward: { kind: 'gems', n: 25 } },
  { pts: 1200, reward: { kind: 'relic', tier: 6 } },
  { pts: 2000, reward: { kind: 'chest', n: 2 } },
  { pts: 3500, reward: { kind: 'gems', n: 80 } },
  { pts: 6000, reward: { kind: 'relic', tier: 8 } },
];

// ---- Wheel ----
export const WHEEL: { reward: Reward; weight: number; label: string }[] = [
  { reward: { kind: 'gold', n: 50 }, weight: 26, label: '50' },
  { reward: { kind: 'gold', n: 120 }, weight: 22, label: '120' },
  { reward: { kind: 'gems', n: 3 }, weight: 6, label: '3' },
  { reward: { kind: 'gold', n: 250 }, weight: 16, label: '250' },
  { reward: { kind: 'gold', n: 80 }, weight: 18, label: '80' },
  { reward: { kind: 'gold', n: 500 }, weight: 7, label: '500' },
  { reward: { kind: 'gems', n: 20 }, weight: 1.5, label: '20' },
  { reward: { kind: 'gold', n: 1000 }, weight: 3.5, label: '1K' },
];

// ---- Copy ----
export const COPY = {
  firstMerge: 'The vault pays those who fuse.',
  forgeHint: 'Forge a relic',
  mergeHint: 'Drag one onto its twin',
  welcomeLine: 'A gift, keeper. Mostly a gift.',
  comebackLine: 'So close to the next tier. It would be a shame to stop now.',
  jammedLine: 'The vault is full. The vault is never full for long.',
  piggyLine: 'The pig has eaten well. Break it, and eat better.',
  passLine: 'You earned a milestone. The premium track would have paid double.',
  doubleLine: 'The criers liked you. The shop likes you more.',
  shopLine: 'Everything here is priced fairly. For me.',
  vipLine: 'Some keepers wear crowns.',
  rankUp: 'The vault remembers your name.',
};
