/**
 * AB#444 slice 4: the timings of the descent (FloorTransition.ts plays them). Pure, so the rules are tested without a
 * renderer: a descent is 2.5 to 3.5 s; a restore is shorter and never drops; reduced motion is a fade with the floor
 * name and no movement; any of them may be skipped from 1.2 s (as the ad veil is); none holds input past 4 s.
 *
 * Times are milliseconds from the tap. `swapAt` is when the old vault is restarted under a closed veil; everything
 * after `swapAt` is measured from the moment the new vault reports ready (its restart takes a frame or two), so the
 * cut is never seen and the total stays inside the budget.
 */
export type TransitionKind = 'descend' | 'restore';

export interface TransitionPlan {
  /** the recorded relics lift off the board and sink into the Reliquary */
  lift: number;
  /** the vault darkens; for a descent the camera also falls through the floor */
  close: number;
  drop: boolean;
  /** when the old scene is restarted, under a fully closed veil (lift and close overlap) */
  swapAt: number;
  /** after ready: the new floor's colour and background rise to meet the camera */
  reveal: number;
  /** after the reveal: the generator row builds in */
  build: number;
  /** the whole sequence, tap to hand-back, assuming the restart is ready at once */
  total: number;
}

export const SKIP_AFTER_MS = 1200;
/** The transition never holds input past this, ready or not (the e2e holds it to 4 s). */
export const INPUT_CAP_MS = 3900;

export function transitionPlan(kind: TransitionKind, reducedMotion: boolean): TransitionPlan {
  if (reducedMotion) {
    // a fade to the floor's colour with its name, the swap under it, and a fade back: no lift, no drop, no build
    const close = 550, reveal = 900;
    return { lift: 0, close, drop: false, swapAt: close, reveal, build: 0, total: close + reveal };
  }
  if (kind === 'restore') {
    // the same sequence, shorter, and the vault stays where it is: this floor again, not a floor below
    const lift = 600, close = 450, reveal = 600, build = 350;
    const swapAt = lift + close - 150;
    return { lift, close, drop: false, swapAt, reveal, build, total: swapAt + reveal + build };
  }
  const lift = 850, close = 800, reveal = 900, build = 450;
  const swapAt = lift + close - 150;
  return { lift, close, drop: true, swapAt, reveal, build, total: swapAt + reveal + build };
}

/** Whether the player may skip, `elapsed` ms after the tap. */
export const skippable = (elapsed: number) => elapsed >= SKIP_AFTER_MS;

/** Whether the user asks for reduced motion (the OS setting, read through the browser). */
export function prefersReducedMotion(win: { matchMedia?: (q: string) => { matches: boolean } } | undefined = globalThis as any): boolean {
  try { return !!win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
