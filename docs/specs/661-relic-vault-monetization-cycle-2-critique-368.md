# relic-vault - Monetization cycle 2 (Critique #368)

Feature AB#661 (Proposed) · product relic-vault · migrated from Azure DevOps on 2026-09-30 (AB#4889)

## What it is

Where it sits. Under the relic-vault epic, AB#268, after Monetization cycle 1 (AB#301, closed). What it is. The stories the PM filed from Monetization Critique AB#368 (verdict COERCIVE, review #2, 2026-09-20): RV-M1 value probe, RV-M2a/b power-ups, RV-M7 Lucky Chest pricing, RV-M8 one offer per session. Why it matters. PORTFOLIO names monetization, not depth, as relic-vault's blocker, and these stories had no parent, so nothing rolled them up. Created by the Board-requested work-item review on 2026-09-21.

## Acceptance

_To be written: the Feature had no acceptance criteria in Azure DevOps._

## Checklist

Each heading replaces a Requirement or Bug, which Azure DevOps keeps (Closed, tagged folded, linked here); its lines are its Acceptance. A checked line was Resolved and has not been verified. 3 open, 0 resolved.

### RV-M3 Packs worth buying (Requirement AB#304, Proposed, under Epic AB#268)

What: Monetization epic RV-M3, from MONETIZATION.md review #1, sharpened by the Board: "who would spend $1.99 for a golden crown and 2 silver urns? they take like 30 seconds to make". / Value perception scored 1 / 5 because the part of a pack a player sees first (relics, gold) is earned in seconds or minutes, while only gems, the pass, VIP and no-ads hold value. This story rebuilds the packs around gems, a power-up kit and something permanent, and retires item-only bundles. / board-owned: the Board is… (the rest: AB#304)

- [ ] Rebuild Welcome and So Close around gems, a power-up kit and something permanent (cosmetic, satchel space); no item-only bundles. Per RV-M1, every pack's contents are worth >= 60 min of planner play at the moment it is offered. Value ribbons stay computed from one baseline; real deadlines only.

### RV-M4 Stakes: cursed relics (Requirement AB#305, Proposed, under Epic AB#268)

What: Monetization epic RV-M4, shared with the depth loop (mastery, decision density). / The board cannot be lost. A player who is not deliberately bricking it never meets Vault Jammed, so nothing is ever at stake and no rescue is worth paying for. This story adds cursed relics: a forge occasionally produces one, and if it is not merged or delivered within N actions it fogs an adjacent socket until an adjacent merge clears it. / The rules that keep it inside the Soul: stakes are counted in actions, never… (the rest: AB#305)

- [ ] Some forges roll a cursed relic; if it is not merged or delivered within N actions it fogs an adjacent socket until an adjacent merge clears it. Counted in actions, never wall-clock; a free way out always exists; power-ups are a faster way out. Probe: greedy fogs >= 3 sockets/day, planner <= 1; planner/greedy orders/day gap widens >= 20%; zero unwinnable states in 10,000 seeded runs.

### RV-M5 Seasons, Trials and leaderboards (design + backend spike) (Requirement AB#306, Proposed)

What: Monetization epic RV-M5, shared with the depth loop (return reason, goal ladder, mastery). The Board asked for leaderboards, seasons, rotating challenges and rewards. / Competition gives a reason to come back that no timer can, but it only works if the scores are real and spending cannot buy rank. The design: a weekly Rush board, a 14-day season board, and rotating fixed-seed Trials, each with its own board; all ages, with generated names only, no free text, no chat and no contact between… (the rest: AB#306)

- [ ] Design doc docs/COMPETE.md plus a server spike: weekly Rush board, 14-day season board, rotating fixed-seed Trials each with a board. All ages: generated names only, no free text, no chat, no contact. Client submits seed + action log; the control plane replays the pure sim and rejects edited-state scores (100% in tests). Rewards fixed per percentile band, never random. Spending never changes rank: paid power-ups excluded from ranked scoring, Trials give everyone the same kit. Needs Board… (the rest: AB#306)

## Demo script

_To be written._
