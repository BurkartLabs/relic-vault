# ANALYTICS — Relic Vault

Two layers, both local-first.

## 1. Orchestrata telemetry (`systems/Telemetry.ts`)

Implements the TELEMETRY.md minimum. Every event carries `distinct_id` (anonymous, per device, localStorage
`rv_did`), `session_id` (per boot), `app_version`, `platform`: `pwa-standalone|browser-<os>` on the web, and in the
Android app `capacitor-android-wv<major>`, the Android System WebView's major version (AB#4739), so store sessions
are separable from the web's and a fault seen on one WebView shows as that WebView.

| Event | Fired from | Props |
|---|---|---|
| `app_open` | GameCtx.boot | source (`?src=` or referral/direct), returning, session_n, lootbox_source (`store`: the Play storefront's country forbids random chests; `manual`: the player switched them off; `none`; AB#4733) |
| `verb_first` | first merge of the session | latency_ms since app_open |
| `verb_repeat` | every later merge | count_in_session |
| `session_pause` | tab hidden | duration_s, actions, n_pause |
| `session_end` | pagehide, or hidden past 30 min | duration_s, actions, pauses, reason |
| `offer_shown` | any offer modal or shop open | sku, trigger |
| `offer_dismiss` | offer closed without buying | sku |
| `purchase_demo` | demo purchase granted (a demo build) | sku, trigger |
| `purchase` | a Google Play purchase granted after the store confirmed it (a Play build, AB#4725) | sku, trigger |
| `error` | window error / unhandled rejection | message, hash |
| `error` (source `plugin`) | a Capacitor plugin call that failed inside handled code: Purchases (start, getCustomerInfo, restorePurchases), Browser.open (AB#4739) | plugin, method, code, message, hash |
| `purchase_failed` | a purchase that did not go through (AB#4739) | sku, trigger, reason (`cancelled` by the player, `pending` on Play, `unavailable`, `error`), code (RevenueCat's) |
| `ad_failed` | an ad that could not load or show: sent by the AdMob integration when it lands; the demo veils cannot fail (AB#4739) | format, stage (`load`/`show`), code, message |
| `funnel_step` | age gate, forge_hint, forge_done, merge_hint, merge_done, tutorial_done, idle_hint | step |
| `merge` | every merge | tier, ascended, card |
| `forge` | every forge | tier |
| `board_full` | forge on a full board | merges |
| `rank_up` | rank-up | rank |
| `discovery` | first time a tier ≥3 is made | tier |
| `share` | share card | tier, method (native/download/cancelled) |
| `install_available` / `install_accepted` | PWA install prompt | — |

**Sink.** Always a 500-event ring in memory (`window.__rv.telemetry.buf`, visible at `?debug=1`).
If the build sets `VITE_TELEMETRY_URL`, events are batched every 10s and flushed with `sendBeacon` on hide
as a JSON array; `app_open`, `verb_first`, purchases, `purchase_failed` and `error` go within a moment.
The endpoint is the control plane's `/e` (Decision AB#4741): the web preview is built with it by the pipeline, and
`npm run android:bundle` builds the store bundle with it unless `VITE_TELEMETRY_URL` is set (scripts/android.mjs).
A debug APK sends nothing unless the variable is set. The client adds `?g=relic-vault` to the URL: the collector
names a game by that, and the app's pages come from `https://localhost`, which names none (AB#4739).

**Native crashes are not here.** This telemetry is the JavaScript side: the game's own errors, and plugin failures
the game catches. A crash or ANR in the Android app itself (the shell, the WebView process, a plugin's native code)
never reaches JavaScript; Google Play Console's **Android vitals** reports those, per app version and device. Read
both: vitals for the app dying, `error` events for the game going wrong while it runs.

The number that keeps or kills this (BRIEF): % sessions with `verb_first` within 30s of `app_open`, then D7 return after 200 sessions.

## 2. Monetization ring buffer (`systems/Analytics.ts`)

256 entries, persisted to IndexedDB. Every entry: `type, sku, trigger, sessionSeconds, rank, gems, gold`.
Types: `session_start`, `offer_impression`, `offer_dismiss`, `offer_decline`, `iap_click`, `iap_purchase`,
`gem_spend_click`, `chest_open`, `ad_request`, `ad_rewarded`, `ad_interstitial`, `ad_failed`, `wheel_spin`,
`event_claim`, `restore_purchases`. `ad_failed` (AB#4724) carries the `reason` or `trigger` and the ad network's error
`code` (`not_ready` when no ad had loaded, `no_consent` when consent does not allow a request). `offer_impression`, `offer_dismiss`, `iap_purchase` are mirrored into telemetry.

## Checking it

- `npm run test:e2e` asserts `app_open`, `verb_first`, `merge`, `board_full`, `purchase_demo` (×10 SKUs) and the ring's required fields.
- `npm run playtest` prints event counts for a scripted 40-action session.

## Sessions: a hide is a pause, not an end (Bug #326)

Hiding the tab sends `session_pause`. A session ends **once**: on `pagehide`, or when the tab comes back after
being hidden for more than 30 minutes (`Telemetry.HIDDEN_TIMEOUT_MS`, matching the timeout in the Orchestrata
TELEMETRY.md).

This matters for anything counting sessions. The client used to send `session_end` on every hide and re-arm it
on every return, so a single 22-minute boot produced **270 session_end events**. Retention and session length
computed from that would have been wrong by two orders of magnitude — and those are the first numbers anyone
looks at. Count sessions by distinct `session_id`, not by `session_end`, and read length from the last
`session_end` for that id.
