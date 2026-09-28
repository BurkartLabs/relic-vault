/**
 * AB#4733: the storefront countries where random paid chests are not offered at all, whatever the player's toggle
 * says: the maintained list the item names (data/lootbox-restricted-countries). Decision AB#4741 (Board, 2026-09-28)
 * named Belgium, which treats paid loot boxes as gambling, and excluded it at the Play level too (Board release steps
 * 5 and 8). The Board adds a country here, and at the Play level, when its law changes; this list and the Play
 * Console exclusion are kept in step.
 *
 * RevenueCat reports the storefront as ISO 3166-1 alpha-2 on Android and alpha-3 on iOS, so each entry carries both.
 */
export interface RestrictedCountry { code: string; alpha3: string; name: string }

export const LOOTBOX_RESTRICTED_COUNTRIES: readonly RestrictedCountry[] = [
  { code: 'BE', alpha3: 'BEL', name: 'Belgium' },
];
