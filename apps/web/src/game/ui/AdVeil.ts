import Phaser from 'phaser';
import { txt } from './kit';
import { ctx } from '../GameCtx';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * Demo ad: a 1.5s branded veil with a skip at 1.2s. Rewarded veils grant on completion
 * (skip after 1.2s also counts). Real SDKs would slot in here.
 */
export class AdVeil extends Phaser.GameObjects.Container {
  private done = false;
  constructor(vs: VaultScene, rewarded: boolean, onDone: () => void) {
    super(vs, 0, 0);
    const W = vs.W, H = vs.H;
    this.setDepth(500);
    const bg = vs.add.image(W / 2, H / 2, 'dim').setDisplaySize(W, H).setAlpha(0).setInteractive();
    const glow = vs.add.image(W / 2, H / 2 - 120, 'relicGlow').setDisplaySize(900, 900).setTint(0x7ee0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    const scroll = vs.add.image(W / 2, H / 2 - 160, 'ic_scroll').setDisplaySize(300, 300);
    const t1 = txt(vs, W / 2, H / 2 + 60, 'THE CRIERS’ GUILD', { size: 64, weight: '900', gold: true });
    const t2 = txt(vs, W / 2, H / 2 + 140, rewarded ? 'presents your reward, briefly' : 'a word from our patrons', { size: 34, font: 'body', color: '#b9a9c6' });
    const tag = txt(vs, 120, 80 + vs.safeTop, rewarded ? 'REWARDED AD · DEMO' : 'AD · DEMO', { size: 26, font: 'num', weight: '700', color: '#8a7a98', origin: [0, 0.5] });
    const bar = vs.add.graphics();
    this.add([bg, glow, scroll, t1, t2, tag, bar]);
    vs.add.existing(this);
    vs.tweens.add({ targets: bg, alpha: 0.96, duration: 150 });
    vs.tweens.add({ targets: scroll, angle: { from: -6, to: 6 }, duration: 400, yoyo: true, repeat: -1 });
    const start = vs.time.now;
    const finish = () => {
      if (this.done) return;
      this.done = true;
      ev.remove();
      vs.tweens.add({ targets: this, alpha: 0, duration: 180, onComplete: () => this.destroy() });
      if (rewarded) onDone();
      else ctx.sfx.play('tick');
    };
    const skip = vs.add.container(W - 150, 80 + vs.safeTop).setAlpha(0);
    const sb = vs.add.nineslice(0, 0, 'btn_dark', undefined, 200, 84, 40, 40, 40, 40);
    skip.add([sb, txt(vs, 0, -4, 'SKIP ▸', { size: 32, font: 'num', weight: '700' })]);
    skip.setSize(200, 84).setInteractive({ useHandCursor: true }).on('pointerup', () => { if (vs.time.now - start >= 1200) finish(); });
    this.add(skip);
    const ev = vs.time.addEvent({
      delay: 16, loop: true, callback: () => {
        const p = Math.min(1, (vs.time.now - start) / 1500);
        bar.clear();
        bar.fillStyle(0x07050a).fillRoundedRect(W / 2 - 300, H / 2 + 230, 600, 24, 12);
        bar.fillStyle(0x7ee0ff).fillRoundedRect(W / 2 - 300, H / 2 + 230, Math.max(24, 600 * p), 24, 12);
        if (vs.time.now - start >= 1200 && skip.alpha === 0) vs.tweens.add({ targets: skip, alpha: 1, duration: 150 });
        if (p >= 1) finish();
      },
    });
  }
}
