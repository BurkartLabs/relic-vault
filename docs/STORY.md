# STORY.md — the Keeper's Chronicle

Design of record for the story half of **RV-D5** ("relic abilities + Keeper's story", queued for cycle 3 and
pulled forward), and for the Board's 2026-09-20 request:

> *"You know how some mobile games open with an advisor type person talking to you? And then they provide you
> with a series of quests throughout the game and you see a bubble for them that gets a green checkmark when
> you've completed their current quest? And then as you complete their quests it advances some sort of story? I
> want that. But we'll have main quests and side quests."*

The floors this story is told across are `docs/ROOMS.md`.

## The advisor already exists

The Keeper is in the game today: a painted portrait (`keeper` in UiArt), a dialog (`KeeperDialog`), and a voice
(`keeperSays`) that already delivers the onboarding lines and the hints. It has a face and nothing to say. So
this is not a new character — it is the character finally being given a reason to keep talking.

His voice is already established and does not change: dry, transactional, fond of the player in a way he would
deny. *"Everything here is priced fairly. For me."* He never begs, never warns of missing out, never mentions
money he is not owed.

## The bubble

A badge on the Keeper's portrait, reusing the seals the game already draws:

| State | Badge | Means |
|---|---|---|
| `none` | nothing | no quest available (all of this floor's are done) |
| `active` | gold seal, quiet | a quest is running; the portrait shows progress on tap |
| `ready` | **green seal with a check** | the current quest is complete and unclaimed |

`seal_green` is already in the atlas. The badge pulses once when it turns green and then sits still — a badge
that pulses for ever is a nag, and the Keeper does not nag.

## Main quests — the Chronicle

**Three per floor, thirty in all, strictly in order.** Each one ends in a beat of story, and the three beats of a
floor make that floor's chapter. The third quest of every floor **is** its capstone, so the chapter closes on the
biggest thing the player does down there and the story is never something happening beside the game.

The two doors open on **clearing the floor**, not on claiming that third beat. A player who dismisses a dialog
must never find themselves locked out of the choice, and the beat arrives at the same moment anyway — the Keeper
offers the doors as soon as it has been heard, and the Chronicle keeps offering them afterwards.

Rules the main line holds:

- **Never gated behind a purchase.** RV-D5's original constraint, and non-negotiable: the story is the reason to
  keep playing, so selling it would be selling the game twice.
- **Never gated behind a random drop.** Every goal is something the player can decide to do — forge, merge,
  deliver, reach a tier, wake a generator. No "open 3 chests and hope".
- **Always achievable on the floor it belongs to**, with the generators that floor has. A quest that needs the
  Star Well never appears above the floor where the Star Well can be running.
- **Progress is derived, never stored.** A quest reads the counters the game already keeps (`stats.merges`,
  `best`, `stats.orders`, `stats.bindings`, …), so the save carries only which quests have been *claimed*. That
  also means a quest can never desync from what the player actually did.

## Side quests — Errands

**Two open at a time, from the patrons already in the game** (Marisol, Brother Cask, Lady Venn, Ilse, Captain
Ossery, the Tin Prophet). Patron *orders* ask for a relic right now; an **errand** asks for a small run of play
and pays for it — "deliver three orders for Ilse", "forge twelve relics in the Star Well", "bind twice".

- Optional, always. Nothing in the main line waits on one.
- Never expire on a wall clock. An errand can be **swapped** for free, which costs a few actions rather than a
  timer, exactly as order refills already work.
- Pay in gold, gems and crumbs — never in story. Story is the main line's job; errands are the economy's.
- Deterministic from the floor and a sequence number, so two players on the same floor see errands of the same
  shape, and a save does not have to store the text.
- Twenty-five errands filled earns the **Errand-Runner** title. Titles are earned, never sold.

## The arc

Ten chapters, one per floor. The Keeper is the vault's previous keeper. He took the post to pay a debt and has
never finished paying, and the player is the first person in a long time who is good at fusing.

| Floor | Chapter | What the player learns |
|---|---|---|
| 1 | The Antechamber | He keeps the ledger. He does not own the vault. |
| 2 | The Drowned Wing | The water was let in on purpose. Something was being washed off. |
| 3 | The Glass Orchard | Relics *grow* down here. The vault makes as well as keeps. |
| 4 | The Ash Kilns | The kilns are fed with the vault's own old relics. Nothing here is new. |
| 5 | The Mirror Stair | There have always been two keepers: one to keep, one to owe. |
| 6 | The Root Cellar | The vault has roots, and it is drinking from something. |
| 7 | The Frost Ledger | The debt, itemised and frozen, with his name at the top. |
| 8 | The Clockworks | What was borrowed was time, and the interest is still running. |
| 9 | The Ink Vaults | The vault's true name, and whose signature is at the bottom of the page. |
| 10 | The Hollow Core | An empty setting, waiting for one more relic. |

The last beat is a **choice, not an ending**: set a relic in the empty setting and inherit the post, or leave it
empty. Either way the game continues and the Hollow Core can be restored for ever. No ending screen, no credits,
nothing switched off — a game that stops is a game that has taken something away.

## What this is not

- Not a cutscene. Every beat is a Keeper line on the existing dialog, dismissible with a tap, and it never
  blocks input for longer than the onboarding lines already do.
- Not a second currency. Chronicle rewards are the currencies the game already has.
- Not voice, animation or a new art pipeline. It is the portrait we have, the seals we have, and words.
