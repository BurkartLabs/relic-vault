import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { PATRONS, ITEMS, BINDINGS } from '../data/items';
import { orderProgress, matchOrder } from '../systems/OrderSystem';
import { txt, fmt } from './kit';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * Three patron order cards above the board (RV-D2). Each shows who is asking, the relics they want
 * (lit when you have them), and what they pay. A complete card glows; tapping it delivers.
 */
export class OrdersPanel extends Phaser.GameObjects.Container {
  cards: Phaser.GameObjects.Container[] = [];
  private sig = '';
  private glows: (Phaser.Tweens.Tween | null)[] = [null, null, null];
  static X = [195, 540, 885];
  static W = 318;
  static H = 226;

  constructor(private vs: VaultScene, x: number, y: number) {
    super(vs, x, y);
    this.setDepth(25);
    OrdersPanel.X.forEach((cx, i) => {
      const c = vs.add.container(cx, 0);
      c.setSize(OrdersPanel.W, OrdersPanel.H).setInteractive({ useHandCursor: true });
      c.on('pointerup', () => vs.onOrderTap(i));
      this.cards.push(c);
      this.add(c);
    });
    vs.add.existing(this);
    this.refresh(true);
  }

  /** Cheap per-frame check; rebuilds a card only when its order or progress changed. */
  poll() {
    const s = ctx.state;
    const sig = s.orders.map((o, i) => (o ? `${o.id}:${orderProgress(s, o).map(Number).join('')}` : `w${s.orderWait[i]}`)).join('|');
    if (sig !== this.sig) this.refresh();
  }

  refresh(force = false) {
    const s = ctx.state;
    const prev = this.sig.split('|');
    this.sig = s.orders.map((o, i) => (o ? `${o.id}:${orderProgress(s, o).map(Number).join('')}` : `w${s.orderWait[i]}`)).join('|');
    const next = this.sig.split('|');
    for (let i = 0; i < this.cards.length; i++) {
      if (!force && prev[i] === next[i]) continue;
      const isNew = !force && prev[i]?.split(':')[0] !== next[i].split(':')[0] && !!s.orders[i];
      this.build(i);
      if (isNew) {
        const c = this.cards[i];
        c.setScale(0.6).setAlpha(0);
        this.vs.tweens.add({ targets: c, scale: 1, alpha: 1, duration: 320, ease: 'Back.Out' });
      }
    }
  }

  anchor(i: number) {
    const m = this.cards[i].getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }

  private build(i: number) {
    const vs = this.vs, s = ctx.state, c = this.cards[i];
    this.glows[i]?.stop();
    this.glows[i] = null;
    c.removeAll(true);
    const o = s.orders[i];
    const W = OrdersPanel.W, H = OrdersPanel.H;
    if (!o) {
      c.add(vs.add.nineslice(0, 0, 'panelDark', undefined, W, H, 64, 64, 60, 60).setAlpha(0.55));
      c.add(txt(vs, 0, -12, 'A patron approaches…', { size: 24, font: 'body', color: '#8a7a98', strokeW: 0 }));
      c.add(txt(vs, 0, 24, `in ${Math.max(1, s.orderWait[i])} actions`, { size: 22, font: 'num', weight: '500', color: '#6a5a78', strokeW: 0 }));
      return;
    }
    const have = orderProgress(s, o);
    const done = !!matchOrder(s, o);
    const glow = vs.add.image(0, 0, 'relicGlow').setDisplaySize(W + 140, H + 120).setTint(0x8cf08a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(done ? 0.55 : 0);
    const bg = vs.add.nineslice(0, 0, done ? 'panel' : 'panelDark', undefined, W, H, 64, 64, 60, 60);
    c.add([glow, bg]);
    const p = PATRONS[o.patron];
    c.add(vs.add.image(-W / 2 + 46, -H / 2 + 44, `patron${p.id}`).setDisplaySize(74, 74));
    const nm = txt(vs, -W / 2 + 90, -H / 2 + 34, p.name, { size: 24, weight: '900', gold: true, origin: [0, 0.5], strokeW: 4 });
    if (nm.width > 150) nm.setScale(150 / nm.width);
    c.add(nm);
    if (p.title) c.add(txt(vs, -W / 2 + 90, -H / 2 + 60, p.title, { size: 18, font: 'body', color: '#b9a9c6', origin: [0, 0.5], strokeW: 0 }));
    // dismiss (free; a new patron arrives after a few actions)
    const x = vs.add.image(W / 2 - 26, -H / 2 + 26, 'ic_close').setDisplaySize(44, 44).setAlpha(0.8).setInteractive({ useHandCursor: true });
    x.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => { ev?.stopPropagation(); vs.onOrderDismiss(i); });
    c.add(x);
    // wanted relics
    const n = o.want.length, gap = 88;
    o.want.forEach((id, k) => {
      const ix = (k - (n - 1) / 2) * gap, iy = 12;
      const slot = vs.add.image(ix, iy, 'relicGlow').setDisplaySize(96, 96).setTint(have[k] ? 0x8cf08a : 0x2a2033).setAlpha(have[k] ? 0.5 : 0.8);
      const ic = vs.add.image(ix, iy, 'relic96', `i${id}`).setDisplaySize(76, 76).setAlpha(have[k] ? 1 : 0.45);
      c.add([slot, ic]);
      if (have[k]) c.add(txt(vs, ix + 30, iy + 28, '✓', { size: 30, font: 'num', weight: '700', color: '#8CF08A' }));
      if (BINDINGS[id] && !have[k]) c.add(vs.add.image(ix - 30, iy - 28, 'ic_link').setDisplaySize(34, 34));
    });
    // reward row
    const ry = H / 2 - 30;
    const parts: Phaser.GameObjects.GameObject[] = [];
    let rx = -W / 2 + 26;
    const push = (key: string, label: string, color: string) => {
      const im = vs.add.image(rx + 16, ry, key).setDisplaySize(34, 34);
      const t = txt(vs, rx + 36, ry, label, { size: 24, font: 'num', weight: '700', color, origin: [0, 0.5], strokeW: 3 });
      parts.push(im, t);
      rx += 40 + t.width + 12;
    };
    push('coin', fmt(o.gold), '#FFE9A3');
    if (o.gems) push('gem', String(o.gems), '#7EE0FF');
    push('ic_pass', `+${o.pass}`, '#c79bff');
    if (o.card) push('ic_card', '', '#fff');
    c.add(parts);
    if (done) {
      const fill = txt(vs, W / 2 - 58, ry - 2, 'FILL!', { size: 30, weight: '900', color: '#8CF08A', strokeW: 5 });
      c.add(fill);
      this.glows[i] = vs.tweens.add({ targets: glow, alpha: { from: 0.3, to: 0.75 }, duration: 520, yoyo: true, repeat: -1 });
      vs.tweens.add({ targets: fill, scale: { from: 1, to: 1.12 }, duration: 520, yoyo: true, repeat: -1 });
    }
  }

  /** Items flying in land here; the card pops. */
  pop(i: number) {
    const c = this.cards[i];
    this.vs.tweens.add({ targets: c, scale: 1.12, duration: 110, yoyo: true, ease: 'Quad.Out' });
  }
}

export function patronLine(patron: number) { return `${PATRONS[patron].name}: “${PATRONS[patron].line}”`; }
export function itemName(id: number) { return ITEMS[id]?.name ?? ''; }
