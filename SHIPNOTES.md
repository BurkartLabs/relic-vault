# SHIPNOTES — Relic Vault v1.0 preview

Branch: `build/relic-vault-v1` (Builder does not merge to main — GOVERNANCE).
Critic: ITERATE → fixed → **SHIP** (preview gates). Production / store: not requested; Board-gated.

## Run it

```bash
npm install
npm run dev          # http://localhost:5173  (add ?debug=1 for the debug panel)
npm run build        # dist/ — installable PWA, offline core loop
npm run preview      # serves dist/ on :4173 and on your LAN IP, so a phone on the same Wi-Fi can play it
npm test             # 37 unit tests: merge, forge, sell, purchase (every SKU), chest odds + pity, minors, offers, save migration
npm run test:e2e     # 10 Playwright smoke tests on a fresh production build (uses installed Edge; PW_CHANNEL=chrome to switch)
npm run playtest     # scripted 40-action phone-size session -> screenshots/playtest (needs `npm run dev` running)
npm run icons        # re-bake PWA icons from the relic painter
node apps/web/tools/collector.mjs 8787         # tiny self-hosted telemetry endpoint (NDJSON)
VITE_TELEMETRY_URL=http://HOST:8787/e npm run build   # ship events to it
node apps/web/tools/record.mjs && node apps/web/tools/make-video.mjs   # re-shoot the project video
```

## Spec (OPUS5_PROMPT.md) §8 acceptance — status

| Check | Status | Evidence |
|---|---|---|
| Cold screenshot reads as dark-fantasy treasure game | yes | `screenshots/preview/03`, Critic gate 1 |
| All 8(+1) tiers distinguishable at 96px | yes | `apps/web/art.html` bottom row; odds table uses 96px icons |
| No emoji on board / HUD / badges | yes | all art is painted; wax-seal badges |
| T4+ merge has ≥3 simultaneous VFX layers | yes | flash + 2 rings + sparks + shards + embers (+ board flash & confetti at T7+) |
| Shop, pass, album, chest are illustrated panels | yes | `screenshots/preview/10–15` |
| 15 min zero-purchase play, never a cooldown | yes | e2e "no cooldown: 60 rapid core actions" |
| 15 min still a reason to open the shop | yes | space pressure (red vignette), album holes, piggy, event ladder |
| First merge opens $1.99 welcome pack once per profile | yes, with a real 48h deadline | e2e "welcome pack exactly once" |
| Board full never softlocks | yes | e2e "board full never softlocks"; satchel holds overflow |
| Reload restores exact board | yes | e2e "reload restores the exact board" |
| Every SKU grants in demo mode | yes | unit + e2e (10 SKUs) |
| Chest odds visible before spend | yes | shop chest card ODDS button, legal footer, Settings → Odds; e2e |
| Age < 16 disables paid random | yes, and **all** random grants | e2e "minor buying every SKU receives zero random rolls" |
| Analytics ring records impressions + purchases | yes | e2e checks sku/trigger/sessionSeconds/rank/gems/gold |
| `npm test` covers merge, forge, purchase, pity | yes | 37 tests |
| `npm run build` → deployable dist/ PWA | yes | manifest, service worker (Workbox), 4 icons, offline precache |
| Installable, no console errors on clean boot | manifest + SW + icons present; e2e asserts 0 console errors | Lighthouse not run (no Chrome DevTools Lighthouse in this environment) |

## Where we deliberately deviated from the spec (Soul > spec)

The Critic's first review (ITERATE) flagged spec items that fail Soul/Charter honesty. Changed:

- Welcome Pack "10:00 countdown that loops" → **real 48h deadline** from first sight; the SKU closes after it.
- "1200% value vs the $9.99 rate, on purpose" → **computed** ribbon (gems + chest at 40 gems, per $, vs the $4.99 pack) = 201%. All ribbons use one stated baseline; the footnote says exactly how.
- "Gems 80 / $4.99" was a decoy (16 gems/$ vs 50–60). Now **200 gems / $4.99** (40.1 gems/$).
- "Fake global rank" on the event → removed; shows real milestone progress.
- Piggy value in dollars → shown in **gold** (it is soft currency).
- Under-16: spec disabled only paid chests. We also convert free/pass/VIP/welcome chests to exact Gold Masks, disable gem wheel spins, and send **no pushed offers** to minors.
- Welcome decline copy is "Not today" (no confirm-shaming).

## Known demo limits

- Store is `PurchaseService('demo')`: every purchase succeeds after 450ms. No StoreKit/Play Billing, no receipts, no server validation, no refunds.
- Ads are a 1.5s branded veil (skip at 1.2s). No ad SDK.
- Saves are local (IndexedDB + localStorage). No accounts, no cloud save, no cross-device.
- Telemetry sink: local collector only. **Hosting a public endpoint is a Board decision** (cost). Until then the preview cannot leave Preview (TELEMETRY.md).
- VIP "subscription" is a 30-day flag. Season (14d) and Gold Rush (4d) are clock-derived, not server-driven.
- Keeper portrait, chest 3/4 view and wheel prize art are the weakest art (see docs/ARTBIBLE.md).
- Lighthouse PWA audit not run in this environment; manifest/SW/icons verified by hand.

## For the Board

- The Keeper voice ("Everything here is priced fairly. For me.") is intentional flavour; the Critic asked us to watch its tone next to honest numbers.
- Before any real store: legal review of value claims, loot-box disclosures per region, and age assurance beyond self-declaration.
