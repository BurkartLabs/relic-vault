# TODO — relic-vault (next 10, most important first)

1. **Board:** pick and fund a telemetry host (PostHog free tier / Smallweb / our `collector.mjs` on a $0 box). Blocks leaving Preview.
2. Put the preview in front of 20 humans (LAN `npm run preview` or a Board-approved preview host); read `verb_first < 30s` share.
3. After 200 human sessions: D1/D7 pull into `Orchestrata/telemetry/`, decide keep/kill against RUBRIC live-health.
4. Art pass on the weakest 20%: keeper face, chest 3/4 view, wheel prize art.
5. Events milestone list: add bottom padding so the last visible row is never clipped at rest.
6. Offer director: cap total pushed offers per session (e.g. 3) and log `offer_suppressed`; measure annoyance vs conversion.
7. Lighthouse PWA + performance run on a mid Android device; confirm 60fps with 36 relics + 200 particles.
8. Real store adapter (StoreKit / Play Billing) behind `PurchaseService` — only after Board ship gate.
9. Share card: add a deep link `?src=share` so `app_open.source` attributes shared installs.
10. Localize copy (strings are in `catalog.ts` / UI files; extract to a table first).
