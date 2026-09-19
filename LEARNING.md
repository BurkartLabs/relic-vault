# LEARNING-001 — relic-vault

Date: 2026-09-19
Outcome: PREVIEW SHIPPED (Critic: SHIP on re-review). Production / store deploy: not requested, Board-gated.
Video: `projects/relic-vault/video/overview.mp4` (script: `video/script.md`, captions: `video/captions.vtt`)
Telemetry window: 2026-09-19, n = 12 sessions, **all automated** (Playwright QA + scripted playtests). 0 human sessions.

## What we set out to learn

Whether a no-energy merge game can look like a shipped mid-casual title with only procedural art, carry a full
F2P surface stack without gating play, and be instrumented well enough to judge with real players.

## What we built (six sentences, no lore)

A Phaser 3 PWA: a 6×6 merge-2 board with nine painted relic tiers, a forge that is always clickable, and a
Vault Jammed sheet so a full board is never a wall. Every pixel is painted by code at boot (relics with a sheen
sweep, a layered vault, framed UI), with synthesized audio and tiered juice. Around it: shop, welcome pack,
disclosed chests with pity, piggy, pass, album that decorates the vault, Gold Rush event, wheel, ads veil, VIP.
An age gate turns off every random paid mechanic for under-16s and loot-box-free regions. Telemetry implements
the TELEMETRY.md event set and ships to a zero-cost self-hosted collector. 37 unit tests and a 10-test Playwright
smoke suite run against a fresh production build.

## What the numbers said

- verb_first: 4 of 12 automated sessions performed a merge (the others were boot/reload/SKU checks); latency 5.8–8.8 s for a scripted player following the ghost finger. This is a floor, not a human number.
- median session: not meaningful (robots).
- D1 if any: none — no human sessions yet.
- crash-free: 12/12 sessions with zero `error` events; 0 console errors on clean boot in QA.
- offer shown / convert: 5 sessions saw an offer; 16 demo purchases were forced by the SKU test. Not a conversion signal.
- surprise: the numbers that mattered this cycle were not telemetry at all — they were bugs and ethics defects that 31 green unit tests did not see (below).

## What we felt in the playtest that the numbers miss

- **Green unit tests certified a broken product.** The first scripted play froze the render loop on the first forge (a camera ease name Phaser's camera doesn't accept), and a later run showed a coin icon that grew until it covered the screen (each coin arrival re-read a mid-tween scale). Both were found only by screenshots from a scripted phone-size playthrough.
- **The spec was the ethics risk.** The original brief asked for a looping "10:00" countdown, a value ribbon against a baseline chosen to inflate it, a fake global rank, and money-like piggy values. The builder implemented them. A fresh-context Critic reading Soul first flagged them, plus four paths that still handed random chests to under-16 profiles (welcome pack, pass, VIP crate, gem wheel). All were fixed and tested before SHIP.
- The merge loop with tier-scaled juice reads instantly on a silent screenshot; the vault itself (sarcophagus, door, decorations) does more for "looks expensive" than any single UI panel.

## Lesson (one sentence)

Green unit tests certified a build that froze on its first forge and sold random chests to children; only a scripted screenshot playthrough and a fresh-context Critic that reads the Soul before the spec caught them.

## Doctrine patch proposal

```
Claim: A preview is not reviewable until (a) a script has played it at phone size and saved screenshots,
       and (b) a fresh-context Critic has read Soul before the project spec.
Evidence: LEARNING-001 — 31/31 unit tests green while the build froze on first forge and a HUD coin
          filled the screen (caught by scripted screenshots); spec-mandated false urgency, an inflated
          value baseline, a fake leaderboard and 4 random-reward paths to minors (caught by the Critic, not the builder).
Line to add (Craft taste): "Unit tests certify rules, not the product. Every preview ships with a scripted
          phone-size screenshot playthrough." (Doctrine, LEARNING-001)
Line to add (Product taste): "A brief inherits Soul. If a spec asks for false urgency, inflated baselines or
          fabricated social proof, the Critic patches the spec; the builder does not follow it." (Doctrine, LEARNING-001)
Line to split (Product taste, "First dollar is a small pack timed off delight or jam"): keep as HYPOTHESIS —
          implemented (welcome pack 1.5s after first merge) but zero human sessions; needs n ≥ 200.
```

## Would we start this again?

Yes — and next time the Critic reads the spec before the Builder starts, not after the first preview.

## Later entries (living)

### 2026-09-19 (evening) — first Board playtest of the numbers

- **The probes overstated how long things take.** The monetization review said a Scarab takes 41 minutes; the Board
  makes one in ~30 seconds (30 actions over 200 seeds). The runway probe's "first seen" times describe a bot busy with
  orders, at an assumed 1.6 s/action that no human has confirmed. Depth scores for runway and time-box fidelity are
  provisional until RV-P2 re-runs them at a measured human pace. (hq BUG-307)
- **Bundles of relics are worth seconds.** Only gems, the pass, VIP and no-ads hold value; MONETIZATION.md review #1
  is 2.3 / 5, REPRICE, with power-ups, stakes and competition as the fix.
- **A red test on main was a real freeze.** e2e "first verb by touch" failed on main because KeeperDialog could throw
  inside Phaser's update and stop the game loop; it was nearly written off as flaky. (hq BUG-317)
- Lesson: until a human has played it, every time-based number in this pack is a bot's opinion.
