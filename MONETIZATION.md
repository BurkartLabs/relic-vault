# MONETIZATION — relic-vault

One `## Review #N — <date> · **x.x / 5 · VERDICT**` section per Monetization Critic review, newest first.
Template: hq `templates/MONETIZATION.md`. RUBRIC Monetization table in hq `RUBRIC.md`.

## Review #1 — 2026-09-19 · **2.5 / 5 · REPRICE**

Reviewer: Board session (baseline written when the Monetization loop was created, **not** a fresh-context Critic).
The first scheduled Monetization Critic review replaces or confirms these scores.
Stage: Deepen cycle 2 · probes: no value probe yet (epic RV-M1); numbers below come from the runway probe,
`probes/2026-09-19-deepen1.txt` (planner bot, 25 min/day, 12 seeds).

### Board feedback that opened this review

> Who would spend $1.99 for a golden crown and 2 silver urns? They take like 30 seconds to make.

Accurate in substance. The Welcome pack is 2 Gold Masks (T4), a Silver Urn (T3), 120 gems, 800 gold and a chest.
The relics and gold are worth minutes of play; only the gems and the chest hold value.

### Probe numbers used

- Planner first makes a Silver Urn (T3) at 4 min, a Gold Mask (T4) at 13 min, an Emerald Scarab (T5) at 41 min.
- Gold banked per day: 6,554 (planner) · 8,889 (greedy). At 25 min/day that is ~260 gold per minute of play.
- Orders per day (planner): 31.4 → about 8 order-gem drops/day at 2–5 gems, plus 3 gems per rank-up and 2 per quest.
  Rough gem income ≈ 30–40/day. Not measured directly: RV-M1.
- Jams are rare: a player who is not trying to brick the board never meets Vault Jammed, so gem-clear and ad salvage
  have almost no demand (Board observation, consistent with 0 jams in the planner's action log: sell 0).

### Honesty audit (provisional, judged first)

| Surface | Fake urgency / scarcity | Inflated baseline | Fabricated social proof | Odds shown | Minors: no paid random rewards | Pass? |
|---|---|---|---|---|---|---|
| Welcome pack | real 48h window from first sight, never resets | ribbon computed (201%) | none | chest odds in shop | chest → exact Gold Mask | pass |
| Shop (gems, chests, market) | none | one baseline ($4.99 = 200 gems) | none | ODDS button before spend | chest SKUs hidden | pass |
| Rush Boost | on sale all Rush, never pushed (RV-D6) | — | none | — | deterministic | pass |
| Piggy, VIP, Pass, So Close | pushed once each | computed | none | — | — | pass |

Provisional **PASS**. The Critic must re-audit every surface in the build.

### What each SKU is worth in play time (estimates until RV-M1)

| SKU | Price | Contents | Minutes of play to earn them when offered | Verdict |
|---|---|---|---|---|
| Keeper's Welcome | $1.99 | 120 gems, 800 gold, 2× T4, 1× T3, 1 chest | relics + gold ≈ 20 min; gems + chest ≈ 4–5 days | the part the player sees first is worthless |
| So Close Bundle | $2.99 | T5, 60 gems, 1,500 gold | T5 ≈ 40 min, gold ≈ 6 min, gems ≈ 2 days | same problem |
| Exact Emerald Scarab | 150 gems | one T5 | ≈ 40 min | ~4 days of gems for 40 min of play |
| Lucky Chest | 40 gems / $2.99 | T2–T6 | mostly minutes | weak |
| Gem packs | $4.99–19.99 | 200–1,200 gems | days to weeks | only as good as what gems buy |
| Pass, VIP, No ads | $7.99–9.99 | luck, crates, skin, no interstitials | permanent / season | the only durable value today |

### Scores (RUBRIC Monetization table)

| Gate | Score | Evidence |
|---|---|---|
| Value perception | 2 | Relic and gold contents are earned in minutes (table above); only gems, pass, VIP and no-ads last. |
| Sink depth | 2 | Gold piles up (6.5–8.9k banked/day); gem sinks buy relics made in minutes; jams almost never happen, so the rescue sinks go unused. |
| Price ladder | 3 | Gem packs run off one computed baseline and rise with commitment; the $2.99 bundles sit off the ladder. |
| Spend moments | 3 | Welcome after the first merge (delight), Jammed on a full board, piggy at 200, VIP at 60 merges; no per-session offer cap yet (TODO #6). |
| Free path | 3 | The planner finishes the pass (day 11.9) and the Rush (day 3.8) without paying; a casual profile is unproven (RV-D6, #275). |
| Spending runway | 2 | After pass + VIP + no-ads there is nothing durable to buy; one skin; chests of relics made in minutes. |
| **Average** | **2.5** | Below the 3.5 threshold. |
| Honesty | PASS (provisional) | See audit. |

### Verdict: REPRICE

Nothing coercive, but nothing worth the money either. The fix is not cheaper prices: it is things worth owning
(power-ups, permanent progress, cosmetics), stakes that make a rescue worth something, and competition that
spending cannot buy.

### Epics (ranked)

| # | Epic | Hypothesis | Probe target (acceptance) | Size | Charter risk check |
|---|---|---|---|---|---|
| 1 | **RV-M1 Value probe** | We cannot price what we do not measure. | `ops/probes/relic-vault-value.ts` prints, per profile (casual 12 min/day, planner, greedy): gem income/day, gold income/day, minutes of play to earn each SKU's contents at the moment it is offered, and $ to buy everything. Output committed under `probes/`. | S | none |
| 2 | **RV-M2 Power-ups** | Gems need something worth wanting at every horizon. A stackable inventory bought with gems and also earned in play: **Auto-Merge** (merges every pair on the board once), **Relic Shower** (fills every empty socket with a random low-tier relic), **Undo** (last action), **Binding Stand-in** (counts as a missing binding once). | Planner using power-ups spends ≥ 70% of gem income and banks ≥ 50% fewer gems/day; a no-pay casual profile earns ≥ 1 power-up/day from Rush, pass and quests; unit tests for each power-up. | M | Relic Shower is random contents bought with gems, i.e. a loot box: under-16 and loot-box-off profiles get a deterministic shower (lowest tier of a chosen chain). Power-ups are never excluded from the free path. |
| 3 | **RV-M3 Packs worth buying** | Players pay for permanence and time saved, not for relics they make in minutes. Rebuild Welcome and So Close around gems, a power-up kit and something permanent (cosmetic, extra satchel space, a generator cosmetic); no item-only bundles. | Per RV-M1: every pack's contents ≥ 60 min of planner play at the moment it is offered; value ribbons still computed from one baseline. | S | no fake "was" prices; real deadlines only |
| 4 | **RV-M4 Stakes** (shared with depth: mastery, decision density) | A board that cannot be lost has no tension and no rescue worth paying for. **Cursed relics**: some forges roll a cursed relic; if it is not merged or delivered within N actions it fogs an adjacent socket until an adjacent merge clears it. Counted in actions, never wall-clock; a free way out always exists; power-ups are a faster way out. | Greedy bot fogs ≥ 3 sockets/day, planner ≤ 1; planner/greedy gap on orders/day widens ≥ 20%; zero unwinnable states in 10,000 seeded runs. | M | no energy-style gate; never "pay or lose progress"; ties into RV-D4a cursed sockets (#276) |
| 5 | **RV-M5 Seasons, challenges and leaderboards** (depth: return reason, goal ladder, mastery) | Competition gives a reason to return that no timer does. Weekly Rush board and a 14-day season board, plus rotating **Trials** (fixed-seed challenges: fewest actions to a Ruby Crown, most orders in 100 actions, ...), each with its own board. **All ages**: generated names only, no free text, no chat, no contact between players. Server-checked: the client submits seed + action log and the control plane replays the pure sim to verify the score. Rewards are fixed per percentile band (gems, cosmetics, titles), never random. | Replay verification rejects 100% of edited-state submissions in tests; a player's rank never changes with spend (Trials give everyone the same kit; paid power-ups excluded from ranked scoring); ≥ 3 goal horizons live at once (Depth "goal ladder" probe). | L → split | Board decision: public exposure (#273) and hosting. No fabricated players on any board (Soul: fabricated social proof). |

**Prestige** (Board idea, same session) is not a monetization epic: it belongs in the vault-rooms design, RV-D4a (#276).
Once every relic in a room has been discovered, the player may leave for a new room and new chains, keeping a
permanent Keeper's Renown bonus (never for sale). It feeds the Depth gates "world change" and "content runway".

### Next review

The first scheduled Monetization Critic sweep (Sunday 03:00 Toronto), or on demand from the Console once the control
plane with the Monetization loop is deployed. RV-M1 should land first so that review has real numbers.
