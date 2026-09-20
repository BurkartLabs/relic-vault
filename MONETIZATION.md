# MONETIZATION — relic-vault

One `## Review #N — <date> · **x.x / 5 · VERDICT**` section per Monetization Critic review, newest first.
Template: hq `templates/MONETIZATION.md`. RUBRIC Monetization table in hq `RUBRIC.md`.

## Review #2 — 2026-09-20 · **2.8 / 5 · COERCIVE**

Reviewer: Monetization Critic (fresh context, read-only, AB#342). Build: commit `835da3f` on `main`
(Board feedback round 2, AB#343–AB#351). Previous: review #1, 2.3 / 5, REPRICE.

> **COERCIVE is not a judgement about intent.** Nothing in this build is designed to mislead. The Honesty gate is
> pass/fail and is judged first, and one paid surface takes $2.99 and delivers a tenth of the gold it advertises
> (Bug #366). Under RUBRIC that is a fail, and a fail is COERCIVE whatever the other scores are. Fix #366 and #367
> and this build is a **REPRICE at 2.8**, up 0.5 from review #1.

### What I could and could not run

I could not run the probes or the test suite. `node_modules` in this container holds 4 packages and no `.bin`, and
npm has no network, so `npm test` prints `vitest: not found` **and exits 0** — the failure is invisible to anything
that checks an exit code (T-008). Every number below is computed by hand from the shipped constants
(`economy.json`, `catalog.ts`, `items.ts`) and is reproducible with arithmetic the Board can check. Where I reuse a
bot number from review #1 I say so. **RV-M1, the value probe that was epic #1 of review #1, has not been built** —
`hq/ops/probes/` still contains only `relic-vault-runway.ts`. This review is therefore the second in a row priced
without the instrument we said we needed first.

### What is already known (searched before scoring)

Searched for published practice on starter-pack pricing and IAP ladders (PocketGamer.biz, Deconstructor of Fun,
GameAnalytics, Unity, Mistplay). The industry answer is clear and it **contradicts what I was about to write**:

- A starter pack is normally $0.99–$4.99 carrying **5–10× the value of an equivalent standard purchase**, time-gated
  to 24–72 hours, sold once to first-time buyers. It is a recognised rung of the ladder, not a break in it.
- First-purchase conversion is the point: a player who has spent once is 3–5× more likely to spend again.

I had scored the Board's new Keeper's Welcome as a **ladder inversion** — $1.99 for ~4× the entry pack's value per
dollar, twice the value per dollar of the SKU badged BEST VALUE. Against the published norm that is not an inversion,
it is a starter pack that is still **under-priced in value terms** (4× against a 5–10× convention), with a real
48h window that sits inside the standard 24–72h. I withdrew the finding. Recording it because the Doctrine rule
("look for the existing answer before generating your own") is the only reason this review does not tell the Board
to undo a decision that matches how the category actually works.

Nothing found on the specific question below — whether a random box may be priced above a deterministic item of the
same class sold beside it. Treated as our own judgement, and said so.

### Honesty audit (judged first, pass/fail)

| Surface | Delivers what it advertises | Fake urgency / scarcity | Baseline honest | Social proof | Odds shown | Minors: no paid random | Pass? |
|---|---|---|---|---|---|---|---|
| Keeper's Welcome $1.99 | **yes** — grant reads `def.gems`/`def.gold`; 120 gems, 100,000 gold, 2×T4, T7, chest all land | real 48h window from first sight, never resets | ribbon 128%, computed; **understates** (ignores gold and relics) | none | chest odds in footer | chest → exact Gold Mask | pass |
| **So Close Bundle $2.99** | **NO — advertises 120 gems + 15,000 gold, grants 60 gems + 1,500 gold** | — | — | none | — | deterministic | **FAIL (Bug #366)** |
| Gem packs | yes | none | 100 / 150 / 200% off one derived baseline | none | n/a | n/a | pass |
| **Shop legal footer** | — | — | **NO — "against the $4.99 pack (66.9 gems/$)"; $4.99 now buys 500 gems = 100.2 gems/$** | none | odds + pity correct | — | **FAIL (Bug #367)** |
| Lucky Chest 50 gems | yes | none | — | none | odds + pity + luck disclosed, exact alternative shown beside it | hidden from minors | pass |
| Piggy / VIP / Pass / Rush Boost | yes | Boost never pushed, on sale all Rush (RV-D6) | computed | none | — | — | pass |
| Interstitials | — | 45s gap (was 90s), never during a streak, never gates play | — | — | — | — | pass |

**FAIL.** Two defects, both filed with proposed fixes before this review was written:

- **Bug #366 (Sev 1)** — `catalog.ts` was updated for AB#347 (120 gems, 15,000 gold) and so was the blurb the player
  reads; `PurchaseService.applyPurchase` case `'comeback'` still hard-codes `s.gems += 60; grantGold(s, 1500)`.
  **A $2.99 purchase delivers half the advertised gems and a tenth of the advertised gold** — a 13,500 gold shortfall,
  about two days of planner-bot income. The `'welcome'` case in the same function reads from the catalog correctly,
  which is why round 2's Welcome change landed and round 2's So Close change did not. **P-HALF-FIX**, and untested:
  `sim.test.ts` calls `applyPurchase` for five SKUs but never asserts a grant against its catalog entry, and the e2e
  only asserts `s.ent.comeback === true`. The fix must be a test that loops over **every** SkuId, not one that pins
  comeback (BUG-333's lesson, restated).
- **Bug #367 (Sev 2)** — AB#344 moved the ribbon baseline onto the entry pack but left the disclosure sentence's
  price as a literal beside the derived rate, so the shop now names one pack and quotes another's rate. The
  percentages themselves are right; the sentence explaining them is not. The contradiction is visible on one screen:
  the gem cards print "66.9 gems per $" and "100.2 gems per $" above a footer that says the comparison pack is the
  $4.99 one at 66.9. A stale second baseline (`Offers.ts` `BASELINE = { gems: 200, price: 4.99 }`) also survives with
  no caller — harmless today, a 213% Welcome ribbon for whoever reaches for the obviously-named `valuePct()` next.
  This is **T-003** exactly, on the one product that already learned it.

Neither is a dark pattern. Both are a number restated instead of derived, which is the failure mode this product has
now produced four times (BUG-318, BUG-319, BUG-322, and these two).

### The numbers (hand-computed from the shipped constants)

Exact-relic ladder, `exactRelicCost(t) = round(5 × itemWork(t) / itemWork(5))`, anchored on the Scarab as the Board asked:

| Forge tier | T2 | T3 | T4 | T5 | T6 | T7 | T8 | T9 |
|---|---|---|---|---|---|---|---|---|
| gems | 1 | 1 | 3 | **5** | 10 | 22 | 44 | 97 |

T7 and T9 cost more than a doubling because they consume a Crypt binding — the ladder is derived from `itemWork`,
so it cannot drift from the economy. This is the cleanest piece of pricing in the build.

**The Lucky Chest is the problem.** It costs 50 gems and drops T4–T8 at 40/30/18/9/3%. Priced in the shop's own
exact-relic currency, its expected relic is worth **7.8 gems** — a **6.4× markup on the deterministic card sitting in
the same section**. Valuing its 20% card drop at the full 80-gem `fillCard` price (generous: most chest cards are
duplicates worth 3 gems once the album fills) still leaves **2.1×**. The chest also went from 5 gems to 50 in round 2
(AB#345) while the exact T5 stayed at 5 (AB#331/#346), so two Board decisions from two rounds now collide. The shop
is honest about it — it pairs random and exact deliberately and discloses odds, pity and luck — but the only reason
to buy the random one is misreading the odds, and `catalog.ts:33` still carries the round-1 comment
"a 5-gem chest whose best prize is worth having".

**Gem ladder** (baseline = entry pack, derived): $2.99 → 66.9 gems/$ (100%) · $4.99 → 100.2 (150%) ·
$8.99 → 133.5 (200%). Value per dollar rises with commitment, computed from one constant. Correct.

**Keeper's Welcome $1.99.** Using the shop's own cross-rate (a T5 costs 1,500 gold or 5 gems → 300 gold/gem), the
pack is worth ~531 gems = 267 gems/$ = **399% of the entry baseline**, ~2× the BEST VALUE pack. Per the published
norm above, that is a correctly-shaped starter pack, and the ribbon's 128% **understates** it because gold and
relics are deliberately not converted. Under-claiming is not a honesty defect. It is worth the Board knowing that
the 100,000 gold is **15.3 days of planner-bot gold income** (review #1's 6,554/day) and ~1/6 of the entire
three-generator upgrade ladder (611,100 gold), so a $1.99 payer stops experiencing gold as a constraint on day one.
That is advantage, which the Charter permits; it is also the gold sink review #1 asked for, spent before it is felt.

### Scores (RUBRIC Monetization table)

| Gate | #1 | #2 | Evidence |
|---|---|---|---|
| Value perception | 1 | **3** | Welcome is now worth ~4× the entry pack and the exact-relic ladder is derived from real merge work (T9 = 97 gems); but the Lucky Chest costs 6.4× the deterministic equivalent beside it. |
| Sink depth | 2 | **3** | Gems now have range at every horizon — wheel 15, chest 50, fillCard 80, exact T9 97 — and the generator ladder is a 611,100-gold sink; Welcome hands a payer 100,000 of it at once. |
| Price ladder | 3 | **3** | Gem packs and the exact-relic ladder both compute off one constant and rise correctly; the chest sits off the ladder and the footer misstates the baseline (#367). |
| Spend moments | 3 | **3** | RV-B8 is real and wired on both paths — `pumpOffers` re-queues and `maybeInterstitial` returns while `streaking` — but there is still **no per-session offer cap** (review #1 TODO #6): 7 offer ids, ~5 reachable in one long first session. |
| Free path | 3 | **3** | Unchanged and still unverified — the casual 12 min/day profile (RV-D6, #275) has not been run; no offer blocks play and no ad gates it. |
| Spending runway | 2 | **2** | Unchanged: past pass + VIP + no-ads there is still nothing durable; RV-M2 power-ups and RV-M3 packs are not built. |
| **Average** | **2.3** | **2.8** | +0.5 on the cycle rule, but below the 3.5 threshold. |
| **Honesty** | pass (provisional) | **FAIL** | Bug #366 (paid surface under-delivers), Bug #367 (false baseline disclosure). |

**The +0.5 is real but it is the Board's, not the loop's.** Every point of movement came from Board decisions
implemented as given. Of review #1's five epics, **none has shipped** — RV-M1 was epic #1 and its absence is why
this review is hand-arithmetic.

### Security (in proportion to what this touches)

- **Data: good.** Telemetry identity is an anonymous `rv_did` in localStorage plus a per-boot session id. The
  invite-only SWA config (Decision #273) sends the player's GitHub/AAD `clientPrincipal` to the front end, and I
  found **no path that logs, sends or puts it in a URL** — the identity used for access control never reaches the
  telemetry payload. `referrer-policy: no-referrer` and `nosniff` are set. That is the right shape.
- **Purchases are client-authoritative.** `applyPurchase` mutates localStorage state with no server. Correct for a
  demo where no money moves, and the file says so. It becomes a real issue at two specific moments, both already on
  the roadmap: real StoreKit (receipts must be validated server-side, never trusted from our own client — DOCTRINE
  "inputs trusted because they came from our own client") and **RV-M5 leaderboards**, where a player who can edit
  `gems` in devtools can edit a score. Review #1's epic already specifies seed + action-log replay on the control
  plane; that is the right answer and it must not be downgraded to client-submitted scores.
- **Fails open on age, in one place worth checking.** `chestsAllowed` gates random rewards on `s.lootboxesAllowed &&
  s.age !== 'minor'`, and `enforceChestRules` re-applies it to profiles whose age is set later — that fails closed
  correctly. No new exposure in round 2.
- No CSP header in `staticwebapp.config.json`. Low priority behind an invite wall; worth adding before public preview.

### Verdict: COERCIVE (Honesty fails) — blocks Live, not a safety issue

The product is in invite-only Preview, so no stranger has been mis-sold. Two fixes clear the gate and there is no
reason they should take more than one story. **Do not promote to Live candidate until #366 and #367 are resolved
with the loop-over-every-SKU regression test**, after which the standing verdict is REPRICE at 2.8 and the epics
below apply.

### Epics (ranked, ≤5, each with a probe target)

| # | Epic | Hypothesis | Probe target (acceptance) | Size |
|---|---|---|---|---|
| 1 | **RV-M6 The shop cannot lie** (blocks Live) | Every number a player is shown must be derived from the constant that produces it. | Fix #366 and #367. One test loops over **every** `SkuId`: for any SKU declaring `gems`/`gold`, `applyPurchase` grants exactly the declared value; one test asserts the footer string contains the baseline SKU's own price and rate, both read from `SKUS`. Dead `Offers.ts` baseline deleted. | S |
| 2 | **RV-M1 Value probe** (carried from review #1, unstarted) | We have now priced this product twice without the instrument. | `ops/probes/relic-vault-value.ts` prints per profile: gem and gold income/day, **actions** to earn each SKU's contents when offered, and $ to buy everything. Minutes only at the Board-calibrated human pace, labelled. Must reproduce this review's hand figures (chest EV 7.8 gems, Welcome ≈ 531 gem-eq) or explain the gap. | S |
| 3 | **RV-M7 Price the chest against its own alternative** | A random box priced at 6.4× the deterministic item beside it converts only on misread odds, which is not a business we want. | Chest EV in exact-relic gems ≥ 60% of its price under RV-M1, at every player tier the rotation can offer. Achieved by price, odds, or by making the chest grant something the exact card cannot (a card, a luck crumb) — the Board picks; the Critic does not set prices. Round-1 comment at `catalog.ts:33` regenerated or deleted. | S |
| 4 | **RV-M2 Power-ups** (carried, unstarted) | Gems need something worth wanting at every horizon; the exact-relic ladder now gives the top end, not the middle. | Unchanged from review #1: planner spends ≥70% of gem income, banks ≥50% fewer gems/day; a no-pay casual profile earns ≥1 power-up/day. Deterministic variant for under-16 and loot-box-off profiles. | M |
| 5 | **RV-M8 One offer per session** (review #1 TODO #6, still open) | RV-B8 protects the good part; nothing yet protects the rest of the session. | OfferDirector caps pushed surfaces per session (suggest 1, 2 max) and logs `offer_shown` with its trigger; probe asserts impressions/session ≤ cap across a 14-day casual run. Streak guard unchanged. | S |

Spending runway (RV-M3 packs, RV-M5 seasons) stays queued behind these. It is the lowest score on the table and
will not move until there is something durable to sell; it is correctly ranked last because pricing an empty shelf
is the mistake this loop already made twice.

### Next review

After RV-M6 lands (it gates Live) and RV-M1 produces real numbers. The next review must show the Honesty gate
passing with the every-SKU test green, and should re-derive the chest and Welcome figures from the probe rather
than from a Critic's arithmetic.

## Review #1 — 2026-09-19 · **2.3 / 5 · REPRICE**

Reviewer: Board session (baseline written when the Monetization loop was created, **not** a fresh-context Critic).
The first scheduled Monetization Critic review replaces or confirms these scores.
Stage: Deepen cycle 2 · probes: no value probe yet (epic RV-M1); numbers below come from the runway probe,
`probes/2026-09-19-deepen1.txt` (planner bot, 25 min/day, 12 seeds).

### Board feedback that opened this review

> Who would spend $1.99 for a golden crown and 2 silver urns? They take like 30 seconds to make.

Accurate in substance. The Welcome pack is 2 Gold Masks (T4), a Silver Urn (T3), 120 gems, 800 gold and a chest.
The relics are worth seconds of play and the gold a few minutes; only the gems and the chest hold value.

### Probe numbers used

> **Corrected (Bug #307).** The first version of this review priced relics by the runway probe's "first seen" times
> (planner: Silver Urn 4 min, Gold Mask 13 min, Emerald Scarab 41 min). Those measure when a bot busy filling orders
> first happens to hold an item, not what it costs to make one, and they use a 1.6 s/action pace nobody has checked
> against a human. The Board makes a Scarab in about 30 seconds.

- **Cost to make, in actions** (a focused player forging and merging toward one tier, 200 seeds; forge luck lowers it):
  Silver Urn (T3) 6 · Gold Mask (T4) 14 · Emerald Scarab (T5) 30 · Sapphire Heart (T6) 60. No-luck floor: 2^tier − 1.
  At roughly one action per second (Board play), that is seconds, not minutes. Human pace is still to be measured.
- Gold banked per day: 6,554 (planner) · 8,889 (greedy), at the probe's assumed 938 actions/day: ~7–9 gold per action.
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

| SKU | Price | Contents | Play needed to earn them when offered | Verdict |
|---|---|---|---|---|
| Keeper's Welcome | $1.99 | 120 gems, 800 gold, 2× T4, 1× T3, 1 chest | relics ≈ 34 actions (under a minute); gold ≈ 100 actions; gems + chest ≈ 4–5 days | the part the player sees first is worthless |
| So Close Bundle | $2.99 | T5, 60 gems, 1,500 gold | T5 ≈ 30 actions (~30 s), gold ≈ 200 actions, gems ≈ 2 days | same problem |
| Exact Emerald Scarab | 150 gems | one T5 | ≈ 30 actions (~30 s) | ~4 days of gems for 30 seconds of play |
| Lucky Chest | 40 gems / $2.99 | T2–T6 | mostly minutes | weak |
| Gem packs | $4.99–19.99 | 200–1,200 gems | days to weeks | only as good as what gems buy |
| Pass, VIP, No ads | $7.99–9.99 | luck, crates, skin, no interstitials | permanent / season | the only durable value today |

### Scores (RUBRIC Monetization table)

| Gate | Score | Evidence |
|---|---|---|
| Value perception | 1 | Relic contents are earned in seconds (a Scarab is ~30 actions) and gold in a few minutes; only gems, pass, VIP and no-ads last. |
| Sink depth | 2 | Gold piles up (6.5–8.9k banked/day); gem sinks buy relics made in seconds; jams almost never happen, so the rescue sinks go unused. |
| Price ladder | 3 | Gem packs run off one computed baseline and rise with commitment; the $2.99 bundles sit off the ladder. |
| Spend moments | 3 | Welcome after the first merge (delight), Jammed on a full board, piggy at 200, VIP at 60 merges; no per-session offer cap yet (TODO #6). |
| Free path | 3 | The planner finishes the pass (day 11.9) and the Rush (day 3.8) without paying; a casual profile is unproven (RV-D6, #275). |
| Spending runway | 2 | After pass + VIP + no-ads there is nothing durable to buy; one skin; chests of relics made in seconds. |
| **Average** | **2.3** | Below the 3.5 threshold. (2.5 before the Bug #307 correction.) |
| Honesty | PASS (provisional) | See audit. |

### Verdict: REPRICE

Nothing coercive, but nothing worth the money either. The fix is not cheaper prices: it is things worth owning
(power-ups, permanent progress, cosmetics), stakes that make a rescue worth something, and competition that
spending cannot buy.

### Epics (ranked)

| # | Epic | Hypothesis | Probe target (acceptance) | Size | Charter risk check |
|---|---|---|---|---|---|
| 1 | **RV-M1 Value probe** | We cannot price what we do not measure. | `ops/probes/relic-vault-value.ts` prints, per profile (focused, casual 12 min/day, planner, greedy): gem income/day, gold income/day, **actions** a focused player needs to earn each SKU's contents at the moment it is offered, and $ to buy everything. Minutes only via the human pace measured in the Bug #307 calibration, labelled as such. Output committed under `probes/`. | S | none |
| 2 | **RV-M2 Power-ups** | Gems need something worth wanting at every horizon. A stackable inventory bought with gems and also earned in play: **Auto-Merge** (merges every pair on the board once), **Relic Shower** (fills every empty socket with a random low-tier relic), **Undo** (last action), **Binding Stand-in** (counts as a missing binding once). | Planner using power-ups spends ≥ 70% of gem income and banks ≥ 50% fewer gems/day; a no-pay casual profile earns ≥ 1 power-up/day from Rush, pass and quests; unit tests for each power-up. | M | Relic Shower is random contents bought with gems, i.e. a loot box: under-16 and loot-box-off profiles get a deterministic shower (lowest tier of a chosen chain). Power-ups are never excluded from the free path. |
| 3 | **RV-M3 Packs worth buying** | Players pay for permanence and time saved, not for relics they make in minutes. Rebuild Welcome and So Close around gems, a power-up kit and something permanent (cosmetic, extra satchel space, a generator cosmetic); no item-only bundles. | Per RV-M1: every pack's contents are worth ≥ 60 min of play at the calibrated human pace when offered; value ribbons still computed from one baseline. | S | no fake "was" prices; real deadlines only |
| 4 | **RV-M4 Stakes** (shared with depth: mastery, decision density) | A board that cannot be lost has no tension and no rescue worth paying for. **Cursed relics**: some forges roll a cursed relic; if it is not merged or delivered within N actions it fogs an adjacent socket until an adjacent merge clears it. Counted in actions, never wall-clock; a free way out always exists; power-ups are a faster way out. | Greedy bot fogs ≥ 3 sockets/day, planner ≤ 1; planner/greedy gap on orders/day widens ≥ 20%; zero unwinnable states in 10,000 seeded runs. | M | no energy-style gate; never "pay or lose progress"; ties into RV-D4a cursed sockets (#276) |
| 5 | **RV-M5 Seasons, challenges and leaderboards** (depth: return reason, goal ladder, mastery) | Competition gives a reason to return that no timer does. Weekly Rush board and a 14-day season board, plus rotating **Trials** (fixed-seed challenges: fewest actions to a Ruby Crown, most orders in 100 actions, ...), each with its own board. **All ages**: generated names only, no free text, no chat, no contact between players. Server-checked: the client submits seed + action log and the control plane replays the pure sim to verify the score. Rewards are fixed per percentile band (gems, cosmetics, titles), never random. | Replay verification rejects 100% of edited-state submissions in tests; a player's rank never changes with spend (Trials give everyone the same kit; paid power-ups excluded from ranked scoring); ≥ 3 goal horizons live at once (Depth "goal ladder" probe). | L → split | Board decision: public exposure (#273) and hosting. No fabricated players on any board (Soul: fabricated social proof). |

**Prestige** (Board idea, same session) is not a monetization epic: it belongs in the vault-rooms design, RV-D4a (#276).
Once every relic in a room has been discovered, the player may leave for a new room and new chains, keeping a
permanent Keeper's Renown bonus (never for sale). It feeds the Depth gates "world change" and "content runway".

### Next review

The first scheduled Monetization Critic sweep (Sunday 03:00 Toronto), or on demand from the Console once the control
plane with the Monetization loop is deployed. RV-M1 should land first so that review has real numbers.
