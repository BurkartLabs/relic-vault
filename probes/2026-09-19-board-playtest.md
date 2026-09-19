# Board playtest — 2026-09-19 (human pace calibration, Bug #307)

First human play of Relic Vault. One player (the Board), Windows, the desktop app's browser pane, dev build
(relic-vault 3c156d4), fresh save. Sources: the save's lifetime stats and the persisted monetization log
(`window.__rv.analytics.buf`, timestamps + rank + session seconds). The per-action telemetry buffer lives in memory
and was lost to page reloads, so pace figures are **wall-clock upper bounds** (menus, offers and pauses included).

## Timeline (seconds from first boot)

| Session | Starts at | Length | Rank at start → end | Notes |
|---|---|---|---|---|
| 1 | 0 | ≤ 210 s | 1 → 3 | 60 merges by 137 s; 5 offers shown, all dismissed in 1–12 s |
| 2 | 210 | ≤ 385 s | 3 → 5 | board full 3×, Vault Jammed dismissed each time in < 2 s |
| 3 | 595 | ≤ 1,844 s | 5 → 9 | ended by a dev-server reload; most of the play |
| 4 | 2,439 | idle | 9 | 29 actions, then idle |

## Numbers

| Measure | Board | Runway probe (planner bot) |
|---|---|---|
| Seconds per action (sessions 1–3, idle included) | **≤ 1.18** (2,069 actions in ≤ 2,439 s) | 1.6 assumed |
| First ~2 min | ≥ 120 actions in 137 s → ~1.1 s/action | — |
| Rank 3 (Crypt) | ≤ 3.5 min | 4 min |
| Rank 5 | ≤ 10 min | (rank 6 at 24 min) |
| Rank 9 | ≤ 41 min | rank 20 by day 14 |
| Living Relic (T9, top of the Forge chain) | made in ≤ 41 min (maxTier 9, 44 bindings used) | **never in 14 days** |
| Patron orders delivered | **0** in 2,098 actions | 31 per day |
| Relics sold | 0 | 0 |
| Offers shown / bought | 7 / 0 (every one dismissed within 12 s) | — |

## What it means

- **Pace:** use **≤ 1.2 s per action** for an engaged player until more humans play, and treat 1.6 s as a casual
  pace. One expert player is a sample of one.
- **Content runway was overstated badly.** The Forge chain, which the probe said a planner never finishes, was
  finished by a human in under 41 minutes. The runway gate in DEPTH.md review #2 (2 / 5) is, if anything, too kind.
- **Patron orders, the centrepiece of Deepen cycle 1, were ignored completely.** A human who plays for 2,000
  actions without delivering one order means orders are either not discoverable or not worth it compared with
  merging. This is a Depth finding for RV-P2 / the next Depth review, not a bug.
- **Offers:** every offer was dismissed on sight; nothing was bought. Consistent with MONETIZATION.md review #1
  (value perception 1).

## Instrumentation gaps found

- The per-action telemetry buffer is in memory only; reloads erase it (use the collector: `VITE_TELEMETRY_URL`).
- `session_end` fires on every tab hide: 270 in one session (Bug #326).
