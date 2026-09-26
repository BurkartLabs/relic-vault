// Bug #2036: where the Keeper's line and its "tap to continue" hint sit in the KeeperDialog. The line was drawn centred
// at a fixed y and the hint at another, so a line that wrapped to six lines ran over the hint. The hint now sits below
// the line's measured height; a line too tall to start at its usual place starts at the top of the box instead of
// growing upwards off it. No Phaser here, so the arithmetic is tested on its own (keeperLayout.test.ts).

export interface KeeperLayoutOpts { boxH?: number; msgY?: number; hintY?: number; gap?: number; pad?: number }

/** Centre y of the line and of the hint, for a line `msgH` tall and a hint `hintH` tall; `fits` is false when the
 *  hint would reach past the box's padding, and the caller should set the line smaller. */
export function keeperLayout(msgH: number, hintH: number, o: KeeperLayoutOpts = {}) {
  const { boxH = 560, msgY = -60, hintY = 140, gap = 24, pad = 36 } = o;
  const top = -boxH / 2 + pad;
  const bottom = boxH / 2 - pad;
  const msg = msgY - msgH / 2 < top ? top + msgH / 2 : msgY;
  const hint = Math.max(hintY, msg + msgH / 2 + gap + hintH / 2);
  return { msgY: msg, hintY: hint, fits: hint + hintH / 2 <= bottom };
}
