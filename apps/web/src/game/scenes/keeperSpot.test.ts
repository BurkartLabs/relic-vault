import { describe, it, expect } from 'vitest';
import { keeperSpot, KEEPER_BOX, COMPACT_SCALE, type KeeperFrame } from './keeperSpot';

// Bug #4892: the Keeper covered the bottom-left socket. These are the three screens measured in the running game
// (design space; the board's sockets span boardLeft..boardLeft+900 and boardTop..boardTop+900).
const frame = (o: Partial<KeeperFrame>): KeeperFrame => ({ boardLeft: 90, boardTop: 574, cell: 150, rows: 6, daisPad: 42, hudBottom: 277, ordersTop: 259, ...o });
const PHONE_9_16 = frame({});                                             // 360x640: no band, a 90px gutter
const PHONE_TALL = frame({ boardTop: 783, ordersTop: 468 });              // 412x892: a 191px band under the HUD
const TABLET = frame({ boardLeft: 270, hudBottom: 277, ordersTop: 259 }); // 768x1024: a 270px gutter

/** The portrait's box at a spot, and whether it overlaps any socket (more than `slack` px into one). */
function box(s: ReturnType<typeof keeperSpot>) {
  const w = KEEPER_BOX.w * s.scale, h = KEEPER_BOX.h * s.scale;
  return { left: s.x - w / 2, right: s.x + w / 2, top: s.y - h / 2, bottom: s.y + h / 2 };
}
function intoSockets(f: KeeperFrame, s: ReturnType<typeof keeperSpot>) {
  const b = box(s);
  const dx = Math.min(b.right, f.boardLeft + 6 * f.cell) - Math.max(b.left, f.boardLeft);
  const dy = Math.min(b.bottom, f.boardTop + f.rows * f.cell) - Math.max(b.top, f.boardTop);
  return dx > 0 && dy > 0 ? Math.min(dx, dy) : 0;
}

describe('the Keeper sits clear of the board (Bug #4892)', () => {
  it('on a tall phone, in the band under the HUD, full size, clear of the sockets and the orders', () => {
    const s = keeperSpot(PHONE_TALL);
    expect(s).toMatchObject({ where: 'band', scale: 1 });
    expect(intoSockets(PHONE_TALL, s)).toBe(0);
    expect(box(s).bottom).toBeLessThanOrEqual(PHONE_TALL.ordersTop + 5);
    expect(box(s).left).toBeGreaterThanOrEqual(0);
  });

  it('on a tablet, beside the board in the gutter, full size', () => {
    const s = keeperSpot(TABLET);
    expect(s).toMatchObject({ where: 'gutter', scale: 1 });
    expect(intoSockets(TABLET, s)).toBe(0);
    expect(box(s).right).toBeLessThanOrEqual(TABLET.boardLeft - TABLET.daisPad);
    expect(box(s).left).toBeGreaterThanOrEqual(0);
  });

  it('on a strict 9:16 phone, with no room anywhere, smaller on the frame and at most a sliver into a socket', () => {
    const s = keeperSpot(PHONE_9_16);
    expect(s).toMatchObject({ where: 'frame', scale: COMPACT_SCALE });
    expect(intoSockets(PHONE_9_16, s)).toBeLessThanOrEqual(10); // the old spot covered 113 px of 150 at 412x892
    expect(box(s).left).toBeGreaterThanOrEqual(0);
  });

  it('the old fixed spot covered the socket on all three, which is what these replace', () => {
    for (const f of [PHONE_9_16, PHONE_TALL, TABLET]) {
      const old = { x: f.boardLeft + 28, y: f.boardTop + 804, scale: 1, where: 'band' as const }; // ox + 118, my + FORGE_Y - 250
      expect(intoSockets(f, old)).toBeGreaterThan(100);
    }
  });
});
