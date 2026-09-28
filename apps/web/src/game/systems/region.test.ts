import { describe, it, expect, afterEach } from 'vitest';
import { setStoreCountry, storeRestriction, lootboxSource } from './Region';
import { chestsAllowed } from './Economy';
import { createState } from './State';
import { PurchaseService } from './PurchaseService';
import { setStorePrices } from './Prices';
import { mulberry32 } from './Rng';
import type { StoreBackend } from './PlayStore';

// AB#4733: random paid chests from the Play storefront's country, the manual toggle kept elsewhere.

afterEach(() => { setStoreCountry(null); setStorePrices(null); });

const store = (country: string | null): StoreBackend => ({
  start: async () => {},
  storefront: async () => country,
  prices: async () => ({}),
  buy: async () => ({ ok: false, reason: 'unavailable' }),
  customer: async () => ({ active: {}, transactions: [], manageUrl: null }),
  restore: async () => ({ active: {}, transactions: [], manageUrl: null }),
  onChange: () => {},
});

describe('loot boxes by storefront (AB#4733)', () => {
  it('a Belgian storefront means no random chests, whatever the toggle says', () => {
    const s = createState();
    s.age = 'adult';
    setStoreCountry('BE');
    s.lootboxesAllowed = true;
    expect(chestsAllowed(s)).toBe(false);
    expect(storeRestriction()?.name).toBe('Belgium');
    expect(lootboxSource(s)).toBe('store');
    setStoreCountry('BEL'); // RevenueCat's alpha-3 form (iOS)
    expect(chestsAllowed(s)).toBe(false);
  });

  it('a Canadian storefront leaves the toggle in charge', () => {
    const s = createState();
    s.age = 'adult';
    setStoreCountry('CA');
    expect(storeRestriction()).toBeNull();
    expect(chestsAllowed(s)).toBe(true);
    expect(lootboxSource(s)).toBe('none');
    s.lootboxesAllowed = false;
    expect(chestsAllowed(s)).toBe(false);
    expect(lootboxSource(s)).toBe('manual');
  });

  it('with no store (web, demo) the toggle works as before, and a minor never gets random chests', () => {
    const s = createState();
    s.age = 'adult';
    expect(chestsAllowed(s)).toBe(true);
    s.age = 'minor';
    expect(chestsAllowed(s)).toBe(false);
  });

  it('a Play build reads the storefront when the store starts, before any shop is drawn', async () => {
    const s = createState();
    s.age = 'adult';
    await new PurchaseService('play', store('be')).start(s, mulberry32(1));
    expect(storeRestriction()?.code).toBe('BE');
    expect(chestsAllowed(s)).toBe(false);
    setStoreCountry(null);
    await new PurchaseService('play', store('CA')).start(s, mulberry32(1));
    expect(chestsAllowed(s)).toBe(true);
  });
});
