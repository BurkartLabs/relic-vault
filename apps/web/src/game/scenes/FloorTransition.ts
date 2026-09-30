import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { txt } from '../ui/kit';
import type { VaultScene } from './VaultScene';
import type { FloorDef as Floor } from '../data/floors';
import { INPUT_CAP_MS, prefersReducedMotion, skippable, transitionPlan, type TransitionKind, type TransitionPlan } from './transitionPlan';

/**
 * AB#444 slice 4: descending is a transition, not a cut (docs/specs/444-..., acceptance 5). A scene launched over the
 * vault that owns the whole sequence: the relics being recorded lift off the board and sink into the Reliquary (the
 * Keeper's seal, where the Chronicle lives), the vault darkens and drops (the camera falls through the floor), the
 * new floor's colour and background rise to meet it, and the generator row builds in.
 *
 * The vault is restarted *under* this scene, behind a fully closed veil (`swap`), and the veil only opens once the
 * new vault reports ready ('vault-ready'), so the restart is never seen. The scene blocks input while it plays, which
 * is never longer than INPUT_CAP_MS; from SKIP_AFTER_MS it can be skipped by its button or by Android's back, the same
 * way as the ad veil. Reduced motion (the OS setting) plays a fade with the floor name instead, and a restore plays a
 * shorter sequence without the drop (transitionPlan.ts).
 */
export interface TransitionRequest {
  kind: TransitionKind;
  /** the item ids the Reliquary recorded: those relics sink into it; the rest of the board fades */
  recorded: number[];
  /** the floor being arrived on */
  floor: Floor;
  /** restarts the vault on the new floor; called once, under the closed veil */
  swap: () => void;
  /** the new vault, once the transition has handed it back */
  onArrive?: (vault: VaultScene) => void;
}

const DARK = 0x07060b;

export class FloorTransition extends Phaser.Scene {
  /** the transition on screen, if any: for Android's back (nativeApp.ts) and the browser tests */
  static current: FloorTransition | null = null;

  private req!: TransitionRequest;
  private plan!: TransitionPlan;
  private startedAt = 0;
  private swapped = false;
  private arrived = false;
  private finished = false;
  private veil!: Phaser.GameObjects.Rectangle;
  private streaks: Phaser.GameObjects.Rectangle[] = [];
  private skipBtn?: Phaser.GameObjects.Container;
  private title?: Phaser.GameObjects.Text;
  private capTimer?: Phaser.Time.TimerEvent;
  private swapTimer?: Phaser.Time.TimerEvent;
  /** read by the browser tests: what happened when, and the board the new vault came up with */
  readonly trace: { phase: string; at: number }[] = [];
  boardAtArrival: number[] | null = null;

  constructor() { super('FloorTransition'); }

  /** Launch the transition over `vault`. */
  static play(vault: VaultScene, req: TransitionRequest) {
    vault.scene.launch('FloorTransition', req);
    vault.scene.bringToTop('FloorTransition');
  }

  get reducedMotion() { return prefersReducedMotion(); }

  /** Back, as the skip button: skips once the skip is offered; before that it is held (as AdVeil.back). */
  back(): boolean {
    if (!skippable(performance.now() - this.startedAt) || this.finished) return false;
    this.skip();
    return true;
  }
  get backState(): 'skippable' | 'playing' { return skippable(performance.now() - this.startedAt) ? 'skippable' : 'playing'; }

  private vault(): VaultScene { return this.scene.get('Vault') as VaultScene; }
  private mark(phase: string) { this.trace.push({ phase, at: Math.round(performance.now() - this.startedAt) }); }

  create(req: TransitionRequest) {
    this.req = req;
    this.plan = transitionPlan(req.kind, this.reducedMotion);
    this.startedAt = performance.now();
    this.swapped = this.arrived = this.finished = false;
    this.trace.length = 0;
    this.boardAtArrival = null;
    this.streaks = [];
    FloorTransition.current = this;
    (window as any).__transition = this; // beside __vault and __rv: the browser tests read the trace
    this.mark(this.reducedMotion ? 'start:reduced' : `start:${req.kind}`);
    const W = this.scale.width, H = this.scale.height;

    // input stops at this scene for as long as it plays: the vault underneath is being taken apart
    this.add.zone(0, 0, W, H).setOrigin(0).setInteractive();
    this.veil = this.add.rectangle(0, 0, W, H, this.reducedMotion ? req.floor.color : DARK).setOrigin(0).setAlpha(0).setDepth(10);

    const v = this.vault();
    if (this.plan.lift) this.lift(v);
    if (this.plan.drop) this.fall(v, W, H);
    // the vault darkens as it falls (half, so the fall is seen), and the veil shuts only in the last 300 ms: the old
    // vault is swapped out once it is fully shut
    const shut = 300, dim = Math.max(0, this.plan.close - shut);
    if (dim) this.tweens.add({ targets: this.veil, alpha: this.reducedMotion ? 0.85 : 0.5, delay: this.plan.swapAt - this.plan.close, duration: dim, ease: 'Sine.In' });
    this.tweens.add({ targets: this.veil, alpha: 1, delay: this.plan.swapAt - shut, duration: shut, ease: 'Sine.In' });
    if (this.reducedMotion) this.showTitle(W, H, 0);
    ctx.sfx.play('whoosh');
    this.swapTimer = this.time.delayedCall(this.plan.swapAt, () => this.doSwap());

    this.game.events.once('vault-ready', this.onReady, this);
    this.skipBtn = this.buildSkip(W);
    // never hold input past the cap, whatever the restart does
    this.capTimer = this.time.delayedCall(INPUT_CAP_MS, () => { this.mark('cap'); this.skip(); });
    this.events.once('shutdown', () => {
      this.game.events.off('vault-ready', this.onReady, this);
      if (FloorTransition.current === this) FloorTransition.current = null;
    });
  }

  /** The relics lift off the board; the recorded ones sink into the Reliquary, the others fade. */
  private lift(v: VaultScene) {
    const seal = v.keeperBtn ? { x: v.keeperBtn.x, y: v.keeperBtn.y } : { x: this.scale.width / 2, y: 140 };
    const recorded = new Set(this.req.recorded);
    let n = 0;
    for (const r of v.relics) {
      if (!r) continue;
      const parts = [r.spr, r.shadow, r.glow, r.gild, r.iris].filter(Boolean) as Phaser.GameObjects.Image[];
      // on the vault's own tweens: its idle bob leaves a relic alone only while the vault is tweening it, and the
      // vault's restart clears them with everything else
      const delay = (n++ % 12) * 18;
      v.tweens.add({ targets: parts, y: '-=46', duration: this.plan.lift * 0.4, ease: 'Sine.Out', delay });
      if (recorded.has(r.tier)) {
        v.tweens.add({ targets: parts, x: seal.x, y: seal.y, scaleX: '*=0.15', scaleY: '*=0.15', alpha: 0.2, delay: this.plan.lift * 0.4 + delay, duration: this.plan.lift * 0.6, ease: 'Cubic.In' });
      } else {
        v.tweens.add({ targets: parts, alpha: 0, delay: this.plan.lift * 0.4, duration: this.plan.lift * 0.5 });
      }
    }
    this.time.delayedCall(this.plan.lift * 0.85, () => ctx.sfx.play('stamp'));
    this.mark('lift');
  }

  /** The vault drops: its viewport slides up as if the camera were falling, with light streaking past. */
  private fall(v: VaultScene, W: number, H: number) {
    const cam = v.cameras.main;
    this.tweens.add({ targets: cam, y: -H * 0.42, delay: this.plan.lift - 150, duration: this.plan.close, ease: 'Cubic.In' });
    for (let i = 0; i < 7; i++) {
      const s = this.add.rectangle(W * (0.1 + 0.8 * Math.random()), H + 40, 3 + Math.random() * 3, H * (0.18 + Math.random() * 0.2), this.req.floor.color, 0.55).setDepth(11).setAlpha(0);
      this.streaks.push(s);
      this.tweens.add({ targets: s, y: -H * 0.4, alpha: { from: 0.7, to: 0 }, delay: this.plan.lift + i * 90, duration: 520, ease: 'Sine.In' });
    }
    this.time.delayedCall(this.plan.lift - 100, () => ctx.sfx.play('whoosh'));
    this.mark('drop');
  }

  private showTitle(W: number, H: number, delay: number) {
    this.title?.destroy();
    this.title = txt(this, W / 2, H / 2, this.req.kind === 'restore' ? `${this.req.floor.name}, again` : this.req.floor.name, { size: 64, weight: '900', gold: true })
      .setDepth(20).setAlpha(0);
    this.tweens.add({ targets: this.title, alpha: 1, delay, duration: 300 });
  }

  /** The old vault goes, under the closed veil. Once. */
  private doSwap() {
    if (this.swapped) return;
    this.swapped = true;
    this.swapTimer?.remove();
    this.tweens.killAll(); // nothing may still be tweening the old vault's relics when it is taken down
    this.veil.setAlpha(1);
    for (const s of this.streaks) s.destroy();
    this.streaks = [];
    const v = this.vault();
    v.cameras.main.y = 0;
    this.mark('swap');
    this.req.swap();
  }

  /** The new vault reports it is built: the board is recorded, then the new floor rises into view. */
  private onReady(vault: VaultScene) {
    if (this.arrived) return;
    this.arrived = true;
    this.boardAtArrival = [...ctx.state.board];
    this.mark('ready');
    if (this.finished) { this.handBack(vault); return; }
    const W = this.scale.width, H = this.scale.height;
    const cam = vault.cameras.main;
    if (this.plan.drop) {
      // the camera is still falling: the new floor comes up from below and meets it
      cam.y = H * 0.3;
      this.tweens.add({ targets: cam, y: 0, duration: this.plan.reveal, ease: 'Cubic.Out' });
      const glow = this.add.rectangle(0, H, W, H * 0.6, this.req.floor.color, 0.35).setOrigin(0, 0).setDepth(9);
      this.tweens.add({ targets: glow, y: -H * 0.6, alpha: 0, duration: this.plan.reveal, ease: 'Sine.Out' });
    }
    if (!this.reducedMotion) this.showTitle(W, H, 0);
    this.tweens.add({ targets: this.veil, alpha: 0, duration: this.plan.reveal, ease: 'Sine.Out' });
    if (this.title) this.tweens.add({ targets: this.title, alpha: 0, delay: this.plan.reveal * 0.6, duration: this.plan.reveal * 0.5 });
    this.time.delayedCall(this.plan.reveal * 0.8, () => ctx.sfx.play('land'));
    if (this.plan.build) this.time.delayedCall(this.plan.reveal * 0.55, () => vault.buildInGenerators(this.plan.build));
    this.time.delayedCall(this.plan.reveal + this.plan.build, () => this.handBack(vault));
  }

  /** Skip: the swap happens now if it has not, and the new vault is handed back as soon as it is ready. */
  skip() {
    if (this.finished) return;
    this.finished = true;
    this.mark('skip');
    if (!this.swapped) this.doSwap();
    if (this.arrived) this.handBack(this.vault());
  }

  private handBack(vault: VaultScene) {
    if (this.scene.isActive() === false) return;
    this.finished = true;
    this.capTimer?.remove();
    vault.cameras.main.y = 0;
    this.mark('end');
    FloorTransition.current = null;
    // every finished transition, for the browser tests: its kind, what happened when, and the board it arrived on
    const done = ((window as any).__transitions ??= []) as unknown[];
    done.push({ kind: this.req.kind, reduced: this.reducedMotion, trace: [...this.trace], boardAtArrival: this.boardAtArrival });
    this.req.onArrive?.(vault);
    this.scene.stop();
  }

  private buildSkip(W: number) {
    const c = this.add.container(W - 150, 80 + (this.vault().safeTop || 0)).setDepth(30).setAlpha(0);
    const bg = this.add.nineslice(0, 0, 'btn_dark', undefined, 200, 84, 40, 40, 40, 40);
    c.add([bg, txt(this, 0, -4, 'SKIP ▸', { size: 32, font: 'num', weight: '700' })]);
    c.setSize(200, 84).setInteractive({ useHandCursor: true }).on('pointerup', () => this.back());
    this.time.delayedCall(1200, () => { if (!this.finished) this.tweens.add({ targets: c, alpha: 1, duration: 150 }); });
    return c;
  }
}
