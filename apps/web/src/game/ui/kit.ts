import Phaser from 'phaser';
import { BTN, PANEL, PILL } from '../art/UiArt';
import { ctx } from '../GameCtx';

export const FONT_TITLE = 'Cinzel, Georgia, serif';
export const FONT_NUM = 'Oswald, "Arial Narrow", sans-serif';

export const C = {
  gold: '#F4C45A', goldHi: '#FFE9A3', goldDk: '#A56A12', ink: '#1a0d04', cream: '#F7EED8',
  gem: '#7EE0FF', danger: '#FF5D6C', muted: '#b9a9c6', green: '#8CF08A',
};

export function fmt(n: number): string {
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 0 : 1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + 'K';
  return Math.floor(n).toLocaleString('en-US');
}
export function money(p: number) { return '$' + p.toFixed(2); }
export function dur(ms: number) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m.toString().padStart(2, '0')}m`;
  return `${m}:${ss.toString().padStart(2, '0')}`;
}

export interface TextOpts {
  size?: number; font?: 'title' | 'num' | 'body'; color?: string; weight?: string; stroke?: string; strokeW?: number;
  gold?: boolean; align?: string; wrap?: number; shadow?: boolean; origin?: [number, number]; lineSpacing?: number;
}

export function txt(scene: Phaser.Scene, x: number, y: number, s: string, o: TextOpts = {}): Phaser.GameObjects.Text {
  const size = o.size ?? 40;
  const family = o.font === 'num' ? FONT_NUM : o.font === 'body' ? FONT_NUM : FONT_TITLE;
  const weight = o.weight ?? (o.font === 'body' ? '500' : '700');
  const t = scene.add.text(x, y, s, {
    fontFamily: family,
    fontSize: `${size}px`,
    fontStyle: weight,
    color: o.color ?? C.cream,
    align: o.align ?? 'center',
    stroke: o.stroke ?? (o.gold ? '#2a1402' : '#0c0608'),
    strokeThickness: o.strokeW ?? Math.max(0, Math.round(size / 7)),
    wordWrap: o.wrap ? { width: o.wrap, useAdvancedWrap: true } : undefined,
    lineSpacing: o.lineSpacing ?? 0,
    padding: { x: 4, y: 4 },
  });
  t.setOrigin(...(o.origin ?? [0.5, 0.5]));
  if (o.shadow !== false) t.setShadow(0, Math.max(2, size / 14), 'rgba(0,0,0,0.75)', Math.max(2, size / 10), true, true);
  if (o.gold) goldFill(t);
  return t;
}

export function goldFill(t: Phaser.GameObjects.Text) {
  const apply = () => {
    const g = t.context.createLinearGradient(0, 0, 0, t.height);
    g.addColorStop(0.1, '#FFF6CF');
    g.addColorStop(0.45, '#FFE9A3');
    g.addColorStop(0.55, '#F4C45A');
    g.addColorStop(1, '#A56A12');
    t.setFill(g);
  };
  apply();
  const orig = t.setText.bind(t);
  (t as any).setText = (v: string | string[]) => { orig(v); apply(); return t; };
}

export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, key = 'panel') {
  return scene.add.nineslice(x, y, key, undefined, w, h, PANEL.corner, PANEL.corner, PANEL.corner, PANEL.corner);
}

export function pill(scene: Phaser.Scene, x: number, y: number, w: number, h = PILL.h) {
  return scene.add.nineslice(x, y, 'pill', undefined, w, h, PILL.corner, PILL.corner, PILL.corner, PILL.corner);
}

export type BtnColor = 'gold' | 'green' | 'red' | 'blue' | 'purple' | 'dark';

export interface ButtonOpts {
  color?: BtnColor; size?: number; icon?: string; iconScale?: number; sub?: string; disabled?: boolean;
  guard?: (p: Phaser.Input.Pointer) => boolean; sfx?: boolean;
}

export class Button extends Phaser.GameObjects.Container {
  bg: Phaser.GameObjects.NineSlice;
  label: Phaser.GameObjects.Text;
  sub?: Phaser.GameObjects.Text;
  icon?: Phaser.GameObjects.Image;
  enabled = true;
  private downAt = { x: 0, y: 0 };
  constructor(scene: Phaser.Scene, x: number, y: number, w: number, h: number, text: string, public onClick: () => void, o: ButtonOpts = {}) {
    super(scene, x, y);
    const color = o.color ?? 'gold';
    const hc = Math.min(BTN.corner, h / 2);
    this.bg = scene.add.nineslice(0, 0, `btn_${color}`, undefined, w, h, BTN.corner, BTN.corner, hc, hc);
    this.add(this.bg);
    const dark = color === 'gold';
    const size = o.size ?? Math.round(h * 0.36);
    let lx = 0;
    if (o.icon) {
      this.icon = scene.add.image(0, -4, o.icon).setScale(o.iconScale ?? (h * 0.5) / 128);
      this.add(this.icon);
    }
    this.label = txt(scene, 0, o.sub ? -h * 0.12 : -h * 0.04, text, {
      size, font: 'num', weight: '700', color: dark ? '#3a1c02' : '#ffffff', stroke: dark ? '#FFF6CF' : '#1a0a10', strokeW: dark ? 0 : Math.round(size / 6), shadow: !dark,
    });
    this.add(this.label);
    if (this.icon) {
      const iw = this.icon.displayWidth, gap = 8;
      const total = iw + gap + this.label.width;
      lx = -total / 2 + iw + gap + this.label.width / 2;
      this.icon.x = -total / 2 + iw / 2;
      this.label.x = lx;
    }
    if (o.sub) {
      this.sub = txt(scene, 0, h * 0.2, o.sub, { size: Math.round(size * 0.55), font: 'num', weight: '500', color: dark ? '#5a3002' : '#e8e0f0', strokeW: 0, shadow: false });
      this.add(this.sub);
    }
    this.setSize(w, h);
    this.setInteractive({ useHandCursor: true });
    this.on('pointerdown', (p: Phaser.Input.Pointer) => {
      if (!this.enabled) return;
      this.downAt = { x: p.x, y: p.y };
      scene.tweens.add({ targets: this, scale: 0.93, duration: 60 });
    });
    this.on('pointerout', () => scene.tweens.add({ targets: this, scale: 1, duration: 90 }));
    this.on('pointerup', (p: Phaser.Input.Pointer) => {
      scene.tweens.add({ targets: this, scale: 1, duration: 120, ease: 'Back.Out' });
      if (!this.enabled) { ctx.sfx.play('error'); return; }
      if (Math.hypot(p.x - this.downAt.x, p.y - this.downAt.y) > 24) return;
      if (o.guard && !o.guard(p)) return;
      if (o.sfx !== false) ctx.sfx.play('tick');
      this.onClick();
    });
    if (o.disabled) this.setEnabled(false);
    scene.add.existing(this);
  }
  setEnabled(v: boolean) {
    this.enabled = v;
    this.setAlpha(v ? 1 : 0.5);
    return this;
  }
  setLabel(s: string) { this.label.setText(s); return this; }
}

export function iconAmount(scene: Phaser.Scene, x: number, y: number, key: string, amount: string, size = 64, fontSize = 40) {
  const c = scene.add.container(x, y);
  const img = scene.add.image(0, 0, key).setDisplaySize(size, size);
  const t = txt(scene, size * 0.55, 2, amount, { size: fontSize, font: 'num', weight: '700', origin: [0, 0.5] });
  c.add([img, t]);
  const w = size + t.width;
  img.x = -w / 2 + size / 2;
  t.x = -w / 2 + size * 1.05;
  return c;
}

/** Clickable image with squash feedback. */
export function hotImage(scene: Phaser.Scene, img: Phaser.GameObjects.Image | Phaser.GameObjects.Container, onClick: () => void, pad = 0) {
  const base = { x: img.scaleX, y: img.scaleY };
  if (img instanceof Phaser.GameObjects.Image) img.setInteractive({ useHandCursor: true, pixelPerfect: false });
  else img.setInteractive(new Phaser.Geom.Rectangle(-img.width / 2 - pad, -img.height / 2 - pad, img.width + pad * 2, img.height + pad * 2), Phaser.Geom.Rectangle.Contains);
  img.on('pointerdown', () => scene.tweens.add({ targets: img, scaleX: base.x * 0.9, scaleY: base.y * 0.9, duration: 60 }));
  img.on('pointerout', () => scene.tweens.add({ targets: img, scaleX: base.x, scaleY: base.y, duration: 90 }));
  img.on('pointerup', () => {
    scene.tweens.add({ targets: img, scaleX: base.x, scaleY: base.y, duration: 160, ease: 'Back.Out' });
    ctx.sfx.play('tick');
    onClick();
  });
}

export function badge(scene: Phaser.Scene, x: number, y: number, label: string, color: 'red' | 'blue' | 'gold' | 'green' = 'red', size = 130) {
  const c = scene.add.container(x, y);
  const seal = scene.add.image(0, 0, `seal_${color}`).setDisplaySize(size, size);
  const lines = label.split(' ');
  const t = txt(scene, 0, 0, lines.join('\n'), {
    size: Math.round(size * (lines.length > 1 ? 0.17 : 0.2)), font: 'num', weight: '700',
    color: color === 'gold' ? '#3a1c02' : '#fff', strokeW: color === 'gold' ? 0 : 3, stroke: '#2a0208', lineSpacing: -6,
  });
  c.add([seal, t]);
  c.setAngle(-12);
  return c;
}

/** Vertical scroll viewport with drag + inertia. Content is added to `.content`. */
export class Scroller {
  content: Phaser.GameObjects.Container;
  private maskG: Phaser.GameObjects.Graphics;
  private dragging = false;
  private lastY = 0;
  private vel = 0;
  private contentH = 0;
  private startDown = 0;
  moved = 0;
  constructor(private scene: Phaser.Scene, private parent: Phaser.GameObjects.Container, private x: number, private y: number, private w: number, private h: number) {
    this.content = scene.add.container(x, y);
    parent.add(this.content);
    this.maskG = scene.make.graphics({}, false);
    this.content.setMask(this.maskG.createGeometryMask());
    this.redrawMask(parent);
    scene.input.on('pointerdown', this.down, this);
    scene.input.on('pointermove', this.move, this);
    scene.input.on('pointerup', this.up, this);
    scene.events.on('update', this.tick, this);
    this.content.once('destroy', () => this.destroy());
  }
  private worldRect(parent: Phaser.GameObjects.Container) {
    const m = parent.getWorldTransformMatrix();
    return { x: m.tx + this.x * m.scaleX, y: m.ty + this.y * m.scaleY, w: this.w * m.scaleX, h: this.h * m.scaleY };
  }
  redrawMask(parent: Phaser.GameObjects.Container) {
    const r = this.worldRect(parent);
    this.maskG.clear();
    this.maskG.fillStyle(0xffffff);
    this.maskG.fillRect(r.x, r.y, r.w, r.h);
    this.rect = r;
  }
  rect = { x: 0, y: 0, w: 0, h: 0 };
  setContentHeight(h: number) { this.contentH = h; }
  inView = (p: Phaser.Input.Pointer) => p.x >= this.rect.x && p.x <= this.rect.x + this.rect.w && p.y >= this.rect.y && p.y <= this.rect.y + this.rect.h && this.moved < 24;
  private down(p: Phaser.Input.Pointer) {
    if (!(p.x >= this.rect.x && p.x <= this.rect.x + this.rect.w && p.y >= this.rect.y && p.y <= this.rect.y + this.rect.h)) return;
    this.dragging = true; this.lastY = p.y; this.vel = 0; this.moved = 0; this.startDown = p.y;
  }
  private move(p: Phaser.Input.Pointer) {
    if (!this.dragging || !p.isDown) return;
    const dy = p.y - this.lastY;
    this.lastY = p.y;
    this.moved = Math.max(this.moved, Math.abs(p.y - this.startDown));
    this.vel = dy;
    this.scrollBy(dy);
  }
  private up() { this.dragging = false; }
  private tick() {
    if (this.parent.active) this.redrawMask(this.parent);
    if (!this.dragging && Math.abs(this.vel) > 0.3) { this.scrollBy(this.vel); this.vel *= 0.92; }
  }
  scrollBy(dy: number) {
    const min = Math.min(0, this.h - this.contentH);
    this.content.y = Phaser.Math.Clamp(this.content.y + dy, this.y + min, this.y);
  }
  scrollTo(offset: number) {
    const min = Math.min(0, this.h - this.contentH);
    this.content.y = Phaser.Math.Clamp(this.y - offset, this.y + min, this.y);
  }
  destroy() {
    this.scene.input.off('pointerdown', this.down, this);
    this.scene.input.off('pointermove', this.move, this);
    this.scene.input.off('pointerup', this.up, this);
    this.scene.events.off('update', this.tick, this);
    this.maskG.destroy();
  }
}
