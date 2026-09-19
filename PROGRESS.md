# PROGRESS — relic-vault

The next session reads this before it reads the code.

## Now

- Stage: **Deepen**, cycle 2. Depth review #2 = 3.0 / 5, DEEPEN (DEPTH.md). Deep enough needs an average ≥ 3.5 with no gate below 2.
- Ticket: cycle 2 stories in ADO under Feature #269, all `agent-ready`, in this order:
  #274 RV-P2 honest probe v2 · #275 RV-D6 casual player finishes without paying · #276 RV-D4a vault rooms design spike.
- Branch / worktree: `main` has v1 + Deepen cycle 1 (PR 1 merged). Agents work on `agent/<AB#id>` branches and open PRs; the Builder never merges.
- Preview URL: Static Web App exists (https://ambitious-river-0aedc1d0f.6.azurestaticapps.net) but is empty until CI can run.
  Locally: `npm run dev` → http://localhost:5173, or `npm run build && npm run preview` → :4173.
- Blocked:
  - CI: new ADO orgs get no hosted build agents until the Board's free-tier request is granted. The required CI check
    on main blocks agent PRs; the Board completes them with "Override branch policies".
  - Human sessions: still waiting on Board decision #273 (public preview exposure). Every telemetry session so far is automated.

## Last session

- Did (Board session, 2026-09-19): cleanup after the Deepen cycle 1 merge. The Rush Boost's dead push path and
  "ends soon" sales copy are gone, and the boost is on sale for the whole Rush instead of only the last 48h (RV-D6).
  KeeperDialog no longer throws (and freezes the game loop) when it is closed within 250 ms of opening; that crash
  had been failing the e2e "first verb by touch" test on main.
  SKU `gems80` renamed `gems200` (it always granted 200 gems; old saves are migrated). docs/ECONOMY.md re-synced to the code.
- Tests: `npm test` 45/45 · `npm run typecheck` · `npm run test:e2e` 13/13.
- Screenshots: `screenshots/deepen/*.png` (cycle 1 playthrough), `screenshots/qa/*.png`.
- Probe: `probes/2026-09-19-deepen1.txt`. The Depth Critic calls it flattering (strawman greedy bot); RV-P2 fixes that first.

## Next session should

1. RV-P2 (#274): make the probe honest before trusting any depth number. The probe lives in hq: `ops/probes/relic-vault-runway.ts`.
2. RV-D6 (#275): prove a casual 12 min/day profile finishes Rush milestone ≥ 9 each cycle and pass tier ≥ 15 by day 14 without paying.
3. RV-D4a (#276): `docs/ROOMS.md` design only, no code. Include prestige (leave a completed room for a new one,
   keep a permanent Keeper's Renown bonus): Board idea, see MONETIZATION.md.
4. Then the Monetization cycle (MONETIZATION.md review #1, 2.5 / 5, REPRICE): RV-M1 value probe first, then power-ups,
   packs worth buying, stakes, seasons + leaderboards.

Do not write a diary. Write a handoff.
