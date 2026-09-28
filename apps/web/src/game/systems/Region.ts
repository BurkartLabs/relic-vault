import { LOOTBOX_RESTRICTED_COUNTRIES, type RestrictedCountry } from '../data/lootboxRestrictedCountries';
import type { GameState } from './State';

/**
 * AB#4733: the loot-box rule from the Play storefront. A Play build reads the store account's country on boot
 * (PurchaseService.start); in a country on the restricted list, random paid chests are off whatever the player's
 * "Loot boxes in region" toggle says, and the toggle is shown locked with the reason. Anywhere else, and in the web or
 * demo build (no storefront), the toggle works as it always has.
 *
 * The country is held in memory for this session only: never saved and never sent (docs/DATA_SAFETY.md). Telemetry
 * gets only which rule applied (lootboxSource).
 */
let storeCountry: string | null = null;

/** The storefront's country code as RevenueCat reports it (alpha-2 or alpha-3); null when there is no store. */
export function setStoreCountry(code: string | null | undefined) {
  storeCountry = code ? String(code).trim().toUpperCase() : null;
}

/** The restricted country the storefront is in, or null (no store, or a country where the toggle governs). */
export function storeRestriction(): RestrictedCountry | null {
  if (!storeCountry) return null;
  return LOOTBOX_RESTRICTED_COUNTRIES.find((c) => c.code === storeCountry || c.alpha3 === storeCountry) ?? null;
}

/**
 * Which rule decides random chests this session, for app_open: `store` when the storefront's country forbids them,
 * `manual` when the player has switched them off, `none` when nothing stops them.
 */
export function lootboxSource(s: GameState): 'store' | 'manual' | 'none' {
  if (storeRestriction()) return 'store';
  return s.lootboxesAllowed ? 'none' : 'manual';
}
