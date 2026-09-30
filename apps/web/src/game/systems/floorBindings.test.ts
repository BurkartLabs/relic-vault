import { describe, it, expect } from 'vitest';
import { createState, type GameState } from './State';
import { bindingFor } from './Floors';
import { merge } from './MergeSystem';
import { bindingReady } from './BoardSystem';
import { buyStandIn } from './PowerUps';
import { mulberry32 } from './Rng';
import { BINDINGS, ITEMS } from '../data/items';

// AB#4712, the Board, 2026-09-30: "when you go down a level, the requirements … remain the same. So even though we have
// a coral mask now … it still wants a gold mask to upgrade those two blue canister thingy majiggers."
const rng = () => mulberry32(4712);
const CANOPIC_JAR = 14, WRAITH_LANTERN = 15, GOLD_MASK = 4, CORAL_DIADEM = 34, LICH_PHYLACTERY = 17, SAPPHIRE_HEART = 6;

function drownedWing(): GameState {
  const s = createState();
  s.floor = 1; // the Drowned Wing: its ladder is chain 3
  s.board.fill(0);
  return s;
}

describe('bindings follow the floor (AB#4712)', () => {
  it('a Forge binding is the same tier of the floor’s own ladder below the Antechamber', () => {
    expect(ITEMS[CORAL_DIADEM].name).toBe('Coral Diadem');
    expect(bindingFor(createState(), WRAITH_LANTERN)).toBe(GOLD_MASK); // the Antechamber is unchanged
    const s = drownedWing();
    expect(bindingFor(s, WRAITH_LANTERN)).toBe(CORAL_DIADEM);
    expect(bindingFor(s, LICH_PHYLACTERY)).toBe(36); // the Sapphire Heart's tier 6, on this floor
    expect(BINDINGS[LICH_PHYLACTERY]).toBe(SAPPHIRE_HEART);
    // a Crypt or Star Well binding runs every floor and does not change
    expect(bindingFor(s, 37)).toBe(BINDINGS[37]);
    expect(bindingFor(s, CANOPIC_JAR)).toBeUndefined();
  });

  it('two Canopic Jars and a Coral Diadem make a Wraith Lantern on the Drowned Wing', () => {
    const s = drownedWing();
    s.board[0] = CANOPIC_JAR; s.board[1] = CANOPIC_JAR; s.board[5] = CORAL_DIADEM;
    expect(bindingReady(s, CANOPIC_JAR, 0, 1)).toBe(true);
    const r = merge(s, 0, 1, rng());
    expect(r.ok).toBe(true);
    expect(s.board[1]).toBe(WRAITH_LANTERN);
    expect(s.board[5]).toBe(0); // the binding is consumed
  });

  it('without it the merge asks for the Coral Diadem, not a Gold Mask', () => {
    const s = drownedWing();
    s.board[0] = CANOPIC_JAR; s.board[1] = CANOPIC_JAR;
    expect(bindingReady(s, CANOPIC_JAR, 0, 1)).toBe(false);
    expect(merge(s, 0, 1, rng())).toMatchObject({ ok: false, reason: 'binding', binding: CORAL_DIADEM });
  });

  it('a Gold Mask brought down from the Antechamber still counts', () => {
    const s = drownedWing();
    s.board[0] = CANOPIC_JAR; s.board[1] = CANOPIC_JAR; s.board[7] = GOLD_MASK;
    expect(merge(s, 0, 1, rng()).ok).toBe(true);
    expect(s.board[7]).toBe(0);
  });

  it('a Coral Diadem Stand-in can be bought and completes the merge', () => {
    const s = drownedWing();
    s.gems = 10_000;
    expect(buyStandIn(s, CORAL_DIADEM)).toBe(true);
    s.board[0] = CANOPIC_JAR; s.board[1] = CANOPIC_JAR;
    const r = merge(s, 0, 1, rng());
    expect(r).toMatchObject({ ok: true, standIn: CORAL_DIADEM });
    expect(s.powerUps.standIn[CORAL_DIADEM] ?? 0).toBe(0);
  });
});
