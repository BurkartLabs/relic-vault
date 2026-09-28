# ANALYTICS — Relic Vault

Two layers, both local-first.

## 1. Orchestrata telemetry (`systems/Telemetry.ts`)

Implements the TELEMETRY.md minimum. Every event carries `distinct_id` (anonymous, per device, localStorage
`rv_did`), `session_id` (per boot), `app_version`, `platform` (`pwa-standalone|browser-<os>`).

| Event | Fired from | Props |
|---|---|---|
| `app_open` | GameCtx.boot | source (`?src=` or referral/direct), returning, session_n |
| `verb_first` | first merge of the session | latency_ms since app_open |
| `verb_repeat` | every later merge | count_in_session |
| `session_pause` | tab hidden | duration_s, actions, n_pause |
| `session_end` | pagehide, or hidden past 30 min | duration_s, actions, pauses, reason |
| `offer_shown` | any offer modal or shop open | sku, trigger |
| `offer_dismiss` | offer closed without buying | sku |
| `purchase_demo` | demo purchase granted (a demo build) | sku, trigger |
| `purchase` | a Google Play purchase granted after the store confirmed it (a Play build, AB#4725) | sku, trigger |
| `error` | window error / unhandled rejection | message, hash |
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
as a JSON array. No endpoint is configured: choosing one (PostHog / Smallweb / self-hosted) is a Board call
because it has a cost (GOVERNANCE). Until then the preview cannot leave Preview (TELEMETRY.md rule).

The number that keeps or kills this (BRIEF): % sessions with `verb_first` within 30s of `app_open`, then D7 return after 200 sessions.

## 2. Monetization ring buffer (`systems/Analytics.ts`)

256 entries, persisted to IndexedDB. Every entry: `type, sku, trigger, sessionSeconds, rank, gems, gold`.
Types: `session_start`, `offer_impression`, `offer_dismiss`, `offer_decline`, `iap_click`, `iap_purchase`,
`gem_spend_click`, `chest_open`, `ad_request`, `ad_rewarded`, `ad_interstitial`, `wheel_spin`, `event_claim`,
`restore_purchases`. `offer_impression`, `offer_dismiss`, `iap_purchase` are mirrored into telemetry.

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
