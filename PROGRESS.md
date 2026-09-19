# PROGRESS — relic-vault

The next session reads this before it reads the code.

## Now

- Ticket: cycle closed at Preview (Critic SHIP). Next: TODO.md #1–#2 (telemetry host → human sessions).
- Branch / worktree: `build/relic-vault-v1` in `Orchestrata/projects/relic-vault` (main has no commits; Builder does not merge).
- Preview URL: none hosted. `npm run build && npm run preview` → http://localhost:4173 and the LAN IP (phones on the same Wi-Fi).
- Blocked: public telemetry endpoint + any public preview host = Board decisions (cost / exposure).

## Last session

- Did: full build from the OPUS5 spec — Phaser PWA, procedural art pipeline, merge loop + juice, every economy surface,
  onboarding, age gate, telemetry (TELEMETRY.md events + self-hosted collector), unit + Playwright suites, video, docs.
  Critic round 1 = ITERATE (minors could get random chests via 4 paths; looping timer, hardcoded 1200%, fake rank,
  $-denominated piggy; telemetry unproven). All fixed; round 2 = SHIP.
- Tests: `npm test` 37/37 · `npm run test:e2e` 10/10 on a fresh build (includes collector receipt of app_open + verb_first).
- Screenshots: `screenshots/preview/*.png` (22, scripted phone-size playthrough), `screenshots/qa/*.png`.
- Video: `video/overview.mp4` (135s, narrated, captions in `video/captions.vtt`).
- Commit: see `git log build/relic-vault-v1`.

## Next session should

1. Depth review #1 (DEPTH.md) scored 1.5/5 → stage is **Deepen**. Cycle 1 = RV-D1 pacing recalibration,
   RV-D2 Patron Orders, RV-D3 chains & generators, in that order; every story carries its probe target.
2. Before coding: PM turns the three epics into agent-ready ADO stories (TRACKING.md) and extends
   `../../ops/probes/relic-vault-runway.ts` so each probe target is measurable.
3. If the Board funded a telemetry host: build with `VITE_TELEMETRY_URL`, deploy preview, start human sessions in parallel.

Do not write a diary. Write a handoff.
