# ECONOMY — Relic Vault (current numbers)

Source of truth: `apps/web/src/game/data/economy.json` and `catalog.ts`. This file mirrors them.

## Core rules

- Merge-2: two of tier *t* → one of *t+1*. Two Living Relics (T9) **ascend**: both leave the board for 5,000 gold + 50 gems.
- Forge is always clickable. T1 normally; luck gives T2 (chance = luck) and T3 (luck/4).
- Board full never blocks: Forge opens **Vault Jammed** (sell lowest / gem-clear lowest 3 for 10 gems / ad salvage), and any overflow reward waits in the **satchel**, never lost.
- No energy, lives, or stamina anywhere. Asserted by the e2e test "no cooldown".

## Per-tier table

| Tier | Merge gold | Sell gold | XP | Event pts | Pass XP |
|---|---|---|---|---|---|
| 2 | 3 | 1 | 2 | 1 | 1 |
| 3 | 8 | 2 | 4 | 2 | 2 |
| 4 | 20 | 6 | 8 | 4 | 3 |
| 5 | 50 | 15 | 14 | 8 | 4 |
| 6 | 120 | 35 | 22 | 16 | 6 |
| 7 | 300 | 80 | 34 | 32 | 8 |
| 8 | 750 | 200 | 50 | 64 | 10 |
| 9 | 1,800 | 500 | 80 | 128 | 14 |
| (T1 sells for 1) | | | | | |

Combo: 3+ merges within 1.8s each add `combo*2 + tier*combo` bonus gold.

## Currencies

- Start: 150 gold, 30 gems.
- Gold sinks: Relic Market (T2 60 · T3 180 · T4 520 · T5 1,500).
- Gem sinks: Lucky Chest 40 · exact Emerald Scarab 150 · fill album card 80 · gem-clear 10 · wheel 15 · x2 Rush Boost 60 (30 min).
- Gem faucets: rank-ups (3 each), daily quests (2 each), duplicate cards (3), pass, events, wheel, VIP crate (5/day), ascension.

## Rank

XP to next rank = 30 + 25 × (rank − 1). Each rank: +3 gems, brighter medallion. Luck +0.1% per rank up to rank 10.

## Luck (hidden)

`0.03 + 0.01·cards + 0.04·pass + 0.02·VIP + 0.01·min(rank,10)/10 + 0.01·pagesDone + 0.002·crumbs`, **capped at 0.18**.

## Lucky Chest (disclosed)

| Result | Chance |
|---|---|
| T2 Copper Idol | 45% |
| T3 Silver Urn | 33% |
| T4 Gold Mask | 14% |
| T5 Emerald Scarab | 6% |
| T6 Sapphire Heart | 2% |

Pity: the 15th chest in a row without ≥T4 is drawn from the ≥T4 rows only. Luck can upgrade any result by one tier (max T6).
35% chance of an album card per chest. Minors and `lootboxesAllowed=false` see only exact-item offers.

## Album

3 pages × 12 cards. Drops: T4+ merges (6% +3%/tier), chests (35%), pass tier 8 (wildcard), events, 80-gem fill.
New drops are biased 60% toward missing cards. Page complete = +1% luck and a decoration in the vault.

## Piggy

Stores 10% of gold earned (1 stored gold = 1¢ displayed), cap 600. Smash $2.99 → stored × 4 gold + 15 gems.
Offered once at $2.00; jiggles every 90s above $2.00.

## Season pass (14 days, 20 tiers, 30 XP each)

Free: gold (80 + 30·tier), chests at 5/10/15/20, luck crumbs at 3/6/9/12/18. Premium ($9.99): gems every tier,
chests at 4/8/12/16, Emerald Scarabs at 5/10/15, wildcard card at 8, Gilded skin at 20, +4% luck.

## Gold Rush (4-day cycle, always on)

Milestones at 15 / 50 / 120 / 250 / 450 / 750 / 1,200 / 2,000 / 3,500 / 6,000 points. The top milestone
assumes pass + chests (intentional per brief). Boost sheet appears in the last 48h.

## SKUs (demo)

| SKU | Price | Grants |
|---|---|---|
| Keeper's Welcome | $1.99 one time | 120 gems, 800 gold, 2× T4, 1× T3, 1 free chest |
| Pouch of Gems | $4.99 | 80 |
| Chest of Gems | $9.99 | 500 (POPULAR) |
| Hoard of Gems | $19.99 | 1,200 (BEST VALUE) |
| Lucky Chest | $2.99 | 1 chest now |
| Smash the Pig | $2.99 | piggy × 4 + 15 gems |
| Keeper's Pass | $9.99 | premium track |
| Silence the Criers | $7.99 | no interstitials / banner |
| Vault VIP | $9.99 / 30 days | daily crate, +2% luck, crown, no ads |
| So Close Bundle | $2.99 one time | T5, 60 gems, 1,500 gold |
| Exact Emerald Scarab | 150 gems | exactly one T5 |

"Value" ribbons compare to the $4.99 pack rate; the Welcome ribbon ("1200%") is measured against the $9.99 rate,
as the brief requested. See SHIPNOTES for why the Board should review that claim before any real store.
