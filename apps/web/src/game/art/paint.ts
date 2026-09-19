/** Canvas2D painting helpers shared by the procedural art bakers. */
import { mulberry32 } from '../systems/Rng';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  return [c, ctx];
}

export const seeded = mulberry32;

export function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: [number, string][]) {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function rad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: [number, string][], x1 = x, y1 = y) {
  const g = ctx.createRadialGradient(x, y, r0, x1, y1, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

export function rr(ctx: Ctx | Path2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function rrPath(x: number, y: number, w: number, h: number, r: number) {
  const p = new Path2D();
  rr(p, x, y, w, h, r);
  return p;
}

export function poly(pts: number[][], close = true) {
  const p = new Path2D();
  pts.forEach(([x, y], i) => (i ? p.lineTo(x, y) : p.moveTo(x, y)));
  if (close) p.closePath();
  return p;
}

/** Smooth closed shape through points (Catmull-Rom -> bezier). */
export function smooth(pts: number[][], tension = 0.5) {
  const p = new Path2D();
  const n = pts.length;
  p.moveTo(pts[0][0], pts[0][1]);
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const t = tension / 3;
    p.bezierCurveTo(
      p1[0] + (p2[0] - p0[0]) * t, p1[1] + (p2[1] - p0[1]) * t,
      p2[0] - (p3[0] - p1[0]) * t, p2[1] - (p3[1] - p1[1]) * t,
      p2[0], p2[1],
    );
  }
  p.closePath();
  return p;
}

export function star(cx: number, cy: number, spikes: number, r0: number, r1: number, rot = -Math.PI / 2) {
  const pts: number[][] = [];
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? r0 : r1;
    const a = rot + (i * Math.PI) / spikes;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return poly(pts);
}

export function glow(ctx: Ctx, x: number, y: number, r: number, color: string, a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = rad(ctx, x, y, 0, r, [[0, color], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

/** Speckle noise for stone / velvet texture. */
export function speckle(ctx: Ctx, x: number, y: number, w: number, h: number, n: number, seed: number, colors: string[], size = [0.6, 2.2]) {
  const r = seeded(seed);
  ctx.save();
  for (let i = 0; i < n; i++) {
    ctx.fillStyle = colors[Math.floor(r() * colors.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    ctx.globalAlpha = 0.25 + r() * 0.5;
    ctx.fillRect(x + r() * w, y + r() * h, s, s);
  }
  ctx.restore();
}

// Material ramps: [highlight, light, mid, dark, shadow]
export const MAT = {
  gold: ['#FFF6CF', '#FFE9A3', '#F4C45A', '#A56A12', '#4A2A05'],
  bronze: ['#F6D9A8', '#D9A25F', '#9C6A2E', '#5A3A14', '#24160A'],
  copper: ['#FFD2AE', '#F0A36B', '#C46A32', '#7A3712', '#3A1706'],
  silver: ['#FFFFFF', '#E6ECF3', '#AEB9C8', '#5F6B7E', '#262C38'],
  flint: ['#E8E0D4', '#B8AEA2', '#81776C', '#4A423A', '#211C18'],
  star: ['#FFFFFF', '#E7E2FF', '#B7A8F0', '#6A5AB8', '#241A52'],
  iron: ['#8C8A96', '#56535F', '#34313C', '#1E1C24', '#0C0B10'],
};

export function metal(ctx: Ctx, m: string[], x0: number, y0: number, x1: number, y1: number) {
  return lin(ctx, x0, y0, x1, y1, [[0, m[0]], [0.18, m[1]], [0.5, m[2]], [0.78, m[3]], [1, m[4]]]);
}

/** Banded "polished metal" gradient with a bright horizon line — reads as shiny at small sizes. */
export function chrome(ctx: Ctx, m: string[], x0: number, y0: number, x1: number, y1: number) {
  return lin(ctx, x0, y0, x1, y1, [
    [0, m[1]], [0.3, m[0]], [0.42, m[2]], [0.55, m[3]], [0.62, m[2]], [0.85, m[1]], [1, m[3]],
  ]);
}

export interface ShadeOpts {
  outline?: string;
  lw?: number;
  hi?: number;
  rim?: string;
  drop?: boolean;
}

/**
 * Fill a shape with the house lighting model:
 * warm key light from top-left, cold cursed-rune rim from bottom-right, dark ink outline.
 */
export function shade(ctx: Ctx, p: Path2D, fill: string | CanvasGradient, box: [number, number, number, number], o: ShadeOpts = {}) {
  const [x, y, w, h] = box;
  ctx.save();
  if (o.drop !== false) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 5;
  }
  ctx.fillStyle = fill;
  ctx.fill(p);
  ctx.restore();

  ctx.save();
  ctx.clip(p);
  // key light
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = rad(ctx, x + w * 0.3, y + h * 0.22, 0, Math.max(w, h) * 0.75, [
    [0, `rgba(255,244,214,${o.hi ?? 0.38})`], [1, 'rgba(255,244,214,0)'],
  ]);
  ctx.fillRect(x, y, w, h);
  // inner edge light: warm top-left, cold rim bottom-right
  ctx.globalCompositeOperation = 'source-over';
  ctx.lineWidth = Math.max(4, Math.min(w, h) * 0.07);
  ctx.strokeStyle = lin(ctx, x, y, x + w, y + h, [
    [0, 'rgba(255,240,200,0.55)'], [0.35, 'rgba(255,240,200,0)'], [0.62, 'rgba(126,224,255,0)'], [1, o.rim ?? 'rgba(126,224,255,0.7)'],
  ]);
  ctx.stroke(p);
  ctx.restore();

  if (o.outline !== 'none') {
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineWidth = o.lw ?? 5;
    ctx.strokeStyle = o.outline ?? '#170c05';
    ctx.stroke(p);
    ctx.restore();
  }
}

export function sparkle(ctx: Ctx, x: number, y: number, r: number, color = '#ffffff', a = 1) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.globalCompositeOperation = 'lighter';
  glow(ctx, x, y, r * 1.6, color, 0.5);
  ctx.fillStyle = color;
  ctx.fill(star(x, y, 4, r * 0.14, r, 0));
  ctx.restore();
}

/** Faceted gem: fills a path with a gradient, then overlays radial facets from a centre. */
export function facets(ctx: Ctx, p: Path2D, cx: number, cy: number, pts: number[][], light: string, dark: string) {
  ctx.save();
  ctx.clip(p);
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? light : dark;
    ctx.fill();
  }
  ctx.restore();
}

export function text(ctx: Ctx, s: string, x: number, y: number, font: string, fill: string | CanvasGradient, stroke?: string, lw = 6) {
  ctx.save();
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (stroke) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.strokeText(s, x, y);
  }
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
  ctx.restore();
}
