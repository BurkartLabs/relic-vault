/**
 * The forge row's three labels share one line: the floor's generator in the middle, the Crypt and the Stars either
 * side. The middle one is the floor's own name, and some are long ("SILVERING TROUGH" ran into both neighbours,
 * Bug #4897), so it is scaled down to the room between them. Pure, so a unit test can hold the rule.
 */
/** the generators' centres in design px: the floor's own, then the Crypt Brazier and the Star Well */
export const FORGE_X = [540, 322, 758] as const;
/** half the width of "CRYPT" or "STARS" at the 28 px they are drawn at, with a little over */
const NEIGHBOUR_HALF = 56;
const GAP = 12;
/** the widest the floor's label may be before it reaches a neighbour's */
export const FLOOR_LABEL_MAX = 2 * (FORGE_X[0] - FORGE_X[1] - NEIGHBOUR_HALF - GAP);

/** the scale that fits a label `width` px wide into `max`; 1 when it already fits */
export function fitScale(width: number, max = FLOOR_LABEL_MAX): number {
  return width > max ? max / width : 1;
}
