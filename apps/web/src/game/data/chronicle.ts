import { ECON, type Reward } from './catalog';
import { FLOORS } from './floors';

/**
 * The Keeper's Chronicle (docs/STORY.md): three main quests per floor, thirty in all, strictly in order, each
 * ending in a beat of story. The three beats of a floor are that floor's chapter.
 *
 * Two rules are structural rather than editorial, and the tests check both:
 *
 * 1. **Nothing here is gated behind a purchase or a random drop.** Every goal is something the player can decide
 *    to do — forge, merge, deliver, bind, ascend. No "open three chests and hope", because the story is the
 *    reason to keep playing and selling it would be selling the game twice (RV-D5's original constraint).
 * 2. **Progress is derived, never stored.** A quest reads counters the game already keeps, so the save carries
 *    only which quests have been claimed and a quest can never disagree with what the player actually did.
 */

/** The counters a quest may read. Per-floor, reset when you descend or restore. */
export type FloorCounter = 'forges' | 'merges' | 'orders' | 'bindings';

export interface MainQuest {
  /** stable id: floor * 3 + position */
  id: number;
  floor: number;
  label: string;
  goal: number;
  /**
   * `counter` counts actions on this floor; `tier` wants the floor's ladder taken to a tier; `capstone` wants
   * the floor cleared. Three kinds is enough, and each one is a thing a player can choose to do.
   */
  kind: { type: 'counter'; counter: FloorCounter } | { type: 'tier' } | { type: 'capstone' };
  rewards: Reward[];
  /** what the Keeper says when it is claimed */
  beat: string;
}

/** Scaled by depth so a floor-8 errand is not paid floor-1 money. */
const gold = (floor: number, n: number): Reward => ({ kind: 'gold', n: Math.round(n * FLOORS[floor].value) });
const gems = (n: number): Reward => ({ kind: 'gems', n });

/**
 * Three per floor, in order: settle in, use the vault, then clear the floor. The third is always the capstone,
 * so the chapter closes on the biggest thing the player does down there.
 */
const FLOOR_QUESTS: { label: string; goal: number; kind: MainQuest['kind']; rewards: (f: number) => Reward[]; beat: string }[][] = [
  // ---- 1. The Antechamber: he keeps the ledger. He does not own the vault.
  [
    { label: 'Forge 12 relics', goal: 12, kind: { type: 'counter', counter: 'forges' }, rewards: (f) => [gold(f, 400)],
      beat: 'Good. You fuse without being told twice, which puts you ahead of the last four.' },
    { label: 'Raise a relic to tier 5', goal: 5, kind: { type: 'tier' }, rewards: (f) => [gold(f, 1200), gems(10)],
      beat: 'The vault is paying attention to you now. I should say: it pays attention the way a creditor does.' },
    { label: 'Ascend the Living Relic', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(25), { kind: 'chest', n: 1 }],
      beat: 'There. Now I can tell you the first true thing: I keep the ledger here. I do not own the place. Neither, yet, do you.' },
  ],
  // ---- 2. The Drowned Wing: the water was let in on purpose.
  [
    { label: 'Forge 20 relics from the Tide Sluice', goal: 20, kind: { type: 'counter', counter: 'forges' }, rewards: (f) => [gold(f, 600)],
      beat: 'Mind the floor. It is not damp, it is *wet*, and there is a difference of about forty years.' },
    { label: 'Fill 5 patron orders', goal: 5, kind: { type: 'counter', counter: 'orders' }, rewards: (f) => [gold(f, 1500), gems(12)],
      beat: 'They buy salt things gladly. Nobody asks why the salt things are cheap down here.' },
    { label: 'Ascend the Tide Ledger', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(30), { kind: 'card', n: 1 }],
      beat: 'Someone opened the sluice from the inside. On purpose. Something was written on these walls and somebody wanted it washed off.' },
  ],
  // ---- 3. The Glass Orchard: things are grown here.
  [
    { label: 'Merge 40 times', goal: 40, kind: { type: 'counter', counter: 'merges' }, rewards: (f) => [gold(f, 900)],
      beat: 'Careful with the branches. They are load-bearing and they are listening.' },
    { label: 'Raise a relic to tier 7', goal: 7, kind: { type: 'tier' }, rewards: (f) => [gold(f, 2600), gems(15)],
      beat: 'You noticed the fruit is older than the tree. Most keepers do not, and most keepers are happier.' },
    { label: 'Ascend the Sap Crown', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(35), { kind: 'chest', n: 2 }],
      beat: 'So: the vault does not only keep relics. It grows them. Which raises the question of where the first ones came from.' },
  ],
  // ---- 4. The Ash Kilns: nothing here is new.
  [
    { label: 'Complete 3 bindings', goal: 3, kind: { type: 'counter', counter: 'bindings' }, rewards: (f) => [gold(f, 1200)],
      beat: 'The kilns take a binding the way a door takes a key. Do not ask what they are unlocking.' },
    { label: 'Forge 30 relics from the Kiln Mouth', goal: 30, kind: { type: 'counter', counter: 'forges' }, rewards: (f) => [gold(f, 3200), gems(18)],
      beat: 'You have worked out what the fuel is. Say it quietly; the kilns are sentimental.' },
    { label: 'Ascend the Kiln Heart', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(40), { kind: 'relic', tier: 6 }],
      beat: 'Every relic here was another relic first. Nothing has been made in this vault for a very long time. It is all the same gold, going round.' },
  ],
  // ---- 5. The Mirror Stair: there have always been two.
  [
    { label: 'Merge 60 times', goal: 60, kind: { type: 'counter', counter: 'merges' }, rewards: (f) => [gold(f, 2000)],
      beat: 'Do not greet anything on the stair. It will greet you back, and then you are in a conversation.' },
    { label: 'Fill 8 patron orders', goal: 8, kind: { type: 'counter', counter: 'orders' }, rewards: (f) => [gold(f, 5000), gems(20)],
      beat: 'The patrons on this floor pay in exact change. Every time. I have stopped finding it charming.' },
    { label: 'Ascend the Second Keeper', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(50), { kind: 'chest', n: 2 }, { kind: 'card', n: 1 }],
      beat: 'You have met him, then. There are always two of us: one to keep the vault, and one to owe it. I have been both, and I would rather be the first.' },
  ],
  // ---- 6. The Root Cellar: the vault is drinking from something.
  [
    { label: 'Forge 40 relics from the Root Press', goal: 40, kind: { type: 'counter', counter: 'forges' }, rewards: (f) => [gold(f, 3000)],
      beat: 'The roots move when the board is full. I have never decided whether that is helpful.' },
    { label: 'Complete 6 bindings', goal: 6, kind: { type: 'counter', counter: 'bindings' }, rewards: (f) => [gold(f, 8000), gems(22)],
      beat: 'Bone and starlight, down here in the wet. The cellar takes both and asks for a third thing it will not name.' },
    { label: 'Ascend the Taproot Reliquary', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(60), { kind: 'relic', tier: 7 }],
      beat: 'It has roots. It is drinking. And it has been drinking for longer than there have been keepers to notice.' },
  ],
  // ---- 7. The Frost Ledger: the debt, itemised.
  [
    { label: 'Raise a relic to tier 6', goal: 6, kind: { type: 'tier' }, rewards: (f) => [gold(f, 4000)],
      beat: 'Cold keeps a number honest. That is the only reason this floor is cold.' },
    { label: 'Merge 90 times', goal: 90, kind: { type: 'counter', counter: 'merges' }, rewards: (f) => [gold(f, 12000), gems(25)],
      beat: 'Every merge you make is entered somewhere on this floor, in a column I am not allowed to read to you.' },
    { label: 'Ascend the Debt in Ice', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(75), { kind: 'chest', n: 3 }],
      beat: 'Itemised. Dated. Signed at the top in a hand you have been reading since the day you arrived. Mine.' },
  ],
  // ---- 8. The Clockworks: what was borrowed was time.
  [
    { label: 'Forge 50 relics from the Mainspring', goal: 50, kind: { type: 'counter', counter: 'forges' }, rewards: (f) => [gold(f, 6000)],
      beat: 'Wind it and something far away is charged for the winding. Not you. Not yet.' },
    { label: 'Fill 12 patron orders', goal: 12, kind: { type: 'counter', counter: 'orders' }, rewards: (f) => [gold(f, 18000), gems(30)],
      beat: 'They are punctual here in a way that is not politeness. They are punctual the way a bill is.' },
    { label: 'Ascend the Hour Unspent', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(90), { kind: 'relic', tier: 8 }],
      beat: 'It was never gold I borrowed. It was time, and the interest has been running since before the water came in.' },
  ],
  // ---- 9. The Ink Vaults: whose signature is at the bottom.
  [
    { label: 'Complete 10 bindings', goal: 10, kind: { type: 'counter', counter: 'bindings' }, rewards: (f) => [gold(f, 9000)],
      beat: 'Wax, gut and vellum. Everything on this floor was made to make something else official.' },
    { label: 'Raise a relic to tier 8', goal: 8, kind: { type: 'tier' }, rewards: (f) => [gold(f, 26000), gems(35)],
      beat: 'You write a good hand, for a fuser. The desk has noticed. The desk notices everything and files it.' },
    { label: 'Ascend the Name of the Vault', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(110), { kind: 'chest', n: 3 }, { kind: 'card', n: 1 }],
      beat: 'There it is: its true name, and at the foot of the page, the signature of whoever fuses. It has your hand. It has always had your hand.' },
  ],
  // ---- 10. The Hollow Core: one socket left.
  [
    { label: 'Merge 120 times', goal: 120, kind: { type: 'counter', counter: 'merges' }, rewards: (f) => [gold(f, 20000)],
      beat: 'Nothing comes out of the Hollow. Take it anyway; it counts, and I have stopped arguing with the arithmetic.' },
    { label: 'Fill 15 patron orders', goal: 15, kind: { type: 'counter', counter: 'orders' }, rewards: (f) => [gold(f, 50000), gems(40)],
      beat: 'No patron has ever come down this far. They send the orders anyway. Somebody is filling them at the other end.' },
    { label: 'Ascend the Empty Setting', goal: 1, kind: { type: 'capstone' }, rewards: (f) => [gems(150), { kind: 'relic', tier: 9 }],
      beat: 'One socket, relic-shaped, at the bottom of everything. Set something in it and the post is yours, debt and all. Leave it empty and we go round again, which I would not hold against you. Either way: you fused better than I did.' },
  ],
];

export const MAIN_QUESTS: MainQuest[] = FLOOR_QUESTS.flatMap((qs, floor) =>
  qs.map((q, n): MainQuest => ({
    id: floor * 3 + n, floor, label: q.label, goal: q.goal, kind: q.kind, rewards: q.rewards(floor), beat: q.beat,
  })),
);

export const mainQuestsOnFloor = (floor: number) => MAIN_QUESTS.filter((q) => q.floor === floor);
export const MAIN_PER_FLOOR = 3;

// ---------------------------------------------------------------- errands (side quests)

/**
 * Errands come from the patrons the game already has. A patron *order* wants a relic right now; an errand wants
 * a small run of play and pays for it. Two are open at a time, they never expire on a clock, and swapping one is
 * free — the cost of changing your mind is the progress you had, not a wait.
 *
 * They pay in currency and never in story: the main line is where the Keeper's secret lives.
 */
export interface ErrandDef {
  patron: number;
  label: (n: number) => string;
  counter: FloorCounter;
  /** goal at floor 1; deeper floors ask for a little more */
  base: number;
  pay: (floor: number, goal: number) => Reward[];
}

/**
 * What an errand pays, derived from the daily quest reward the Board has already balanced (`ECON.questGold`)
 * rather than from numbers invented here.
 *
 * The first draft paid 300-700 gold *per item asked for*, which on floor 1 was two orders of magnitude over
 * what the work is worth: an early patron order pays single-digit gold, so "fill 5 orders" would have handed
 * out 2,000 and flattened the early economy. Anchoring on a constant that is already tuned means an errand
 * cannot drift away from the rest of the game without that constant moving too (T-003).
 */
const errandGold = (f: number, weight: number) => gold(f, Math.round(ECON.questGold * weight));

export const ERRANDS: ErrandDef[] = [
  { patron: 0, counter: 'orders', base: 3, label: (n) => `Fill ${n} patron orders for Marisol`,
    pay: (f) => [errandGold(f, 1.5), gems(2)] },
  { patron: 1, counter: 'bindings', base: 2, label: (n) => `Complete ${n} bindings for Brother Cask`,
    pay: (f) => [errandGold(f, 1.6), { kind: 'crumb', n: 1 }] },
  { patron: 2, counter: 'merges', base: 25, label: (n) => `Merge ${n} times for Lady Venn`,
    pay: (f) => [errandGold(f, 1), gems(3)] },
  { patron: 3, counter: 'forges', base: 20, label: (n) => `Forge ${n} relics for Ilse`,
    pay: (f) => [errandGold(f, 1), gems(2)] },
  { patron: 4, counter: 'orders', base: 5, label: (n) => `Fill ${n} orders for Captain Ossery`,
    pay: (f) => [errandGold(f, 2), { kind: 'chest', n: 1 }] },
  { patron: 5, counter: 'merges', base: 40, label: (n) => `Merge ${n} times for the Tin Prophet`,
    pay: (f) => [errandGold(f, 1.4), gems(4)] },
];

export const ERRAND_SLOTS = 2;
/** Twenty-five errands filled earns a title. Earned, never sold — the rule every title in this game follows. */
export const ERRAND_TITLE_AT = 25;

/** What an errand asks for on a given floor: deeper floors ask for more, and pay more for it. */
export const errandGoal = (def: ErrandDef, floor: number) => Math.round(def.base * (1 + floor * 0.35));
