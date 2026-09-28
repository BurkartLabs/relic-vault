import { SKUS, SkuId, WELCOME_RELICS } from '../data/catalog';
import type { GameState } from './State';
import type { Rng } from './Rng';
import { placeOrStash } from './BoardSystem';
import { grantGold, grantChests, piggyGems, chestsAllowed, openChest, type ChestResult } from './Economy';
import { welcomeOpen } from './Offers';
import { ENTITLEMENT, PLAY_PACKAGE, PLAY_PRODUCT, type StoreBackend, type StoreCustomer, type StoreTransaction } from './PlayStore'; // AB#4725
import { setStorePrices } from './Prices';
import { setStoreCountry } from './Region'; // AB#4733
import { reportPluginError } from './NativeTelemetry'; // AB#4739

export interface PurchaseGrant {
  ok: boolean;
  /** owned: a one-time pack already bought; granted: this store transaction was already paid out (AB#4725). */
  reason?: 'owned' | 'granted';
  sku: SkuId;
  gems: number;
  gold: number;
  relics: { tier: number; index: number }[];
  /** A chest the pack opened on purchase: its relic is already placed, the scene only plays the ceremony. */
  chest?: ChestResult;
}

export function skuAvailable(s: GameState, sku: SkuId): boolean {
  if (sku === 'welcome') return !s.ent.welcome && welcomeOpen(s, Date.now());
  if (sku === 'comeback') return !s.ent.comeback;
  if (sku === 'pass') return !s.ent.passPremium;
  if (sku === 'noads') return !s.ent.removeAds;
  if (sku === 'vip') return !s.ent.vip;
  if (sku === 'piggy') return piggyGems(s) > 0;
  return true;
}

/** Pure entitlement grant. Identical in demo and storekit modes. */
export function applyPurchase(s: GameState, sku: SkuId, rng: Rng, now = Date.now()): PurchaseGrant {
  const g: PurchaseGrant = { ok: true, sku, gems: 0, gold: 0, relics: [] };
  if (!skuAvailable(s, sku)) return { ...g, ok: false, reason: 'owned' };
  const def = SKUS[sku];
  switch (sku) {
    case 'welcome':
      s.ent.welcome = true;
      s.gems += def.gems!; s.gold += def.gold!; g.gems = def.gems!; g.gold = def.gold!;
      for (const t of WELCOME_RELICS) g.relics.push({ tier: t, index: placeOrStash(s, t, rng) }); // Board RV-B1: a Ruby Crown, not a Silver Urn
      // Bug #678, Board Decision #683 (option B): the pack is bought with money, so its chest rolls the paid odds, and
      // it opens now: a free-chest token would roll the earned odds whenever the player got round to it.
      if (chestsAllowed(s)) g.chest = openChest(s, rng, 'paid');
      else g.relics.push(...grantChests(s, 1, rng));
      break;
    case 'gems200': case 'gems500': case 'gems1200':
      s.gems += def.gems!; g.gems = def.gems!;
      break;
    case 'piggy': {
      const gems = piggyGems(s);
      s.gems += gems; s.piggy = 0; g.gems = gems;
      break;
    }
    case 'pass': s.ent.passPremium = true; break;
    case 'noads': s.ent.removeAds = true; break;
    case 'vip': s.ent.vip = true; s.ent.vipUntil = now + 30 * 86400000; break;
    case 'comeback':
      // Bug #366: these numbers used to be restated here (60 / 1,500) while the shop advertised the catalog's
      // 120 / 15,000, so a $2.99 purchase paid out a tenth of the gold it promised. Read the SKU, never retype it.
      s.ent.comeback = true;
      s.gems += def.gems!; grantGold(s, def.gold!); g.gems = def.gems!; g.gold = def.gold!;
      g.relics.push({ tier: 5, index: placeOrStash(s, 5, rng) });
      break;
  }
  s.purchases.push({ sku, t: now });
  return g;
}

/** Transaction ids kept to refuse a second payout; far more than a player makes, so none that matters is dropped. */
const GRANTED_KEPT = 500;

/**
 * AB#4725: pays out `sku` for store transaction `txId` exactly once. A transaction already paid (the same purchase
 * reported twice, a pending purchase completing after it was granted) grants nothing.
 */
export function grantOnce(s: GameState, txId: string, sku: SkuId, rng: Rng, now = Date.now()): PurchaseGrant {
  if (s.store.granted.includes(txId)) return { ok: false, reason: 'granted', sku, gems: 0, gold: 0, relics: [] };
  const g = applyPurchase(s, sku, rng, now);
  if (g.ok) {
    s.store.granted.push(txId);
    if (s.store.granted.length > GRANTED_KEPT) s.store.granted.splice(0, s.store.granted.length - GRANTED_KEPT);
  }
  s.store.pending = s.store.pending.filter((p) => p.sku !== sku);
  return g;
}

/**
 * AB#4725: No Ads, the Keeper's Pass and Vault VIP as the store has them. Set from the store and cleared by it, so a
 * refund or a cancelled subscription takes the entitlement away with no server of ours. VIP lasts while its
 * entitlement is active; vipUntil is when the store says it lapses (0 when it does not say). Returns what changed.
 */
export function applyEntitlements(s: GameState, active: StoreCustomer['active']): SkuId[] {
  const changed: SkuId[] = [];
  const set = (sku: SkuId, on: boolean, write: (v: boolean) => void, was: boolean) => { if (was !== on) changed.push(sku); write(on); };
  set('noads', 'noads' in active, (v) => (s.ent.removeAds = v), s.ent.removeAds);
  set('pass', 'pass' in active, (v) => (s.ent.passPremium = v), s.ent.passPremium);
  set('vip', 'vip' in active, (v) => (s.ent.vip = v), s.ent.vip);
  s.ent.vipUntil = s.ent.vip ? active.vip ?? 0 : 0;
  return changed;
}

/**
 * AB#4725: a one-time purchase this device started that Play left pending (a slow card, cash at a shop), paid out when
 * the store later records it. Only transactions after the purchase was started count, so a restore on a new device,
 * whose history holds every pack ever bought, never pays a consumable out again.
 */
export function settlePending(s: GameState, transactions: StoreTransaction[], rng: Rng, now = Date.now()): PurchaseGrant[] {
  const out: PurchaseGrant[] = [];
  for (const p of [...s.store.pending]) {
    const t = transactions.find((x) => x.sku === p.sku && x.at >= p.since && !s.store.granted.includes(x.id));
    if (t) out.push(grantOnce(s, t.id, p.sku, rng, now));
  }
  return out;
}

export type StoreMode = 'demo' | 'play';

export type PurchaseResult =
  | { ok: true; receipt: string; customer?: StoreCustomer }
  | { ok: false; reason: 'cancelled' | 'pending' | 'unavailable' | 'error'; code?: string; message?: string };

/**
 * Store adapter. Demo mode (the web default and every e2e run): every purchase succeeds after a short "processing"
 * beat, with a made-up receipt. Play mode (AB#4725): Google Play Billing through RevenueCat, which confirms the
 * transaction before the purchase resolves; the caller grants only then, once per transaction id (grantOnce).
 */
export class PurchaseService {
  /** Set once the store has answered in play mode: what failed, for the shop to say instead of showing prices. */
  unavailable: string | null = null;
  constructor(public mode: StoreMode = 'demo', private backend: StoreBackend | null = null) {}

  /** Play mode: connect, fetch the localised prices, and read the entitlements. Never throws; a failure is kept. */
  async start(s: GameState, rng: Rng, onChange?: (changed: SkuId[], grants: PurchaseGrant[]) => void): Promise<void> {
    if (this.mode !== 'play') return;
    setStorePrices({}); // a play build never falls back to the catalog's USD prices
    try {
      if (!this.backend) throw new Error('no store in this build');
      await this.backend.start();
      // AB#4733: the storefront's country first, so the loot-box rule is set before the first shop render
      if (this.backend.storefront) {
        setStoreCountry(await this.backend.storefront().catch((e) => { reportPluginError('Purchases', 'getStorefront', e); return null; }));
      }
      setStorePrices(await this.backend.prices());
      await this.sync(s, rng);
      this.backend.onChange((c) => { const changed = applyEntitlements(s, c.active); const grants = settlePending(s, c.transactions, rng); onChange?.(changed, grants); });
    } catch (e) {
      this.unavailable = String((e as Error)?.message ?? e);
      reportPluginError('Purchases', 'start', e); // AB#4739: a store build whose store never answered is worth knowing
    }
  }

  /** Play mode: the entitlements, and any pending purchase that has since gone through, as the store has them now. */
  async sync(s: GameState, rng: Rng): Promise<{ changed: SkuId[]; grants: PurchaseGrant[] }> {
    if (this.mode !== 'play' || !this.backend || this.unavailable) return { changed: [], grants: [] };
    const c = await this.backend.customer();
    return { changed: applyEntitlements(s, c.active), grants: settlePending(s, c.transactions, rng) };
  }

  async purchase(sku: SkuId, s?: GameState): Promise<PurchaseResult> {
    if (this.mode === 'demo') {
      await new Promise((r) => setTimeout(r, 450));
      return { ok: true, receipt: `demo-${sku}-${Date.now()}` };
    }
    if (!this.backend || this.unavailable) return { ok: false, reason: 'unavailable', message: this.unavailable ?? undefined };
    // Recorded before the store is asked, so a purchase that completes while the app is closed is still paid out on the
    // next boot; a minute early, for a device clock a little behind Play's purchase time.
    if (s && !ENTITLEMENT[sku]) s.store.pending = [...s.store.pending.filter((p) => p.sku !== sku), { sku, since: Date.now() - 60_000 }];
    const r = await this.backend.buy(sku);
    if (!r.ok) {
      // A pending purchase stays on the list, to be paid out when Play completes it (settlePending). Nothing else does.
      if (s && r.reason !== 'pending') s.store.pending = s.store.pending.filter((p) => p.sku !== sku);
      return r;
    }
    return { ok: true, receipt: r.transaction.id, customer: r.customer };
  }

  /**
   * Settings, Restore Purchases. Demo mode: nothing to ask. Play mode: the store's entitlements, applied; consumables
   * are never paid out again (settlePending only pays what this device left pending). Returns what the store has.
   */
  async restore(s?: GameState): Promise<{ entitlements: SkuId[]; changed: SkuId[] } | null> {
    if (this.mode !== 'play' || !this.backend || this.unavailable || !s) return null;
    const c = await this.backend.restore();
    return { entitlements: Object.keys(c.active) as SkuId[], changed: applyEntitlements(s, c.active) };
  }

  /** Where Play manages the VIP subscription: the store's own link, or Play's subscription centre for this app. */
  async manageUrl(): Promise<string> {
    const fallback = `https://play.google.com/store/account/subscriptions?sku=${PLAY_PRODUCT.vip.split(':')[0]}&package=${PLAY_PACKAGE}`;
    if (this.mode !== 'play' || !this.backend || this.unavailable) return fallback;
    try { return (await this.backend.customer()).manageUrl || fallback; } catch { return fallback; }
  }
}
