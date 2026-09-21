# PROGRESS — relic-vault

The next session reads this before it reads the code.

## Now

- Stage: **Deepen**, cycle 2. Depth review #2 = 3.0 / 5, DEEPEN (DEPTH.md). Deep enough needs an average ≥ 3.5 with no gate below 2.
- Ticket: cycle 2 stories in ADO under Feature #269, all `agent-ready`, in this order:
  #274 RV-P2 honest probe v2 · #275 RV-D6 casual player finishes without paying.
- **Floors and the Chronicle shipped** (Feature #444, stories #445-#447, Board request 2026-09-20): ten floors
  each with their own nine-relic ladder, the Descend-or-Restore choice with Keeper's Renown, and the Keeper's
  Chronicle (30 main quests, patron errands, the green seal on his portrait). Design of record:
  **`docs/ROOMS.md`** and **`docs/STORY.md`** — read those before touching `data/floors.ts`,
  `data/chronicle.ts`, `systems/Floors.ts` or `systems/Chronicle.ts`. This supersedes #276's design spike.
- **The art is the open piece.** A floor's relics carry a `form` naming the silhouette they want, and the painter
  does not compose from it yet: floors 2-10 currently draw with the tier-9 Forge masters tinted to the floor's
  palette. The grammar (form x material x ornament) and hand-painted capstones are the next art pass, and
  ROOMS.md explains why 81 bespoke paintings was the wrong answer.
- Branch / worktree: `main` has v1 + Deepen cycle 1 (PR 1 merged). Agents work on `agent/<AB#id>` branches and open PRs; the Builder never merges.
- Preview URL: Static Web App exists (https://ambitious-river-0aedc1d0f.6.azurestaticapps.net) but is empty until CI can run.
  Locally: `npm run dev` → http://localhost:5173, or `npm run build && npm run preview` → :4173.
- Blocked:
  - CI: new ADO orgs get no hosted build agents until the Board's free-tier request is granted. The required CI check
    on main blocks agent PRs; the Board completes them with "Override branch policies".
  - Human sessions: still waiting on Board decision #273 (public preview exposure). Every telemetry session so far is automated.

## Last session

- Did (Builder tab, 2026-09-21, AB#380 RV-M7, dispatched by OPS): **the gem chest now has its own odds table**,
  priced against the exact relic sold beside it. Board chose "keep 50 gems, change the odds"; the Builder chose, and
  the Board has not yet confirmed, (a) paid chest only (earned chests keep 40/30/18/9/3) and (b) the table
  T4 10 / T6 10 / T7 25 / T8 55. EV in exact-relic gems: 7.8 before, 31.0 now at no luck (62%). `chestEvGems` and a
  luck sweep in `sim.test.ts` hold it at ≥ 60%. The odds disclosure is derived from the tables (fixes Bug #677, which
  said "40 gems or $2.99"), and the shop footer and odds sheet were re-laid out after screenshots showed overlap.
- Open, filed: Bug #678, the Welcome ribbon counts its free chest at the 50-gem paid price (predates this change).
- Tests: `npm test` 127/127 · `npm run typecheck` · `npm run test:e2e` 16/16. `play.mjs` gained an `odds` scenario
  (also runs inside `full`).
- Screenshots: `screenshots/ab380/*.png`.

## Next session should

1. RV-P2 (#274) is in review: probe v2 (hq `ops/probes/relic-vault-runway.ts`), report `probes/2026-09-21-probe-v2.md`.
   It measures in actions, counts density against an order-aware greedy move (35%, not v1's 99%), and has casual and
   focused players, and (corrected by AB#379) collects rank, pass and Rush rewards. Its findings: a focused player
   makes the Living Relic in ~1,138 actions (under an hour); an engaged planner is on time for the pass (day 10.0);
   a casual player misses the pass and the Rush top in every run. No bot descends floors yet: the next probe gap.
2. RV-D6 (#275): the probe now has the casual profile this story needs, and on this build the answer is no (see above).
3. RV-D4a (#276): `docs/ROOMS.md` design only, no code. Include prestige (leave a completed room for a new one,
   keep a permanent Keeper's Renown bonus): Board idea, see MONETIZATION.md.
4. Monetization cycle 2 (Critique #368, COERCIVE, Feature #661): RV-M7 (AB#380) has merged (!121) and waits on QA.
   RV-M1 (#379) is in review — hq `ops/probes/relic-vault-value.ts`, report `probes/2026-09-21-value-probe.md`. It
   reproduces the Critique's chest EV (7.80) and Welcome (531.3, 399%), and prices every SKU in actions per profile;
   $52.91 buys everything once. RV-M3 (#304, packs worth ≥ 60 min) should start from its table. The gem chest now rolls
   its own table, worth 31.0; the 7.8 in that report is the earned table the Welcome chest still rolls on.
   Bug #678 needs a PM call.

Do not write a diary. Write a handoff.
