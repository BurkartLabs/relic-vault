# Value probe — 2026-09-21 (RV-M1, AB#379)

The instrument two Monetization reviews priced this product without. Code: hq `ops/probes/relic-vault-value.ts`, bots in
`ops/probes/relic-vault-sim.ts` (the same players as the depth probe). Raw output: `2026-09-21-value-probe.txt`. Game:
relic-vault `main` at e88f664, which still has one chest table; AB#380 (PR !121) splits it, and the probe reads
either.

**Every number is in actions.** Minutes are the Board's measured pace (≤ 1.18 s/action, Bug #307), labelled. What a
SKU grants comes from the game's own `applyPurchase()` on a fresh adult save and from the pass/VIP reward tables, not
from the catalog's blurbs. A relic's worth is the actions to make it by hand (forge T1s and merge; bindings included):
Gold Mask 15, Emerald Scarab 31, Sapphire Heart 63, Ruby Crown 134, Star-Metal Ark 284, Living Relic 677.

## Reproducing Monetization review #2 (Critique AB#368)

| Figure | Critique, by hand | Probe | |
|---|---|---|---|
| Chest EV, exact-relic gems | 7.8 | **7.80** | reproduced |
| Welcome, gem-equivalents (300 gold/gem, chest at its 50-gem price) | ~531, 399% | **531.3, 399%** | reproduced |
| Welcome, chest at what it returns | — | 489.1, 367% | the gap |

The Critique's 531 counts the Welcome chest at the 50-gem price of a chest you buy; the chest in the pack rolls on
the earned table and returns 7.8. That 42-gem gap is Bug #678, filed from AB#380.

## Income (median of 12 seeds, 14 days)

| | gems/day | gold/day | day 1 (one-off rank rewards included) |
|---|---|---|---|
| planner, engaged | 79.2 | 42,054 | 225 gems, 22,008 gold |
| planner, casual | 51.1 | 18,102 | 171 gems, 6,898 gold |
| focused, engaged | 121.3 | 29,899 | 113 gems, 30,915 gold |
| focused, casual | 56.1 | 13,723 | 14 gems, 7,741 gold |

## What a SKU is worth in play (planner; at 14-day income, then at day-1 income)

| SKU | Grants | Engaged | Casual |
|---|---|---|---|
| Keeper's Welcome $1.99 | 120 gems, 100,000 gold, 2 Gold Masks, a Ruby Crown, a chest | 101 min · 2.2 h | 99 min · 3.1 h |
| So Close Bundle $2.99 | 120 gems, 15,000 gold, an Emerald Scarab | **47 min · 31 min** | **39 min · 35 min** |
| Pouch of Gems $2.99 | 200 gems | 63 min · **22 min** | **47 min · 14 min** |
| Chest of Gems $4.99 | 500 gems | 2.6 h · **56 min** | 117 min · **35 min** |
| Hoard of Gems $8.99 | 1,200 gems | 6.3 h · 2.2 h | 4.7 h · 84 min |
| Smash the Pig $2.99 | up to 250 gems | 79 min · **28 min** | **59 min · 18 min** |
| Keeper's Pass $9.99 | 400 gems, 3 Emerald Scarabs, 3 chests, a card, a skin, +4% luck | 2.2 h · **49 min** | 98 min · **33 min** |
| Vault VIP $9.99/month | 150 gems, 30 chests, +2% luck, a crown, no ads | 75 min · **45 min** | 63 min · **38 min** |
| Silence the Criers $7.99 | no interstitials or banner | nothing play can earn | — |

**$ to buy everything once** (one month of VIP, a full piggy, each gem pack once): **$52.91**.

Bold is under the 60 minutes RV-M3 (#304) asks every pack's contents to be worth when offered. On 14-day income only
So Close and, for a casual player, the Pouch and the Pig fall short; on day-1 income most gem products do, because a
new player's gems arrive fast from rank rewards. Which income is "when offered" depends on when each offer fires, and
the probe does not model offers: it gives both and leaves the call to RV-M3.

## Blind class

Everything the depth probe cannot see (floors, daily quests, the wheel, the VIP crate, opening chests, one human
pace), and more: this prices **contents**. It says nothing about what a purchase saves a player from, permanence,
cosmetics, luck, ads removed, or how a pack feels. The card, skin, luck and crown in the Pass and VIP are listed and
not converted.
