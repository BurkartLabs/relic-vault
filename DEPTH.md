# DEPTH — relic-vault

Review #: 1
Date: 2026-09-19
Reviewer: Director (interim, first run of the Depth loop; future reviews are by a fresh-context Depth Critic)
Probe: `ops/probes/relic-vault-runway.ts` (greedy bot on the pure TS rules, 20 seeds × 3,000 actions, 1.6 s/action, no purchases)
Stage: Preview (Critic SHIP) → **Deepen**
Previous score: —

## Probe numbers

```
tier | median actions to first | ~minutes
T2 | 2 | 0.1        T6 | 60  | 1.6
T3 | 6 | 0.2        T7 | 122 | 3.3
T4 | 14 | 0.4       T8 | 242 | 6.5
T5 | 30 | 0.8       T9 | 472 | 12.6      first ascension (T9+T9) | 908 | 24.2
after 3000 actions (~80 min): avg rank 28.9, cards 30.9/36, pass tier 20.0/20, event milestones 10.0/10, gold 68,633
actions with >1 legal merge: 0% ; forced sells: 0.0
```

Read plainly:
- The whole relic ladder is seen in **~13 minutes**; the ascension jackpot at **~24 minutes**.
- A **14-day** season pass and a **4-day** event both complete in **~80 minutes**; the album is 86% full.
- A sensible player **never has a choice**: there is never more than one pending merge, and it is always right to take it.
- A sensible player **never fills the board**. The space pressure that Vault Jammed, the pig and several offers
  lean on only happens to players who play badly. (Good for fairness; it also means the shop has little honest pull.)

## Scores (RUBRIC Depth table)

| Gate | Score | Evidence |
|---|---|---|
| Decision density | 1 | 0% of bot turns had ≥2 legal merges; merge order and placement never matter. |
| Goal ladder | 2 | Seconds: next merge. Session: 3 generic quests. Week: pass/event, but both finish in one sitting. |
| Content runway | 1 | Last new relic at ~13 min; last new system (ascension) at ~24 min. |
| Time-box fidelity | 1 | 14-day pass and 4-day event done in ~80 min (≈ 250× and 70× too fast). |
| System interplay | 1 | Luck is the only cross-system effect and it only shifts forge odds a few %. Nothing changes *how* you merge. |
| Mastery | 1 | The greedy bot is optimal; the combo bonus is the only skill signal and it is tiny. |
| World change | 3 | Album pages hang decorations in the vault; the sarcophagus wakes with your best relic. Real, but three states total. |
| Return reason | 2 | Daily quests and the VIP crate; everything with a week-long arc is already finished. |
| **Average** | **1.5** | Well below the 3.5 threshold. |

## What a player feels

- **Minute 5:** delighted. The juice lands, the art looks expensive, the tiers climb fast.
- **Minute 30:** has seen every relic and the ascension. Merging is a rhythm, not a decision.
- **Minute 120:** the pass, event and most of the album are done; nothing is left to want except bigger numbers.
- **Day 3:** opens the game, forges, merges, does the 3 quests in 2 minutes, leaves. No story, no project, no puzzle.
- **Day 14:** nothing has changed that the player caused, except gold.

## Verdict: DEEPEN

It's not SUNSET, because the genre has well-proven depth structures (orders, multiple chains, spatial boards,
restoration meta) that fit this vault fiction and the Charter's no-energy rule. The art, juice and systems plumbing are
a strong base. It is currently a toy with a shop, not a game with a runway.

## Epics (ranked; Deepen cycle 1 = the first three, per the ≤3-per-cycle rule)

| # | Epic | Hypothesis | Probe target (goes in acceptance) | Size | Charter risk check |
|---|---|---|---|---|---|
| 1 | **RV-D1 Pacing recalibration** | Every other depth system is judged against broken clocks; fix the clocks first. Slow the *rewards*, never the *verb*. | At 25 min/day of bot play: pass tier 20 lands day 10–12; event top milestone needs most of its 4 days; T9 no earlier than ~4 h cumulative; album page I ≈ day 3. | S (numbers + probe) | No waiting introduced: forging and merging stay unlimited. |
| 2 | **RV-D2 Patron Orders** | Named patrons ask for specific relics (tier + chain), which creates keep-vs-merge decisions and session goals. | Decision density ≥ 40% of turns; a mid-horizon goal active ≥ 90% of play time; greedy-vs-planner payout gap ≥ 20%. | M | Orders never expire on a wall clock; there are always 3 open, and refreshing one is free. |
| 3 | **RV-D3 Chains & generators** | Three chains (Forge metals · Crypt bone/urn/wraith · Star Well astral), each fed by its own mergeable generator, with cross-chain recipes for orders. Runway and variety both multiply. | Last new item ≥ 10 h of bot play; ≥ 27 distinct relics; recipes used in ≥ 30% of orders. | M (split: generators, then recipes) | Generators never have charges or cooldowns; output is always available. |
| 4 | **RV-D4 Vault rooms & cursed sockets** | The board becomes a place. New rooms open through restoration. Cursed or fogged sockets are cleared by merging next to them, so placement matters. | Planner beats greedy by ≥ 20% on room clears; ≥ 4 rooms; world-change screenshot diff day 1 vs day 14. | M | Space is progression, not a wall: Vault Jammed stays, and a free path always exists. |
| 5 | **RV-D5 Relic abilities + Keeper's story** | High tiers become tools (the Scarab cleanses a curse, the Heart copies a T≤3, the Ark stores 3, the Crown doubles an order), and restoration chapters tell the Keeper's secret. | ≥ 4 cross-system effects on the core verb; keeping a T6+ is correct in ≥ 25% of planner decisions; story chapter every ~2 days of play. | M | The story must not be gated behind purchases. |

Deferred to cycle 3+: daily Vault Puzzle (fixed seed, par score), a **real** async leaderboard (needs a backend,
so it's a Board decision; it replaces the fake rank we removed), and album set bonuses that change play.

**Targets:** Depth average ≥ 2.8 after cycle 1 (D1–D3), ≥ 3.5 after cycle 2 (D4–D5). If cycle 1 doesn't lift the average by 0.5,
the Director schedules a kill review (OPERATIONS §3).

**Monetization note for the Board:** once D1 fixes pacing, the pass, event and pig become meaningful again. Re-run
the Critic's honesty checks at the end of cycle 1, because slower pacing plus paid acceleration is exactly where
"energy in disguise" creeps in.

## Next review

End of Deepen cycle 1 (14 days after cycle start), by a fresh-context Depth Critic, re-running this probe
plus new probes for decision density with orders and runway with chains.
