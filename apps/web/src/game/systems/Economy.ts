import {
  ECON, CARDS, CARDS_PER_PAGE, ALBUM_PAGES, EARNED_CHEST_ODDS, GEM_CHEST_ODDS, type ChestOdds, CHEST_PITY_TIER, CHEST_TOP_TIER,
  EVENT_MILESTONES, PASS_FREE, PASS_PREMIUM,
  WHEEL, Reward, MAX_TIER, RELICS, SKUS, type SkuId,
} from '../data/catalog';
import { priceAmount, baselineGemsPerUnit } from './Prices'; // AB#4725
import type { GameState } from './State';
import { utcDay } from './State';
import { Rng, pickWeighted, mulberry32 } from './Rng';
import { computeLuck } from './LuckSystem';
import { placeOrStash, lowest, empties, sellValue } from './BoardSystem';
import { CHAINS, GEN_UPGRADE_GOLD, GEN_MAX_LEVEL, itemWork } from '../data/items';
import { RANK_REWARDS } from './Profile';
import { cyclePrize } from './Standings';
import { renownGold } from './Floors';

// ---------------- currencies ----------------
/** Keeper's Renown multiplies gold, never gems: a deeper player earns faster without a shortcut past the ladder. */
export function grantGold(s: GameState, n: number) {
  if (n <= 0) return;
  s.gold += Math.round(n * renownGold(s));
}

/**
 * The pig stores gems, a quarter gem per merge by default (Board, #328: 2,400 gold for $2.99 was worthless).
 * `s.piggy` is fractional; only whole gems are shown or paid out.
 */
export function feedPiggy(s: GameState) {
  s.piggy = Math.min(ECON.piggyCap, s.piggy + 1 / ECON.piggyMergesPerGem);
}
export const piggyGems = (s: GameState) => Math.floor(s.piggy);

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


// ---------------- rank ----------------
export function xpToNext(rank: number) { return ECON.rankXpBase + (rank - 1) * ECON.rankXpStep + (rank - 1) * (rank - 1) * (ECON.rankXpQuad ?? 0); }

export function addXp(s: GameState, n: number): number {
  s.xp += n;
  let ups = 0;
  while (s.xp >= xpToNext(s.rank)) {
    s.xp -= xpToNext(s.rank);
    s.rank++;
    s.gems += ECON.rankGems;
    ups++;
  }
  if (ups) unlockGenerators(s);
  return ups;
}

// ---------------- generators (RV-D3) ----------------
/**
 * Unlock any generator whose rank requirement is met. Returns newly unlocked chain ids.
 *
 * A floor's own ladder has `unlockRank: 0`, which means *never by rank* — it is opened by descending to that
 * floor (docs/ROOMS.md). Without this guard `s.rank >= 0` is true for every one of them, and ranking up once
 * would hand the player every generator in the vault.
 */
export function unlockGenerators(s: GameState): number[] {
  const out: number[] = [];
  for (const c of CHAINS) {
    if (c.unlockRank <= 0) continue;
    if ((s.gens[c.id] ?? 0) === 0 && s.rank >= c.unlockRank) { s.gens[c.id] = 1; out.push(c.id); }
  }
  return out;
}

export function genUpgradeCost(s: GameState, chain: number): number | null {
  const lvl = s.gens[chain] ?? 0;
  if (lvl <= 0 || lvl >= GEN_MAX_LEVEL) return null;
  return GEN_UPGRADE_GOLD[lvl + 1];
}

/** Gold sink: each level adds +2% chance of higher-tier output from that generator. Never a gate. */
export function upgradeGenerator(s: GameState, chain: number): boolean {
  const cost = genUpgradeCost(s, chain);
  if (cost == null || !spendGold(s, cost)) return false;
  s.gens[chain]++;
  return true;
}

// ---------------- album ----------------
export interface CardResult { id: number; duplicate: boolean; pageCompleted: number }

export function grantCard(s: GameState, rng: Rng, missingOnly = false): CardResult {
  const missing = CARDS.filter((c) => !s.album[c.id]).map((c) => c.id);
  let id: number;
  // The album fills page by page: most drops come from the lowest unfinished page, so a page completes
  // (and decorates the vault) before the next one starts to matter.
  const openPage = s.pagesDone.findIndex((d) => !d);
  const pageMissing = openPage >= 0 ? missing.filter((id) => CARDS[id].page === openPage) : [];
  if (missingOnly && missing.length) id = (pageMissing.length ? pageMissing : missing)[Math.floor(rng() * (pageMissing.length || missing.length))];
  else if (pageMissing.length && rng() < ECON.cardPageBias) id = pageMissing[Math.floor(rng() * pageMissing.length)];
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
  if (tier < ECON.cardDropMinTier) return 0;
  return ECON.cardDropBase + (tier - ECON.cardDropMinTier) * ECON.cardDropPerTier;
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

/**
 * Roll a chest tier: disclosed odds, pity every N dry chests, luck upgrade. Pure. `table` is the earned chests'
 * unless the caller says otherwise; only a chest bought with gems rolls on GEM_CHEST_ODDS (AB#380).
 */
export function rollChest(s: GameState, rng: Rng, table: ChestOdds = EARNED_CHEST_ODDS): { tier: number; pityHit: boolean; upgraded: boolean } {
  let pityHit = false;
  let pool = table;
  if (s.pity >= ECON.pityEvery - 1) {
    pool = table.filter((o) => o.tier >= CHEST_PITY_TIER);
    pityHit = true;
  }
  const idx = pickWeighted(pool.map((o) => ({ weight: o.chance })), rng);
  let tier = pool[idx].tier;
  let upgraded = false;
  if (rng() < computeLuck(s) && tier < CHEST_TOP_TIER) { tier++; upgraded = true; }
  s.pity = tier >= CHEST_PITY_TIER ? 0 : s.pity + 1;
  return { tier, pityHit, upgraded };
}

export interface ChestResult {
  ok: boolean; reason?: 'gems' | 'blocked'; tier: number; index: number; card?: CardResult; pityHit?: boolean; upgraded?: boolean;
}

/**
 * Open a chest. `source` free = pass/event/vip/reward grant, gems = paid with gems, paid = part of a pack bought with
 * money (the Keeper's Welcome), already paid for. Anything bought rolls on GEM_CHEST_ODDS (AB#380, Bug #678).
 */
export function openChest(s: GameState, rng: Rng, source: 'free' | 'gems' | 'paid'): ChestResult {
  if (!chestsAllowed(s)) return { ok: false, reason: 'blocked', tier: 0, index: -1 };
  if (source === 'gems' && !spendGems(s, ECON.chestGemCost)) return { ok: false, reason: 'gems', tier: 0, index: -1 };
  if (source === 'free') {
    if (s.freeChests <= 0) return { ok: false, reason: 'gems', tier: 0, index: -1 };
    s.freeChests--;
  }
  const roll = rollChest(s, rng, source === 'free' ? EARNED_CHEST_ODDS : GEM_CHEST_ODDS);
  const index = placeOrStash(s, roll.tier, rng);
  s.stats.chests++;
  s.quests.chest++;
  let card: CardResult | undefined;
  if (rng() < ECON.chestCardChance) card = grantCard(s, rng);
  return { ok: true, tier: roll.tier, index, card, pityHit: roll.pityHit, upgraded: roll.upgraded };
}

// ---------------- deterministic buys ----------------
/**
 * Board, RV-B4: the exact-relic card rotates and is priced by what the relic is actually worth in merges, with the
 * Emerald Scarab as the anchor the Board named. Work doubles per tier, so the price does too: no hand-written table
 * to drift from the economy.
 */
export function exactRelicCost(tier: number): number {
  return ladderGems(tier);
}

/**
 * Any relic at the exact-relic ladder's price: the Emerald Scarab's `exactT5Gems`, scaled by the relic's work. A Forge
 * tier's id is its tier, so exactRelicCost is this; power-ups (PowerUps.ts, AB#381) are priced from it too.
 */
export function ladderGems(item: number): number {
  return Math.max(1, Math.round(ECON.exactT5Gems * (itemWork(item) / itemWork(5))));
}

/**
 * What a chest returns on average, in the shop's own exact-relic gems: each row valued at exactRelicCost, with a
 * `luck` chance of the one-tier upgrade. Pity is left out, so this is a floor: pity only ever raises a result.
 * The measure Critique #368 used; AB#380 holds the gem chest to CHEST_MIN_VALUE_SHARE of its price with it.
 */
export function chestEvGems(table: ChestOdds, luck = 0): number {
  return table.reduce((ev, o) => {
    const up = o.tier < CHEST_TOP_TIER ? exactRelicCost(o.tier + 1) : exactRelicCost(o.tier);
    return ev + o.chance * ((1 - luck) * exactRelicCost(o.tier) + luck * up);
  }, 0);
}

/**
 * What the Keeper's Welcome ribbon counts its chest as, in gems: what the chest this player is handed returns, not
 * what a chest costs to buy (Bug #678, Board Decision #683, option B). The pack is bought with money, so its chest
 * rolls on GEM_CHEST_ODDS and counts at that table's expected value with no luck, a floor. Where random rewards are
 * off the chest is an exact Gold Mask, counted at the exact-relic price.
 */
export function welcomeChestGems(s: GameState): number {
  return chestsAllowed(s) ? Math.round(chestEvGems(GEM_CHEST_ODDS)) : exactRelicCost(CHEST_EXACT_TIER);
}

/** How the Welcome figure was worked out, from the same number, for every screen that explains it. */
export function welcomeValueBasis(s: GameState): string {
  return chestsAllowed(s)
    ? `the Welcome figure counts its Lucky Chest at ${welcomeChestGems(s)} gems, the average relic at its odds`
    : `the Welcome figure counts its ${RELICS[CHEST_EXACT_TIER].name} at ${welcomeChestGems(s)} gems, the exact-relic price`;
}

/**
 * Computed, never hardcoded: gem-equivalent per unit of currency vs the baseline pack, both at the price the player is
 * charged (AB#4725: the store's, in a Play build), so the ribbon holds in any currency. Welcome adds its chest (above).
 * NaN while a Play build has no price yet: the shop shows no ribbon rather than a wrong one.
 */
export function skuValuePct(id: SkuId, s: GameState): number {
  const sku = SKUS[id];
  if (!sku.gems) return 0;
  const gemEq = sku.gems + (id === 'welcome' ? welcomeChestGems(s) : 0);
  return Math.round(((gemEq / priceAmount(id)) / baselineGemsPerUnit()) * 100);
}

/** Which relic the shop offers today: near the player's best Forge tier, so it is always worth having. */
export function exactRelicOffer(s: GameState, now = Date.now()): number {
  const best = Math.min(MAX_TIER, Math.max(4, s.best[0] ?? 1));
  const pool = [best - 1, best, Math.min(MAX_TIER, best + 1)].filter((t) => t >= 3);
  return pool[Math.floor(mulberry32(utcDay(now) * 31 + s.rank)() * pool.length)] ?? 5;
}

export function buyExact(s: GameState, tier: number, rng: Rng): number | null {
  if (!(tier >= 2 && tier <= MAX_TIER)) return null;
  if (!spendGems(s, exactRelicCost(tier))) return null;
  return placeOrStash(s, tier, rng);
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
  for (const i of lo) { gold += sellValue(s.board[i]); s.board[i] = 0; }
  s.gold += gold;
  return { ok: true, cleared: lo, gold };
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
/**
 * Take the reward for a rank landmark. Rewards are claimed, not auto-granted: a pile of gold that appears in the
 * wallet while the player is mid-merge is a reward nobody notices, and ranking up is the most frequent
 * progression moment in the game (Board: "Level up rewards?").
 */
export function claimRankReward(s: GameState, rank: number, rng: Rng): Granted | null {
  const entry = RANK_REWARDS[rank];
  if (!entry || s.rank < rank) return null;
  if (!s.rankClaimed) s.rankClaimed = [];
  if (s.rankClaimed.includes(rank)) return null;
  s.rankClaimed.push(rank);
  let g = emptyGrant();
  for (const r of entry.rewards) g = grantReward(s, r, rng, g);
  return g;
}

/**
 * Take the end-of-cycle Gold Rush prizes: one for where the player placed, one for how many milestones they
 * completed (Board: rewards "both for completing the most milestones but also having the highest score compared
 * to other players"). Claimable once per cycle, and only if the player actually entered.
 */
export function claimCyclePrize(s: GameState, rng: Rng): Granted | null {
  const key = `cyclePrize:${s.event.cycle}`;
  if (s.flags[key]) return null;
  const prize = cyclePrize(s);
  if (!prize.placeRewards.length && !prize.diligenceRewards.length) return null;
  s.flags[key] = 1;
  let g = emptyGrant();
  for (const r of [...prize.placeRewards, ...prize.diligenceRewards]) g = grantReward(s, r, rng, g);
  return g;
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
  { id: 2, label: 'Fill 3 patron orders', goal: 3, key: 'orders' as const },
];
export function questProgress(s: GameState, q: number) {
  const d = QUESTS[q];
  return Math.min(d.goal, s.quests[d.key]);
}
/**
 * RV-M2b (AB#382): the free path to power-ups. The first daily quest a player claims each day also gives an Auto-Merge,
 * so a sink the shop sells for gems (AB#381) is one a player who never pays still reaches every day they play: the
 * 12-minute casual profile forges ten relics every day. It is the same fixed grant for every profile, with no roll, so
 * under-16 and loot-box-off players get exactly what everyone gets (MONETIZATION.md, Board 2026-09-19: features are
 * made safe for all ages, not restricted by age).
 */
export function questPowerUpDue(s: GameState, now: number): boolean {
  return s.quests.day === utcDay(now) && s.quests.claimed.length === 0;
}

export function claimQuest(s: GameState, q: number, now: number): boolean {
  if (s.quests.day !== utcDay(now)) return false;
  if (s.quests.claimed.includes(q) || questProgress(s, q) < QUESTS[q].goal) return false;
  const firstToday = questPowerUpDue(s, now);
  s.quests.claimed.push(q);
  if (firstToday) { s.powerUps.autoMerge += ECON.questAutoMerges; s.stats.freePowerUps = (s.stats.freePowerUps ?? 0) + ECON.questAutoMerges; }
  grantGold(s, ECON.questGold);
  s.gems += ECON.questGems;
  // RV-D6 (AB#275): the season's casual promise is pass tier 15 by day 14 without paying, and 12 minutes a day fell
  // up to one tier short. Showing up is what a casual player gives, so it is paid per day rather than per action,
  // which helps the 12-minute player more than the 25-minute one. The value is the smallest that leaves every casual
  // probe run a tier of margin (docs/ECONOMY.md has the sweep).
  s.pass.xp += ECON.questPassXp;
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
