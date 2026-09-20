import { RELICS } from './catalog';

/**
 * The ten floors of the vault (docs/ROOMS.md). Floor 1 is the Antechamber the game already opens in; floors 2
 * to 10 each add their own nine-relic ladder, forged by that floor's generator and ending in a capstone.
 *
 * The Crypt Brazier (chain 1) and the Star Well (chain 2) run the whole depth and do not change when you
 * descend — they are where bindings come from, so a relic saved on floor 3 still matters on floor 7.
 *
 * **Ids.** A floor's ladder is a chain, so it reuses every mechanic chains already have (generators, bindings,
 * per-chain `best`, the `value` multiplier). Chain 0 is the Antechamber's Forge; floors 2-10 take chains 3-11,
 * which keeps `id = chain * 10 + tier` intact (the last id is 119) and leaves every existing save valid.
 *
 * **Art.** Relics here are composed from a form family and a material family rather than hand-painted one at a
 * time; see ROOMS.md, "how nine floors' worth get made". `form` names the silhouette the painter should use and
 * is deliberately reused across floors — a jar and an urn share a form and are not the same object.
 */

/** The silhouette families the relic painter composes from. */
export type Form =
  | 'shard' | 'vessel' | 'effigy' | 'mask' | 'creature' | 'instrument'
  | 'seal' | 'lantern' | 'crown' | 'book' | 'frame' | 'core';

export interface FloorRelic {
  name: string;
  material: string;
  color: number;
  form: Form;
  lore: string;
}

export interface FloorDef {
  /** 0-based floor index; floor 1 is id 0. */
  id: number;
  /** the chain its ladder occupies */
  chain: number;
  name: string;
  /** one line, shown under the floor name when you arrive */
  subtitle: string;
  color: number;
  /** the generator that forges this floor's ladder, and what it says on its sheet */
  gen: string;
  genBlurb: string;
  /** pays a little more the deeper it sits (the chain `value` multiplier) */
  value: number;
  /** nine relics, tier 1 to 9. The ninth is the capstone. */
  relics: FloorRelic[];
}

/** Floor 1 keeps the relics the game shipped with, so nothing a player already owns changes name or colour. */
const ANTECHAMBER: FloorRelic[] = [
  { ...pick(1), form: 'shard' }, { ...pick(2), form: 'effigy' }, { ...pick(3), form: 'vessel' },
  { ...pick(4), form: 'mask' }, { ...pick(5), form: 'creature' }, { ...pick(6), form: 'core' },
  { ...pick(7), form: 'crown' }, { ...pick(8), form: 'frame' }, { ...pick(9), form: 'creature' },
];
function pick(t: number) {
  const r = RELICS[t];
  return { name: r.name, material: r.material, color: r.color, lore: r.lore };
}

const DROWNED: FloorRelic[] = [
  { name: 'Salt Nodule', material: 'Rock salt', color: 0xdfe9ee, form: 'shard', lore: 'Sweated out of the wall. Tastes of a tide nobody remembers.' },
  { name: 'Barnacle Cup', material: 'Shell', color: 0xbfd8c8, form: 'vessel', lore: 'Holds a mouthful. Charges a shilling.' },
  { name: 'Drowned Sailor', material: 'Whalebone', color: 0xeae2cc, form: 'effigy', lore: 'Carved by someone with time and no rescue.' },
  { name: 'Coral Diadem', material: 'Red coral', color: 0xff7f6a, form: 'crown', lore: 'Still growing. It will outgrow your head.' },
  { name: 'Pearl Lantern', material: 'Nacre', color: 0xf2f0ff, form: 'lantern', lore: 'Lights nothing. Makes the dark look expensive.' },
  { name: 'Kraken Seal', material: 'Wet bronze', color: 0x2f8f8a, form: 'seal', lore: 'Pressed into wax once. The wax screamed.' },
  { name: 'Tide Organ', material: 'Shell and brass', color: 0x7fd6cf, form: 'instrument', lore: 'Plays when the water rises. It has been playing for years.' },
  { name: 'Leviathan Rib', material: 'Whalebone', color: 0xd8cdb0, form: 'frame', lore: 'One rib. There is no room down here for the rest.' },
  { name: 'The Tide Ledger', material: 'Salt and ink', color: 0x4fe0d8, form: 'book', lore: 'Every debt the sea collected, in a hand that ran when it got wet.' },
];

const ORCHARD: FloorRelic[] = [
  { name: 'Glass Seed', material: 'Bottle glass', color: 0xa8e6b0, form: 'shard', lore: 'Plant it and something transparent comes up.' },
  { name: 'Resin Jar', material: 'Pine resin', color: 0xe8b552, form: 'vessel', lore: 'Sealed while warm. Something small is still in there, furious.' },
  { name: 'Amber Fruit', material: 'Amber', color: 0xffb03a, form: 'creature', lore: 'Ripe for nine thousand years. Do not bite it.' },
  { name: 'Sapling Effigy', material: 'Grown glass', color: 0x9fe8a0, form: 'effigy', lore: 'It was pruned into a person. It prefers this shape now.' },
  { name: 'Prism Bloom', material: 'Cut crystal', color: 0xd0f0ff, form: 'core', lore: 'Opens at a light nobody has brought down here yet.' },
  { name: 'Glasswing Moth', material: 'Spun glass', color: 0xcfe8d8, form: 'creature', lore: 'Beats twice a year. Both times are audible.' },
  { name: 'Orchard Chime', material: 'Glass and wire', color: 0xb8e6d0, form: 'instrument', lore: 'Rung by fruit falling. The orchard is very fond of the note.' },
  { name: 'Vitrine Crown', material: 'Blown glass', color: 0x8fe0c0, form: 'crown', lore: 'Worn by whoever tended this place. Cracked at the temple.' },
  { name: 'The Sap Crown', material: 'Living amber', color: 0xffd05a, form: 'crown', lore: 'The orchard grew a king so it would have someone to obey.' },
];

const KILNS: FloorRelic[] = [
  { name: 'Clay Pinch', material: 'Raw clay', color: 0xc08a6a, form: 'shard', lore: 'Somebody\'s thumbprint, fired hard enough to last.' },
  { name: 'Soot Jar', material: 'Black ceramic', color: 0x4a4048, form: 'vessel', lore: 'Full of what the vault has burned. It is not empty.' },
  { name: 'Ember Idol', material: 'Fired clay', color: 0xff8a3a, form: 'effigy', lore: 'Warm to the touch. Warmer if you are the last one in the room.' },
  { name: 'Kiln Mask', material: 'Glazed ceramic', color: 0xe8a05a, form: 'mask', lore: 'Worn to face the heat. The face underneath was not saved.' },
  { name: 'Cinder Hound', material: 'Ash and iron', color: 0xd06a3a, form: 'creature', lore: 'It guards the flue. Nothing has ever wanted the flue.' },
  { name: 'Slag Lantern', material: 'Waste glass', color: 0xffb05a, form: 'lantern', lore: 'Made from the mistakes. Brighter than anything made on purpose.' },
  { name: 'Bellows Organ', material: 'Leather and brass', color: 0xc9873a, form: 'instrument', lore: 'Six lungs. Plays one note, and the fire answers it.' },
  { name: 'Firing Seal', material: 'Red ceramic', color: 0xff6a4a, form: 'seal', lore: 'Stamped on anything the kilns consider finished.' },
  { name: 'The Kiln Heart', material: 'Fused ash', color: 0xffd08a, form: 'core', lore: 'What is left when the vault burns its own relics. It is always this size.' },
];

const MIRROR: FloorRelic[] = [
  { name: 'Mirror Splinter', material: 'Silvered glass', color: 0xdfe8f0, form: 'shard', lore: 'Shows a hand slightly before yours moves.' },
  { name: 'Looking Cup', material: 'Polished silver', color: 0xe8eef2, form: 'vessel', lore: 'Whatever you pour in, you drink your own face.' },
  { name: 'Second Face', material: 'Mirror and lead', color: 0xc8d4e0, form: 'mask', lore: 'Fits perfectly. That is the unpleasant part.' },
  { name: 'Reflected Stair', material: 'Cold glass', color: 0xb8c8dc, form: 'frame', lore: 'Nine steps down, nine steps up, and only one of them is real.' },
  { name: 'Silver Twin', material: 'Quicksilver', color: 0xf0f4f8, form: 'effigy', lore: 'It does what you did, a moment late, and better.' },
  { name: 'Glass Owl', material: 'Mirror', color: 0xd8e4ee, form: 'creature', lore: 'Watches the stair. Sees both directions at once, which it dislikes.' },
  { name: 'Echo Bell', material: 'Silvered bronze', color: 0xcfe0ea, form: 'instrument', lore: 'Rings after you leave. Politely.' },
  { name: 'Regress Crown', material: 'Mirror and gold', color: 0xf4e0a0, form: 'crown', lore: 'Each facet shows a keeper. None of them are finished.' },
  { name: 'The Second Keeper', material: 'Living mirror', color: 0xe8f0ff, form: 'effigy', lore: 'There have always been two. One to keep, and one to owe.' },
];

const CELLAR: FloorRelic[] = [
  { name: 'Root Knuckle', material: 'Dry root', color: 0x8a6a48, form: 'shard', lore: 'Snapped off something that is still growing somewhere.' },
  { name: 'Loam Pot', material: 'Wet earth', color: 0x6a5238, form: 'vessel', lore: 'Whatever you plant, it produces exactly one relic.' },
  { name: 'Cap and Gill', material: 'Fungus', color: 0xc8a8d8, form: 'creature', lore: 'It has opinions about the light you brought.' },
  { name: 'Wicker Saint', material: 'Woven root', color: 0xa88a58, form: 'effigy', lore: 'Bound to be prayed at. Bound tightly.' },
  { name: 'Mycelium Lantern', material: 'Glowing fungus', color: 0x9ae8b8, form: 'lantern', lore: 'The light is alive and is being paid for in something.' },
  { name: 'Grave Gourd', material: 'Cellar gourd', color: 0xd8c068, form: 'vessel', lore: 'Grown around a lockbox. The gourd won.' },
  { name: 'Hollow Flute', material: 'Reed and root', color: 0xbfa070, form: 'instrument', lore: 'One note, very low. The roots lean towards it.' },
  { name: 'Taproot Seal', material: 'Heartwood', color: 0x7a5a30, form: 'seal', lore: 'Pressed on the deed. The deed is now part of the tree.' },
  { name: 'The Taproot Reliquary', material: 'Living wood', color: 0x8fd870, form: 'core', lore: 'The vault has roots. They go down past this floor, and they are drinking.' },
];

const FROST: FloorRelic[] = [
  { name: 'Rime Flake', material: 'Hoarfrost', color: 0xe8f4ff, form: 'shard', lore: 'Weighs nothing. Counts for something.' },
  { name: 'Ice Decanter', material: 'Black ice', color: 0xbfe0f4, form: 'vessel', lore: 'Pours slower the longer you are owed.' },
  { name: 'Frozen Clerk', material: 'Ice and wool', color: 0xd0e4f0, form: 'effigy', lore: 'Mid-sentence, mid-column, mid-career.' },
  { name: 'Frost Mask', material: 'Clear ice', color: 0xcfeaff, form: 'mask', lore: 'Wear it and your breath stops fogging the page.' },
  { name: 'Winter Hound', material: 'Rime and sinew', color: 0xa8d0e8, form: 'creature', lore: 'It collects. It has never once been called off.' },
  { name: 'Cold Lamp', material: 'Blue ice', color: 0x8fd0ff, form: 'lantern', lore: 'Sheds no warmth, so nothing in the ledger thaws.' },
  { name: 'Tally Harp', material: 'Ice and gut', color: 0xbfd8f0, form: 'instrument', lore: 'One string per debt. It is not a small instrument.' },
  { name: 'Arrears Seal', material: 'Frozen wax', color: 0x7fb8e0, form: 'seal', lore: 'Stamped on everything overdue. Everything down here is overdue.' },
  { name: 'The Debt in Ice', material: 'Frozen ink', color: 0x5fd8ff, form: 'book', lore: 'Itemised, dated, and signed at the top in a hand you have seen on the hints.' },
];

const CLOCKWORKS: FloorRelic[] = [
  { name: 'Loose Cog', material: 'Brass', color: 0xe0b060, form: 'shard', lore: 'Fell out of something that is somehow still running.' },
  { name: 'Spring Cask', material: 'Steel and brass', color: 0xd0a850, form: 'vessel', lore: 'Wound tight. Holds four hours of somebody\'s afternoon.' },
  { name: 'Automaton Boy', material: 'Brass and enamel', color: 0xf0c878, form: 'effigy', lore: 'Built to carry the ledger. Has carried it a long way.' },
  { name: 'Escapement Mask', material: 'Polished brass', color: 0xe8c070, form: 'mask', lore: 'Ticks when you speak. Counts what you said.' },
  { name: 'Clockwork Magpie', material: 'Brass and glass', color: 0xffd888, form: 'creature', lore: 'Steals the smallest bright thing, every ninety seconds, for ever.' },
  { name: 'Hour Lantern', material: 'Brass and oil', color: 0xffc060, form: 'lantern', lore: 'Burns exactly one hour of light per hour. Nobody profits.' },
  { name: 'Interest Engine', material: 'Steel', color: 0xc9a040, form: 'instrument', lore: 'A very small sound, very often. That is how it adds up.' },
  { name: 'Grand Escapement', material: 'Gold and steel', color: 0xf4d890, form: 'core', lore: 'Sets the pace of the whole vault. It has never been adjusted down.' },
  { name: 'The Hour Unspent', material: 'Stopped brass', color: 0xfff0b0, form: 'core', lore: 'What was borrowed was time. This is the only hour left unclaimed.' },
];

const INK: FloorRelic[] = [
  { name: 'Nib', material: 'Steel', color: 0xbfc8d0, form: 'shard', lore: 'Sharp, stained, and certain.' },
  { name: 'Inkwell', material: 'Glass and iron gall', color: 0x3a3a58, form: 'vessel', lore: 'Bottomless in the boring way: it is simply very deep.' },
  { name: 'Vellum Effigy', material: 'Vellum', color: 0xe8ddc0, form: 'effigy', lore: 'A person, written down at full size, folded twice.' },
  { name: 'Sealing Mask', material: 'Wax', color: 0xc84a4a, form: 'mask', lore: 'Press it on a face and the face becomes official.' },
  { name: 'Marginal Beast', material: 'Ink', color: 0x6a6ab0, form: 'creature', lore: 'Drawn in the margin by a clerk who was bored and is now famous.' },
  { name: 'Reading Lamp', material: 'Brass and vellum', color: 0xffd8a0, form: 'lantern', lore: 'Lights one line at a time, which is how the vault prefers to be read.' },
  { name: 'Clause Harp', material: 'Gut and vellum', color: 0xd8c8a0, form: 'instrument', lore: 'Plucked while reading aloud. It agrees with whoever is louder.' },
  { name: 'Great Seal', material: 'Gold and wax', color: 0xf0c060, form: 'seal', lore: 'Makes a thing true. Has been applied to several lies.' },
  { name: 'The Name of the Vault', material: 'Ink and gold leaf', color: 0xffe89a, form: 'book', lore: 'Its true name, and at the bottom of the page, a signature you will recognise.' },
];

const HOLLOW: FloorRelic[] = [
  { name: 'Absence', material: '—', color: 0x50506a, form: 'shard', lore: 'A shard of nothing. It has weight, which is the problem.' },
  { name: 'Unfilled Vessel', material: '—', color: 0x5a5a78, form: 'vessel', lore: 'Cannot be filled. Has been tried, thoroughly.' },
  { name: 'Nobody', material: '—', color: 0x646484, form: 'effigy', lore: 'Stands where someone should. Everyone nods at it.' },
  { name: 'Unworn Mask', material: '—', color: 0x6e6e90, form: 'mask', lore: 'No face fits. Several have been altered to try.' },
  { name: 'The Quiet Animal', material: '—', color: 0x78789c, form: 'creature', lore: 'It is not hunting. It is waiting, which is worse for the nerves.' },
  { name: 'Unlit Lantern', material: '—', color: 0x8282a8, form: 'lantern', lore: 'It gives dark. You did not know you could be given that.' },
  { name: 'The Rest', material: '—', color: 0x8c8cb4, form: 'instrument', lore: 'A whole instrument for the silence between notes.' },
  { name: 'Unsigned', material: '—', color: 0x9696c0, form: 'seal', lore: 'A seal with no device. Whatever it stamps belongs to no one.' },
  { name: 'The Empty Setting', material: 'Vault-iron', color: 0xd8d8ff, form: 'frame', lore: 'One socket, relic-shaped, at the bottom of everything. It is waiting.' },
];

export const FLOORS: FloorDef[] = [
  { id: 0, chain: 0, name: 'The Antechamber', subtitle: 'Where the vault does its introductions.', color: 0xf4c45a, gen: 'Forge', genBlurb: 'Metal and gold, hammered from nothing.', value: 1, relics: ANTECHAMBER },
  { id: 1, chain: 3, name: 'The Drowned Wing', subtitle: 'The water was let in on purpose.', color: 0x4fe0d8, gen: 'Tide Sluice', genBlurb: 'Open the gate, take what the water brought.', value: 1.6, relics: DROWNED },
  { id: 2, chain: 4, name: 'The Glass Orchard', subtitle: 'Things are grown here, not kept.', color: 0x9fe8a0, gen: 'Grafting Bench', genBlurb: 'Cut, bind, wait. It comes up glass.', value: 2.3, relics: ORCHARD },
  { id: 3, chain: 5, name: 'The Ash Kilns', subtitle: 'Fed with the vault\'s own old relics.', color: 0xff8a3a, gen: 'Kiln Mouth', genBlurb: 'Feed it the old. It hands back the new.', value: 3.2, relics: KILNS },
  { id: 4, chain: 6, name: 'The Mirror Stair', subtitle: 'One to keep, and one to owe.', color: 0xdfe8f0, gen: 'Silvering Trough', genBlurb: 'Dip anything. It comes out with an opinion.', value: 4.3, relics: MIRROR },
  { id: 5, chain: 7, name: 'The Root Cellar', subtitle: 'The vault has roots, and they are drinking.', color: 0x8fd870, gen: 'Root Press', genBlurb: 'Squeeze the cellar. The cellar squeezes back.', value: 5.6, relics: CELLAR },
  { id: 6, chain: 8, name: 'The Frost Ledger', subtitle: 'The debt, itemised and frozen.', color: 0x5fd8ff, gen: 'Rime Frame', genBlurb: 'Leave it out. Cold does the work and takes a cut.', value: 7.2, relics: FROST },
  { id: 7, chain: 9, name: 'The Clockworks', subtitle: 'What was borrowed was time.', color: 0xf4d890, gen: 'Mainspring', genBlurb: 'Wind it. Something, somewhere, is owed the hour.', value: 9.0, relics: CLOCKWORKS },
  { id: 8, chain: 10, name: 'The Ink Vaults', subtitle: 'Where the vault keeps its own name.', color: 0xffe89a, gen: 'Copy Desk', genBlurb: 'Write it down and it exists. That is the whole trick.', value: 11.2, relics: INK },
  { id: 9, chain: 11, name: 'The Hollow Core', subtitle: 'There is one socket left.', color: 0xd8d8ff, gen: 'Hollow', genBlurb: 'Nothing comes out. Take it anyway.', value: 14.0, relics: HOLLOW },
];

export const FLOOR_COUNT = FLOORS.length;
/** The tier that clears a floor when it is ascended. Every floor's ladder is nine deep. */
export const CAPSTONE_TIER = 9;

export const floorDef = (i: number) => FLOORS[Math.max(0, Math.min(FLOOR_COUNT - 1, i))];
/** Which floor a chain belongs to, or -1 for the two chains that run the whole depth (Crypt, Star Well). */
export const floorOfChain = (chain: number) => FLOORS.findIndex((f) => f.chain === chain);
