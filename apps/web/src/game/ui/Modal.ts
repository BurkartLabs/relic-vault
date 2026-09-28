import Phaser from 'phaser';
import { panel, txt } from './kit';
import { ctx } from '../GameCtx';
import type { VaultScene } from '../scenes/VaultScene';

export interface ModalOpts {
  w?: number; h?: number; title?: string; ribbon?: 'ribbon' | 'ribbonBlue' | 'ribbonPurple';
  panelKey?: 'panel' | 'panelBlue' | 'panelDark'; closable?: boolean; dim?: number; tapOutside?: boolean;
  offer?: string; // analytics offer id for impression logging
}

/** Framed plaque modal: dimmer, nine-slice panel, ribbon title, close seal, pop-in. */
export class Modal extends Phaser.GameObjects.Container {
  box: Phaser.GameObjects.Container;
  pw: number;
  ph: number;
  closing = false;
  converted = false;
  /** stable identifier (class names are minified in production) */
  kind = 'Modal';
  private offerId?: string;
  onClosed?: () => void;
  /**
   * AB#4728: what Android's back does on this sheet, when it is not a plain close(): a sheet opened from another (odds
   * from the shop) has a BACK button that closes it and re-opens the one it came from, and back takes that path.
   */
  onBack?: () => void;
  protected dimmer: Phaser.GameObjects.Image;
  protected frame: Phaser.GameObjects.Container;

  constructor(public vs: VaultScene, o: ModalOpts = {}) {
    super(vs, 0, 0);
    const W = vs.W, H = vs.H;
    this.pw = o.w ?? 960;
    this.ph = Math.min(o.h ?? 1200, H - 140);
    this.setDepth(100);
    this.dimmer = vs.add.image(W / 2, H / 2, 'dim').setDisplaySize(W + 20, H + 20).setAlpha(0).setInteractive();
    this.dimmer.on('pointerup', () => { if (o.closable !== false && o.tapOutside !== false) this.close(); });
    this.add(this.dimmer);
    this.frame = vs.add.container(W / 2, H / 2);
    this.add(this.frame);
    const p = panel(vs, 0, 0, this.pw, this.ph, o.panelKey ?? 'panel');
    p.setInteractive(); // swallow taps
    this.frame.add(p);
    this.box = vs.add.container(0, 0);
    this.frame.add(this.box);
    if (o.title) {
      const rib = vs.add.image(0, -this.ph / 2 - 10, o.ribbon ?? 'ribbon').setScale(Math.min(1, (this.pw + 60) / 760), 1);
      const t = txt(vs, 0, -this.ph / 2 - 22, o.title, { size: 50, gold: true, weight: '900', strokeW: 7 });
      if (t.width > 560) t.setScale(560 / t.width);
      this.frame.add([rib, t]);
    }
    if (o.closable !== false) {
      const x = vs.add.image(this.pw / 2 - 18, -this.ph / 2 + 18, 'ic_close').setDisplaySize(104, 104).setInteractive({ useHandCursor: true });
      x.on('pointerup', () => { ctx.sfx.play('tick'); this.close(); });
      this.frame.add(x);
    }
    vs.add.existing(this);
    // pop in
    this.frame.setScale(0.82).setAlpha(0);
    vs.tweens.add({ targets: this.dimmer, alpha: o.dim ?? 0.72, duration: 180 });
    vs.tweens.add({ targets: this.frame, scale: 1, alpha: 1, duration: 280, ease: 'Back.Out' });
    ctx.sfx.play('whoosh');
    if (o.offer) { this.offerId = o.offer; ctx.analytics.log('offer_impression', { offer: o.offer, sku: o.offer.split(':')[0], trigger: o.offer.split(':')[1] }); }
  }

  close() {
    if (this.closing) return;
    this.closing = true;
    if (this.offerId && !this.converted) ctx.analytics.log('offer_dismiss', { offer: this.offerId, sku: this.offerId.split(':')[0] });
    this.vs.tweens.add({ targets: this.frame, scale: 0.88, alpha: 0, duration: 160, ease: 'Cubic.In' });
    this.vs.tweens.add({
      targets: this.dimmer, alpha: 0, duration: 200,
      onComplete: () => { this.destroy(); this.onClosed?.(); this.vs.onModalClosed(this); },
    });
  }

  /** Top of the content area in body coordinates. */
  get top() { return -this.ph / 2; }
  get bottom() { return this.ph / 2; }
}

export function keeperLine(vs: VaultScene, parent: Phaser.GameObjects.Container, x: number, y: number, w: number, line: string, portrait = 130) {
  const c = vs.add.container(x, y);
  const k = vs.add.image(-w / 2 + portrait / 2, 0, 'keeper').setDisplaySize(portrait, portrait);
  const bubble = vs.add.nineslice(portrait / 2 + 10, 0, 'panelDark', undefined, w - portrait - 10, Math.max(110, portrait * 0.85), 60, 60, 50, 50);
  const t = txt(vs, portrait / 2 + 10, 0, line, { size: 30, font: 'title', weight: '700', color: '#FFE9A3', wrap: w - portrait - 170, align: 'center', lineSpacing: 2 });
  if (t.height > bubble.height - 50) bubble.setSize(bubble.width, t.height + 60);
  c.add([bubble, k, t]);
  parent.add(c);
  return c;
}
