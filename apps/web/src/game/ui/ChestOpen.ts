import Phaser from 'phaser';
import { Modal } from './Modal';
import { Button, txt } from './kit';
import { ctx } from '../GameCtx';
import { RELICS, CARDS } from '../data/catalog';
import { openChest, ChestResult } from '../systems/Economy';
import type { VaultScene } from '../scenes/VaultScene';

/** Chest ceremony: drop, rattle, lid tilt, light shaft, relic fly-out, then onto the board. */
export class ChestOpen extends Modal {
  constructor(vs: VaultScene, source: 'free' | 'gems', private trigger: string, pre?: ChestResult) {
    super(vs, { w: 1000, h: 1300, closable: false, panelKey: 'panelDark', dim: 0.85 });
    this.kind = 'ChestOpen';
    (this.frame.list[0] as Phaser.GameObjects.NineSlice).setVisible(false); // no plaque: full-bleed ceremony
    const s = ctx.state;
    const res = pre ?? openChest(s, ctx.rng, source);
    if (!res.ok) { this.close(); return; }
    ctx.persist();
    ctx.analytics.log('chest_open', { source, tier: res.tier, pity: !!res.pityHit, upgraded: !!res.upgraded, trigger });
    const B = this.box;
    const tier = res.tier;
    const color = RELICS[tier].color;

    const shaft = vs.add.image(0, 60, 'shaft').setOrigin(0.5, 1).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setDisplaySize(500, 900).setTint(color);
    const glow = vs.add.image(0, 0, 'relicGlow').setDisplaySize(700, 700).setTint(color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const chest = vs.add.container(0, -900);
    const body = vs.add.image(0, 90, 'chestBody').setDisplaySize(400, 253);
    const lid = vs.add.image(0, 0, 'chestLid').setOrigin(0.5, 0.85).setDisplaySize(400, 187);
    chest.add([body, lid]);
    const relic = vs.add.image(0, 60, 'relic256', `R${tier}`).setScale(0.1).setAlpha(0);
    const name = txt(vs, 0, -470, RELICS[tier].name.toUpperCase(), { size: 64, gold: true, weight: '900' }).setAlpha(0);
    const tierT = txt(vs, 0, -400, `TIER ${tier}`, { size: 34, font: 'num', weight: '700', color: '#b9a9c6' }).setAlpha(0);
    B.add([glow, shaft, chest, relic, name, tierT]);

    const tl = vs.tweens;
    ctx.sfx.play('whoosh');
    tl.add({
      targets: chest, y: 160, duration: 520, ease: 'Bounce.Out',
      onComplete: () => {
        ctx.sfx.play('land');
        vs.cameras.main.shake(120, 0.004);
        // rattle
        tl.add({
          targets: chest, angle: { from: -5, to: 5 }, duration: 70, yoyo: true, repeat: 5,
          onComplete: () => {
            chest.angle = 0;
            ctx.sfx.play('chest');
            ctx.haptic([15, 30, 40]);
            // lid tilt: rotate back + squash to fake a 3D hinge
            tl.add({ targets: lid, angle: -28, scaleY: lid.scaleY * 0.45, y: -40, duration: 320, ease: 'Back.Out' });
            tl.add({ targets: shaft, alpha: 0.9, duration: 300 });
            tl.add({ targets: glow, alpha: 0.8, duration: 300 });
            vs.fx.flash(this.frame.x, this.frame.y + 160, 3, color);
            vs.fx.burst(this.frame.x, this.frame.y + 140, 40, color);
            // fly-out
            relic.setAlpha(1);
            tl.add({ targets: relic, y: -170, scale: 1.7, angle: 360, duration: 620, ease: 'Back.Out', delay: 120 });
            tl.add({ targets: [name, tierT], alpha: 1, duration: 300, delay: 500 });
            vs.time.delayedCall(700, () => {
              ctx.sfx.chime(tier);
              vs.fx.ring(this.frame.x, this.frame.y - 170, color, 2.4, 700);
              if (tier >= 4) vs.fx.confetti(this.frame.x, this.frame.y - 170, 50);
              let tagY = -330;
              if (res.pityHit) { this.tag('PITY GUARANTEE', '#8CF08A', tagY); tagY -= 0; }
              if (res.upgraded) this.tag('LUCKY UPGRADE!', '#7EE0FF', res.pityHit ? -280 : tagY);
              if (res.card) {
                const c = vs.add.image(330, 90, 'cards', `c${res.card.id}`).setDisplaySize(10, 14);
                B.add(c);
                tl.add({ targets: c, displayWidth: 170, displayHeight: 238, angle: 8, duration: 400, ease: 'Back.Out' });
                B.add(txt(vs, 330, 240, res.card.duplicate ? 'Duplicate +3 gems' : CARDS[res.card.id].name, { size: 26, font: 'body', color: '#7EE0FF' }));
                ctx.sfx.play('card');
              }
              const btn = new Button(vs, 0, 470, 460, 130, 'COLLECT', () => this.collect(res, relic), { color: 'gold', size: 54 });
              btn.setAlpha(0);
              B.add(btn);
              tl.add({ targets: btn, alpha: 1, duration: 300 });
            });
          },
        });
      },
    });
    tl.add({ targets: shaft, angle: { from: -3, to: 3 }, duration: 1400, yoyo: true, repeat: -1 });
  }

  private tag(label: string, color: string, y: number) {
    const t = txt(this.vs, 0, y, label, { size: 40, font: 'num', weight: '700', color }).setScale(2).setAlpha(0);
    this.box.add(t);
    this.vs.tweens.add({ targets: t, scale: 1, alpha: 1, duration: 260, ease: 'Back.Out' });
  }

  private collect(res: ChestResult, relic: Phaser.GameObjects.Image) {
    const vs = this.vs;
    const m = relic.getWorldTransformMatrix();
    const from = { x: m.tx, y: m.ty };
    this.close();
    if (res.index >= 0) vs.dropRelic(res.index, res.tier, 60, from);
    else vs.toast('No room on the board: the relic waits in your satchel.');
    if (res.card?.pageCompleted !== undefined && res.card.pageCompleted >= 0) vs.time.delayedCall(900, () => vs.pageComplete(res.card!.pageCompleted));
    vs.hud.refresh();
    vs.refreshButtons();
    vs.dock.refresh();
    vs.time.delayedCall(900, () => vs.maybeInterstitial('chest_close'));
  }
}
