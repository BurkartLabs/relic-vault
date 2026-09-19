# BRIEF — relic-vault

Size: M
Stage: Preview (Critic SHIP, 2026-09-19) — production Board-gated
Scorecard: verb 5 (merge is visible), session 4, bet 3, doctrine 5 if we learn
           "no-energy merge can still convert", distribution 3, measurement 4

## One sentence

Merge cursed treasure on a living vault board. No energy. Always another merge.

## The verb

Forge a relic, drag two matching tiers together, watch them fuse.

## Who it is for, how they find it

Casual phone players. PWA first. Shareable merge juice.

## What we will measure first

`verb_first` within 30s of `app_open`, then 7-day return after 200 sessions.

## Telemetry sink

Self-hosted NDJSON collector (`apps/web/tools/collector.mjs`, $0) wired via `VITE_TELEMETRY_URL`.
Where it runs publicly is a Board decision; until then events are proven only in QA.
Identity: anonymous `rv_did` (localStorage), per-boot session id, app version, platform.

## Monetization

Demo IAP stack: $1.99 welcome pack timed after first merge, dual currency,
chests with published odds, piggy, pass, album. No play-stopping cooldown.
Amended by Critic (Soul > spec): real 48h welcome deadline, computed value ribbons,
no fake leaderboard, no random rewards or pushed offers for under-16s.

## Out of scope

Real StoreKit, accounts, live PvP, kids mode.

## Acceptance for Preview

- [x] stranger can merge without us talking (ghost finger; scripted verb_first 5.8–8.8s; no human test yet)
- [x] telemetry events fire (TELEMETRY.md set; arrive at self-hosted collector in e2e)
- [x] no play-stopping cooldown (e2e: 60 rapid actions never refused)
- [x] screenshot looks like a dark-fantasy product, not a form (Critic gate 1)

## Estimated load

| Phase | Sessions | Calendar |
|---|---|---|
| Preview (Phaser vault + 8 relics + merge juice) | 8–12 | 3–4 d |
| v1 surfaces (shop, offers, album, pass) | 8–12 | to day 14 |
| Learning + video | 1 | close day |
