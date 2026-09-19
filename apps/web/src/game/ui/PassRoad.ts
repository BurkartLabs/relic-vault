import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, money, dur, fmt, badge } from './kit';
import { ctx } from '../GameCtx';
import { PASS_FREE, PASS_PREMIUM, ECON, SKUS, COPY, Reward, RELICS } from '../data/catalog';
import { passTier, claimPass, chestsAllowed } from '../systems/Economy';
import { seasonEndsAt } from '../systems/State';
import type { VaultScene } from '../scenes/VaultScene';

export function rewardVisual(vs: VaultScene, r: Reward, x: number, y: number, size = 90): Phaser.GameObjects.Container {
  const c = vs.add.container(x, y);
  let key = 'coin', frame: string | undefined, label = '';
  switch (r.kind) {
    case 'gold': key = 'coin'; label = fmt(r.n); break;
    case 'gems': key = 'gem'; label = String(r.n); break;
    case 'chest':
      if (chestsAllowed(ctx.state)) { key = 'ic_chest'; label = `x${r.n}`; }
      else { key = 'relic256'; frame = 'R4'; label = `MASK x${r.n}`; }
      break;
    case 'card': key = 'ic_card'; label = 'WILD'; break;
    case 'relic': key = 'relic256'; frame = `R${r.tier}`; label = RELICS[r.tier].name.split(' ')[1] ?? ''; break;
    case 'skin': key = 'crown'; label = 'GILDED'; break;
    case 'crumb': key = 'ic_luck'; label = 'LUCK'; break;
  }
  c.add(vs.add.image(0, -8, key, frame).setDisplaySize(size, size));
  c.add(txt(vs, 0, size * 0.52, label, { size: Math.round(size * 0.3), font: 'num', weight: '700', color: r.kind === 'gems' ? '#7EE0FF' : '#FFE9A3' }));
  return c;
}

export class PassRoad extends Modal {
  private road!: Phaser.GameObjects.Container;
  private maskG!: Phaser.GameObjects.Graphics;
  private dragX = 0;
  private startX = 0;
  private moved = 0;
  private dragging = false;
  private minX = 0;
  private roadBaseX = 0;
  private teardown?: () => void;
  private listenerBound = false;
  constructor(vs: VaultScene, private trigger: string, private upsell = false) {
    super(vs, { w: 1020, h: 1560, title: 'KEEPER’S PASS', ribbon: 'ribbonPurple', offer: upsell ? `pass_upsell:${trigger}` : undefined });
    this.kind = 'PassRoad';
    this.build();
  }

  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = this.top;
    const tier = passTier(s);
    const into = s.pass.xp - tier * ECON.passXpPerTier;
    B.add(txt(vs, 0, top + 80, `Season ends in ${dur(seasonEndsAt(Date.now()) - Date.now())}`, { size: 30, font: 'num', weight: '500', color: '#b9a9c6' }));
    B.add(txt(vs, -440, top + 150, `TIER ${tier}/${ECON.passTiers}`, { size: 44, font: 'num', weight: '700', gold: true, origin: [0, 0.5] }));
    const g = vs.add.graphics();
    const bw = 520;
    g.fillStyle(0x07050a).fillRoundedRect(-80, top + 136, bw, 30, 15);
    g.fillStyle(0xc79bff).fillRoundedRect(-80, top + 136, Math.max(30, bw * (tier >= ECON.passTiers ? 1 : into / ECON.passXpPerTier)), 30, 15);
    g.lineStyle(3, 0xa56a12).strokeRoundedRect(-80, top + 136, bw, 30, 15);
    B.add(g);
    B.add(txt(vs, 180, top + 186, tier >= ECON.passTiers ? 'MAX' : `${into}/${ECON.passXpPerTier} xp · earned from every merge`, { size: 22, font: 'body', color: '#b9a9c6' }));

    // --- road viewport
    const vy = top + 250, vh = 760, vx = -470, vw = 940;
    B.add(vs.add.nineslice(0, vy + vh / 2, 'panelDark', undefined, vw + 40, vh + 30, 70, 70, 70, 70));
    B.add(txt(vs, vx + 20, vy + 40, 'FREE', { size: 30, weight: '900', gold: true, origin: [0, 0.5] }));
    B.add(txt(vs, vx + 20, vy + vh - 40, 'PREMIUM', { size: 30, weight: '900', color: '#c79bff', origin: [0, 0.5] }));
    this.road = vs.add.container(vx, vy);
    B.add(this.road);
    this.roadBaseX = vx;
    const step = 200, n = ECON.passTiers;
    const width = 120 + n * step;
    this.minX = vx - (width - vw);
    const midY = vh / 2;
    this.road.add(vs.add.tileSprite(60, midY, width, 26, 'road').setOrigin(0, 0.5));
    const filled = Math.max(0, tier * step - step / 2 + (tier < n ? (into / ECON.passXpPerTier) * step : 0));
    this.road.add(vs.add.tileSprite(60, midY, Math.max(1, 40 + filled), 26, 'roadFill').setOrigin(0, 0.5));
    for (let t = 1; t <= n; t++) {
      const x = 60 + t * step - step / 2 + 40;
      const reached = t <= tier;
      const node = vs.add.image(x, midY, 'medallion').setDisplaySize(110, 110).setAlpha(reached ? 1 : 0.5);
      const nt = txt(vs, x, midY, String(t), { size: 38, font: 'num', weight: '700', gold: reached });
      this.road.add([node, nt]);
      this.slot(x, 190, PASS_FREE[t - 1], t, 'free', reached);
      this.slot(x, vh - 190, PASS_PREMIUM[t - 1], t, 'prem', reached);
    }
    // mask
    const m = this.frame;
    this.maskG = vs.make.graphics({}, false);
    this.road.setMask(this.maskG.createGeometryMask());
    const redraw = () => {
      const wx = m.x + vx * m.scaleX, wy = m.y + vy * m.scaleY;
      this.maskG.clear().fillStyle(0xffffff).fillRect(wx, wy, vw * m.scaleX, vh * m.scaleY);
    };
    this.teardown?.();
    vs.events.on('update', redraw);
    const maskG = this.maskG;
    this.teardown = () => { vs.events.off('update', redraw); maskG.destroy(); vs.input.off('pointerdown', this.down, this); vs.input.off('pointermove', this.move, this); vs.input.off('pointerup', this.up, this); };
    if (!this.listenerBound) { this.listenerBound = true; this.once('destroy', () => this.teardown?.()); }
    vs.input.on('pointerdown', this.down, this);
    vs.input.on('pointermove', this.move, this);
    vs.input.on('pointerup', this.up, this);
    // scroll to current tier
    this.road.x = Phaser.Math.Clamp(vx - (tier - 2) * step, this.minX, vx);

    // --- premium CTA
    const cy = top + 1130;
    if (!s.ent.passPremium) {
      if (this.upsell) keeperLine(vs, B, 0, cy, 900, COPY.passLine, 110);
      else B.add(txt(vs, 0, cy, 'Premium: gems every tier · wildcard card at tier 8 · Gilded relic skin · +4% luck', { size: 28, font: 'body', color: '#e8dcf0', wrap: 880 }));
      const b = new Button(vs, 0, top + 1300, 560, 130, `UNLOCK ${money(SKUS.pass.price)}`, () => vs.buy('pass', `pass:${this.trigger}`, () => { if (this.active && !this.closing) { this.box.removeAll(true); this.build(); } }), { color: 'purple', size: 46 });
      B.add(b);
      B.add(badge(vs, 300, top + 1260, 'POPULAR', 'red', 120));
      vs.tweens.add({ targets: b, scale: 1.04, duration: 600, yoyo: true, repeat: -1 });
    } else {
      B.add(txt(vs, 0, cy, 'PREMIUM ACTIVE · +4% luck', { size: 40, weight: '900', color: '#c79bff' }));
      if (s.ent.skin) {
        const tog = new Button(vs, 0, top + 1300, 520, 110, s.ent.skinOn ? 'GILDED SKIN: ON' : 'GILDED SKIN: OFF', () => {
          s.ent.skinOn = !s.ent.skinOn; ctx.persist(); tog.setLabel(s.ent.skinOn ? 'GILDED SKIN: ON' : 'GILDED SKIN: OFF');
          // rebuild sprites so the gild layer appears / disappears
          const b = s.board.slice(); s.board.fill(0); vs.syncBoard(); s.board.splice(0, b.length, ...b); vs.syncBoard();
        }, { color: 'gold', size: 36 });
        B.add(tog);
      }
    }
    B.add(txt(vs, 0, top + 1420, 'Buying the pass never skips play. It makes play pay better.', { size: 22, font: 'body', color: '#8a7a98', strokeW: 0 }));
  }

  private slot(x: number, y: number, r: Reward, t: number, track: 'free' | 'prem', reached: boolean) {
    const vs = this.vs, s = ctx.state;
    const claimed = (track === 'free' ? s.pass.free : s.pass.prem).includes(t);
    const locked = track === 'prem' && !s.ent.passPremium;
    const plate = vs.add.nineslice(x, y, track === 'prem' ? 'panelBlue' : 'panelDark', undefined, 176, 250, 60, 60, 60, 60);
    this.road.add(plate);
    const v = rewardVisual(vs, r, x, y - 20, 86);
    this.road.add(v);
    if (claimed) { v.setAlpha(0.4); this.road.add(txt(vs, x, y + 80, 'CLAIMED', { size: 26, font: 'num', weight: '700', color: '#8CF08A' })); }
    else if (locked) this.road.add(vs.add.image(x + 56, y - 84, 'ic_lock').setDisplaySize(56, 56));
    if (!claimed && reached && !locked) {
      const glow = vs.add.image(x, y - 20, 'relicGlow').setDisplaySize(220, 220).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
      this.road.addAt(glow, this.road.list.indexOf(v));
      vs.tweens.add({ targets: glow, alpha: 0.2, duration: 600, yoyo: true, repeat: -1 });
      const b = new Button(vs, x, y + 84, 150, 66, 'CLAIM', () => {
        if (this.moved > 20) return;
        const g = claimPass(s, t, track, ctx.rng);
        if (!g) return;
        const m = b.getWorldTransformMatrix();
        vs.showGrant(g, { x: m.tx, y: m.ty });
        ctx.sfx.play('purchase');
        const keepX = this.road.x;
        this.box.removeAll(true);
        this.build();
        this.road.x = keepX;
      }, { color: 'green', size: 28 });
      this.road.add(b);
    }
  }

  private down(p: Phaser.Input.Pointer) { this.dragging = true; this.dragX = p.x; this.startX = p.x; this.moved = 0; }
  private move(p: Phaser.Input.Pointer) {
    if (!this.dragging || !p.isDown) return;
    this.road.x = Phaser.Math.Clamp(this.road.x + (p.x - this.dragX), this.minX, this.roadBaseX);
    this.dragX = p.x;
    this.moved = Math.max(this.moved, Math.abs(p.x - this.startX));
  }
  private up() { this.dragging = false; this.vs.time.delayedCall(0, () => { this.moved = 0; }); }
}
