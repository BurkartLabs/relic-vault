# RV-D4/D5 The ten floors, prestige, and the Keeper's Chronicle (AB#444)

Product: relic-vault · Version: 1.1 · Lanes: relic-vault/all

## Why

The floors shipped on 2026-09-20 from the Board's ask, *"add 9 more levels, each with their own unique set of
Relics"*: ten floors with their own nine-relic ladders (`data/floors.ts`), the doors at the bottom of each
(`FloorDoorsModal`), the Chronicle, Renown, mementos and restore (`systems/Floors.ts`, `ui/Chronicle.ts`) are all
built and playable through the Hollow Core (Bug AB#4896 is about the *last* floor's doors popup). Three things the
design of record promised were never finished, and the Board named all three on 2026-09-30:

1. **The relics are placeholders.** `RelicFactory.ts:510-521` says so: floors 2-10 borrow the Antechamber
   silhouette of the same tier and wear their floor's colour. docs/ROOMS.md ("how nine floors' worth get made")
   designed a **form family + material family + ornament pass** composition with hand-painted capstones, and
   `floors.ts` already carries each relic's `form` and `material`. The grammar was never painted. On the store
   listing these are the screenshots.
2. **Descending is a hard cut.** `VaultScene.onFloorChanged()` calls `this.scene.restart()`. The Board: *"I wasn't
   even sure it worked."* ROOMS.md says descending is the reward for clearing a floor; today it is a blink.
3. **Arrival is one Keeper line.** `keeperSays(floor.name + subtitle)` after the restart, and nothing else. The
   floor is a chapter of the story (docs/STORY.md) and should open like one.

Nothing here changes rules, economy or saves: `id = chain * 10 + tier` stays, every existing save stays valid, and
ROOMS.md's rules (no waiting, nothing purchasable, nothing lost, no dead end) are untouched.

## Acceptance

1. **Every floor relic is composed, not recoloured.** For every floor 2-10 and tier 1-9, the painted relic uses the
   `form` and `material` named in `data/floors.ts`: the silhouette comes from that form's painter, the palette and
   finish from that floor's material family, and the floor's ornament pass is visible on it. No floor relic is drawn
   by `PAINTERS[tier]` plus `recolour()`; the placeholder branch in `paintRelic` is gone and a unit test fails if any
   floor id falls through to it.
2. **Capstones are hand-painted.** Each floor's tier 9 (the Tide Ledger, the Sap Crown, the Kiln Heart, the Second
   Keeper, the Taproot Reliquary, the Debt in Ice, the Hour Unspent, the Name of the Vault, the Empty Setting) has
   its own painter, not a form-family composition.
3. **They tell apart.** `apps/web/art.html` shows all 90 floor relics on one contact sheet at 96 px, grouped by
   floor; a stranger can name a relic's floor from its material and its tier from its size and detail without a
   caption (SHIPNOTES "all tiers distinguishable at 96px" now holds for every floor). The sheet is attached to each
   art PR.
4. **The atlas still fits a phone.** `rebakeBoardFor` and the AB#4737 lazy paint are preserved: floor art paints on
   first need, texture memory stays under the AB#4737 budget, and cold start does not regress against the numbers in
   docs/DEVICE_QA.md.
5. **Descending is a transition, not a cut.** Choosing a door plays a 2.5 to 3.5 second sequence: the relics being
   recorded lift off the board and sink into the Reliquary, the vault darkens and drops (the camera falls through the
   floor), the new floor's colour and background rise to meet it, the generator row builds in. Skippable after
   1.2 s (as the ad veil is); a reduced-motion variant is a fade with the floor name; restore is a shorter
   variant of the same sequence. 60 fps on a mid-range phone (the DEVICE_QA device). The scene restart happens
   under the transition, never visibly, and the board after it is exactly what `descend()`/`restore()` returned.
6. **Arrival opens a chapter.** When the transition ends, before any input, a full-screen card: "Chapter N" (floor
   index + 1; "again" on restore), the floor's name and subtitle, its material family in one line, the generator's
   name and blurb, the capstone shown veiled ("what you will make here"), Renown gained and the memento placed on
   the board, one Keeper line, one Continue. Once per arrival; the Keeper's bubble line after it is dropped. A
   fresh game on floor 1 shows Chapter 1 once, after the age gate and before the first forge hint.
7. **Nothing is lost or paid.** Ten descend/restore cycles in the e2e leave the Reliquary, satchel, Renown and
   memento exactly as `floors.test.ts` predicts; no timer, cooldown, price or offer appears anywhere in the
   transition or the chapter card.
8. **It was looked at.** Each PR attaches screenshots at 1080x1920 and 375x812: two floors' relics on the board,
   the transition at its midpoint (a frame from a recording), and the chapter card. `npm run typecheck && npm test
   && npx playwright test` pass; `npm run playtest` still completes.

## Slices

The art is three sessions, three floors each, because 27 composed relics plus three hand-painted capstones is a
session, and 81 is not. The grammar (form painters, material finishes, the ornament hook) lands with the first.

### Slice 1: the form-and-material grammar, and floors 2-4 (lane: relic-vault/all)

- [x] `art/FloorArt.ts`: one painter per `Form` (`shard, vessel, effigy, mask, creature, instrument, seal, lantern, crown, book, frame, core`), each parameterised by tier (size, detail count) so a tier-2 vessel and a tier-8 vessel read as the same family at different rank
- [x] a material finish per floor as a post-pass over the silhouette (palette from `floors.ts` colours plus finish: salt/coral/pearl grain, glass/amber translucency, clay/soot/ember glow) and a per-floor ornament pass (the Drowned Wing's barnacle line, the Orchard's graft seam, the Kilns' crackle)
- [x] `paintRelic` routes floor ids to `FloorArt`; the placeholder branch is deleted; a unit test asserts every id 30-119 resolves to a form painter or a capstone painter
- [x] hand-painted capstones: the Tide Ledger, the Sap Crown, the Kiln Heart
- [x] `art.html` contact sheet grouped by floor at 96 px; screenshots of the Drowned Wing board at both sizes attached

### Slice 2: floors 5-7 (lane: relic-vault/all)

- [ ] material finishes and ornament passes for the Mirror Stair (mirror, silvered glass, a reflection band), the Root Cellar (root, fungus, wet wood), the Frost Ledger (ice, rime, frozen ink)
- [ ] any form painter these floors need that slice 1 did not exercise, with the same tier parameterisation
- [ ] hand-painted capstones: the Second Keeper, the Taproot Reliquary, the Debt in Ice
- [ ] contact sheet updated; screenshots of the Mirror Stair board at both sizes attached

### Slice 3: floors 8-10 (lane: relic-vault/all)

- [ ] material finishes and ornament passes for the Clockworks (brass, spring, escapement), the Ink Vaults (ink, vellum, seal-wax), the Hollow Core (absence: silhouettes drawn as their own negative space, per ROOMS.md "un-things")
- [ ] hand-painted capstones: the Hour Unspent, the Name of the Vault, the Empty Setting
- [ ] the AB#4737 numbers re-measured with every floor painted (cold start, texture memory) and recorded in docs/DEVICE_QA.md; contact sheet complete; screenshots of the Hollow Core board at both sizes attached

### Slice 4: the descent (lane: relic-vault/all)

- [x] `scenes/FloorTransition.ts`: a scene launched over the vault that owns the sequence (recorded relics lift and sink into the Reliquary, the vault darkens and drops, the new floor's colour and background rise, the generator row builds in), 2.5 to 3.5 s, with sfx
- [x] `onFloorChanged` restarts the vault *under* the transition; the transition ends only when the new scene reports ready, so the cut is never visible; `persistNow` before, exactly as today
- [x] skip after 1.2 s; `prefers-reduced-motion` variant (fade plus the floor name); the restore variant shorter and without the drop
- [ ] e2e: ten descend/restore cycles leave state as `floors.test.ts` predicts and the transition never blocks input past 4 s; a recording or three frames attached, and the fps on the DEVICE_QA phone recorded

### Slice 5: the chapter card (lane: relic-vault/all)

- [x] `ui/FloorIntro.ts`: a modal opened by the transition's end with Chapter N, name, subtitle, material line, generator name and blurb, the veiled capstone, Renown gained and the memento placed, one Keeper line, one Continue; copy in `catalog.ts` COPY like every other string
- [x] shown once per arrival (descend and restore), and once for Chapter 1 on a fresh game after the age gate; the post-restart `keeperSays` line removed
- [x] the Chronicle links each chapter card to its floor entry (the card is where the floor's story begins)
- [x] e2e asserts the card appears exactly once per arrival and never on a plain reload; screenshots at both sizes attached

## Demo script

1. Open a save on the Antechamber with the capstone made; walk to the doors. Choose **Descend**. Watch the whole
   transition without skipping (screenshot the midpoint): the relics sink, the vault drops, the Drowned Wing rises.
2. Read the chapter card: "Chapter 2 · The Drowned Wing · The water was let in on purpose." with the Tide Sluice,
   the veiled Tide Ledger, the Renown line and the memento. Press Continue once; the board is playable.
3. Forge and merge to tier 4 on the Drowned Wing. Screenshot the board at 1080x1920 and 375x812: every relic is
   salt, coral, pearl or whalebone, none is an Antechamber shape.
4. Open `art.html`: 90 relics in ten rows; point at any one and say which floor it is from.
5. Enable reduced motion in the OS; descend again: a fade and the floor name, then the card.
6. Restore the floor: the shorter transition, the card says "again".

## Out of scope

- The four rooms, fog and curses (ROOMS.md "Rooms", RV-D4a #276): designed, still not built, its own slices later.
- 81 bespoke paintings. ROOMS.md's trade stands: composed relics, hand-painted capstones.
- New floors, or any change to Renown, mementos, restore, or the economy's `value` multipliers.
- Bug AB#4896 (the last floor's doors heading wraps) and AB#4895 (a possible freeze near the Antechamber) stay their
  own Bugs; slice 4 must not make AB#4895 harder to reproduce (keep the transition's logs).
