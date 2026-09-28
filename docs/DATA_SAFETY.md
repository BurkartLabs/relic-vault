# Relic Vault: data-safety inventory

AB#4726. Every kind of data Relic Vault collects, which component collects it, why, and whether it is shared, in the
vocabulary of Google Play's **Data safety** form. Board step 3 copies it row for row. `public/privacy.html` says the
same things in plain words: if this changes, change both. `apps/web/src/game/systems/dataSafety.test.ts` fails if a
field in `Telemetry.ts` or `Analytics.ts` is missing from this page.

**What counts as collected.** Play counts data as collected when it leaves the device. Data kept only on the device
(the save, the shop log) is not collected. Relic Vault sends gameplay telemetry only when the build sets
`VITE_TELEMETRY_URL`. Answer the form for the build being released: if the release has no endpoint, the rows marked
*Telemetry* are not collected either.

## Collected (leaves the device)

| Play category → data type | Collected by | What exactly | Purpose (Play) | Shared? | Optional? | Deletable in app? |
|---|---|---|---|---|---|---|
| Device or other IDs | Telemetry (`Telemetry.ts`) | `distinct_id`, the random `rv_did` made on first launch (not the advertising ID); `session_id`, random per boot | Analytics | No | No (sent with every event) | Yes: Delete My Data makes a new one |
| App activity → App interactions | Telemetry | `event` and `t` (name and time), plus `props`: what was merged, forged, claimed, filled or dismissed; rank gained; session length and pauses (`duration_s`, `actions`); funnel steps | Analytics | No | No | Device copy, yes; sent events, on request |
| App activity → Other actions | Telemetry, mirroring the shop log (`Analytics.ts`) | an offer shown or dismissed (`sku`, `trigger`), and a purchase (`sku`, `trigger`, `rank`, `gems`, `gold`) | Analytics | No | No | Device copy, yes; sent events, on request |
| Financial info → Purchase history | Telemetry | a purchase event (`purchase` in a Play build, `purchase_demo` in the demo) with the `sku` bought; a purchase that did not go through (`purchase_failed`) with its `sku`, `trigger`, `reason` and the store's error `code` | Analytics | No | No | Device copy, yes; sent events, on request |
| Personal info → Other info | Telemetry | the age band from the age question (`band`: minor, adult, unknown), in the `funnel_step` event | Analytics; App functionality (under-16 rules) | No | No | Yes |
| App info and performance → Crash logs | Telemetry | `error` and `boot_error` events: the error's text (first 200 characters) and its `hash`; for a failed call to the app's native code (AB#4739), its `source`, `plugin`, `method` and error `code`; an ad that failed to load or show (`ad_failed`), with its `format`, `stage` and error `code` | Analytics (stability) | No | No | Device copy, yes; sent events, on request |
| App info and performance → Diagnostics | Telemetry | `app_version`; `platform` (OS family from the user agent, installed or browser; in the Android app, the Android System WebView's major version); `save_unreadable` with its reason; in `app_open`, which loot-box rule applies (`lootbox_source`: store, manual or none; AB#4733) | Analytics | No | No | Device copy, yes; sent events, on request |
| Device or other IDs; Location → Approximate; App activity; App info and performance | **Google AdMob SDK** (Android app, when `VITE_ADS_MODE=admob`) | advertising ID, IP address, ad interactions, SDK diagnostics, collected by Google | Advertising or marketing; Analytics; Fraud prevention | **Confirm at Board step 3** against Google's own AdMob data-disclosure page, which says what to declare for its SDK | No | By Google (reset the advertising ID in Android settings) |
| Financial info → Purchase history; Device or other IDs | **RevenueCat SDK**, in a Play build (AB#4725) | purchase receipts; the anonymous app user id RevenueCat assigns | App functionality (restoring purchases, entitlements) | No: a service provider acting for us is not sharing under Play's definition | No | Delete My Data clears its cache on the device; the customer record RevenueCat keeps is deleted on request, by the operator in RevenueCat |

Payments go through **Google Play Billing**. Card and account details are collected by Google, never by the app, so they
are not declared as the app's collection.

**The Play storefront's country** (AB#4733) is read from RevenueCat on each boot of a Play build, to switch random paid
chests off where the law treats them as gambling (Belgium today, `data/lootboxRestrictedCountries.ts`). It is held in
memory for that session only: never saved on the device and never sent. Telemetry carries only which rule applied
(`lootbox_source`), not the country.

## Stays on the device (not collected)

| Data | Where | Cleared by |
|---|---|---|
| The save: progress, settings, record of purchases, age band | IndexedDB `relic-vault-save`, localStorage fallback | Reset Progress, Delete My Data |
| The shop log: up to 256 entries of `t`, `type`, `sku`, `trigger`, `sessionSeconds`, `rank`, `gems`, `gold` | IndexedDB `relic-vault-analytics`, localStorage fallback | Reset Progress, Delete My Data |
| A copy of a save that could not be read (Bug #443) | `relic-vault-save-unreadable` | Reset Progress, Delete My Data |
| The random device id | localStorage `rv_did` | Delete My Data |
| The telemetry buffer (last 500 events) | memory only | closing the game |

## Form answers that follow from the above

- **Is all collected data encrypted in transit?** Yes, if the telemetry endpoint is `https` (it must be). AdMob and
  RevenueCat use HTTPS.
- **Can users request deletion?** Yes: Delete My Data in Settings clears the device. Sent telemetry is tied only to the
  random id, and can be deleted on request by email (`public/privacy.html`, Contact).
- **Account creation:** none.
- **Data collected from children:** the game asks the age band. Under 16 it removes random paid chests and sales offers
  (`Economy.ts` `chestsAllowed`, `OfferDirector.ts`). It does not change AdMob's request, whose child-directed and
  under-age settings belong to the AdMob integration item.

## Every telemetry field

The envelope of each event (`TelemetryEvent` in `Telemetry.ts`):

| Field | Meaning |
|---|---|
| `event` | the event's name |
| `t` | when it happened (ms since 1970) |
| `distinct_id` | the random device id, `rv_did` |
| `session_id` | a random id for this boot |
| `app_version` | the build's version |
| `platform` | `pwa-standalone-*` or `pwa-browser-*` plus the OS family |
| `props` | the event's details, below |

The shop log entry (`AnalyticsEvent` in `Analytics.ts`). Kept on the device. Offers shown or dismissed are mirrored to
telemetry with `sku` and `trigger`, and purchases with `sku`, `trigger`, `gems`, `gold` and `rank` (`GameCtx.ts` TELEMETRY_MAP):

| Field | Meaning |
|---|---|
| `t` | when it happened |
| `type` | offer shown, offer dismissed, purchase button pressed, purchase, and so on |
| `sku` | the shop item |
| `trigger` | what showed the offer |
| `sessionSeconds` | how long the session had run |
| `rank` | the player's rank |
| `gems` | gems held |
| `gold` | gold held |

`props` keys sent today: `source`, `returning`, `session_n` (app_open); `latency_ms` (verb_first); `count_in_session`
(verb_repeat); `tier`, `ascended`, `card` (merge); `chain` (forge, chain_unlock); `rank` (rank_up); `step`, `band`
(funnel_step); `items`, `gold`, `patron` (order_filled, order_dismissed); `quest`, `floor`, `chapterDone`
(chronicle_claim); `total` (errand_claim); `kind`, `binding`, `cost`, `merges` (power-ups); `merges` (board_full);
`method` (share); `duration_s`, `actions`, `n_pause`, `pauses`, `reason` (session_pause, session_end); `message`,
`hash` (error); `why` (boot_error, save_unreadable); `making` (binding_missing).
