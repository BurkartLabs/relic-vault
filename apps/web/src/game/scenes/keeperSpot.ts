/**
 * Bug #4892: where the Keeper's portrait sits. It was placed at a fixed offset that, in the scene's 1080-wide design
 * space, put its centre inside the bottom-left socket on every screen, so it covered a relic and took its taps. The
 * board fills the width of a phone, so there is no one place clear of it everywhere; this picks, in order:
 *
 *   1. beside the board, in the left gutter, when the screen is wide enough for the portrait there (tablets);
 *   2. in the band between the HUD and the orders, when the screen is tall enough for it there (most phones: 9:19 and
 *      taller have a band ~190 design px high);
 *   3. otherwise (a strict 9:16 screen, with neither), smaller, on the dais frame's left edge, clear of every socket
 *      but a sliver.
 *
 * Pure: design-space numbers in, a position and a scale out, so it is tested without Phaser.
 */
export interface KeeperFrame {
  /** The board's left edge x (its first column's left), and its first row's top y. */
  boardLeft: number; boardTop: number;
  /** One socket's size, and the board's rows. */
  cell: number; rows: number;
  /** The dais frame's padding around the sockets. */
  daisPad: number;
  /** Where the HUD ends and the orders row begins, as the scene has built them. */
  hudBottom: number; ordersTop: number;
}
export interface KeeperSpot { x: number; y: number; scale: number; where: 'gutter' | 'band' | 'frame' }

/** The portrait's box at scale 1: its hit area (170 x 210, the medallion and the floor label under it). */
export const KEEPER_BOX = { w: 170, h: 210 };
/** The room a full-size portrait needs, with a margin. */
const ROOM = 180;
export const COMPACT_SCALE = 0.55;

export function keeperSpot(f: KeeperFrame): KeeperSpot {
  const gutter = f.boardLeft - f.daisPad; // clear screen left of the dais frame
  const bottomRowY = f.boardTop + (f.rows - 0.5) * f.cell;
  if (gutter >= ROOM) return { x: gutter / 2, y: bottomRowY, scale: 1, where: 'gutter' };
  const band = f.ordersTop - f.hudBottom;
  if (band >= ROOM) {
    // the medallion's centre sits a little above the middle: its floor label hangs below it
    return { x: f.boardLeft + 28, y: f.hudBottom + band / 2 - 8, scale: 1, where: 'band' };
  }
  return { x: f.boardLeft - f.daisPad / 2 - 20, y: bottomRowY, scale: COMPACT_SCALE, where: 'frame' };
}
