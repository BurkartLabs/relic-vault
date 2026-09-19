import {
  ECON, CARDS, CARDS_PER_PAGE, ALBUM_PAGES, CHEST_ODDS, EVENT_MILESTONES, PASS_FREE, PASS_PREMIUM,
  WHEEL, Reward, MAX_TIER,
} from '../data/catalog';
import type { GameState } from './State';
import { utcDay } from './State';
import { Rng, pickWeighted } from './Rng';
import { computeLuck } from './LuckSystem';
import { placeOrStash, lowest, empties } from './BoardSystem';

// ---------------- currencies ----------------
export function grantGold(s: GameState, n: number) {
  if (n <= 0) return;
  s.gold += n;
  s.piggy = Math.min(ECON.piggyCap, s.piggy + Math.max(1, Math.round(n * ECON.piggyRate)));
}

export function spendGems(s: GameState, n: number): boolean {
  if (s.gems < n) return false;
  s.gems -= n;
  return true;
}

export function spendGold(s: GameState, n: number): boolean {
  if (s.gold < n) return false;
  s.gold -= n;
  return true;
}

/** Piggy "stored value" in cents for display. 1 stored gold == 1 cent. */
export function piggyCents(s: GameState) { return s.piggy; }

// ---------------- rank ----------------
export function xpToNext(rank: number) { return ECON.rankXpBase + (rank - 1) * ECON.rankXpStep; }

export function addXp(s: GameState, n: number): number {
  s.xp += n;
  let ups = 0;
  while (s.xp >= xpToNext(s.rank)) {
    s.xp -= xpToNext(s.rank);
    s.rank++;
    s.gems += ECON.rankGems;
    ups++;
  }
  return ups;
}

// ---------------- album ----------------
export interface CardResult { id: number; duplicate: boolean; pageCompleted: number }

export function grantCard(s: GameState, rng: Rng, missingOnly = false): CardResult {
  const missing = CARDS.filter((c) => !s.album[c.id]).map((c) => c.id);
  let id: number;
  if (missingOnly && missing.length) id = missing[Math.floor(rng() * missing.length)];
  // Bias toward missing cards 60% of the time so the album feels like it moves.
  else if (missing.length && rng() < 0.6) id = missing[Math.floor(rng() * missing.length)];
  else id = Math.floor(rng() * CARDS.length);
  const duplicate = s.album[id] > 0;
  s.album[id]++;
  if (duplicate) s.gems += ECON.duplicateCardGems;
  let pageCompleted = -1;
  const page = CARDS[id].page;
  if (!duplicate && !s.pagesDone[page]) {
    const all = CARDS.filter((c) => c.page === page).every((c) => s.album[c.id] > 0);
    if (all) { s.pagesDone[page] = true; pageCompleted = page; }
  }
  return { id, duplicate, pageCompleted };
}

export function cardsOwned(s: GameState) { return s.album.filter((x) => x > 0).length; }
export function pageOwned(s: GameState, p: number) {
  let n = 0;
  for (let i = p * CARDS_PER_PAGE; i < (p + 1) * CARDS_PER_PAGE; i++) if (s.album[i] > 0) n++;
  return n;
}

export function fillCard(s: GameState, rng: Rng): CardResult | null {
  if (cardsOwned(s) >= CARDS.length) return null;
  if (!spendGems(s, ECON.fillCardGems)) return null;
  return grantCard(s, rng, true);
}

export function cardDropChance(tier: number) {
  if (tier < 4) return 0;
  return ECON.cardDropBase + (tier - 4) * ECON.cardDropPerTier;
}

// ---------------- chests ----------------
export function chestsAllowed(s: GameState) { return s.lootboxesAllowed && s.age !== 'minor'; }

/** Exact-item stand-in for a chest when random contents are not allowed (minors, loot-box-free regions). */
export const CHEST_EXACT_TIER = 4;

/** Grant n chests, or n exact Gold Masks when random rewards are off. Returns placed relics. */
export function grantChests(s: GameState, n: number, rng: Rng): { tier: number; index: number }[] {
  if (chestsAllowed(s)) { s.freeChests += n; return []; }
  const out: { tier: number; index: number }[] = [];
  for (let i = 0; i < n; i++) out.push({ tier: CHEST_EXACT_TIER, index: placeOrStash(s, CHEST_EXACT_TIER, rng) });
  return out;
}

/** Enforce the no-random-rewards rule on an existing profile (e.g. age set after chests were earned). */
export function enforceChestRules(s: GameState, rng: Rng) {
  if (chestsAllowed(s) || s.freeChests <= 0) return;
  const n = s.freeChests;
  s.freeChests = 0;
  for (let i = 0; i < n; i++) s.satchel.push(CHEST_EXACT_TIER);
  void rng;
}

/** Roll a chest tier: disclosed odds, pity every N dry chests, luck upgrade. Pure. */
export function rollChest(s: GameState, rng: Rng): { tier: number; pityHit: boolean; upgraded: boolean } {
  let pityHit = false;
  let pool = CHEST_ODDS;
  if (s.pity >= ECON.pityEvery - 1) {
    pool = CHEST_ODDS.filter((o) => o.tier >= 4);
    pityHit = true;
  }
  const idx = pickWeighted(pool.map((o) => ({ weight: o.chance })), rng);
  let tier = pool[idx].tier;
  let upgraded = false;
  if (rng() < computeLuck(s) && tier < 6) { tier++; upgraded = true; }
  s.pity = tier >= 4 ? 0 : s.pity + 1;
  return { tier, pityHit, upgraded };
}

export interface ChestResult {
  ok: boolean; reason?: 'gems' | 'blocked'; tier: number; index: number; card?: CardResult; pityHit?: boolean; upgraded?: boolean;
}

/** Open a chest. `source` free = welcome/pass/event/vip grant, gems = paid with gems. */
export function openChest(s: GameState, rng: Rng, source: 'free' | 'gems' | 'cash'): ChestResult {
  if (source === 'gems') {
    if (!chestsAllowed(s)) return { ok: false, reason: 'blocked', tier: 0, index: -1 };
    if (!spendGems(s, ECON.chestGemCost)) return { ok: false, reason: 'gems', tier: 0, index: -1 };
  }
  if (source === 'free' || source === 'cash') {
    if (!chestsAllowed(s)) return { ok: false, reason: 'blocked', tier: 0, index: -1 };
  }
  if (source === 'free') {
    if (s.freeChests <= 0) return { ok: false, reason: 'gems', tier: 0, index: -1 };
    s.freeChests--;
  }
  const roll = rollChest(s, rng);
  const index = placeOrStash(s, roll.tier, rng);
  s.stats.chests++;
  s.quests.chest++;
  let card: CardResult | undefined;
  if (rng() < ECON.chestCardChance) card = grantCard(s, rng);
  return { ok: true, tier: roll.tier, index, card, pityHit: roll.pityHit, upgraded: roll.upgraded };
}

// ---------------- deterministic buys ----------------
export function buyExact(s: GameState, tier: number, rng: Rng): number | null {
  if (tier !== 5) return null;
  if (!spendGems(s, ECON.exactT5Gems)) return null;
  return placeOrStash(s, 5, rng);
}

export function buyMarket(s: GameState, tier: number, rng: Rng): number | null {
  const cost = ECON.marketGold[tier];
  if (!cost) return null;
  if (!empties(s).length) return null;
  if (!spendGold(s, cost)) return null;
  return placeOrStash(s, tier, rng);
}

export function gemClear(s: GameState): { ok: boolean; cleared: number[]; gold: number } {
  const lo = lowest(s, 3);
  if (!lo.length || !spendGems(s, ECON.gemClearCost)) return { ok: false, cleared: [], gold: 0 };
  let gold = 0;
  for (const i of lo) { gold += ECON.sellGold[s.board[i]]; s.board[i] = 0; }
  s.gold += gold;
  return { ok: true, cleared: lo, gold };
}

/** Rewarded-ad salvage: remove the lowest relic, pay double its sell value. */
export function adSalvage(s: GameState): { index: number; gold: number } {
  const [i] = lowest(s, 1);
  if (i === undefined) return { index: -1, gold: 0 };
  const gold = ECON.sellGold[s.board[i]] * 2 + 10;
  s.board[i] = 0;
  grantGold(s, gold);
  return { index: i, gold };
}

export function dropFromSatchel(s: GameState, rng: Rng): { index: number; tier: number } | null {
  if (!s.satchel.length) return null;
  const e = empties(s);
  if (!e.length) return null;
  const tier = s.satchel.shift()!;
  const index = e[Math.floor(rng() * e.length)];
  s.board[index] = tier;
  return { index, tier };
}

// ---------------- rewards ----------------
export interface Granted { gold: number; gems: number; chests: number; cards: CardResult[]; relics: { tier: number; index: number }[]; skin: boolean; crumbs: number }
export function emptyGrant(): Granted { return { gold: 0, gems: 0, chests: 0, cards: [], relics: [], skin: false, crumbs: 0 }; }

export function grantReward(s: GameState, r: Reward, rng: Rng, g: Granted = emptyGrant()): Granted {
  switch (r.kind) {
    case 'gold': grantGold(s, r.n); g.gold += r.n; break;
    case 'gems': s.gems += r.n; g.gems += r.n; break;
    case 'chest': { const exact = grantChests(s, r.n, rng); if (exact.length) g.relics.push(...exact); else g.chests += r.n; break; }
    case 'card': for (let i = 0; i < r.n; i++) g.cards.push(grantCard(s, rng, true)); break;
    case 'relic': g.relics.push({ tier: r.tier, index: placeOrStash(s, r.tier, rng) }); break;
    case 'skin': s.ent.skin = true; s.ent.skinOn = true; g.skin = true; break;
    case 'crumb': s.crumbs += r.n; g.crumbs += r.n; break;
  }
  return g;
}

// ---------------- pass ----------------
export function passTier(s: GameState) { return Math.min(ECON.passTiers, Math.floor(s.pass.xp / ECON.passXpPerTier)); }

export function claimPass(s: GameState, tier: number, track: 'free' | 'prem', rng: Rng): Granted | null {
  if (tier < 1 || tier > passTier(s)) return null;
  const list = track === 'free' ? s.pass.free : s.pass.prem;
  if (list.includes(tier)) return null;
  if (track === 'prem' && !s.ent.passPremium) return null;
  list.push(tier);
  const r = (track === 'free' ? PASS_FREE : PASS_PREMIUM)[tier - 1];
  return grantReward(s, r, rng);
}

// ---------------- event ----------------
export function eventMilestoneIndex(s: GameState) {
  let n = 0;
  for (const m of EVENT_MILESTONES) if (s.event.points >= m.pts) n++;
  return n; // number reached
}
export function claimEvent(s: GameState, i: number, rng: Rng): Granted | null {
  if (i < 0 || i >= EVENT_MILESTONES.length) return null;
  if (s.event.points < EVENT_MILESTONES[i].pts || s.event.claimed.includes(i)) return null;
  s.event.claimed.push(i);
  return grantReward(s, EVENT_MILESTONES[i].reward, rng);
}
export function buyBoost(s: GameState, now: number): boolean {
  if (!spendGems(s, ECON.boostGemCost)) return false;
  s.event.boostUntil = Math.max(now, s.event.boostUntil) + ECON.boostMinutes * 60000;
  return true;
}

// ---------------- quests ----------------
export const QUESTS = [
  { id: 0, label: 'Forge 10 relics', goal: 10, key: 'forge' as const },
  { id: 1, label: 'Merge a Gold Mask', goal: 1, key: 't4' as const },
  { id: 2, label: 'Open 1 chest', goal: 1, key: 'chest' as const },
];
export function questProgress(s: GameState, q: number) {
  const d = QUESTS[q];
  return Math.min(d.goal, s.quests[d.key]);
}
export function claimQuest(s: GameState, q: number, now: number): boolean {
  if (s.quests.day !== utcDay(now)) return false;
  if (s.quests.claimed.includes(q) || questProgress(s, q) < QUESTS[q].goal) return false;
  s.quests.claimed.push(q);
  grantGold(s, ECON.questGold);
  s.gems += ECON.questGems;
  return true;
}

// ---------------- wheel ----------------
/** Paying gems for a weighted random prize is a paid random mechanic: off for minors / loot-box-free regions. */
export function wheelGemSpinAllowed(s: GameState) { return chestsAllowed(s); }

export function spinWheel(s: GameState, rng: Rng, pay: 'gems' | 'ad'): { ok: boolean; slot: number; grant?: Granted } {
  if (pay === 'gems' && !wheelGemSpinAllowed(s)) return { ok: false, slot: -1 };
  if (pay === 'gems' && !spendGems(s, ECON.wheelGemCost)) return { ok: false, slot: -1 };
  const slot = pickWeighted(WHEEL, rng);
  const grant = grantReward(s, WHEEL[slot].reward, rng);
  return { ok: true, slot, grant };
}

// ---------------- VIP ----------------
export function claimVipCrate(s: GameState, now: number, rng: Rng = Math.random): { tier: number; index: number }[] | false {
  if (!s.ent.vip) return false;
  const d = utcDay(now);
  if (s.daily.vipCrateDay === d) return false;
  s.daily.vipCrateDay = d;
  s.gems += 5;
  return grantChests(s, 1, rng);
}

export { MAX_TIER, ALBUM_PAGES };
