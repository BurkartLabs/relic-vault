/**
 * AB#4728: what Android's back button does, decided from what is on screen, topmost first.
 *
 * The age gate (a DOM layer over the whole game) is a first screen with nothing to lose: back leaves the app, as on any
 * Android first screen. An ad veil sits above every sheet (depth 500): back presses its skip once the skip is offered,
 * the same path as tapping it, and does nothing before that, because closing a rewarded ad early would forfeit what it
 * grants. A sheet (only one is ever open: VaultScene.openModal replaces the last) takes its own way back: close(), the path
 * its X and the dimmer use, or, for a sheet opened from another (odds from the shop), its BACK button (Modal.onBack). On the bare vault the first back warns, and a second within EXIT_WINDOW_MS leaves.
 */
export type BackAction = 'exit' | 'hold' | 'skip-ad' | 'close-sheet' | 'warn';

export interface BackView {
  /** The age gate is on screen. */
  ageGate: boolean;
  /** The vault scene exists (false while the game is still loading). */
  ready: boolean;
  /** An ad veil is showing: 'skippable' once its skip is offered, 'playing' before. */
  adVeil: 'skippable' | 'playing' | null;
  /** A sheet (shop, settings, an offer, odds, album, ...) is open. */
  sheet: boolean;
}

export const EXIT_WINDOW_MS = 2000;
export const EXIT_WARNING = 'Press back again to leave the vault';

/** The action for one press of back. `lastWarnAt` is when the bare vault last warned (null if it has not). */
export function resolveBack(view: BackView, lastWarnAt: number | null, now: number): BackAction {
  if (view.ageGate || !view.ready) return 'exit';
  if (view.adVeil) return view.adVeil === 'skippable' ? 'skip-ad' : 'hold';
  if (view.sheet) return 'close-sheet';
  return lastWarnAt !== null && now - lastWarnAt <= EXIT_WINDOW_MS ? 'exit' : 'warn';
}

export interface BackDeps {
  now(): number;
  view(): BackView;
  closeSheet(): void;
  skipAd(): void;
  warn(): void;
  exit(): void;
}

/** One press of back, carried out. The bare vault's warning only counts for the press straight after it. */
export function createBackHandler(d: BackDeps): () => BackAction {
  let lastWarnAt: number | null = null;
  return () => {
    const now = d.now();
    const action = resolveBack(d.view(), lastWarnAt, now);
    lastWarnAt = action === 'warn' ? now : null;
    if (action === 'warn') d.warn();
    else if (action === 'close-sheet') d.closeSheet();
    else if (action === 'skip-ad') d.skipAd();
    else if (action === 'exit') d.exit();
    return action;
  };
}
