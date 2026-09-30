/**
 * AB#4712 (the Board, 2026-09-30: "the audio stays playing even when the screen is off … my phone is getting real hot
 * playing it"): what the game spends when nobody is looking at it, or touching it.
 *
 * - In the background (the Android app minimised or the screen off, a hidden browser tab) the game loop sleeps and
 *   the audio is suspended: no frames, no drone. Phaser's own hidden handler only adjusts its clock and leaves the
 *   frame loop to the browser, and an Android WebView behind a stopped activity is not guaranteed to stop it.
 * - In the foreground the game draws at 60 fps while the player is touching it and for IDLE_AFTER_MS after, then at
 *   IDLE_FPS: the vault's idle animations do not need 60, and it roughly halves the work (measured on the idle vault:
 *   74 ms of main-thread work a second at 60, 41 at 30, 11 with the loop asleep).
 */

export const ACTIVE_FPS = 60;
export const IDLE_FPS = 30;
export const IDLE_AFTER_MS = 2500;

/** The parts of Phaser's TimeStep this uses. Its frame limit is bound when the loop starts, hence sleep then wake. */
export interface FrameLoop {
  running: boolean;
  fpsLimit: number;
  hasFpsLimit: boolean;
  _limitRate: number;
  sleep(): void;
  wake(seamless?: boolean): void;
}

export interface BackgroundAudio {
  suspendForBackground(): void;
  resumeFromBackground(): void;
}

/** The frame rate the game should draw at: full while a finger is down or was lately, IDLE_FPS otherwise. */
export function frameRateFor(idleForMs: number, pointerDown: boolean): number {
  return pointerDown || idleForMs < IDLE_AFTER_MS ? ACTIVE_FPS : IDLE_FPS;
}

/** Limit a running loop to `fps` (ACTIVE_FPS or more: no limit). A sleeping loop takes the limit when it wakes. */
export function setFrameLimit(loop: FrameLoop, fps: number) {
  const limited = fps < ACTIVE_FPS;
  loop.hasFpsLimit = limited;
  loop.fpsLimit = limited ? fps : 0;
  loop._limitRate = limited ? 1000 / fps : 0;
  if (loop.running) { loop.sleep(); loop.wake(true); }
}

export class PowerGovernor {
  private lastInput: number;
  private down = false;
  private background = false;
  fps = ACTIVE_FPS;

  constructor(private loop: FrameLoop, private audio: BackgroundAudio, private now: () => number = () => performance.now()) {
    this.lastInput = now();
  }

  get inBackground() { return this.background; }

  /** A pointer went down, moved or came up: back to full rate at once. */
  input(kind: 'down' | 'move' | 'up') {
    this.lastInput = this.now();
    if (kind === 'down') this.down = true;
    if (kind === 'up') this.down = false;
    this.apply(ACTIVE_FPS);
  }

  /** Called every so often: drops to the idle rate once the player has stopped touching the game. */
  tick() {
    this.apply(frameRateFor(this.now() - this.lastInput, this.down));
  }

  /** The game is out of sight: stop drawing and silence it. A second call changes nothing. */
  hide() {
    if (this.background) return;
    this.background = true;
    this.down = false;
    this.loop.sleep();
    this.audio.suspendForBackground();
  }

  /** The game is back: draw at full rate from where it was, and bring the sound back if it was playing. */
  show() {
    if (!this.background) return;
    this.background = false;
    this.lastInput = this.now();
    this.fps = ACTIVE_FPS;
    setFrameLimit(this.loop, ACTIVE_FPS); // asleep, so this only sets the rate wake() binds
    this.loop.wake(true);
    this.audio.resumeFromBackground();
  }

  private apply(fps: number) {
    if (this.background || fps === this.fps) return;
    this.fps = fps;
    setFrameLimit(this.loop, fps);
  }
}

let current: PowerGovernor | null = null;

/** Wire the governor to the page: pointer input, the tab's visibility, and a check every half second. */
export function wirePower(loop: FrameLoop, audio: BackgroundAudio): PowerGovernor {
  const p = (current = new PowerGovernor(loop, audio));
  const opts = { passive: true, capture: true } as const;
  window.addEventListener('pointerdown', () => p.input('down'), opts);
  window.addEventListener('pointermove', () => { if (!p.inBackground) p.input('move'); }, opts);
  window.addEventListener('pointerup', () => p.input('up'), opts);
  window.addEventListener('pointercancel', () => p.input('up'), opts);
  document.addEventListener('visibilitychange', () => (document.hidden ? p.hide() : p.show()));
  window.setInterval(() => p.tick(), 500);
  return p;
}

/** The Android app's lifecycle (nativeApp.ts): the same as a hidden or shown tab. */
export function appBackgrounded() { current?.hide(); }
export function appForegrounded() { current?.show(); }
