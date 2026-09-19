import { SKUS, SkuId } from '../data/catalog';
import type { GameState } from './State';
import type { Rng } from './Rng';
import { placeOrStash } from './BoardSystem';
import { grantGold, grantChests } from './Economy';
import { welcomeOpen } from './Offers';

export interface PurchaseGrant {
  ok: boolean;
  reason?: 'owned';
  sku: SkuId;
  gems: number;
  gold: number;
  relics: { tier: number; index: number }[];
  freeChests: number;
}

export function skuAvailable(s: GameState, sku: SkuId): boolean {
  if (sku === 'welcome') return !s.ent.welcome && welcomeOpen(s, Date.now());
  if (sku === 'comeback') return !s.ent.comeback;
  if (sku === 'pass') return !s.ent.passPremium;
  if (sku === 'noads') return !s.ent.removeAds;
  if (sku === 'vip') return !s.ent.vip;
  if (sku === 'piggy') return s.piggy > 0;
  return true;
}

/** Pure entitlement grant. Identical in demo and storekit modes. */
export function applyPurchase(s: GameState, sku: SkuId, rng: Rng, now = Date.now()): PurchaseGrant {
  const g: PurchaseGrant = { ok: true, sku, gems: 0, gold: 0, relics: [], freeChests: 0 };
  if (!skuAvailable(s, sku)) return { ...g, ok: false, reason: 'owned' };
  const def = SKUS[sku];
  switch (sku) {
    case 'welcome':
      s.ent.welcome = true;
      s.gems += def.gems!; s.gold += def.gold!; g.gems = def.gems!; g.gold = def.gold!;
      for (const t of [4, 4, 3]) g.relics.push({ tier: t, index: placeOrStash(s, t, rng) });
      { const exact = grantChests(s, 1, rng); if (exact.length) g.relics.push(...exact); else g.freeChests = 1; }
      break;
    case 'gems200': case 'gems500': case 'gems1200':
      s.gems += def.gems!; g.gems = def.gems!;
      break;
    case 'piggy': {
      const gold = s.piggy * 4;
      s.gold += gold; s.gems += 15; s.piggy = 0;
      g.gold = gold; g.gems = 15;
      break;
    }
    case 'pass': s.ent.passPremium = true; break;
    case 'noads': s.ent.removeAds = true; break;
    case 'vip': s.ent.vip = true; s.ent.vipUntil = now + 30 * 86400000; break;
    case 'comeback':
      s.ent.comeback = true;
      s.gems += 60; grantGold(s, 1500); g.gems = 60; g.gold = 1500;
      g.relics.push({ tier: 5, index: placeOrStash(s, 5, rng) });
      break;
  }
  s.purchases.push({ sku, t: now });
  return g;
}

export type StoreMode = 'demo' | 'storekit';

/**
 * Store adapter. In demo mode every purchase succeeds after a short "processing" beat.
 * A storekit/play-billing adapter would resolve the same promise after receipt validation.
 */
export class PurchaseService {
  constructor(public mode: StoreMode = 'demo') {}
  async purchase(sku: SkuId): Promise<{ ok: boolean; receipt: string }> {
    if (this.mode === 'demo') {
      await new Promise((r) => setTimeout(r, 450));
      return { ok: true, receipt: `demo-${sku}-${Date.now()}` };
    }
    throw new Error('storekit adapter not linked in v1');
  }
  async restore(): Promise<string[]> {
    return [];
  }
}
