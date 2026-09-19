# ART BIBLE — Relic Vault

Everything on screen is painted by code at boot (Canvas2D → Phaser canvas textures). No external art files,
no emoji. The only binary assets are two bundled OFL fonts (Cinzel, Oswald) and the PWA icons, which are
themselves baked from the same painters (`npm run icons`).

## Lighting model (every object)

`paint.ts → shade()`: fill → warm key light radial from top-left → clipped inner edge stroke that runs
warm-white (top-left) to cold rune-cyan `#7EE0FF` (bottom-right) → ink outline `#160b05`.
This one function is why flint, copper, gold and star-metal all read as the same world.

## Palette (as shipped)

| Role | Values |
|---|---|
| Background | `#07060B` `#140E18` `#1B1424` |
| Gold ramp | `#FFF6CF` `#FFE9A3` `#F4C45A` `#A56A12` `#4A2A05` |
| Cold accent | `#7EE0FF` `#3AA0C8` |
| Danger / sale | `#FF5D6C` |
| Velvet (panels) | `#4A1838` → `#2A0F22` → `#12060E` |

## Relic ladder (RelicFactory.ts)

| T | Relic | Silhouette | Material |
|---|---|---|---|
| 1 | Flint Shard | jagged shard + bound bone chip, ember rune | flint, faceted |
| 2 | Copper Idol | squat figurine, crest, folded arms, plinth | copper + verdigris blooms |
| 3 | Silver Urn | amphora with ear handles, meander band | polished silver, sapphire inset |
| 4 | Gold Mask | face mask inside a 14-point sunburst | gold, turquoise teardrop, ember eyes |
| 5 | Emerald Scarab | top-down beetle, spread wings, holds a sun | faceted emerald, gold legs |
| 6 | Sapphire Heart | faceted heart in a gold filigree cage | sapphire |
| 7 | Ruby Crown | 5-point crown, velvet cap, pearl tips | gold, ruby, emerald, sapphire |
| 8 | Star-Metal Ark | ark with wings meeting overhead, glowing seam | iridescent star-metal, gold poles |
| 9 | Living Relic | void orb, halo spikes, tendrils, gold ring cage, **live eye** | living gold |

Distinguishability was checked at 96px (see `apps/web/art.html`, bottom row). T3 and T4 differ by
silhouette (vase vs. sunburst), not colour.

Atlases baked at boot:

- `relic256` — 9 × 256px masters (inspect, chest, shop, album, share card)
- `relics` — 9 × 7 frames at 160px: frame 0 + a 6-frame specular sheen sweep (plays every 2.5s, staggered per socket)
- `relic96` — 9 × 96px icons (odds table, ladders)
- `iris` — the Living Relic's pupil, a live sprite that tracks the finger

## Board and vault (VaultBackground.ts)

- Far: basalt block wall with speckle, a great arch recess, a bronze vault door (28 bolts, 16 cold runes, spokes), gold-banded pillars, three coin drifts with gems, vignette.
- Mid: sagging chains + two hanging chains with weights (sway tween, parallax 18px).
- Sarcophagus: basalt lid with gold/lapis headdress, gold face, chains + padlock. Eye glows are live sprites; they flare on T5+ merges and burn brighter as the best relic climbs.
- Near: two drifting fog tile layers (screen blend) + 34 gold motes + rare embers.
- Dais: slab with gold trim, star corner studs with rubies, 36 carved sockets (inner shadow, lit lip, faint sigil), front lip for thickness.
- Board-fill mood: additive red vignette ramps in past 72% full; dust kicks at 90%.
- Album page rewards appear in the world: Forge Banner (I), Crypt Chandelier (II, swinging), Star Orrery (III, rotating).

## UI chrome (UiArt.ts)

Nine-slice plaques (iron frame, gold channel, velvet, filigree corners with ruby rivets) in three velvets;
capsule buttons in 6 colours with gold rims and gloss; HUD pills; ribbon banners (red / blue / purple);
irregular wax seals for badges; illustrated coin (keyhole emblem), gem, pig idol, rank medallion with laurels,
crown; 18 icons (dock tabs, lock, gear, close seal, scroll, wheel, satchel, ad, scales, ghost gauntlet, chest,
cards, boost flame, clover); forge (anvil in a brazier); two-piece chest for the lid tilt; album card backs and
36 unique card fronts; keeper portrait; carnival wheel; particles (flare, ring, spark, shard, ember, mote,
confetti, ash, light shaft, contact shadow, selection ring, bulbs, candle flame).

## Juice inventory

Merge: slam (110ms) → 2-frame white freeze → flash + tier-coloured shockwave ring + spark burst → T4+: second
white ring, shards, embers → T7+: board-wide flash + confetti → squash-pop of the new relic → FUSE / RELIC! /
MYTHIC / LIVING! float text → coin fountain into the gold pill with count-up → camera shake scaled to tier →
haptic pattern → two-tone chime rising with tier (and with combo). Sell: shatter into 8–14 shards that fly to
the gold pill. Chest: bounce drop, rattle, lid hinge tilt, light shaft, fly-out, confetti on T4+. Purchase:
"SEALED" wax stamp slam, ring, coin/gem rain. Album page: confetti + ash, decoration fades into the vault.
First session: camera punch-ins on forge, first pair and first merge.

## Weakest 20% (next art pass)

1. Keeper portrait is a silhouette; give him a face under the hood.
2. Chest is flat-front; add a side face for a stronger 3/4 read.
3. Wheel prize icons are coins/gems only; paint prize-specific art.
