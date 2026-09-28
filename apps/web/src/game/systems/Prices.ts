import { SKUS, SkuId, BASELINE_SKU } from '../data/catalog';

/**
 * AB#4725: what a pack costs, as the player is charged it. In demo mode (the web default) that is the catalog's USD
 * price. In a Play build it is the store's own localised price, set here once RevenueCat has fetched the products:
 * every price the player sees comes from priceLabel(), and every number derived from a price (the value ribbons, gems
 * per unit of currency) from priceAmount(), so the Honesty rule (every number derived) holds in any currency. Until
 * the store answers, or for a product it does not return, a Play build shows no price at all rather than a USD one.
 */
export interface StorePrice {
  /** The store's formatted price, e.g. "12,49 €". Shown as is. */
  label: string;
  /** The same price as a number in `currency`, for derived figures. */
  amount: number;
  /** ISO 4217 code, e.g. "EUR". */
  currency: string;
}

let book: Partial<Record<SkuId, StorePrice>> | null = null;

/** A Play build's prices, as the store returned them. `null` goes back to the catalog's USD (demo, tests). */
export function setStorePrices(prices: Partial<Record<SkuId, StorePrice>> | null) {
  book = prices;
}

export function storePricesLoaded(): boolean {
  return book !== null && Object.keys(book).length > 0;
}

/** What the store charges for `id`, in its currency; NaN while a store build has no price for it yet. */
export function priceAmount(id: SkuId): number {
  if (book === null) return SKUS[id].price;
  return book[id]?.amount ?? NaN;
}

/** The price to show on a button or in copy. A store build with no price for `id` shows an ellipsis, never USD. */
export function priceLabel(id: SkuId): string {
  if (book === null) return '$' + SKUS[id].price.toFixed(2);
  return book[id]?.label ?? '…';
}

/** The unit a per-price figure is quoted in: "$" in demo mode, the store's currency code in a Play build. */
export function currencyUnit(): string {
  if (book === null) return '$';
  const any = Object.values(book).find(Boolean);
  return any ? any.currency : '';
}

/** Gems per unit of currency for a gem pack, at the price charged; NaN when there is no price yet. */
export function gemsPerUnit(id: SkuId): number {
  const gems = SKUS[id].gems ?? 0;
  const amount = priceAmount(id);
  return amount > 0 ? gems / amount : NaN;
}

/** The value ribbons' baseline rate: the entry pack's gems per unit of currency, at the price charged. */
export function baselineGemsPerUnit(): number {
  return gemsPerUnit(BASELINE_SKU.id as SkuId);
}
