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

- Did (Builder tab, 2026-09-25, Bug #678 + #751, dispatched by OPS): **the Keeper's Welcome chest rolls the paid
  odds, and its ribbon counts what that chest returns** (Board Decision #683, option B). The purchase opens the chest
  at once (`openChest(s, rng, 'paid')`, GEM_CHEST_ODDS) instead of leaving a `freeChests` token that rolled the
  earned odds. `welcomeChestGems(s)` in `systems/Economy.ts` owns the counted value: 31 gems (paid-table EV, no luck),
  or 3 for the exact Gold Mask minors and loot-box-free regions get. `skuValuePct(id, s)` moved beside it. Ribbon:
  **113%** (92% for minors), was 128%. `welcomeValueBasis(s)` is the one sentence the Shop footer and the Welcome
  modal both show (the modal used to say "chest at 40 gems, vs the $4.99 pack", Bug #751).
- Filed, not fixed: #1814 (the modal draws and names a Silver Urn; the pack grants a Ruby Crown), #1819 (the Chronicle
  e2e failed once in three full runs, cause not captured). Seen, not filed: an interstitial ad can fire when the
  Welcome chest ceremony closes, straight after the $1.99 purchase (`maybeInterstitial('chest_close')`, predates this).
- Tests: `npm test` 136/136 · typecheck clean · `npx playwright test` 18/18 (the new e2e reads the rendered modal and
  shop text and checks ribbon and sentence agree). `play.mjs welcome` is the look; screenshots `screenshots/ab678/`.

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
   $52.91 buys everything once. RV-M3 (#304, packs worth ≥ 60 min) should start from its table. The gem chest and the
   Welcome chest both roll the paid table, worth 31.0; the 7.8 in that report is the earned table. Its Welcome figure
   (531.3, 399%) predates Bug #678 and is not what the ribbon claims (113%).

Do not write a diary. Write a handoff.
