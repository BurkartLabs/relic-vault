import Phaser from 'phaser';
import { Modal } from './Modal';
import { Button, txt } from './kit';
import { ctx } from '../GameCtx';
import { WHEEL, ECON } from '../data/catalog';
import { spinWheel, wheelGemSpinAllowed } from '../systems/Economy';
import { WHEEL_SIZE } from '../art/UiArt';
import type { VaultScene } from '../scenes/VaultScene';

/** Carnival wheel: chase lights, ticking pegs, weighted prizes. Ad or 15 gems. */
export class WheelModal extends Modal {
  private wheel!: Phaser.GameObjects.Container;
  private spinning = false;
  private bulbs: Phaser.GameObjects.Image[] = [];
  private btns: Button[] = [];
  constructor(vs: VaultScene, private trigger: string) {
    super(vs, { w: 980, h: 1500, title: 'LUCKY WHEEL', ribbon: 'ribbonPurple' });
    this.kind = 'WheelModal';
    const B = this.box, top = this.top;
    const cy = top + 580;
    const glow = vs.add.image(0, cy, 'relicGlow').setDisplaySize(900, 900).setTint(0xc79bff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4);
    B.add(glow);
    this.wheel = vs.add.container(0, cy);
    const disc = vs.add.image(0, 0, 'wheel').setDisplaySize(760, 760);
    this.wheel.add(disc);
    const R = (WHEEL_SIZE * 0.44) * (760 / WHEEL_SIZE) * 0.68;
    WHEEL.forEach((w, i) => {
      const a = (i / WHEEL.length) * Math.PI * 2 - Math.PI / 2;
      const key = w.reward.kind === 'gems' ? 'gem' : 'coin';
      const icon = vs.add.image(Math.cos(a) * R, Math.sin(a) * R - 14, key).setDisplaySize(70, 70).setRotation(a + Math.PI / 2);
      const t = txt(vs, Math.cos(a) * (R - 70), Math.sin(a) * (R - 70), w.label, { size: 42, font: 'num', weight: '700', color: w.reward.kind === 'gems' ? '#7EE0FF' : '#FFE9A3' }).setRotation(a + Math.PI / 2);
      this.wheel.add([icon, t]);
    });
    B.add(this.wheel);
    // chase bulbs on the rim
    const rr = 760 * 0.47 * 1.02;
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      const b = vs.add.image(Math.cos(a) * rr, cy + Math.sin(a) * rr, 'bulb').setDisplaySize(40, 40).setBlendMode(Phaser.BlendModes.ADD);
      this.bulbs.push(b);
      B.add(b);
    }
    let k = 0;
    const chase = vs.time.addEvent({ delay: 120, loop: true, callback: () => { k++; this.bulbs.forEach((b, i) => b.setAlpha((i + k) % 3 === 0 ? 1 : 0.25)); } });
    this.once('destroy', () => chase.remove());
    const pointer = vs.add.image(0, cy - 400, 'pointer').setDisplaySize(84, 108);
    B.add(pointer);

    B.add(txt(vs, 0, top + 1030, 'Gold every spin. A rare gem jackpot.', { size: 30, font: 'body', color: '#e8dcf0' }));
    const ad = new Button(vs, -210, top + 1180, 380, 130, 'FREE SPIN', () => this.spin('ad'), { color: 'purple', size: 40, icon: 'ic_ad', iconScale: 0.5, sub: ctx.adsSuppressed ? 'no ad for VIP' : 'watch a short ad' });
    const gemOk = wheelGemSpinAllowed(ctx.state);
    const gem = new Button(vs, 210, top + 1180, 380, 130, gemOk ? `SPIN ${ECON.wheelGemCost}` : 'FREE SPINS ONLY', () => this.spin('gems'), { color: 'blue', size: gemOk ? 42 : 30, icon: gemOk ? 'gem' : undefined, iconScale: 0.5, disabled: !gemOk });
    this.btns = [ad, gem];
    B.add([ad, gem]);
    B.add(txt(vs, 0, top + 1330, 'Odds: 50g 26% · 80g 18% · 120g 22% · 250g 16% · 500g 7% · 1K 3.5% · 3 gems 6% · 20 gems 1.5%', { size: 20, font: 'body', color: '#8a7a98', wrap: 860, strokeW: 0 }));
  }

  private spin(pay: 'gems' | 'ad') {
    if (this.spinning) return;
    const vs = this.vs, s = ctx.state;
    if (pay === 'gems' && !wheelGemSpinAllowed(s)) { ctx.sfx.play('error'); vs.toast('Paid spins are off on this profile. Free spins stay on.'); return; }
    if (pay === 'gems' && s.gems < ECON.wheelGemCost) { ctx.sfx.play('error'); vs.toast('Not enough gems.'); return; }
    const go = () => {
      const r = spinWheel(s, ctx.rng, pay);
      if (!r.ok) return;
      if (pay === 'gems') vs.hud.tickGems();
      this.spinning = true;
      this.btns.forEach((b) => b.setEnabled(false));
      const seg = 360 / WHEEL.length;
      const target = 360 * 6 + (360 - r.slot * seg) + (Math.random() - 0.5) * seg * 0.6;
      const start = this.wheel.angle % 360;
      this.wheel.angle = start;
      let lastPeg = 0;
      vs.tweens.add({
        targets: this.wheel, angle: start + target, duration: 4200, ease: 'Cubic.Out',
        onUpdate: () => {
          const peg = Math.floor(this.wheel.angle / (seg / 2));
          if (peg !== lastPeg) { lastPeg = peg; ctx.sfx.play('wheelTick'); }
        },
        onComplete: () => {
          this.spinning = false;
          this.btns.forEach((b) => b.setEnabled(true));
          const w = WHEEL[r.slot];
          const m = this.wheel.getWorldTransformMatrix();
          vs.fx.flash(m.tx, m.ty - 300, 2, 0xc79bff);
          vs.fx.confetti(m.tx, m.ty - 300, w.weight < 5 ? 90 : 40);
          ctx.sfx.play(w.weight < 5 ? 'purchase' : 'coin');
          vs.fx.floatText(m.tx, m.ty - 120, w.reward.kind === 'gems' ? `+${w.label} GEMS` : `+${w.label} GOLD`, { size: 80, gold: true, rise: 60, dur: 1200 });
          vs.showGrant(r.grant!, { x: m.tx, y: m.ty - 300 });
          ctx.analytics.log('wheel_spin', { pay, slot: r.slot, trigger: this.trigger });
        },
      });
    };
    if (pay === 'ad') {
      if (ctx.adsSuppressed) go();
      else vs.watchAd('wheel', go);
    } else go();
  }
}
