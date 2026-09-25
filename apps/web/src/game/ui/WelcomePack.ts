import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, badge, money, dur } from './kit';
import { ctx } from '../GameCtx';
import { SKUS, COPY, BASELINE_SKU } from '../data/catalog';
import { welcomeDeadline } from '../systems/Offers';
import { chestsAllowed, skuValuePct, welcomeValueBasis } from '../systems/Economy';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * One-time Welcome Pack, timed after the first merge.
 * Value ribbon is computed by skuValuePct(), and the sentence under the loot that explains it is built from the same
 * numbers (Bug #678, Bug #751). The deadline is real: 48h from first sight, never resets (Critic ITERATE: honesty
 * beats the original looping-timer spec).
 */
export class WelcomePack extends Modal {
  private timerText: Phaser.GameObjects.Text;
  private ev: Phaser.Time.TimerEvent;
  constructor(vs: VaultScene, trigger: string) {
    super(vs, { w: 980, h: 1420, title: 'KEEPER’S WELCOME', offer: `welcome:${trigger}` });
    this.kind = 'WelcomePack';
    const B = this.box;
    ctx.state.flags.offer_welcome = 1;
    ctx.director.queue = ctx.director.queue.filter((q) => q.id !== 'welcome');
    const top = this.top;
    keeperLine(vs, B, 0, top + 120, 880, COPY.welcomeLine, 130);

    // light rays behind the loot
    const rays = vs.add.image(0, top + 470, 'relicGlow').setDisplaySize(900, 900).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    B.add(rays);
    vs.tweens.add({ targets: rays, alpha: 0.25, duration: 1000, yoyo: true, repeat: -1 });

    const rib = vs.add.image(0, top + 250, 'ribbon').setDisplaySize(840, 150);
    const rt = txt(vs, 0, top + 236, `ONE TIME · ${skuValuePct('welcome', ctx.state)}% VALUE`, { size: 50, weight: '900', gold: true, strokeW: 8 });
    B.add([rib, rt]);
    vs.tweens.add({ targets: [rib, rt], scale: { from: 1, to: 1.04 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    // loot arrangement
    const loot = vs.add.container(0, top + 520);
    const m1 = vs.add.image(-150, -20, 'relic256', 'R4').setDisplaySize(230, 230);
    const m2 = vs.add.image(150, -20, 'relic256', 'R4').setDisplaySize(230, 230);
    const urn = vs.add.image(0, 30, 'relic256', 'R3').setDisplaySize(190, 190);
    loot.add([m1, m2, urn]);
    [m1, m2, urn].forEach((o, k) => vs.tweens.add({ targets: o, y: o.y - 10, duration: 1200 + k * 200, yoyo: true, repeat: -1, ease: 'Sine.InOut' }));
    B.add(loot);

    const row = vs.add.container(0, top + 790);
    const random = chestsAllowed(ctx.state);
    const items: [string, string, string?][] = [['gem', String(SKUS.welcome.gems)], ['coin', SKUS.welcome.gold!.toLocaleString('en-US')], random ? ['ic_chest', 'x1'] : ['relic256', 'x1', 'R4']];
    items.forEach(([k, n], i) => {
      const x = (i - 1) * 290;
      const plate = vs.add.nineslice(x, 0, 'panelDark', undefined, 260, 150, 60, 60, 60, 60);
      const img = vs.add.image(x - 60, 0, k, items[i][2]).setDisplaySize(96, 96);
      const t = txt(vs, x + 40, 0, n, { size: 54, font: 'num', weight: '700', color: k === 'gem' ? '#7EE0FF' : '#FFE9A3' });
      row.add([plate, img, t]);
    });
    B.add(row);
    // Anchored by its top edge below the plates: centred, the derived sentence's third line grew up into them (Bug #678).
    B.add(txt(vs, 0, top + 882, '+ two Gold Masks and a Silver Urn dropped straight onto your board.\n' +
      `Value = gems per $ against the ${money(BASELINE_SKU.price)} pack; ${welcomeValueBasis(ctx.state)}. Gold and relics are extra.`,
      { size: 24, font: 'body', color: '#e8dcf0', wrap: 840, origin: [0.5, 0] }));

    // price + real countdown (starts at first sight, never resets)
    this.timerText = txt(vs, 0, top + 1020, '', { size: 36, font: 'num', weight: '700', color: '#FF5D6C' });
    B.add(this.timerText);
    const buy = new Button(vs, 0, top + 1140, 520, 140, money(SKUS.welcome.price), () => {
      vs.buy('welcome', `welcome:${trigger}`);
      this.close();
    }, { color: 'green', size: 64 });
    B.add(buy);
    vs.tweens.add({ targets: buy, scale: 1.05, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    B.add(badge(vs, 330, top + 1110, 'ONE PER KEEPER', 'gold', 150));
    const no = txt(vs, 0, top + 1265, 'Not today', { size: 26, font: 'body', color: '#8a7a98', strokeW: 0 });
    no.setInteractive({ useHandCursor: true }).on('pointerup', () => { ctx.analytics.log('offer_decline', { offer: 'welcome' }); this.close(); });
    B.add(no);

    const deadline = welcomeDeadline(ctx.state, Date.now());
    ctx.persist();
    const tick = () => {
      const left = deadline - Date.now();
      this.timerText.setText(left > 0 ? 'LEAVES THE VAULT IN ' + dur(left) : 'THIS OFFER HAS EXPIRED');
      if (left <= 0) buy.setEnabled(false);
    };
    tick();
    this.ev = vs.time.addEvent({ delay: 500, loop: true, callback: tick });
    this.once('destroy', () => this.ev.remove());
  }
}
