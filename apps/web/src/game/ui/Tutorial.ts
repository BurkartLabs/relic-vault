import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { COPY, BOARD_SIZE } from '../data/catalog';
import { txt } from './kit';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * 90-second visual onboarding. Ghost finger + camera punch-ins on the first three teaches.
 * Never blocks input: the finger is decoration, the player can do anything at any time.
 */
export class Tutorial {
  blocking = false;
  private finger: Phaser.GameObjects.Image;
  private ghost?: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private loop?: Phaser.Tweens.TweenChain | Phaser.Tweens.Tween;
  private idle?: Phaser.Time.TimerEvent;
  private pulse?: Phaser.Tweens.Tween;

  constructor(private vs: VaultScene) {
    this.finger = vs.add.image(0, 0, 'ic_hand').setDisplaySize(150, 150).setOrigin(0.45, 0.05).setDepth(90).setVisible(false);
    this.label = txt(vs, 0, 0, '', { size: 46, gold: true, weight: '900', strokeW: 7 }).setDepth(90).setVisible(false);
    vs.tweens.add({ targets: this.label, scale: { from: 1, to: 1.06 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
  }

  get step() { return ctx.state.flags.tut ?? 0; }
  set step(v: number) { ctx.state.flags.tut = v; ctx.persist(); }

  start() {
    const s = ctx.state;
    if (s.stats.merges > 0 && this.step < 3) this.step = 3;
    if (this.step === 0) this.showForge();
    else if (this.step === 1) this.showMerge();
  }

  forgePrefer(): number | undefined {
    if (this.step !== 0) return undefined;
    const b = ctx.state.board;
    if (b[14] === 1 && b[15] === 0) return 15;
    return undefined;
  }

  private clear() {
    this.loop?.stop();
    this.idle?.remove();
    this.pulse?.stop();
    this.ghost?.destroy();
    this.ghost = undefined;
    this.finger.setVisible(false);
    this.label.setVisible(false);
  }

  private punch(x: number, y: number, zoom = 1.08) {
    const cam = this.vs.cameras.main;
    cam.pan(x, y, 380, 'Sine.easeInOut');
    cam.zoomTo(zoom, 380, 'Sine.easeInOut');
    this.vs.time.delayedCall(900, () => { cam.pan(this.vs.W / 2, this.vs.H / 2, 420, 'Sine.easeInOut'); cam.zoomTo(1, 420, 'Sine.easeInOut'); });
  }

  private idlePulse(targets: Phaser.GameObjects.GameObject[]) {
    this.idle = this.vs.time.delayedCall(4000, () => {
      this.pulse = this.vs.tweens.add({ targets, scale: '*=1.12', duration: 280, yoyo: true, repeat: -1 });
    });
  }

  private showForge() {
    const vs = this.vs;
    ctx.telemetry.track('funnel_step', { step: 'forge_hint' });
    const f = vs.forgeBtn;
    this.finger.setVisible(true).setPosition(f.x + 40, f.y + 10).setAlpha(0);
    this.label.setText(COPY.forgeHint).setPosition(f.x, f.y - 160).setVisible(true);
    this.loop = vs.tweens.chain({
      targets: this.finger, loop: -1,
      tweens: [
        { alpha: 1, y: f.y + 10, duration: 250 },
        { scale: '*=0.85', duration: 140, yoyo: true, hold: 60 },
        { alpha: 0.9, duration: 500 },
      ],
    });
    this.punch(f.x, f.y - 200);
    this.idlePulse([f]);
  }

  private showMerge(a?: number, b?: number) {
    const vs = this.vs, s = ctx.state;
    if (a === undefined || b === undefined) {
      const ones: number[] = [];
      for (let i = 0; i < BOARD_SIZE; i++) if (s.board[i] === 1) ones.push(i);
      if (ones.length < 2) { this.clear(); return; }
      [a, b] = ones;
    }
    this.clear();
    ctx.telemetry.track('funnel_step', { step: 'merge_hint' });
    const pa = vs.cellPos(a), pb = vs.cellPos(b);
    this.label.setText(COPY.mergeHint).setPosition((pa.x + pb.x) / 2, Math.min(pa.y, pb.y) - 150).setVisible(true);
    this.dragLoop(pa, pb, 1);
    this.punch((pa.x + pb.x) / 2, (pa.y + pb.y) / 2);
    const relA = (vs.relics[a]?.spr), relB = (vs.relics[b]?.spr);
    if (relA && relB) this.idlePulse([relA, relB]);
  }

  private dragLoop(pa: { x: number; y: number }, pb: { x: number; y: number }, tier: number, loops = -1) {
    const vs = this.vs;
    this.ghost = vs.add.image(pa.x, pa.y, 'relics', `r${tier}_0`).setDisplaySize(150, 150).setAlpha(0).setDepth(89);
    this.finger.setVisible(true).setPosition(pa.x + 20, pa.y + 10).setAlpha(0).setScale(this.finger.scaleX);
    this.loop = vs.tweens.chain({
      targets: [this.finger, this.ghost], loop: loops,
      tweens: [
        { x: `+=0`, alpha: { from: 0, to: 0.85 }, duration: 250, onStart: () => { this.finger.setPosition(pa.x + 20, pa.y + 10); this.ghost?.setPosition(pa.x, pa.y); } },
        { x: pb.x, y: pb.y, duration: 700, ease: 'Sine.InOut', hold: 200 },
        { alpha: 0, duration: 250 },
      ],
      onComplete: () => this.clear(),
    });
  }

  hintPair(pair: [number, number]) {
    this.clear();
    const t = ctx.state.board[pair[0]];
    this.dragLoop(this.vs.cellPos(pair[0]), this.vs.cellPos(pair[1]), t, 2);
  }

  onForge(i: number) {
    if (this.step !== 0) return;
    this.step = 1;
    ctx.telemetry.track('funnel_step', { step: 'forge_done' });
    this.clear();
    const s = ctx.state;
    const other = s.board.findIndex((t, k) => t === s.board[i] && k !== i);
    if (other >= 0) this.vs.time.delayedCall(450, () => this.showMerge(i, other));
  }

  onMerge(at: number) {
    if (this.step >= 2) { this.clear(); return; }
    this.step = 2;
    ctx.telemetry.track('funnel_step', { step: 'merge_done' });
    this.clear();
    const vs = this.vs;
    const p = vs.cellPos(at);
    this.punch(p.x, p.y, 1.1);
    vs.time.delayedCall(300, () => { vs.sarcoReact(6); vs.cameras.main.shake(300, 0.004); });
    this.blocking = true;
    vs.time.delayedCall(1150, () => {
      this.blocking = false;
      vs.keeperSays(COPY.firstMerge, () => { this.step = 3; ctx.telemetry.track('funnel_step', { step: 'tutorial_done' }); });
    });
  }
}
