import { describe, it, expect, afterEach } from 'vitest';
import { createState, migrate } from './State';
import { PurchaseService, grantOnce, applyEntitlements, settlePending } from './PurchaseService';
import { PLAY_PRODUCT, skuForProduct, type StoreBackend, type StoreCustomer, type BuyResult } from './PlayStore';
import { setStorePrices, priceLabel, priceAmount, currencyUnit } from './Prices';
import { skuValuePct } from './Economy';
import { storeCopy } from '../buildMode';
import { mulberry32 } from './Rng';
import { SKUS, type SkuId } from '../data/catalog';
import type { StorePrice } from './Prices';

// AB#4725: the Play store adapter, against a fake of the RevenueCat backend (there is no Play Billing under vitest).

const rng = () => mulberry32(4725);
const ALL = Object.keys(SKUS) as SkuId[];

/** Store prices in euros, deliberately not the USD catalog times one rate, so a ribbon that still read USD would show. */
const EUR: Record<SkuId, number> = { welcome: 2.29, gems200: 3.49, gems500: 5.49, gems1200: 9.99, piggy: 3.49, pass: 10.99, noads: 8.99, vip: 10.99, comeback: 3.49 };
const eurPrices = (): Partial<Record<SkuId, StorePrice>> =>
  Object.fromEntries(ALL.map((sku) => [sku, { label: `${EUR[sku].toFixed(2).replace('.', ',')} €`, amount: EUR[sku], currency: 'EUR' }]));

class FakeStore implements StoreBackend {
  customerNow: StoreCustomer = { active: {}, transactions: [], manageUrl: null };
  next: BuyResult | null = null;
  failStart = false;
  listener: ((c: StoreCustomer) => void) | null = null;
  private seq = 0;
  async start() { if (this.failStart) throw new Error('Play Billing is not available on this device'); }
  async prices() { return eurPrices(); }
  async buy(sku: SkuId): Promise<BuyResult> {
    if (this.next) { const r = this.next; this.next = null; return r; }
    const transaction = { id: `GPA.${++this.seq}`, sku, at: Date.now() };
    this.customerNow = { ...this.customerNow, transactions: [...this.customerNow.transactions, transaction] };
    return { ok: true, transaction, customer: this.customerNow };
  }
  async customer() { return this.customerNow; }
  async restore() { return this.customerNow; }
  onChange(l: (c: StoreCustomer) => void) { this.listener = l; }
}

afterEach(() => setStorePrices(null));

describe('Play store adapter (AB#4725)', () => {
  it('maps every catalog SKU to its Play product, and back', () => {
    expect(Object.keys(PLAY_PRODUCT).sort()).toEqual([...ALL].sort());
    expect(PLAY_PRODUCT.vip).toBe('rv_vip:monthly');
    for (const sku of ALL) expect(skuForProduct(PLAY_PRODUCT[sku]), sku).toBe(sku);
    expect(skuForProduct('rv_vip')).toBe('vip'); // a Play subscription id without its base plan
  });

  it('a consumable transaction reported twice is granted once', () => {
    const s = createState();
    const first = grantOnce(s, 'GPA.3301-7', 'gems500', rng());
    const gems = s.gems;
    const again = grantOnce(s, 'GPA.3301-7', 'gems500', rng());
    expect(first.ok).toBe(true);
    expect(again).toMatchObject({ ok: false, reason: 'granted', gems: 0 });
    expect(s.gems).toBe(gems);
    expect(s.purchases.filter((p) => p.sku === 'gems500')).toHaveLength(1);
    expect(grantOnce(s, 'GPA.3301-8', 'gems500', rng()).ok).toBe(true); // a second purchase is its own transaction
  });

  it('the transaction ids it paid out survive a save and a load', () => {
    const s = createState();
    grantOnce(s, 'GPA.1', 'gems200', rng());
    const loaded = migrate(JSON.parse(JSON.stringify(s)));
    expect(grantOnce(loaded, 'GPA.1', 'gems200', rng()).ok).toBe(false);
    expect(migrate({ v: 6 } as any).store).toEqual({ granted: [], pending: [] }); // an old save gains an empty ledger
  });

  it('shows the store’s localised prices, never the USD catalog, and derives the ribbons from them', async () => {
    const s = createState();
    const store = new FakeStore();
    const p = new PurchaseService('play', store);
    await p.start(s, rng());
    expect(priceLabel('gems500')).toBe('5,49 €');
    expect(priceLabel('vip')).toBe('10,99 €');
    expect(currencyUnit()).toBe('EUR');
    for (const sku of ALL) expect(priceLabel(sku), sku).not.toMatch(/\$/);
    // gems per euro against the entry pack's gems per euro, both at the euro prices
    expect(skuValuePct('gems1200', s)).toBe(Math.round(((1200 / 9.99) / (200 / 3.49)) * 100));
    expect(skuValuePct('gems1200', s)).not.toBe(Math.round(((1200 / SKUS.gems1200.price) / (200 / SKUS.gems200.price)) * 100));
  });

  it('with no store (a failed start), shows no price rather than a USD one, and refuses to sell', async () => {
    const s = createState();
    const store = new FakeStore();
    store.failStart = true;
    const p = new PurchaseService('play', store);
    await p.start(s, rng());
    expect(p.unavailable).toMatch(/not available/);
    expect(priceLabel('gems200')).toBe('…');
    expect(Number.isNaN(priceAmount('gems200'))).toBe(true);
    expect(Number.isNaN(skuValuePct('gems500', s))).toBe(true);
    expect(await p.purchase('gems200', s)).toMatchObject({ ok: false, reason: 'unavailable' });
  });

  it('returns the store’s transaction id as the receipt, which grantOnce keys on', async () => {
    const s = createState();
    const p = new PurchaseService('play', new FakeStore());
    await p.start(s, rng());
    const r = await p.purchase('gems200', s);
    expect(r).toMatchObject({ ok: true, receipt: 'GPA.1' });
  });

  it('a pending purchase is not a failure: it waits, and is paid once when Play completes it', async () => {
    const s = createState();
    const store = new FakeStore();
    const p = new PurchaseService('play', store);
    await p.start(s, rng());
    store.next = { ok: false, reason: 'pending' };
    const r = await p.purchase('gems1200', s);
    expect(r).toMatchObject({ ok: false, reason: 'pending' });
    expect(s.store.pending.map((x) => x.sku)).toEqual(['gems1200']);
    const gems = s.gems;
    // Play completes it later: the transaction appears in the customer's history
    store.customerNow = { ...store.customerNow, transactions: [{ id: 'GPA.9', sku: 'gems1200', at: Date.now() }] };
    const first = await p.sync(s, rng());
    expect(first.grants.map((g) => g.ok)).toEqual([true]);
    expect(s.gems).toBe(gems + 1200);
    expect((await p.sync(s, rng())).grants).toEqual([]);
    expect(s.gems).toBe(gems + 1200);
    expect(s.store.pending).toEqual([]);
  });

  it('a cancelled purchase leaves nothing pending', async () => {
    const s = createState();
    const store = new FakeStore();
    const p = new PurchaseService('play', store);
    await p.start(s, rng());
    store.next = { ok: false, reason: 'cancelled' };
    expect(await p.purchase('gems200', s)).toMatchObject({ ok: false, reason: 'cancelled' });
    expect(s.store.pending).toEqual([]);
  });

  it('entitlements come from the store on every sync: a refund or a lapsed VIP takes them away', async () => {
    const s = createState();
    const store = new FakeStore();
    const renews = Date.now() + 20 * 86400000;
    store.customerNow = { active: { noads: null, vip: renews, pass: null }, transactions: [], manageUrl: null };
    const p = new PurchaseService('play', store);
    await p.start(s, rng());
    expect(s.ent).toMatchObject({ removeAds: true, vip: true, vipUntil: renews, passPremium: true });
    store.customerNow = { active: { pass: null }, transactions: [], manageUrl: null }; // No Ads refunded, VIP cancelled
    const r = await p.sync(s, rng());
    expect(r.changed.sort()).toEqual(['noads', 'vip']);
    expect(s.ent).toMatchObject({ removeAds: false, vip: false, vipUntil: 0, passPremium: true });
  });

  it('a restore brings back unlocks and VIP, and never pays a consumable out again', async () => {
    const s = createState(); // a new device: an empty save
    const store = new FakeStore();
    store.customerNow = {
      active: { noads: null },
      transactions: [{ id: 'GPA.old-1', sku: 'gems1200', at: Date.now() - 86400000 }, { id: 'GPA.old-2', sku: 'welcome', at: Date.now() - 86400000 }],
      manageUrl: null,
    };
    const p = new PurchaseService('play', store);
    await p.start(s, rng());
    const gems = s.gems;
    const r = await p.restore(s);
    expect(r?.entitlements).toEqual(['noads']);
    expect(s.ent.removeAds).toBe(true);
    expect(s.gems).toBe(gems);
    expect(s.ent.welcome).toBe(false);
    expect(settlePending(s, store.customerNow.transactions, rng())).toEqual([]);
  });

  it('a pending pack is paid only by a transaction after it was started, not an older one of the same pack', () => {
    const s = createState();
    const now = Date.now();
    s.store.pending = [{ sku: 'gems500', since: now - 1000 }];
    expect(settlePending(s, [{ id: 'GPA.old', sku: 'gems500', at: now - 86400000 }], rng(), now)).toEqual([]);
    expect(settlePending(s, [{ id: 'GPA.new', sku: 'gems500', at: now }], rng(), now).map((g) => g.ok)).toEqual([true]);
  });

  it('VIP’s 30-day flag is the entitlement: the store’s expiry, or none', () => {
    const s = createState();
    applyEntitlements(s, { vip: null });
    expect(s.ent).toMatchObject({ vip: true, vipUntil: 0 });
  });

  it('opens Play’s subscription centre for Vault VIP', async () => {
    const p = new PurchaseService('play', new FakeStore());
    await p.start(createState(), rng());
    expect(await p.manageUrl()).toBe('https://play.google.com/store/account/subscriptions?sku=rv_vip&package=com.orchestrata.relicvault');
  });

  it('demo mode is unchanged: catalog prices in USD, and every purchase succeeds with a demo receipt', async () => {
    expect(priceLabel('gems500')).toBe('$4.99');
    const r = await new PurchaseService('demo').purchase('gems500');
    expect(r).toMatchObject({ ok: true });
    expect(r.ok && r.receipt).toMatch(/^demo-gems500-/);
  });

  it('a Play build says nothing about a demo store, and the demo build still does', () => {
    const play = Object.values(storeCopy('play')).join(' ');
    expect(play).not.toMatch(/demo|simulated|not charged|no real/i);
    expect(storeCopy('demo').footer).toBe('DEMO STORE MODE · no real charges');
  });
});
