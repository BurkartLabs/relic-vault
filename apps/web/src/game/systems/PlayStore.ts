import type { SkuId } from '../data/catalog';
import type { StorePrice } from './Prices';
import { registerDataEraser } from './DataEraser';

/**
 * AB#4725: Google Play Billing through RevenueCat (Board Decision AB#4741: RevenueCat over our own receipt validation,
 * so there is no Play Developer API backend to run). This file is the only one that knows RevenueCat's API; the
 * PurchaseService talks to the StoreBackend interface below, which the tests fake.
 *
 * The product ids are the ones the Play Console listing uses (Board step 7 creates them). A subscription is known to
 * RevenueCat on Android as "<subscription id>:<base plan id>", so Vault VIP is rv_vip:monthly.
 */
export const PLAY_PRODUCT: Record<SkuId, string> = {
  welcome: 'rv_welcome',
  gems200: 'rv_gems_200',
  gems500: 'rv_gems_500',
  gems1200: 'rv_gems_1200',
  piggy: 'rv_piggy',
  pass: 'rv_pass',
  noads: 'rv_noads',
  comeback: 'rv_comeback',
  vip: 'rv_vip:monthly',
};

/** The app's Play package name (capacitor.config.ts appId), for the link to Play's subscription centre. */
export const PLAY_PACKAGE = 'com.orchestrata.relicvault';

/** The SKUs that are subscriptions in Play; every other product is a one-time product. */
export const SUBSCRIPTION_SKUS: readonly SkuId[] = ['vip'];

/**
 * The SKUs RevenueCat keeps as entitlements, by the entitlement identifier configured in the RevenueCat dashboard. They
 * are read from the customer's info on every boot and resume, so a refund or a lapsed subscription takes them away.
 * Everything else is a consumable: granted once per transaction, never by a restore. The Keeper's Pass is one since
 * Decision AB#4788 (Bug AB#4786): bought once per season, and on while a transaction from this season is on record
 * (PurchaseService.seasonPassFrom).
 */
export const ENTITLEMENT: Partial<Record<SkuId, string>> = { noads: 'noads', vip: 'vip' };

export const skuForProduct = (productId: string): SkuId | undefined =>
  (Object.keys(PLAY_PRODUCT) as SkuId[]).find((sku) => PLAY_PRODUCT[sku] === productId || PLAY_PRODUCT[sku].split(':')[0] === productId);

export interface StoreTransaction { id: string; sku: SkuId; at: number }

export interface StoreCustomer {
  /** Active entitlements by SKU, with when each lapses (null: it does not, e.g. a lifetime No Ads). */
  active: Partial<Record<SkuId, number | null>>;
  /** Every one-time purchase the store has on record for this customer. */
  transactions: StoreTransaction[];
  /** Where the player manages the subscription, when the store gives one. */
  manageUrl: string | null;
}

export type BuyResult =
  | { ok: true; transaction: StoreTransaction; customer: StoreCustomer }
  | { ok: false; reason: 'cancelled' | 'pending' | 'unavailable' | 'error'; code?: string; message?: string };

export interface StoreBackend {
  start(): Promise<void>;
  prices(): Promise<Partial<Record<SkuId, StorePrice>>>;
  buy(sku: SkuId): Promise<BuyResult>;
  customer(): Promise<StoreCustomer>;
  restore(): Promise<StoreCustomer>;
  /** AB#4733: the store account's country code (alpha-2 or alpha-3), or null when the store cannot say. */
  storefront?(): Promise<string | null>;
  /** Called with the customer whenever the store reports a change (a pending purchase completing, a refund). */
  onChange(listener: (customer: StoreCustomer) => void): void;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function toCustomer(info: any): StoreCustomer {
  const active: StoreCustomer['active'] = {};
  for (const [sku, entitlement] of Object.entries(ENTITLEMENT) as [SkuId, string][]) {
    const e = info?.entitlements?.active?.[entitlement];
    if (e?.isActive) active[sku] = e.expirationDateMillis ?? (e.expirationDate ? Date.parse(e.expirationDate) : null);
  }
  const transactions: StoreTransaction[] = [];
  for (const t of info?.nonSubscriptionTransactions ?? []) {
    const sku = skuForProduct(t.productIdentifier);
    if (sku) transactions.push({ id: t.transactionIdentifier, sku, at: Date.parse(t.purchaseDate) || 0 });
  }
  return { active, transactions, manageUrl: info?.managementURL ?? null };
}

/** RevenueCat's error codes (purchases-typescript-internal PURCHASES_ERROR_CODE) that are not failures. */
const CANCELLED = '1';
const PENDING = '20';

/**
 * The RevenueCat Capacitor plugin. `apiKey` is RevenueCat's public Android SDK key (goog_...), which is meant to ship in
 * the app. With a sandbox key and a Play licence tester, purchases go through Play's test cards and charge nothing.
 */
export class RevenueCatBackend implements StoreBackend {
  private rc: any = null;
  private products = new Map<SkuId, any>();
  constructor(private apiKey: string) {}

  async start() {
    if (!this.apiKey) throw new Error('no RevenueCat SDK key in this build (VITE_REVENUECAT_KEY)');
    const mod = await import('@revenuecat/purchases-capacitor');
    this.rc = mod.Purchases;
    await this.rc.configure({ apiKey: this.apiKey });
    // Delete my data (AB#4726): the customer info RevenueCat caches on the device goes with everything else
    registerDataEraser('revenuecat', () => this.rc.invalidateCustomerInfoCache());
  }

  async prices() {
    const out: Partial<Record<SkuId, StorePrice>> = {};
    const skus = Object.keys(PLAY_PRODUCT) as SkuId[];
    const oneTime = skus.filter((s) => !SUBSCRIPTION_SKUS.includes(s));
    const fetch = async (list: SkuId[], type: 'NON_SUBSCRIPTION' | 'SUBSCRIPTION') => {
      const ids = list.map((s) => PLAY_PRODUCT[s].split(':')[0]);
      const { products } = await this.rc.getProducts({ productIdentifiers: ids, type });
      for (const p of products ?? []) {
        const sku = skuForProduct(p.identifier);
        if (!sku || (SUBSCRIPTION_SKUS.includes(sku) && p.identifier !== PLAY_PRODUCT[sku])) continue;
        this.products.set(sku, p);
        out[sku] = { label: p.priceString, amount: p.price, currency: p.currencyCode };
      }
    };
    await fetch(oneTime, 'NON_SUBSCRIPTION');
    await fetch([...SUBSCRIPTION_SKUS], 'SUBSCRIPTION');
    return out;
  }

  async buy(sku: SkuId): Promise<BuyResult> {
    const product = this.products.get(sku);
    if (!product) return { ok: false, reason: 'unavailable' };
    try {
      const r = await this.rc.purchaseStoreProduct({ product });
      const customer = toCustomer(r.customerInfo);
      const t = r.transaction;
      return { ok: true, transaction: { id: t?.transactionIdentifier ?? `${sku}-${t?.purchaseDate ?? Date.now()}`, sku, at: Date.parse(t?.purchaseDate) || Date.now() }, customer };
    } catch (e: any) {
      // AB#4739: RevenueCat's error code travels with the result, for the purchase_failed event
      const code = e?.code !== undefined && e?.code !== null ? String(e.code) : undefined;
      if (e?.userCancelled || e?.code === CANCELLED) return { ok: false, reason: 'cancelled', code };
      if (e?.code === PENDING) return { ok: false, reason: 'pending', code };
      return { ok: false, reason: 'error', code, message: String(e?.message ?? e) };
    }
  }

  async customer() {
    return toCustomer((await this.rc.getCustomerInfo()).customerInfo);
  }

  async storefront() {
    return (await this.rc.getStorefront())?.countryCode ?? null;
  }

  async restore() {
    return toCustomer((await this.rc.restorePurchases()).customerInfo);
  }

  onChange(listener: (customer: StoreCustomer) => void) {
    void this.rc.addCustomerInfoUpdateListener((info: any) => listener(toCustomer(info)));
  }
}
