import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, money, fmt } from './kit';
import { ctx } from '../GameCtx';
import { SKUS, ECON, COPY } from '../data/catalog';
import type { VaultScene } from '../scenes/VaultScene';

/** The living pig-idol. Every gold earned drips a little into it. Smash for x4 + 15 gems. */
export class PiggySheet extends Modal {
  constructor(vs: VaultScene, trigger: string) {
    super(vs, { w: 960, h: 1320, title: 'THE GOLDEN PIG', offer: `piggy:${trigger}` });
    this.kind = 'PiggySheet';
    const s = ctx.state, B = this.box, top = this.top;
    // seen it once (any trigger) -> the director should not re-offer it
    s.flags.offer_piggy = 1;
    ctx.director.queue = ctx.director.queue.filter((q) => q.id !== 'piggy');
    keeperLine(vs, B, 0, top + 120, 860, COPY.piggyLine, 120);
    const fill = Math.min(1, s.piggy / ECON.piggyCap);
    const glow = vs.add.image(0, top + 470, 'relicGlow').setDisplaySize(700, 700).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.3 + fill * 0.5);
    const pig = vs.add.image(0, top + 470, 'pig').setDisplaySize(360 + fill * 120, 360 + fill * 120);
    B.add([glow, pig]);
    vs.tweens.add({ targets: pig, scaleY: pig.scaleY * 1.04, scaleX: pig.scaleX * 0.98, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // fill gauge
    const g = vs.add.graphics();
    g.fillStyle(0x07050a).fillRoundedRect(-330, top + 740, 660, 44, 22);
    g.fillStyle(0xf4c45a).fillRoundedRect(-330, top + 740, Math.max(44, 660 * fill), 44, 22);
    g.lineStyle(4, 0xa56a12).strokeRoundedRect(-330, top + 740, 660, 44, 22);
    B.add(g);
    B.add(txt(vs, 0, top + 816, fill >= 1 ? 'FULL: it can’t hold more gold' : `${Math.round(fill * 100)}% full`, { size: 28, font: 'num', weight: '700', color: '#FFE9A3' }));
    B.add(txt(vs, 0, top + 866, `Stored: ${fmt(s.piggy)} gold (10% of all gold you earn)`, { size: 30, font: 'num', weight: '500', color: '#b9a9c6' }));
    B.add(txt(vs, 0, top + 920, `SMASH FOR ${fmt(s.piggy * 4)} GOLD + 15 GEMS`, { size: 44, weight: '900', gold: true }));
    const b = new Button(vs, 0, top + 1080, 540, 140, s.piggy > 0 ? `SMASH ${money(SKUS.piggy.price)}` : 'EMPTY', () => this.smash(pig), { color: 'green', size: 52, disabled: s.piggy <= 0 });
    B.add(b);
    B.add(txt(vs, 0, top + 1210, 'The pig fills as you earn gold. It never stops you playing.', { size: 24, font: 'body', color: '#8a7a98', strokeW: 0 }));
  }

  private smash(pig: Phaser.GameObjects.Image) {
    const vs = this.vs;
    const m = pig.getWorldTransformMatrix();
    vs.buy('piggy', 'piggy_sheet', () => {
      ctx.sfx.play('smash');
      vs.fx.shards(m.tx, m.ty, 18, 0xf4c45a);
      vs.fx.flash(m.tx, m.ty, 3);
      vs.fx.confetti(m.tx, m.ty, 60);
      pig.setVisible(false);
      vs.time.delayedCall(500, () => this.close());
    });
  }
}
