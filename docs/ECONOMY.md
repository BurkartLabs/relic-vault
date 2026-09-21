# ECONOMY — Relic Vault (current numbers)

Source of truth: `apps/web/src/game/data/economy.json`, `catalog.ts` and `items.ts`. This file mirrors them;
if they disagree, the code wins and this file is stale. Last synced: Board pricing feedback round 2, 2026-09-19 (save v5).

## Core rules

- Merge-2: two of the same item → the next tier of that chain. Two top-tier relics **ascend**: both leave the
  board for 5,000 gold + 50 gems, multiplied by the chain's value.
- Forge is always clickable. It makes T1 of the chosen chain; luck gives T2 (chance = luck) and T3 (luck/4).
  Each generator level above 1 adds +2% to that generator's luck.
- Board full never blocks: Forge opens **Vault Jammed** (sell lowest / gem-clear lowest 3 for 10 gems / ad salvage),
  and any overflow reward waits in the **satchel**, never lost.
- No energy, lives, or stamina anywhere. Asserted by the e2e test "no cooldown".

## Chains (item id = chain × 10 + tier)

| Chain | Ids | Unlocks at | Value × |
|---|---|---|---|
| Forge | 1–9 | rank 1 | 1 |
| Crypt Brazier | 11–17 | rank 3 | 1.25 |
| Star Well | 21–27 | rank 6 | 1.5 |

**Bindings**: making a high-tier item consumes a relic from another chain that must be on the board.

| Makes | Consumes |
|---|---|
| 7 Ruby Crown | 13 Candle Skull |
| 8 Star-Metal Ark | 24 Moon Sickle |
| 9 Living Relic | 16 Ossuary Chest |
| 15 Wraith Lantern | 4 Gold Mask |
| 16 Ossuary Chest | 24 Moon Sickle |
| 17 Lich Phylactery | 6 Sapphire Heart |
| 25 Armillary Sphere | 14 Canopic Jar |
| 26 Star Lyre | 6 Sapphire Heart |
| 27 Heart of the Sky | 16 Ossuary Chest |

**Generator upgrades** (gold sink, never a gate), every generator up to level 10: level 2 300 · 3 900 · 4 2,500 ·
5 6,000 · 6 12,000 · 7 20,000 · 8 32,000 · 9 50,000 · 10 80,000. Each level above 1 adds +2% higher-tier output.

## Per-tier table (Forge values; Crypt × 1.25, Star Well × 1.5, rounded)

| Tier (made / sold) | Merge gold | Sell gold | XP | Rush pts |
|---|---|---|---|---|
| 1 | — | 1 | — | — |
| 2 | 3 | 2 | 1 | 0 |
| 3 | 8 | 6 | 1 | 0 |
| 4 | 20 | 15 | 2 | 1 |
| 5 | 50 | 35 | 3 | 1 |
| 6 | 120 | 80 | 4 | 2 |
| 7 | 300 | 200 | 6 | 2 |
| 8 | 750 | 500 | 8 | 3 |
| 9 | 1,800 | 1,200 | 10 | 4 |

Merges give **no pass XP** (the `passXp` table is all zeros); pass XP comes from patron orders. Ascending gives 20 pass XP.

Combo: the 3rd+ merge within 1.8 s of the previous one adds `combo × 2 + tier × combo` bonus gold.

## Patron orders (the main faucet since Deepen cycle 1)

- 3 order slots, each from a different patron (6 patrons, each with a favourite chain).
- An order asks for 1–3 items. It never asks for T1, never above the player's best tier + 1, and never for an item
  whose binding chain is still locked.
- "Work" of an item = 2^(tier−1) T1 forges, plus the work of its binding, × chain value. XP and Rush points are paid
  per unit of work (0.6 XP · 2.1 pts; pass XP = √work).
- **Gold is priced differently, and deliberately** (Board RV-B9): an order pays **2.2 × the gold the merges to build
  those relics already paid out** (`buildGold`, bindings included), because merge gold grows faster per tier than
  "work" does — a flat rate per work unit is generous at the bottom and insulting at the top. A top-of-chain relic
  also pays at least 60% of its ascension gold, so a patron always outbids both keeping it and ascending it.
- Orders with more than one item pay +15% per extra item.
- The first time an order can be filled from the board, the Keeper points it out (once).
- 2–5 gems on every 4th order; 4.5% chance of an album card.
- Orders never expire on a clock. Dismissing is free; the slot refills after 3 actions.

## Currencies

- Start: 150 gold, 30 gems.
- Gold sinks: generator upgrades (above); Relic Market (T2 60 · T3 180 · T4 520 · T5 1,500).
- Gem sinks: Lucky Chest 50 · exact relic 1–97 by tier (see below) · fill album card 80 · gem-clear 10 · wheel 15 ·
  x2 Rush Boost 60 (30 min).
- Gem faucets: rank-ups (3 each), orders, daily quests (2 gems + 120 gold + 3 pass XP each), duplicate cards (3), pass,
  Rush, wheel, VIP crate, ascension.
- Pass XP from daily quests (AB#275): 9 a day for all three. It keeps the 12 min/day player at pass tier ≥ 15 by day 14
  in every probe run (lowest 16), and it is the smallest value that leaves a tier of margin: 2 left two runs at
  exactly 15; 3, 4 and 5 moved the 25 min/day player's pass from day 9.6 to 8.7, 8.6 and 8.5 (probe:
  `probes/2026-09-21-probe-v2.md`).

## Rank

XP to next rank = 40 + 40 × (rank − 1) + 4 × (rank − 1)². Each rank: +3 gems. Rank 3 unlocks the Crypt Brazier,
rank 6 the Star Well.

## Luck (hidden)

`0.03 + 0.01·cards + 0.04·pass + 0.02·VIP + 0.01·min(rank,10)/10 + 0.01·pagesDone + 0.002·crumbs`, **capped at 0.18**.
Generator levels add on top of the cap (forge only).

## Lucky Chest (disclosed)

| Result | Chance |
|---|---|
| T4 Gold Mask | 40% |
| T5 Emerald Scarab | 30% |
| T6 Sapphire Heart | 18% |
| T7 Ruby Crown | 9% |
| T8 Star-Metal Ark | 3% |

50 gems; no longer sold for cash. Pity: the 15th chest in a row without ≥T6 is drawn from the ≥T6 rows only. Luck
can upgrade any result by one tier (max T8).
20% chance of an album card per chest. Minors and `lootboxesAllowed=false` get an exact Gold Mask instead of any chest.

## Album

3 pages × 12 cards. Drops: merges of T5 and up (2% at T5, +1% per tier), chests (20%), orders (4.5%), pass tier 8
(wildcard), Rush, 80-gem fill. New drops are biased 75% toward missing cards on the open page. Page complete = +1% luck
and a decoration in the vault.

## Interruptions and ads

- Interstitials: at most one every 45 s, never for VIP or no-ads owners, and never during a combo streak.
- **Nothing interrupts a streak** (Board RV-B8): while a combo is live, and for 2.2 s after the last merge, no offer,
  shop, modal or interstitial opens. Queued offers wait rather than being dropped. Vault Jammed still appears,
  because that is the player asking for help.

## Piggy

Stores gems: one every 4 merges, cap 250. Smash $2.99 → every whole stored gem (~84 gems per dollar at the cap).
Offered once at 50 gems. Save v5 emptied the old gold pig.

## Season pass (14 days, 20 tiers, 80 XP each)

Free: gold (80 + 30·tier), chests at 5/10/15/20, luck crumbs at 3/6/9/12/18. Premium ($9.99): gems on the other
tiers, chests at 4/12/16, Emerald Scarabs at 5/10/15, wildcard card at 8, Gilded skin at 20, +4% luck.

## Gold Rush (4-day cycle, always on)

Milestones at 15 / 50 / 120 / 250 / 450 / 750 / 1,200 / 2,000 / 3,500 / 6,000 points. The x2 Rush Boost (60 gems,
30 min) is on sale for the whole cycle in the Events panel. It is never pushed and never tied to the deadline (RV-D6).

## SKUs (demo)

| SKU id | Name | Price | Grants |
|---|---|---|---|
| welcome | Keeper's Welcome | $1.99 one time | 120 gems, 100,000 gold, 2× Gold Mask, 1× **Ruby Crown (T7)**, 1 free chest |
| gems200 | Pouch of Gems | $2.99 | 200 gems (baseline rate, 100%) |
| gems500 | Chest of Gems | $4.99 | 500 gems (POPULAR, 150%) |
| gems1200 | Hoard of Gems | $8.99 | 1,200 gems (BEST VALUE, 200%) |
| piggy | Smash the Pig | $2.99 | every whole gem the pig holds, up to 250 |
| pass | Keeper's Pass | $9.99 | premium track |
| noads | Silence the Criers | $7.99 | no interstitials / banner |
| vip | Vault VIP | $9.99 / 30 days | daily crate, +2% luck, crown, no ads |
| comeback | So Close Bundle | $2.99 one time | T5, 120 gems, 15,000 gold |
| — | Exact relic (rotating) | 1–97 gems | one relic, chosen near your best Forge tier and priced from its build cost: T3 1 · T4 3 · **T5 5 (the anchor)** · T6 10 · T7 22 · T8 44 · T9 97. A Ruby Crown costs more than a straight doubling because it also consumes a Crypt binding. |

"Value" ribbons are computed, never hardcoded (`skuValuePct`): gem-equivalent per dollar against the **entry pack**,
whatever it costs today (currently $2.99 for 200 gems, so 66.9 gems per dollar). The bigger packs therefore read 150%
and 200%. The Welcome pack counts its chest at the chest's gem price and none of its gold, so its ribbon understates
it badly now that it carries 100,000 gold — worth revisiting with the value probe (RV-M1).
