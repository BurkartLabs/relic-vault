# ROOMS.md — the ten floors, and the choice at the bottom of each

Design of record for **RV-D4a** (#276), which asked for this document before any code, and for the Board's
2026-09-20 request: *"So we can choose to prestige or advance to the next level. Let's go ahead and add 9 more
levels, each with their own unique set of Relics."*

The story half — the Keeper, main quests and side quests — is `docs/STORY.md`. They ship together because the
floors are what the story is about.

## The shape

The vault has **ten floors**. Floor 1 is the Antechamber the game already opens in. Each floor has its own
nine-relic ladder, forged by the generator on that floor, ending in a **capstone** — the floor's tier 9.

Two chains run the *whole depth* of the vault and do not change when you descend: the **Crypt Brazier** and the
**Star Well**. That is deliberate rather than economical. They are where bindings come from, so keeping them
continuous means a relic you saved on floor 3 still matters on floor 7, and the generator levels you paid gold
for are never taken away. What changes on each floor is the ladder you spend most of your attention on.

**Ascending the capstone clears the floor.** Ascension already existed: two top-tier relics leave the board
together for a jackpot. It is the biggest moment the game has, and it now means something beyond the payout.

## The choice

A cleared floor is not an end. The Keeper offers two doors, and **both are free, repeatable and never for sale**:

| | **Descend** | **Restore** (prestige) |
|---|---|---|
| What happens | floor + 1: a new ladder, new relics, new chapter | this floor begins again |
| The board | cleared; every relic on it is recorded in the Reliquary | cleared the same way |
| You keep | one relic of your choice as a **memento**, plus the Crypt and Star Well | the same memento |
| You gain | the next floor's content, and the next chapter of the Keeper's story | **+1 Keeper's Renown**, permanently |
| Best for | wanting to see what is further down | wanting to stay where the play feels good |

**Keeper's Renown** is the permanent reward for restoring: a small luck bonus and a gold multiplier that no
purchase can grant and nothing ever removes. It is capped, so a player who restores twenty times is faster, not
untouchable — the same rule the luck stat already follows.

The point of offering both is that "more content" and "better at this content" are different appetites, and a
game that only rewards the first one punishes the player who is enjoying themselves. Descending is the runway;
restoring is mastery. Neither is the correct answer, and the Keeper says so.

### Why a memento

Descending with nothing would make every floor a fresh start, which reads as losing your things. Descending with
everything would make the new ladder pointless. One relic you *chose* is the difference between a reset and a
move: it is the story of the last floor carried into the next one, it works as a binding down there, and choosing
which one to keep is a real decision made once per floor.

## The relics, and how nine floors' worth get made

Ninety relics, and each relic in this game is a hand-painted procedural function — 23 of them today, at roughly
20 lines each. Eighty-one more of those is weeks of work at this art bar, and it would be the wrong weeks: the
result would be 81 silhouettes drawn without art direction.

So a floor's relics are **composed**, not drawn one at a time:

- a **form family** (the silhouettes: vessels, effigies, instruments, seals, creatures …),
- a **material family** (palette and finish: salt and coral, glass and amber, ice and rime, brass and spring …),
- an **ornament** pass that belongs to the floor.

Two relics on different floors can share a form, the way a jar and an urn share a form, and never look like the
same object. A floor reads as a coherent set because it *is* one, and a new floor costs data rather than code.
The capstones are hand-painted, because the capstone is the image the player remembers.

This is the honest trade and it is written down here so nobody reads "unique relics" later and assumes eighty-one
bespoke paintings were promised. If they are ever wanted, that is its own epic.

## The ten floors

| # | Floor | Material family | The capstone |
|---|---|---|---|
| 1 | The Antechamber | flint, copper, silver, gold, gems | Living Relic |
| 2 | The Drowned Wing | salt, coral, pearl, whalebone | The Tide Ledger |
| 3 | The Glass Orchard | glass, resin, amber, grown things | The Sap Crown |
| 4 | The Ash Kilns | clay, soot, ember, fired ceramic | The Kiln Heart |
| 5 | The Mirror Stair | mirror, silvered glass, reflection | The Second Keeper |
| 6 | The Root Cellar | root, fungus, wet wood, earth | The Taproot Reliquary |
| 7 | The Frost Ledger | ice, rime, frozen ink | The Debt in Ice |
| 8 | The Clockworks | brass, spring, escapement | The Hour Unspent |
| 9 | The Ink Vaults | ink, vellum, seal-wax | The Name of the Vault |
| 10 | The Hollow Core | absence, void, un-things | The Empty Setting |

Floors get richer, not merely bigger: each one's ladder pays a little more (the chain `value` multiplier the
economy already uses), so descending is worth doing without any floor becoming the only sensible place to play.

## Rules this design does not break

- **No waiting.** Descending and restoring are instant. Neither has a timer, a cooldown or an energy cost.
- **Nothing here is purchasable.** Not Renown, not a floor, not a memento, not a skip. A floor cannot be bought
  past, because the ladder is the game.
- **Nothing is lost.** Every relic on the board at the moment you leave is recorded in the Reliquary, and the
  satchel is never emptied by a floor change.
- **No dead end.** The Hollow Core can be restored for ever, so the player who reaches the bottom still has
  somewhere to go — the bottom is a place, not a wall.
- **The portfolio law of the game economy holds**: floors raise the ceiling on content, never on coercion.

## Rooms: the four rooms of every floor (RV-D4a, #276)

*Designed 2026-09-26. Not built. Everything in this section is a proposal, and its probe targets are written down
before any code, as the story asks.*

**Why.** The content runway scored 2 / 5. The Board made the Living Relic, the whole Forge ladder, in under 41
minutes, and the v2 probe agrees: a focused bot does it in 1,138 actions (`probes/2026-09-21-probe-v2.md`). The
floors above answer "what comes next". They do not answer two findings the probes keep repeating:

- **Where a relic sits never matters.** Forged relics land in a random empty socket, and no rule reads a position.
- **Gold has nowhere to go.** The engaged planner banks 137,810 gold by day 14 (9,844 a day) and the casual player
  57,575 (4,112 a day), once the generator ladder is bought. Keeper's Renown multiplies gold by up to 1.75, which
  makes this worse the more a player restores.

Rooms put a place into the board, and a gold sink that the player can see.

**How this fits the Board's prestige ask.** The Board asked that once every relic in a room is discovered, the
player may leave for a new room with new chains and keep a permanent Keeper's Renown bonus. That shipped as the
floors above: a floor is the Board's "room with new chains". Its capstone is its own ladder's tier 9, and making
it means every relic on that ladder has been made. Renown is never for sale. This section uses **room** for
something smaller: a quarter of a floor's board.

### The four rooms

The 6 × 6 board is four 3 × 3 rooms. Each floor names its own four (the Antechamber's are the Gatehouse, the
Scriptorium, the Ossuary and the Treasury), and each has its own art in the vault background.

| Room | Where | On arrival | What opens it |
|---|---|---|---|
| 1 | top left | open | nothing: this is where you start |
| 2 | top right | fogged | merging beside the fog, nothing else |
| 3 | bottom left | fogged, with a cursed socket | fog as above, and the curse needs a tier-5 merge beside it |
| 4 | bottom right | fogged, with a cursed socket | fog as above, and the curse needs a merge at the floor's tier 8 beside it |

- **Fog.** A fogged socket can hold nothing, so neither the forge nor the satchel can place into it. It clears
  when a merge's result lands in a socket orthogonally next to it (`neighbours()` in `BoardSystem.ts`). One merge
  clears every fogged neighbour it touches. Fog only clears from an open socket, so a room opens from its edge
  inward. That is the placement decision: which copy you drag onto decides where the result lands.
- **Curses.** Rooms 3 and 4 each have one cursed socket, at the room's centre. A curse clears only when a merge
  of at least its **ward tier** lands next to it. The ward tiers come from the ladder, not from new numbers: room
  3's is `CAPSTONE_TIER − 4` (T5), and room 4's is `CAPSTONE_TIER − 1` (T8). Any chain counts, so the Crypt and the
  Star Well can open a room whose own ladder the player has not reached. A room is **clear** when none of its
  sockets is fogged or cursed.
- **Nothing here is random.** Where the fog is, which sockets are cursed and what clears them are fixed per
  floor. Every profile gets the same rooms, including under-16 and loot-box-off (MONETIZATION.md, 2026-09-19:
  features are made safe for everyone, not restricted by age).
- **A new save is not cramped.** On the very first visit to the Antechamber, rooms 1 and 2 start open (18
  sockets), so the first session's delight is untouched. Every later arrival, whether by Descend or by Restore,
  starts with room 1 open only.

### Repair: the gold-paid restoration

*Named **Repair** so it is never confused with the **Restore** door above, which is prestige.*

A clear room can be **repaired**, once per floor, for gold. The cost comes from existing constants:
`repairCost(room k, floor) = k × 1.5 × ascendGold × floor.value`, which is 7,500 · 15,000 · 22,500 · 30,000 on the
Antechamber (75,000 in all). It grows with floor value, as the floor's income does. The 1.5 is the one new
number, and it is the probe's to tune (targets below).

A repaired room gives three things:

1. **The world changes.** The room's art is rebuilt: sconces lit, murals uncovered, the fog's stains gone. It
   stays rebuilt for good, and the Chronicle records it. Four rooms times ten floors is forty visible states,
   against today's three.
2. **One more memento.** Each repaired room lets the player carry one more relic of their choice through Descend
   or Restore, up to five from a fully repaired floor. The memento is already a binding on the floor below, so
   this is the link between rooms and floors: repair the floor you are leaving, and start the next one stronger.
3. **Its rooms stay open on Restore.** Restoring a floor fogs its unrepaired rooms again, so the placement puzzle
   returns with every Renown. A repaired room comes back already open. That makes Repair a real reason to stay.

**What Repair never does.** It never gates a door: a floor clears on its capstone, whatever is repaired, so no
purchase is ever needed to go deeper. Fog and curses clear only through play. Gold is sold (the Keeper's Welcome
holds 100,000), so a payer can repair the Antechamber at once. That is advantage (a view and extra mementos),
which the Charter permits. It is never progression, and a free player reaches every repair on gold the game pays.

### Rules this does not break

- **No waiting.** Fog is counted in merges, never in time. Nothing here has a timer or an energy cost.
- **A free way out always exists.** Vault Jammed, selling and the satchel are unchanged. A smaller open board
  means more jams, and the casual target below exists to catch that. Power-ups (AB#381) clear fog only the way
  any merge does, a faster way out rather than the only one.
- **Nothing is lost.** A fogged socket never swallows a relic, because nothing can be placed there. A relic on
  the board when a room re-fogs on Restore goes to the Reliquary with the rest.
- **Stakes stay separate.** RV-M4's cursed *relics* (#305, the Board's pricing list) could later fog a socket
  through the same fog state. This design does not need them and does not assume them.

### Probe targets, written before the build

Measured by a probe that does not exist yet. Its bots must choose where merges land, buy repairs when they can
afford them, and descend. Baselines are from `probes/2026-09-21-probe-v2.md`, median of 12 seeds, bot numbers
(P-PROXY), in actions: engaged 1,271 a day, casual 610.

| # | Target | Why |
|---|---|---|
| 1 | Every floor has 4 rooms, all clearable without spending anything | structure, and no gate |
| 2 | Planner clears **≥ 20% more rooms** than the order-aware greedy baseline over 14 days, engaged and casual | placement is skill (DEPTH review #2) |
| 3 | Gold banked a day **−50%**: engaged planner ≤ 4,922, casual planner ≤ 2,056 (from 9,844 and 4,112) | the sink works |
| 4 | Planner decision density ≥ 45% (from 35%): turns whose move differs from the greedy baseline's | placement adds decisions, not just a rule |
| 5 | Focused engaged player repairs all four Antechamber rooms **no earlier than day 2** | rooms outlast the ladder (41 min) |
| 6 | Longest gap without a new relic, room clear or repair: engaged planner **≤ 2 days** (today 8,623 actions, ~6.8 days) | runway |
| 7 | Casual player clears ≥ 3 Antechamber rooms and repairs ≥ 2 by day 14 without buying, with Vault Jammed on ≤ 1% of actions | the free path is real and the smaller board is not a squeeze |
| 8 | Under-16 and loot-box-off profiles produce the same rooms, clears and costs as everyone else | safe design: nothing random, nothing withheld |

Two things the probe cannot see, and a human look must cover. The world change (target: day-1 and day-14
screenshots of the Antechamber differ in at least three rooms), and whether pushing fog back reads as a puzzle or
as a chore. Neither is a number.

**Building it is its own story.** The fog and curse rules, Repair, the memento change, room art for the
Antechamber first, and the probe. Room art for floors 2 to 10 uses the composed-art approach above.

## Open questions, deliberately left

- Should a floor's *side* chains eventually change too (a third constant, deeper down)? Not for v1: two
  constants is already enough cross-floor binding economy to reason about.
- Cursed sockets are designed above (Rooms, RV-D4a). Cursed *relics* (RV-M4, #305) stay the Board's pricing call and
  would reuse the same fog state.
- Whether Repair costs should also scale with Renown, so a player who has restored many times still finds gold
  scarce. Left to the probe: target 3 will say.
- The Reliquary wants a room of its own in the UI eventually. For now it is a count and a list.
