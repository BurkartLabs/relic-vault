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

## Open questions, deliberately left

- Should a floor's *side* chains eventually change too (a third constant, deeper down)? Not for v1: two
  constants is already enough cross-floor binding economy to reason about.
- Cursed sockets (RV-M4 / #305) are per-floor furniture and want their own pass once floors exist.
- The Reliquary wants a room of its own in the UI eventually. For now it is a count and a list.
