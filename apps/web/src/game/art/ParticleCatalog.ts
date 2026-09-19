import Phaser from 'phaser';
import { txt } from '../ui/kit';

type Img = Phaser.GameObjects.Image;

/** Pooled juice: flashes, rings, sparks, shards, coins/gems that fly to the HUD, float text, confetti. */
export class Fx {
  private pool: Record<string, Img[]> = {};
  private textPool: Phaser.GameObjects.Text[] = [];
  sparks: Phaser.GameObjects.Particles.ParticleEmitter;
  embers: Phaser.GameObjects.Particles.ParticleEmitter;
  live = 0;
  static CAP = 200;

  constructor(private scene: Phaser.Scene, private depth = 30) {
    this.sparks = scene.add.particles(0, 0, 'p_spark', {
      speed: { min: 260, max: 900 }, lifespan: { min: 300, max: 700 }, scale: { start: 0.9, end: 0 },
      blendMode: 'ADD', gravityY: 900, emitting: false, rotate: { min: 0, max: 360 },
    }).setDepth(depth + 2);
    this.embers = scene.add.particles(0, 0, 'p_ember', {
      speed: { min: 60, max: 260 }, lifespan: { min: 600, max: 1400 }, scale: { start: 1.4, end: 0 },
      blendMode: 'ADD', gravityY: -120, emitting: false, alpha: { start: 1, end: 0 },
    }).setDepth(depth + 1);
  }

  private get(key: string): Img | null {
    if (this.live >= Fx.CAP) return null;
    const list = (this.pool[key] ||= []);
    let img = list.pop();
    if (!img) img = this.scene.add.image(0, 0, key);
    img.setActive(true).setVisible(true).setAlpha(1).setScale(1).setAngle(0).setTint(0xffffff).setBlendMode(Phaser.BlendModes.NORMAL).setDepth(this.depth);
    this.live++;
    return img;
  }
  private release(key: string, img: Img) {
    img.setActive(false).setVisible(false);
    this.scene.tweens.killTweensOf(img);
    (this.pool[key] ||= []).push(img);
    this.live--;
  }

  flash(x: number, y: number, scale = 1.4, tint = 0xffffff) {
    const f = this.get('p_flare'); if (!f) return;
    f.setPosition(x, y).setScale(scale * 0.4).setBlendMode(Phaser.BlendModes.ADD).setTint(tint).setDepth(this.depth + 3);
    this.scene.tweens.add({ targets: f, scale: scale, alpha: 0, duration: 320, ease: 'Cubic.Out', onComplete: () => this.release('p_flare', f) });
  }

  ring(x: number, y: number, tint = 0xffe9a3, scale = 1.6, dur = 480) {
    const r = this.get('p_ring'); if (!r) return;
    r.setPosition(x, y).setScale(0.15).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setDepth(this.depth + 2);
    this.scene.tweens.add({ targets: r, scale, alpha: 0, duration: dur, ease: 'Cubic.Out', onComplete: () => this.release('p_ring', r) });
  }

  burst(x: number, y: number, n: number, tint = 0xffe9a3) {
    this.sparks.setParticleTint(tint);
    this.sparks.explode(Math.min(n, 60), x, y);
  }
  emberPuff(x: number, y: number, n = 10) { this.embers.explode(n, x, y); }

  /** Shatter into shards; optionally fly them to a HUD target. */
  shards(x: number, y: number, n: number, tint: number, to?: { x: number; y: number }, onArrive?: () => void) {
    let arrived = false;
    for (let i = 0; i < n; i++) {
      const s = this.get('p_shard'); if (!s) break;
      const a = Math.random() * Math.PI * 2, d = 60 + Math.random() * 120;
      s.setPosition(x, y).setTint(tint).setScale(0.6 + Math.random() * 0.8).setAngle(Math.random() * 360).setDepth(this.depth + 1);
      const mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d;
      this.scene.tweens.add({
        targets: s, x: mx, y: my, angle: s.angle + 240, duration: 260, ease: 'Cubic.Out',
        onComplete: () => {
          if (!to) {
            this.scene.tweens.add({ targets: s, alpha: 0, y: my + 60, duration: 300, onComplete: () => this.release('p_shard', s) });
            return;
          }
          this.scene.tweens.add({
            targets: s, x: to.x, y: to.y, scale: 0.3, duration: 380 + i * 25, ease: 'Cubic.In',
            onComplete: () => { this.release('p_shard', s); if (!arrived) { arrived = true; onArrive?.(); } },
          });
        },
      });
    }
  }

  /** Arcing currency fountain into a HUD pill. onEach fires per arrival. */
  flyTo(key: 'coin' | 'gem' | 'ic_card' | 'ic_chest', x: number, y: number, to: { x: number; y: number }, count: number, onEach?: (i: number) => void, size = 64) {
    for (let i = 0; i < count; i++) {
      const c = this.get(key); if (!c) { onEach?.(i); continue; }
      c.setPosition(x, y).setDisplaySize(size, size).setDepth(this.depth + 5);
      const sx = c.scaleX;
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, pop = 120 + Math.random() * 160;
      const px = x + Math.cos(ang) * pop, py = y + Math.sin(ang) * pop;
      this.scene.tweens.add({
        targets: c, x: px, y: py, duration: 220 + Math.random() * 80, ease: 'Quad.Out', delay: i * 28,
        onComplete: () => {
          const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(px, py), new Phaser.Math.Vector2((px + to.x) / 2 + (Math.random() - 0.5) * 300, Math.min(py, to.y) - 120), new Phaser.Math.Vector2(to.x, to.y));
          const o = { t: 0 };
          this.scene.tweens.add({
            targets: o, t: 1, duration: 420 + Math.random() * 160, ease: 'Sine.In',
            onUpdate: () => { const p = path.getPoint(o.t); c.setPosition(p.x, p.y); c.setScale(sx * (1 - o.t * 0.4)); c.angle += 8; },
            onComplete: () => { this.release(key, c); onEach?.(i); },
          });
        },
      });
    }
  }

  floatText(x: number, y: number, s: string, o: { size?: number; color?: string; gold?: boolean; rise?: number; dur?: number; delay?: number } = {}) {
    let t = this.textPool.pop();
    const size = o.size ?? 64;
    if (!t) t = txt(this.scene, x, y, s, { size, gold: o.gold, color: o.color, weight: '900' });
    else { t.setText(s).setFontSize(size).setColor(o.color ?? '#F7EED8'); t.setActive(true).setVisible(true); }
    if (o.gold) { const g = t.context.createLinearGradient(0, 0, 0, t.height); g.addColorStop(0.1, '#FFF6CF'); g.addColorStop(0.5, '#F4C45A'); g.addColorStop(1, '#A56A12'); t.setFill(g); }
    t.setPosition(x, y).setDepth(this.depth + 8).setAlpha(0).setScale(0.4);
    this.scene.tweens.add({ targets: t, alpha: 1, scale: 1.12, duration: 160, ease: 'Back.Out', delay: o.delay ?? 0 });
    this.scene.tweens.add({
      targets: t, y: y - (o.rise ?? 150), duration: o.dur ?? 900, ease: 'Cubic.Out', delay: o.delay ?? 0,
      onComplete: () => this.scene.tweens.add({ targets: t, alpha: 0, scale: 0.9, duration: 220, onComplete: () => { t!.setVisible(false).setActive(false); this.textPool.push(t!); } }),
    });
  }

  confetti(x: number, y: number, n = 80, ash = false) {
    const colors = [0xf4c45a, 0xff5d6c, 0x7ee0ff, 0x3fe39a, 0xc79bff, 0xfff6cf];
    for (let i = 0; i < n; i++) {
      const key = ash ? 'p_ash' : 'p_confetti';
      const c = this.get(key); if (!c) break;
      c.setPosition(x, y).setTint(ash ? 0xffffff : colors[i % colors.length]).setScale(1 + Math.random()).setDepth(this.depth + 6);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6, v = 500 + Math.random() * 900;
      const vx = Math.cos(a) * v, vy = Math.sin(a) * v;
      const o = { t: 0 };
      const sx = c.x, sy = c.y, spin = (Math.random() - 0.5) * 20;
      this.scene.tweens.add({
        targets: o, t: 1, duration: 1600 + Math.random() * 900,
        onUpdate: () => {
          const tt = o.t * 1.8;
          c.x = sx + vx * tt * 0.6 + Math.sin(tt * 8 + i) * 30;
          c.y = sy + vy * tt * 0.6 + 900 * tt * tt * 0.5;
          c.angle += spin; c.scaleY = Math.abs(Math.sin(tt * 10 + i));
          c.alpha = 1 - o.t * o.t;
        },
        onComplete: () => this.release(key, c),
      });
    }
  }

  dust(x: number, y: number) {
    for (let i = 0; i < 6; i++) {
      const d = this.get('p_dot'); if (!d) break;
      d.setPosition(x + (Math.random() - 0.5) * 60, y + 40).setTint(0x8a7a6a).setAlpha(0.5).setScale(1.2 + Math.random());
      this.scene.tweens.add({ targets: d, x: d.x + (Math.random() - 0.5) * 120, y: d.y - 20 - Math.random() * 30, alpha: 0, scale: 3, duration: 500, ease: 'Cubic.Out', onComplete: () => this.release('p_dot', d) });
    }
  }
}
