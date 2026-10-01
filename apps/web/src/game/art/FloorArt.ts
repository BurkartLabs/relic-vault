/**
 * The floor relics (chains 3-11), composed rather than drawn one at a time (docs/ROOMS.md, "The relics, and how
 * nine floors' worth get made"; AB#444 slice 1):
 *
 *  1. a **form** painter draws the silhouette (the twelve `Form` families in data/floors.ts), lit with the house
 *     model, in a ramp made from the relic's own colour. Each is parameterised by tier: a tier-8 vessel is a larger,
 *     more worked version of a tier-2 vessel, so the family reads and so does the rank;
 *  2. the floor's **finish** is a pass over the painted pixels only (salt grain and nacre on the Drowned Wing,
 *     glass and amber translucency in the Orchard, soot and ember in the Kilns, silvering on the Mirror Stair, wet
 *     wood in the Root Cellar, rime on the Frost Ledger);
 *  3. the floor's **ornament** pass is drawn over that (the Drowned Wing's barnacle line, the Orchard's graft seam,
 *     the Kilns' crackle, the Mirror Stair's reflection band, the Cellar's roots and fungus, the Ledger's frozen ink).
 *
 * The capstones (tier 9) are hand-painted, because the capstone is the image the player remembers. Floors 8-10
 * take their finishes and capstones in slice 3; until then their relics are form-composed in their own colours with
 * no floor pass, never a recoloured Antechamber relic.
 *
 * `floorPainterFor` is pure (no canvas), so a unit test can prove every floor id resolves to a painter.
 */
import { FLOORS, CAPSTONE_TIER, type Form } from '../data/floors';
import { Ctx, makeCanvas, lin, rad, poly, smooth, star, glow, shade, metal, chrome, facets, sparkle, rrPath, speckle, seeded } from './paint';

const OUT = '#160b05';
const FORMS: readonly Form[] = ['shard', 'vessel', 'effigy', 'mask', 'creature', 'instrument', 'seal', 'lantern', 'crown', 'book', 'frame', 'core'];

// ---------------------------------------------------------------- palette

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
function mix(a: number, b: number, t: number): string {
  const ch = (s: number) => [(a >> s) & 255, (b >> s) & 255];
  const c = [16, 8, 0].map((s) => { const [x, y] = ch(s); return Math.round(x + (y - x) * t); });
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
/** The relic's colour as a material ramp: [highlight, light, mid, dark, shadow], as paint.ts MAT ramps are. */
export function rampOf(color: number): string[] {
  return [mix(color, 0xffffff, 0.78), mix(color, 0xffffff, 0.36), hex(color), mix(color, 0x000000, 0.46), mix(color, 0x1a0f08, 0.82)];
}
const rgba = (h: string, a: number) => `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${a})`;

// ---------------------------------------------------------------- small helpers

function circle(x: number, y: number, r: number) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; }
function ellipse(x: number, y: number, rx: number, ry: number, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
function outline(ctx: Ctx, p: Path2D, lw = 5) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = OUT; ctx.stroke(p); ctx.restore();
}
function bar(ctx: Ctx, draw: (c: Ctx) => void, w: number, fill: string | CanvasGradient) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); draw(ctx); ctx.lineWidth = w + 7; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); draw(ctx); ctx.lineWidth = w; ctx.strokeStyle = fill; ctx.stroke();
  ctx.restore();
}
/** A lit inset stone in the accent colour: the house "gem" used on higher tiers. */
function gem(ctx: Ctx, x: number, y: number, r: number, accent: string[]) {
  shade(ctx, circle(x, y, r), rad(ctx, x - r * 0.3, y - r * 0.3, 1, r * 1.1, [[0, '#ffffff'], [0.35, accent[1]], [0.75, accent[3]], [1, accent[4]]]), [x - r, y - r, r * 2, r * 2], { lw: 3, drop: false });
}
/** Glowing eyes, the creature and effigy "life" tell. */
function eyes(ctx: Ctx, pts: number[][], r: number, color: string) {
  for (const [x, y] of pts) {
    ctx.save(); ctx.fillStyle = '#140804'; ctx.fill(ellipse(x, y, r * 1.5, r)); ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.fillStyle = color; ctx.fill(ellipse(x, y, r * 0.8, r * 0.55)); ctx.restore();
  }
}

type FormPainter = (ctx: Ctx, r: string[], tier: number, rnd: () => number, accent: string[]) => void;

// ---------------------------------------------------------------- the twelve forms

/** A raw piece: jagged, faceted. More points and satellite crystals with tier. */
const shard: FormPainter = (ctx, r, t, rnd, a) => {
  const n = 8 + t;
  const pts: number[][] = [];
  for (let i = 0; i < n; i++) {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const rr = (i % 2 ? 62 : 88) + rnd() * 16;
    pts.push([128 + Math.cos(ang) * rr * 0.82, 136 + Math.sin(ang) * rr]);
  }
  for (let k = 0; k < Math.max(0, t - 3); k++) {
    const side = k % 2 ? 1 : -1, x = 128 + side * (58 + k * 5), y = 196 - k * 6;
    const sp = poly([[x - 10, y + 22], [x + side * 4, y - 26 - k * 3], [x + 12, y + 20]]);
    shade(ctx, sp, metal(ctx, r, x - 12, y - 30, x + 12, y + 24), [x - 12, y - 30, 24, 54], { lw: 4, drop: false });
  }
  const p = poly(pts);
  shade(ctx, p, metal(ctx, r, 60, 40, 200, 230), [52, 40, 152, 196], { outline: 'none', hi: 0.34 });
  facets(ctx, p, 124, 128, pts, 'rgba(255,255,255,0.14)', 'rgba(10,6,4,0.18)');
  outline(ctx, p);
  if (t >= 6) gem(ctx, 128, 132, 9 + t, a);
};

/** A container: lip, neck, belly, foot. Bands with tier; handles from tier 4, a lid from tier 6. */
const vessel: FormPainter = (ctx, r, t, _rnd, a) => {
  if (t >= 4) for (const s of [-1, 1]) bar(ctx, (c) => { c.moveTo(128 + s * 26, 84); c.bezierCurveTo(128 + s * 86, 70, 128 + s * 92, 136, 128 + s * 56, 146); }, 10, chrome(ctx, r, 40, 70, 220, 150));
  const p = new Path2D();
  p.moveTo(92, 58); p.lineTo(164, 58); p.quadraticCurveTo(170, 68, 154, 74); p.lineTo(154, 90);
  p.bezierCurveTo(206, 106, 212, 164, 180, 196); p.quadraticCurveTo(166, 208, 156, 210);
  p.lineTo(172, 232); p.lineTo(84, 232); p.lineTo(100, 210); p.quadraticCurveTo(90, 208, 76, 196);
  p.bezierCurveTo(44, 164, 50, 106, 102, 90); p.lineTo(102, 74); p.quadraticCurveTo(86, 68, 92, 58); p.closePath();
  shade(ctx, p, chrome(ctx, r, 52, 0, 206, 0), [52, 58, 154, 174], { outline: 'none', hi: 0.36 });
  ctx.save(); ctx.clip(p);
  const bands = 1 + Math.floor(t / 3);
  for (let i = 0; i < bands; i++) {
    const y = 128 + (i - (bands - 1) / 2) * 24;
    ctx.fillStyle = rgba(r[4], 0.55); ctx.fillRect(40, y, 180, 12);
    ctx.fillStyle = rgba(r[0], 0.7); ctx.fillRect(40, y - 2, 180, 2); ctx.fillRect(40, y + 12, 180, 2);
  }
  ctx.restore();
  outline(ctx, p);
  const lip = ellipse(128, 58, 38, 10);
  shade(ctx, lip, chrome(ctx, r, 90, 0, 166, 0), [90, 48, 76, 20], { lw: 4, drop: false });
  if (t >= 6) { shade(ctx, circle(128, 40, 11), rad(ctx, 124, 36, 1, 13, [[0, r[0]], [0.5, r[2]], [1, r[4]]]), [117, 29, 22, 22], { lw: 4, drop: false }); gem(ctx, 128, 128, 10, a); }
};

/** A figure: plinth, robed body, folded arms, head. A halo from tier 5, a crest from tier 7. */
const effigy: FormPainter = (ctx, r, t, _rnd, a) => {
  if (t >= 5) { ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = rgba(a[1], 0.85); ctx.shadowColor = a[1]; ctx.shadowBlur = 14; ctx.stroke(ellipse(128, 70, 50, 50)); ctx.restore(); }
  const plinth = rrPath(72, 204, 112, 30, 7);
  shade(ctx, plinth, metal(ctx, r, 72, 204, 72, 234), [72, 204, 112, 30], { lw: 5, hi: 0.2 });
  const body = smooth([[100, 108], [156, 108], [182, 160], [178, 206], [78, 206], [74, 160]], 0.45);
  shade(ctx, body, chrome(ctx, r, 70, 0, 186, 0), [74, 106, 108, 100], { outline: 'none' });
  ctx.save(); ctx.clip(body);
  ctx.strokeStyle = rgba(r[4], 0.5); ctx.lineWidth = 3;
  for (let i = 0; i < 2 + Math.floor(t / 3); i++) { const x = 98 + i * (60 / (1 + Math.floor(t / 3))); ctx.beginPath(); ctx.moveTo(x, 150); ctx.lineTo(x - 6, 206); ctx.stroke(); }
  ctx.restore();
  outline(ctx, body);
  shade(ctx, rrPath(90, 138, 76, 22, 11), metal(ctx, r, 90, 138, 90, 160), [90, 138, 76, 22], { lw: 4, drop: false });
  if (t >= 7) shade(ctx, star(128, 44, 5, 12, 30), metal(ctx, r, 98, 14, 158, 70), [98, 14, 60, 56], { lw: 4 });
  const head = circle(128, 80, 36);
  shade(ctx, head, rad(ctx, 114, 64, 4, 44, [[0, r[0]], [0.35, r[1]], [0.75, r[2]], [1, r[3]]]), [92, 44, 72, 72], { lw: 5 });
  eyes(ctx, [[114, 80], [142, 80]], 6, a[1]);
  if (t >= 3) gem(ctx, 128, 178, 7 + t * 0.6, a);
};

/** A face: oval, brow, eye slits. A forehead stone from tier 4, a radiating crest from tier 6. */
const mask: FormPainter = (ctx, r, t, _rnd, a) => {
  if (t >= 6) shade(ctx, star(128, 120, 8 + t, 80, 118), rad(ctx, 128, 120, 30, 118, [[0, r[1]], [0.6, r[2]], [1, r[3]]]), [10, 2, 236, 236], { lw: 4, hi: 0.2 });
  const face = smooth([[128, 36], [174, 48], [194, 100], [184, 150], [162, 196], [128, 226], [94, 196], [72, 150], [62, 100], [82, 48]], 0.5);
  shade(ctx, face, chrome(ctx, r, 62, 0, 194, 0), [62, 36, 132, 190], { outline: 'none', hi: 0.42 });
  ctx.save(); ctx.clip(face);
  ctx.strokeStyle = rgba(r[4], 0.7); ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 98); ctx.quadraticCurveTo(104, 82, 124, 96); ctx.moveTo(176, 98); ctx.quadraticCurveTo(152, 82, 132, 96);
  for (let i = 0; i < Math.min(3, Math.floor(t / 2)); i++) { ctx.moveTo(86 + i * 4, 150 + i * 10); ctx.quadraticCurveTo(98, 168 + i * 8, 110, 174 + i * 6); ctx.moveTo(170 - i * 4, 150 + i * 10); ctx.quadraticCurveTo(158, 168 + i * 8, 146, 174 + i * 6); }
  ctx.stroke();
  ctx.fillStyle = lin(ctx, 116, 0, 140, 0, [[0, rgba(r[0], 0.8)], [1, rgba(r[4], 0.5)]]);
  ctx.beginPath(); ctx.moveTo(126, 102); ctx.lineTo(116, 158); ctx.quadraticCurveTo(128, 166, 140, 158); ctx.lineTo(130, 102); ctx.fill();
  ctx.restore();
  outline(ctx, face);
  for (const s of [-1, 1]) {
    const cx = 128 + s * 30, eye = new Path2D();
    eye.moveTo(cx - 20, 118); eye.quadraticCurveTo(cx, 102, cx + 20, 118); eye.quadraticCurveTo(cx, 128, cx - 20, 118); eye.closePath();
    ctx.save(); ctx.fillStyle = '#140602'; ctx.fill(eye); ctx.clip(eye); glow(ctx, cx, 118, 16, rgba(a[1], 0.9)); ctx.restore();
    outline(ctx, eye, 3);
  }
  const mouth = new Path2D(); mouth.moveTo(110, 190); mouth.quadraticCurveTo(128, 182, 146, 190); mouth.quadraticCurveTo(128, 200, 110, 190); mouth.closePath();
  shade(ctx, mouth, metal(ctx, r, 110, 182, 110, 200), [110, 182, 36, 18], { lw: 3, drop: false });
  if (t >= 4) gem(ctx, 128, 66, 8 + t * 0.5, a);
};

/** A living thing: crouched body, head, ears, tail, legs. Spots with tier; wings from tier 5. */
const creature: FormPainter = (ctx, r, t, rnd, a) => {
  if (t >= 5) for (const s of [-1, 1]) {
    const w = ellipse(128 + s * 54, 96, 58, 34, s * -0.5);
    shade(ctx, w, rad(ctx, 128 + s * 54, 96, 4, 60, [[0, rgba(r[0], 0.95)], [0.7, rgba(r[1], 0.7)], [1, rgba(r[3], 0.8)]]), [128 + s * 54 - 60, 60, 120, 72], { lw: 4, drop: false });
  }
  bar(ctx, (c) => { c.moveTo(176, 176); c.bezierCurveTo(222, 170, 226, 120, 200, 104); }, 12, metal(ctx, r, 170, 100, 226, 180));
  for (const x of [88, 110, 150, 170]) shade(ctx, rrPath(x - 8, 184, 16, 42, 7), metal(ctx, r, x - 8, 184, x + 8, 226), [x - 8, 184, 16, 42], { lw: 4, drop: false });
  const body = ellipse(130, 164, 68, 42);
  shade(ctx, body, chrome(ctx, r, 62, 0, 198, 0), [62, 122, 136, 84], { outline: 'none', hi: 0.36 });
  ctx.save(); ctx.clip(body);
  for (let i = 0; i < t; i++) glow(ctx, 90 + rnd() * 90, 140 + rnd() * 44, 6 + rnd() * 5, rgba(r[4], 0.55));
  ctx.restore();
  outline(ctx, body);
  for (const s of [-1, 1]) shade(ctx, poly([[88 + s * 18, 76], [80 + s * 30, 42], [96 + s * 8, 70]]), metal(ctx, r, 70, 40, 110, 80), [70, 40, 40, 40], { lw: 4, drop: false });
  const head = circle(88, 96, 34);
  shade(ctx, head, rad(ctx, 76, 82, 4, 42, [[0, r[0]], [0.4, r[1]], [0.8, r[2]], [1, r[3]]]), [54, 62, 68, 68], { lw: 5 });
  eyes(ctx, [[78, 94], [100, 94]], 5.5, a[1]);
  if (t >= 7) gem(ctx, 130, 150, 9, a);
};

/** Something played: a base with pipes or strings. More pipes with tier; a crest from tier 6. */
const instrument: FormPainter = (ctx, r, t, _rnd, a) => {
  const n = 3 + Math.ceil(t / 2);
  const w = 132 / n;
  for (let i = 0; i < n; i++) {
    const mid = (n - 1) / 2, h = 150 - Math.abs(i - mid) * (60 / n) * 1.6;
    const x = 62 + i * w, y = 188 - h;
    const pipe = rrPath(x + 2, y, w - 4, h, Math.min(8, w / 2 - 1));
    shade(ctx, pipe, chrome(ctx, r, x, 0, x + w, 0), [x, y, w, h], { lw: 4, drop: i === 0, hi: 0.3 });
    ctx.save(); ctx.fillStyle = '#120603'; ctx.fill(ellipse(x + w / 2, y + h * 0.62, w * 0.22, 5)); ctx.restore();
  }
  if (t >= 6) shade(ctx, poly([[70, 64], [128, 22], [186, 64], [170, 70], [128, 40], [86, 70]]), metal(ctx, r, 70, 22, 186, 70), [70, 22, 116, 48], { lw: 4 });
  const base = rrPath(52, 184, 152, 44, 9);
  shade(ctx, base, metal(ctx, r, 52, 184, 52, 228), [52, 184, 152, 44], { lw: 5, hi: 0.22 });
  gem(ctx, 128, 206, 7 + t * 0.5, a);
};

/** A stamp: handle, neck, heavy disc, engraved device. More rim notches and device points with tier. */
const seal: FormPainter = (ctx, r, t, _rnd, a) => {
  const side = new Path2D();
  side.moveTo(46, 168); side.lineTo(46, 196); side.ellipse(128, 196, 82, 30, 0, Math.PI, 0, true); side.lineTo(210, 168); side.closePath();
  shade(ctx, side, metal(ctx, r, 46, 168, 46, 226), [46, 160, 164, 66], { lw: 5 });
  ctx.save(); ctx.strokeStyle = rgba(r[4], 0.8); ctx.lineWidth = 3;
  const notches = 8 + t * 2;
  for (let i = 0; i < notches; i++) { const ang = Math.PI * (i / (notches - 1)); const x = 128 - Math.cos(ang) * 80; ctx.beginPath(); ctx.moveTo(x, 172 + Math.sin(ang) * 26); ctx.lineTo(x, 196 + Math.sin(ang) * 26); ctx.stroke(); }
  ctx.restore();
  const top = ellipse(128, 168, 82, 30);
  shade(ctx, top, chrome(ctx, r, 46, 0, 210, 0), [46, 138, 164, 60], { lw: 5, drop: false });
  ctx.save(); ctx.scale(1, 0.37); ctx.translate(0, 168 / 0.37 - 168);
  const dev = star(128, 168, 3 + Math.floor(t / 2), 20, 52);
  ctx.fillStyle = rgba(r[4], 0.75); ctx.fill(dev); ctx.lineWidth = 3; ctx.strokeStyle = rgba(r[0], 0.8); ctx.stroke(dev);
  ctx.restore();
  const neck = rrPath(110, 96, 36, 70, 12);
  shade(ctx, neck, chrome(ctx, r, 110, 0, 146, 0), [110, 96, 36, 70], { lw: 4, drop: false });
  const knob = circle(128, 76, 30);
  shade(ctx, knob, rad(ctx, 118, 64, 2, 36, [[0, r[0]], [0.45, r[2]], [1, r[4]]]), [98, 46, 60, 60], { lw: 5 });
  if (t >= 5) gem(ctx, 128, 76, 10, a);
};

/** A light: ring, cap, glowing glass, bars, base. More bars and a stronger glow with tier. */
const lantern: FormPainter = (ctx, r, t, _rnd, a) => {
  glow(ctx, 128, 138, 70 + t * 6, rgba(a[1], 0.35 + t * 0.03));
  bar(ctx, (c) => { c.arc(128, 38, 18, 0, Math.PI * 2); }, 7, chrome(ctx, r, 108, 20, 148, 56));
  const glass = rrPath(84, 80, 88, 118, 22);
  ctx.save(); ctx.fillStyle = rad(ctx, 128, 136, 4, 70, [[0, '#ffffff'], [0.3, a[0]], [0.7, a[1]], [1, a[3]]]); ctx.fill(glass); ctx.restore();
  ctx.save(); ctx.clip(glass);
  const bars = 2 + Math.floor(t / 2);
  for (let i = 1; i <= bars; i++) { const x = 84 + (88 * i) / (bars + 1); ctx.fillStyle = r[3]; ctx.fillRect(x - 3, 80, 6, 118); ctx.fillStyle = rgba(r[0], 0.8); ctx.fillRect(x - 3, 80, 2, 118); }
  ctx.restore();
  outline(ctx, glass);
  const cap = poly([[74, 84], [96, 52], [160, 52], [182, 84]]);
  shade(ctx, cap, metal(ctx, r, 74, 52, 182, 84), [74, 52, 108, 32], { lw: 5 });
  const base = rrPath(70, 194, 116, 30, 8);
  shade(ctx, base, metal(ctx, r, 70, 194, 70, 224), [70, 194, 116, 30], { lw: 5 });
  sparkle(ctx, 110, 116, 10 + t);
};

/** A crown: band with points and stones. More points with tier; an inner cap from tier 6. */
const crown: FormPainter = (ctx, r, t, _rnd, a) => {
  if (t >= 6) { const capP = new Path2D(); capP.ellipse(128, 150, 66, 70, 0, Math.PI, 0); capP.closePath(); shade(ctx, capP, rad(ctx, 128, 110, 4, 70, [[0, a[1]], [1, a[3]]]), [62, 80, 132, 70], { lw: 4, drop: false }); }
  const n = 3 + Math.floor(t / 2);
  const pts: number[][] = [[54, 204], [54, 150]];
  for (let i = 0; i < n; i++) {
    const x0 = 54 + (148 * i) / n, x1 = 54 + (148 * (i + 1)) / n, xm = (x0 + x1) / 2;
    const h = i === Math.floor(n / 2) && n % 2 ? 108 : 92 - Math.abs(i - (n - 1) / 2) * 6;
    pts.push([x0, 150], [xm, 150 - h + 30]);
    if (i === n - 1) pts.push([x1, 150]);
  }
  pts.push([202, 204]);
  const body = poly(pts);
  shade(ctx, body, chrome(ctx, r, 54, 0, 202, 0), [54, 40, 148, 164], { outline: 'none', hi: 0.4 });
  ctx.save(); ctx.clip(body); ctx.fillStyle = rgba(r[4], 0.55); ctx.fillRect(40, 166, 180, 30); ctx.restore();
  outline(ctx, body);
  for (let i = 0; i < n; i++) { const xm = 54 + (148 * (i + 0.5)) / n; const tip = pts[3 + i * 2] ?? pts[pts.length - 2]; shade(ctx, circle(tip[0], tip[1] - 4, 8), rad(ctx, tip[0] - 2, tip[1] - 6, 1, 9, [[0, r[0]], [1, r[3]]]), [tip[0] - 8, tip[1] - 12, 16, 16], { lw: 3, drop: false }); gem(ctx, xm, 182, 6 + t * 0.4, a); }
};

/** A tome: cover, page block, spine bands, clasp, device. More bands with tier; a stone clasp from tier 5. */
const book: FormPainter = (ctx, r, t, _rnd, a) => {
  const pages = poly([[176, 64], [198, 76], [198, 222], [176, 212]]);
  shade(ctx, pages, lin(ctx, 176, 0, 198, 0, [[0, '#f4ecd8'], [1, '#b8a888']]), [176, 64, 22, 158], { lw: 4 });
  ctx.save(); ctx.strokeStyle = 'rgba(90,70,40,0.5)'; ctx.lineWidth = 1; for (let y = 84; y < 212; y += 6) { ctx.beginPath(); ctx.moveTo(178, y); ctx.lineTo(196, y + 6); ctx.stroke(); } ctx.restore();
  const cover = rrPath(58, 54, 124, 166, 10);
  shade(ctx, cover, metal(ctx, r, 58, 54, 182, 220), [58, 54, 124, 166], { outline: 'none', hi: 0.3 });
  ctx.save(); ctx.clip(cover);
  const bands = 2 + Math.floor(t / 3);
  for (let i = 0; i < bands; i++) { const y = 70 + (140 * (i + 0.5)) / bands; ctx.fillStyle = rgba(r[4], 0.7); ctx.fillRect(58, y - 4, 20, 8); ctx.fillStyle = rgba(r[0], 0.6); ctx.fillRect(58, y - 4, 20, 2); }
  ctx.strokeStyle = rgba(r[0], 0.55); ctx.lineWidth = 3; ctx.strokeRect(84, 72, 86, 130);
  ctx.restore();
  outline(ctx, cover);
  const dev = t >= 4 ? star(128, 136, 4 + Math.floor(t / 2), 12, 30) : circle(128, 136, 22);
  shade(ctx, dev, chrome(ctx, r, 98, 0, 158, 0), [98, 106, 60, 60], { lw: 4, drop: false });
  shade(ctx, rrPath(176, 124, 30, 26, 6), metal(ctx, r, 176, 124, 206, 150), [176, 124, 30, 26], { lw: 4, drop: false });
  if (t >= 5) gem(ctx, 191, 137, 7, a);
};

/** A structure: an arch of bone or metal with struts. More struts with tier; a light inside from tier 5. */
const frame: FormPainter = (ctx, r, t, _rnd, a) => {
  if (t >= 5) glow(ctx, 128, 140, 60 + t * 4, rgba(a[1], 0.5));
  const struts = 1 + Math.floor(t / 2);
  for (let i = 0; i < struts; i++) { const y = 212 - ((i + 1) * 150) / (struts + 1); const half = 58 * Math.sqrt(Math.max(0.1, 1 - ((212 - y - 20) / 170) ** 2)); bar(ctx, (c) => { c.moveTo(128 - half, y); c.lineTo(128 + half, y); }, 7, metal(ctx, r, 0, y - 6, 0, y + 6)); }
  bar(ctx, (c) => { c.moveTo(62, 226); c.bezierCurveTo(52, 110, 92, 38, 128, 34); c.bezierCurveTo(164, 38, 204, 110, 194, 226); }, 20, chrome(ctx, r, 40, 0, 216, 0));
  for (const x of [62, 194]) shade(ctx, rrPath(x - 16, 216, 32, 18, 5), metal(ctx, r, x - 16, 216, x - 16, 234), [x - 16, 216, 32, 18], { lw: 4, drop: false });
  gem(ctx, 128, 40, 8 + t * 0.5, a);
};

/** A heart of something: orb, orbit ring, rays. More rays with tier; a second ring from tier 6. */
const core: FormPainter = (ctx, r, t, _rnd, a) => {
  shade(ctx, star(128, 128, 6 + t, 58, 100 + t * 2), rad(ctx, 128, 128, 30, 110, [[0, rgba(a[1], 0.9)], [1, rgba(a[3], 0.9)]]), [20, 20, 216, 216], { lw: 3, hi: 0.15 });
  const back = new Path2D(); back.ellipse(128, 128, 96, 26, -0.35, Math.PI, Math.PI * 2);
  ctx.save(); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke(back); ctx.lineWidth = 5; ctx.strokeStyle = r[1]; ctx.stroke(back); ctx.restore();
  const orb = circle(128, 128, 50 + t * 1.5);
  shade(ctx, orb, rad(ctx, 112, 110, 4, 60 + t * 2, [[0, '#ffffff'], [0.25, r[0]], [0.6, r[2]], [1, r[4]]]), [78, 78, 100, 100], { lw: 5 });
  glow(ctx, 128, 128, 30, rgba(a[0], 0.7));
  const front = new Path2D(); front.ellipse(128, 128, 96, 26, -0.35, 0, Math.PI);
  ctx.save(); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.stroke(front); ctx.lineWidth = 5; ctx.strokeStyle = r[0]; ctx.stroke(front); ctx.restore();
  if (t >= 6) { const f2 = new Path2D(); f2.ellipse(128, 128, 88, 22, 0.6, 0, Math.PI * 2); ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = rgba(a[0], 0.8); ctx.stroke(f2); ctx.restore(); }
  sparkle(ctx, 110, 106, 12 + t);
};

const FORM_PAINTERS: Record<Form, FormPainter> = { shard, vessel, effigy, mask, creature, instrument, seal, lantern, crown, book, frame, core };

// ---------------------------------------------------------------- floor finishes and ornaments

interface FloorStyle {
  /** over the painted pixels only (source-atop) */
  finish(ctx: Ctx, rnd: () => number, r: string[]): void;
  /** the floor's mark, over the finish */
  ornament(ctx: Ctx, rnd: () => number, r: string[], tier: number): void;
  /** the stones and lights a relic of this floor wears */
  accent: string[];
}

/** The Drowned Wing: salt grain, a nacre sheen, and a line of barnacles along the waterline. */
const DROWNED: FloorStyle = {
  accent: ['#e8fffd', '#4fe0d8', '#27a8a2', '#0e5a5a', '#062a2c'],
  finish(ctx, rnd) {
    ctx.fillStyle = lin(ctx, 40, 40, 216, 216, [[0, 'rgba(255,200,230,0)'], [0.38, 'rgba(255,200,230,0.22)'], [0.5, 'rgba(190,255,250,0.3)'], [0.62, 'rgba(255,255,255,0.22)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 30, 30, 196, 200, 220, Math.floor(rnd() * 1e6), ['#ffffff', '#f4f8f6', '#cfe0dc'], [0.8, 2.4]);
  },
  ornament(ctx, rnd, _r, tier) {
    // the tide line: a salt mark where the water stood, and barnacles grown along it
    const y0 = 184 - tier * 2, wave = (x: number) => y0 + Math.sin(x / 19) * 4;
    ctx.save(); ctx.lineCap = 'round';
    ctx.beginPath(); for (let x = 20; x <= 236; x += 4) (x === 20 ? ctx.moveTo(x, wave(x)) : ctx.lineTo(x, wave(x)));
    ctx.lineWidth = 7; ctx.strokeStyle = 'rgba(240,248,246,0.5)'; ctx.stroke();
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(60,90,90,0.45)'; ctx.stroke();
    const n = 3 + Math.floor(tier / 2);
    for (let i = 0; i < n; i++) {
      const x = 60 + (i / Math.max(1, n - 1)) * 136 + (rnd() - 0.5) * 14, y = wave(x) + 2, s = 5 + rnd() * 3 + tier * 0.25;
      ctx.fillStyle = rad(ctx, x - s * 0.3, y - s * 0.4, 0.5, s * 1.2, [[0, '#fbf8ee'], [0.6, '#d6cfbc'], [1, '#8a8474']]);
      ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(30,26,20,0.85)'; ctx.stroke();
      ctx.fillStyle = '#1c2a2a'; ctx.beginPath(); ctx.ellipse(x, y - s * 0.1, s * 0.42, s * 0.28, 0, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  },
};

/** The Glass Orchard: light through glass and amber, a bright streak, and the graft seam where it was joined. */
const ORCHARD: FloorStyle = {
  accent: ['#fff8d0', '#ffd05a', '#e8a020', '#8a5a08', '#3a2404'],
  finish(ctx) {
    ctx.fillStyle = rad(ctx, 128, 120, 4, 110, [[0, 'rgba(255,255,235,0.42)'], [0.55, 'rgba(255,255,235,0.1)'], [1, 'rgba(255,255,235,0)']]);
    ctx.fillRect(0, 0, 256, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.save(); ctx.translate(128, 128); ctx.rotate(-0.7); ctx.fillRect(-120, -52, 240, 7); ctx.fillRect(-120, -36, 240, 3); ctx.restore();
    ctx.fillStyle = lin(ctx, 0, 150, 0, 250, [[0, 'rgba(40,90,40,0)'], [1, 'rgba(40,90,40,0.22)']]);
    ctx.fillRect(0, 150, 256, 106);
  },
  ornament(ctx, rnd, _r, tier) {
    // the graft seam: where a cutting was joined to its stock, down the right side, clear of any face; buds on it
    const x0 = 150 + rnd() * 10, pt = (u: number) => [x0 + u * 42 + Math.sin(u * 9) * 5, 44 + u * 176];
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); for (let i = 0; i <= 40; i++) { const [x, y] = pt(i / 40); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(46,92,36,0.8)'; ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(220,255,200,0.85)'; ctx.stroke();
    const buds = 1 + Math.floor(tier / 3);
    for (let i = 0; i < buds; i++) {
      const [x, y] = pt((i + 0.5) / buds);
      ctx.fillStyle = rad(ctx, x - 2, y - 2, 0.5, 6, [[0, '#e8ffd0'], [1, '#3a8a2a']]);
      ctx.beginPath(); ctx.ellipse(x + 5, y - 2, 6, 3.5, -0.6, 0, Math.PI * 2); ctx.fill();
      ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(20,50,16,0.9)'; ctx.stroke();
    }
    ctx.restore();
  },
};

/** The Ash Kilns: soot pooled low, embers under the glaze, and the crackle of something fired too hot. */
const KILNS: FloorStyle = {
  accent: ['#fff0c8', '#ff9a3c', '#e05a18', '#7a2208', '#2a0a02'],
  finish(ctx, rnd) {
    ctx.fillStyle = lin(ctx, 0, 90, 0, 240, [[0, 'rgba(24,14,10,0)'], [1, 'rgba(24,14,10,0.5)']]);
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) glow(ctx, 70 + rnd() * 116, 120 + rnd() * 90, 14 + rnd() * 10, 'rgba(255,120,40,0.55)');
    speckle(ctx, 30, 120, 196, 110, 90, Math.floor(rnd() * 1e6), ['#1a0e08', '#3a2418'], [0.8, 2]);
  },
  ornament(ctx, rnd, _r, tier) {
    // the crackle: a few jagged cracks across the lower body, where the heat was, fire showing in them; faces stay clean
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'miter';
    const cracks = 2 + Math.floor(tier / 3);
    for (let i = 0; i < cracks; i++) {
      let x = 70 + ((i + 0.5) / cracks) * 116 + (rnd() - 0.5) * 20, y = 150 + rnd() * 50;
      const dir = rnd() > 0.5 ? 1 : -1;
      const path = new Path2D(); path.moveTo(x, y);
      for (let k = 0; k < 5; k++) { x += dir * (6 + rnd() * 5); y += (k % 2 ? -1 : 1) * (5 + rnd() * 6); path.lineTo(x, y); }
      ctx.lineWidth = 3.2; ctx.strokeStyle = 'rgba(28,10,4,0.95)'; ctx.stroke(path);
      ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 7; ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(255,190,100,0.95)'; ctx.stroke(path); ctx.shadowBlur = 0;
    }
    ctx.restore();
  },
};

/** The Mirror Stair: cold silvering, hard-edged glints, and a band of glass across the foot showing the relic upside down. */
const MIRROR: FloorStyle = {
  accent: ['#ffffff', '#d8ecff', '#9fc4ea', '#46607e', '#141e2c'],
  finish(ctx, rnd) {
    // silvered glass: cold at the top, a blue-black back where the silver has gone thin
    ctx.fillStyle = lin(ctx, 0, 30, 0, 230, [[0, 'rgba(235,245,255,0.28)'], [0.55, 'rgba(160,190,220,0.08)'], [1, 'rgba(20,30,50,0.32)']]);
    ctx.fillRect(0, 0, 256, 256);
    // the glints are hard-edged, not soft light: a mirror, not glass
    ctx.save(); ctx.translate(128, 128); ctx.rotate(0.62);
    const x = -40 + rnd() * 30;
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(x, -140, 16, 280);
    ctx.fillStyle = 'rgba(255,255,255,0.28)'; ctx.fillRect(x + 24, -140, 5, 280);
    ctx.restore();
    // desilvering: a few dark flecks where the backing let go
    speckle(ctx, 30, 150, 196, 80, 40, Math.floor(rnd() * 1e6), ['#1e2838', '#3a4658'], [1, 2.6]);
  },
  ornament(ctx, rnd, _r, tier) {
    // the reflection band: the relic's own belly, seen upside down in a strip of mirror across its foot. Deeper with tier.
    const [copy, cc] = makeCanvas(256, 256);
    cc.drawImage(ctx.canvas, 0, 0);
    const top = 182 - tier * 3, h = 22 + tier * 3;
    ctx.save();
    ctx.beginPath(); ctx.rect(0, top, 256, h); ctx.clip();
    ctx.fillStyle = 'rgba(40,56,80,0.55)'; ctx.fillRect(0, top, 256, h);
    ctx.globalAlpha = 0.85; ctx.translate(0, top * 2); ctx.scale(1, -1); ctx.drawImage(copy, 0, 0);
    ctx.restore();
    ctx.save();
    ctx.fillStyle = lin(ctx, 0, top, 0, top + h, [[0, 'rgba(255,255,255,0.35)'], [0.4, 'rgba(255,255,255,0)'], [1, 'rgba(10,16,28,0.35)']]);
    ctx.fillRect(0, top, 256, h);
    ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.fillRect(0, top - 1, 256, 2.5);
    ctx.fillStyle = 'rgba(20,28,44,0.8)'; ctx.fillRect(0, top + h, 256, 2);
    // a bevel mark per few tiers along the band, where the glass was cut
    for (let i = 0; i < 1 + Math.floor(tier / 3); i++) { const bx = 50 + rnd() * 156; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(bx, top + 3, 1.5, h - 6); }
    ctx.restore();
  },
};

/** The Root Cellar: wet wood grain, black loam low down, and roots and fungus coming up over everything. */
const CELLAR: FloorStyle = {
  accent: ['#f0ffe0', '#b8f090', '#6ac050', '#2a6a22', '#0e2a0c'],
  finish(ctx, rnd) {
    // wood grain: long dark wavering lines
    ctx.save(); ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(40,24,10,0.3)';
    for (let i = 0; i < 16; i++) {
      const x0 = 30 + i * 13 + rnd() * 6, ph = rnd() * 6;
      ctx.beginPath(); for (let y = 20; y <= 240; y += 8) { const x = x0 + Math.sin(y / 22 + ph) * 4; if (y === 20) ctx.moveTo(x, y); else ctx.lineTo(x, y); } ctx.stroke();
    }
    ctx.restore();
    // the damp: darker from the floor up, and a wet gloss high on the surface
    ctx.fillStyle = lin(ctx, 0, 110, 0, 240, [[0, 'rgba(30,20,10,0)'], [1, 'rgba(30,20,10,0.55)']]);
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 6; i++) { const x = 70 + rnd() * 110, y = 60 + rnd() * 80; ctx.fillStyle = 'rgba(240,255,240,0.55)'; ctx.beginPath(); ctx.ellipse(x, y, 4 + rnd() * 4, 1.6, -0.4, 0, Math.PI * 2); ctx.fill(); }
    speckle(ctx, 30, 170, 196, 70, 120, Math.floor(rnd() * 1e6), ['#1a120a', '#3a2a18', '#5a4a30'], [0.8, 2.4]);
  },
  ornament(ctx, rnd, _r, tier) {
    // roots coming up from the floor over the relic, more and longer with tier
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    const roots = 2 + Math.floor(tier / 2);
    const grow = (x: number, y: number, ang: number, len: number, w: number) => {
      const p = new Path2D(); p.moveTo(x, y);
      for (let k = 0; k < Math.ceil(len / 10); k++) { ang += (rnd() - 0.5) * 0.7; x += Math.cos(ang) * 10; y += Math.sin(ang) * 10; p.lineTo(x, y); }
      ctx.lineWidth = w + 2.5; ctx.strokeStyle = 'rgba(24,14,6,0.9)'; ctx.stroke(p);
      ctx.lineWidth = w; ctx.strokeStyle = '#8a6a44'; ctx.stroke(p);
      ctx.lineWidth = Math.max(1, w * 0.35); ctx.strokeStyle = 'rgba(230,200,150,0.7)'; ctx.stroke(p);
      return [x, y, ang] as const;
    };
    for (let i = 0; i < roots; i++) {
      const x = 60 + ((i + 0.5) / roots) * 136 + (rnd() - 0.5) * 16;
      const [ex, ey, ea] = grow(x, 240, -Math.PI / 2 + (rnd() - 0.5) * 0.8, 40 + tier * 5 + rnd() * 20, 4 + tier * 0.25);
      if (tier >= 4) grow(ex, ey, ea + (rnd() > 0.5 ? 0.9 : -0.9), 18 + tier * 2, 2);
    }
    // fungus: a cluster of pale caps on one side, from tier 3
    const caps = tier >= 3 ? 1 + Math.floor((tier - 2) / 2) : 0;
    const cx = rnd() > 0.5 ? 78 : 170;
    for (let i = 0; i < caps; i++) {
      const x = cx + (i - (caps - 1) / 2) * 14 + (rnd() - 0.5) * 4, y = 200 - (i % 2) * 10, s = 6 + rnd() * 3 + tier * 0.4;
      ctx.fillStyle = '#e8dcc8'; ctx.fillRect(x - 1.5, y, 3, s);
      const capP = new Path2D(); capP.ellipse(x, y, s, s * 0.6, 0, Math.PI, 0); capP.closePath();
      ctx.fillStyle = rad(ctx, x - s * 0.3, y - s * 0.4, 0.5, s * 1.2, [[0, '#fff4e8'], [0.6, '#d8b8e0'], [1, '#8a6a98']]); ctx.fill(capP);
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(30,16,30,0.85)'; ctx.stroke(capP);
    }
    ctx.restore();
  },
};

/** The Frost Ledger: rime at the rim, ice light across the face, and the ledger's ruled lines and tallies frozen into it. */
const FROST: FloorStyle = {
  accent: ['#ffffff', '#bff0ff', '#5fd8ff', '#1a6a9a', '#06223a'],
  finish(ctx, rnd) {
    // ice: cold through the middle, rime whitening towards the edges
    ctx.fillStyle = rad(ctx, 128, 132, 20, 120, [[0, 'rgba(60,170,255,0.34)'], [0.65, 'rgba(150,220,255,0.3)'], [1, 'rgba(255,255,255,0.7)']]);
    ctx.fillRect(0, 0, 256, 256);
    // hard facet planes, the way ice fractures
    ctx.save(); ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 3; i++) { const x = 60 + rnd() * 130, y = 60 + rnd() * 120; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 30 + rnd() * 20, y - 10 - rnd() * 20); ctx.lineTo(x + 20, y + 26 + rnd() * 16); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    speckle(ctx, 20, 20, 216, 216, 180, Math.floor(rnd() * 1e6), ['#ffffff', '#e8f8ff'], [0.6, 1.8]);
  },
  ornament(ctx, rnd, _r, tier) {
    // frozen ink: the ledger's ruling across the lower body and a row of tallies, one group per two tiers
    ctx.save(); ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) { ctx.fillStyle = 'rgba(14,30,60,0.45)'; ctx.fillRect(40, 168 + i * 14, 176, 1.8); }
    ctx.fillStyle = 'rgba(160,30,40,0.5)'; ctx.fillRect(84, 156, 1.8, 58); // the margin rule, in red
    ctx.strokeStyle = 'rgba(10,20,44,0.85)'; ctx.lineWidth = 2.2;
    for (let g = 0; g < Math.min(5, 1 + Math.floor(tier / 2)); g++) {
      const gx = 96 + g * 24, gy = 172 + (g % 2) * 14;
      ctx.beginPath();
      for (let k = 0; k < 4; k++) { ctx.moveTo(gx + k * 4, gy); ctx.lineTo(gx + k * 4 - 1, gy + 10); }
      ctx.moveTo(gx - 3, gy + 8); ctx.lineTo(gx + 16, gy + 1);
      ctx.stroke();
    }
    // an ink blot that froze as it ran
    const bx = 60 + rnd() * 16, by = 184;
    ctx.fillStyle = 'rgba(10,20,44,0.75)'; ctx.beginPath(); ctx.ellipse(bx, by, 5, 4, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(bx - 1.5, by, 3, 10 + tier);
    // rime feathers growing in from the top corner
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.4;
    const fern = (x: number, y: number, ang: number, len: number) => {
      const ex = x + Math.cos(ang) * len, ey = y + Math.sin(ang) * len;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey);
      for (let u = 0.2; u < 1; u += 0.16) {
        const px = x + (ex - x) * u, py = y + (ey - y) * u, l = len * 0.28 * (1 - u);
        for (const s of [-1, 1]) { ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ang + s * 0.8) * l, py + Math.sin(ang + s * 0.8) * l); }
      }
      ctx.stroke();
    };
    for (let i = 0; i < 1 + Math.floor(tier / 3); i++) fern(40 + i * 14, 40 + i * 6, 0.7 + i * 0.25, 40 + tier * 3);
    ctx.restore();
  },
};

/** Floors 8-10 until slice 3 gives them their own: their colours only, no floor pass. */
/** The Clockworks: polished brass with the lathe's lines in it, and a cog and a mainspring worked into the metal. */
const CLOCKWORKS: FloorStyle = {
  accent: ['#fff6d8', '#ffd060', '#d09a28', '#6a4a10', '#2a1c06'],
  finish(ctx, rnd) {
    // polished brass: a warm horizon band, then the brushed lines the lathe left, curving with the piece
    ctx.fillStyle = lin(ctx, 0, 40, 0, 230, [[0, 'rgba(255,240,190,0.18)'], [0.42, 'rgba(255,250,220,0.4)'], [0.5, 'rgba(120,80,20,0.22)'], [1, 'rgba(60,36,6,0.3)']]);
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = 'rgba(255,240,200,0.14)'; ctx.lineWidth = 1;
    const cx = 128 + (rnd() - 0.5) * 20;
    for (let r = 20; r < 180; r += 5) { ctx.beginPath(); ctx.arc(cx, 150, r, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); }
  },
  ornament(ctx, rnd, _r, tier) {
    // the escapement: a cog low on one side, teeth and hub, and a coiled mainspring beside it; bigger with tier
    const side = rnd() > 0.5 ? 1 : -1, cx = 128 + side * (46 + rnd() * 10), cy = 186 - tier, R = 12 + tier * 1.2, teeth = 8 + tier;
    const cog = new Path2D();
    for (let i = 0; i < teeth * 2; i++) { const a = (i / (teeth * 2)) * Math.PI * 2, rr = i % 2 ? R : R + 4; i ? cog.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr) : cog.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    cog.closePath();
    ctx.save();
    ctx.fillStyle = 'rgba(90,60,14,0.55)'; ctx.fill(cog);
    ctx.lineWidth = 1.6; ctx.strokeStyle = 'rgba(255,236,170,0.85)'; ctx.stroke(cog);
    ctx.fillStyle = 'rgba(40,26,6,0.8)'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.32, 0, Math.PI * 2); ctx.fill();
    // the mainspring: an Archimedean coil opposite the cog
    ctx.strokeStyle = 'rgba(60,40,10,0.75)'; ctx.lineWidth = 2; ctx.beginPath();
    const sx = 256 - cx, sy = cy - 6;
    for (let t = 0; t <= Math.PI * 6; t += 0.2) { const rr = 1.2 * t; const x = sx + Math.cos(t) * rr, y = sy + Math.sin(t) * rr; t ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke(); ctx.strokeStyle = 'rgba(255,230,160,0.6)'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.restore();
  },
};

/** The Ink Vaults: vellum grain, ink pooled low and wicking up, and a red wax seal set on the piece with a line of script. */
const INK: FloorStyle = {
  accent: ['#fff4e0', '#e05050', '#a82828', '#4a0e0e', '#1a0404'],
  finish(ctx, rnd) {
    speckle(ctx, 30, 30, 196, 200, 160, Math.floor(rnd() * 1e6), ['#f4ead0', '#c8b890', '#8a7a58'], [0.6, 1.8]);
    // the ink wash: pooled at the foot, feathering upward
    ctx.fillStyle = lin(ctx, 0, 130, 0, 236, [[0, 'rgba(20,20,48,0)'], [0.6, 'rgba(20,20,48,0.28)'], [1, 'rgba(10,10,30,0.55)']]);
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) glow(ctx, 60 + rnd() * 136, 190 + rnd() * 30, 12 + rnd() * 10, 'rgba(18,18,50,0.45)');
  },
  ornament(ctx, rnd, _r, tier) {
    ctx.save(); ctx.lineCap = 'round';
    // a line of script, too small to read, where a clerk wrote on it
    ctx.strokeStyle = 'rgba(24,20,50,0.75)'; ctx.lineWidth = 1.4;
    const y0 = 150 + (rnd() - 0.5) * 16;
    for (let row = 0; row < 1 + Math.floor(tier / 4); row++) {
      ctx.beginPath(); let x = 70;
      ctx.moveTo(x, y0 + row * 9);
      while (x < 176) { const w = 4 + rnd() * 6; ctx.quadraticCurveTo(x + w / 2, y0 + row * 9 - 3 - rnd() * 3, x + w, y0 + row * 9); x += w + (rnd() < 0.25 ? 5 : 0); if (rnd() < 0.25) ctx.moveTo(x, y0 + row * 9); }
      ctx.stroke();
    }
    // the seal: a wax blob, its drips, and the impression of a device
    const side = rnd() > 0.5 ? 1 : -1, sx = 128 + side * (52 + rnd() * 10), sy = 204 - tier, sr = 7 + tier * 0.5; // a small seal at the foot, off to one side
    const blob = new Path2D();
    for (let i = 0; i <= 14; i++) { const a = (i / 14) * Math.PI * 2, rr = sr * (0.9 + rnd() * 0.2); i ? blob.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr) : blob.moveTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
    blob.closePath();
    ctx.fillStyle = rad(ctx, sx - sr * 0.3, sy - sr * 0.3, 1, sr * 1.2, [[0, '#ff8a7a'], [0.5, '#c02828'], [1, '#5a0808']]); ctx.fill(blob);
    ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(40,4,4,0.9)'; ctx.stroke(blob);
    ctx.strokeStyle = 'rgba(70,6,6,0.9)'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(sx, sy, sr * 0.55, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(70,6,6,0.9)'; ctx.fill(star(sx, sy, 5, sr * 0.14, sr * 0.36));
    ctx.fillStyle = 'rgba(255,200,190,0.7)'; ctx.beginPath(); ctx.ellipse(sx - sr * 0.4, sy - sr * 0.45, sr * 0.25, sr * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  },
};

/**
 * The Hollow Core: un-things (ROOMS.md). The relic is drawn as its own negative space: the silhouette is emptied to a
 * void with a little starlight in it, and only its inner edge is left, as a thin pale rim. A ghost of its detail
 * shows at the lowest alpha, so a tier still reads by what it once had.
 */
/** The Hollow Core finish leaves its rim here for the ornament pass that follows it (same relic, same paint). */
let hollowEdge: HTMLCanvasElement | null = null;
const HOLLOW: FloorStyle = {
  accent: ['#f0f0ff', '#b8b8ff', '#7070c0', '#2a2a50', '#0a0a18'],
  finish(ctx, rnd) {
    const [ghost, g] = makeCanvas(256, 256);
    g.drawImage(ctx.canvas, 0, 0);
    // the inner edge: the silhouette less itself eroded by 3 px (drawn shifted, kept only where all four agree)
    const [er, e] = makeCanvas(256, 256);
    e.drawImage(ghost, 0, 0);
    e.globalCompositeOperation = 'destination-in';
    for (const [dx, dy] of [[3, 0], [-3, 0], [0, 3], [0, -3]]) e.drawImage(ghost, dx, dy);
    const [ring, rg] = makeCanvas(256, 256);
    rg.drawImage(ghost, 0, 0);
    rg.globalCompositeOperation = 'destination-out'; rg.drawImage(er, 0, 0);
    rg.globalCompositeOperation = 'source-in'; rg.fillStyle = '#d8d8ff'; rg.fillRect(0, 0, 256, 256);
    // empty it
    ctx.fillStyle = rad(ctx, 128, 128, 4, 150, [[0, '#15152c'], [1, '#040410']]);
    ctx.fillRect(0, 0, 256, 256);
    speckle(ctx, 20, 20, 216, 216, 70, Math.floor(rnd() * 1e6), ['#ffffff', '#b8b8ff'], [0.6, 1.6]);
    ctx.globalAlpha = 0.12; ctx.drawImage(ghost, 0, 0); ctx.globalAlpha = 1;
    ctx.drawImage(ring, 0, 0);
    hollowEdge = ring;
  },
  ornament(ctx) {
    // the rim glows a little outward, as an absence does against a lit room
    if (!hollowEdge) return;
    ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.shadowColor = '#9a9aff'; ctx.shadowBlur = 8; ctx.globalAlpha = 0.6; ctx.drawImage(hollowEdge, 0, 0); ctx.restore();
    hollowEdge = null;
  },
};

const PLAIN: FloorStyle = { accent: ['#ffffff', '#cfe8ff', '#8fb8e0', '#3a5a80', '#101a28'], finish() {}, ornament() {} };

const FLOOR_STYLE: Record<number, FloorStyle> = { 1: DROWNED, 2: ORCHARD, 3: KILNS, 4: MIRROR, 5: CELLAR, 6: FROST, 7: CLOCKWORKS, 8: INK, 9: HOLLOW };

// ---------------------------------------------------------------- hand-painted capstones

/** The Tide Ledger: an open ledger with the sea rising out of it, salt on the pages, ink running. */
function tideLedger(ctx: Ctx) {
  glow(ctx, 128, 120, 120, 'rgba(79,224,216,0.45)');
  for (const s of [-1, 1]) {
    const page = poly([[128, 150], [128 + s * 104, 132], [128 + s * 100, 214], [128, 230]]);
    shade(ctx, page, lin(ctx, 128, 140, 128 + s * 100, 214, [[0, '#fbf5e4'], [1, '#c8b890']]), [s < 0 ? 24 : 128, 132, 104, 98], { lw: 5 });
    ctx.save(); ctx.clip(page); ctx.strokeStyle = 'rgba(20,40,60,0.55)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) { const y = 160 + i * 10; ctx.beginPath(); ctx.moveTo(128 + s * 14, y + 2); ctx.lineTo(128 + s * 88, y - 10); ctx.stroke(); }
    ctx.fillStyle = 'rgba(30,60,90,0.6)'; for (let i = 0; i < 3; i++) ctx.fillRect(128 + s * (30 + i * 20), 186 + i * 4, 3, 16 + i * 6);
    speckle(ctx, s < 0 ? 24 : 128, 132, 104, 98, 80, s < 0 ? 11 : 12, ['#ffffff', '#e8f4f2'], [0.8, 2]);
    ctx.restore();
  }
  bar(ctx, (c) => { c.moveTo(128, 150); c.lineTo(128, 230); }, 5, '#5a4020');
  const wave = new Path2D();
  wave.moveTo(58, 150); wave.bezierCurveTo(60, 90, 100, 52, 148, 40); wave.bezierCurveTo(196, 30, 214, 70, 188, 88);
  wave.bezierCurveTo(170, 98, 160, 78, 172, 70); wave.bezierCurveTo(150, 72, 128, 104, 150, 150); wave.closePath();
  shade(ctx, wave, lin(ctx, 60, 40, 190, 150, [[0, '#e8fffd'], [0.3, '#7ff0e8'], [0.65, '#1fb0aa'], [1, '#0a5a5c']]), [58, 34, 156, 116], { lw: 5, rim: 'rgba(230,255,255,0.9)' });
  ctx.save(); ctx.clip(wave); ctx.strokeStyle = 'rgba(255,255,255,0.75)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(80, 130); ctx.bezierCurveTo(88, 96, 116, 70, 150, 60); ctx.stroke(); ctx.restore();
  for (const [x, y, s] of [[196, 108, 7], [182, 128, 5], [70, 168, 5]]) shade(ctx, circle(x, y, s), rad(ctx, x - 2, y - 2, 1, s, [[0, '#ffffff'], [1, '#27a8a2']]), [x - s, y - s, s * 2, s * 2], { lw: 2.5, drop: false });
  sparkle(ctx, 176, 58, 14, '#e8fffd');
}

/** The Sap Crown: a crown of living amber, sap running from the band, leaves coming up through it. */
function sapCrown(ctx: Ctx) {
  glow(ctx, 128, 130, 118, 'rgba(255,208,90,0.45)');
  for (const [x, ang] of [[70, -0.9], [186, 0.9], [128, 0]]) {
    ctx.save(); ctx.translate(x, 96); ctx.rotate(ang);
    const leaf = new Path2D(); leaf.moveTo(0, 0); leaf.bezierCurveTo(-18, -24, -10, -52, 0, -64); leaf.bezierCurveTo(10, -52, 18, -24, 0, 0); leaf.closePath();
    shade(ctx, leaf, lin(ctx, -18, -64, 18, 0, [[0, '#d8ffc0'], [0.5, '#6ad050'], [1, '#1f6a20']]), [-18, -64, 36, 64], { lw: 4, drop: false });
    ctx.strokeStyle = 'rgba(20,70,20,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(0, -56); ctx.stroke();
    ctx.restore();
  }
  const pts: number[][] = [[50, 196], [50, 132], [72, 132], [86, 74], [104, 132], [128, 56], [152, 132], [170, 74], [184, 132], [206, 132], [206, 196]];
  const body = smooth(pts, 0.2);
  shade(ctx, body, lin(ctx, 50, 56, 206, 196, [[0, '#fff4c0'], [0.3, '#ffd05a'], [0.6, '#f0a020'], [1, '#8a5008']]), [50, 56, 156, 140], { outline: 'none', hi: 0.5 });
  ctx.save(); ctx.clip(body);
  glow(ctx, 128, 150, 70, 'rgba(255,250,220,0.55)');
  for (const [x, y] of [[92, 170], [140, 150], [168, 178]]) { ctx.fillStyle = 'rgba(90,50,10,0.6)'; ctx.beginPath(); ctx.ellipse(x, y, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  outline(ctx, body);
  for (const [x, len] of [[74, 26], [118, 40], [160, 20], [194, 32]]) {
    const drip = new Path2D(); drip.moveTo(x - 7, 190); drip.lineTo(x - 5, 190 + len); drip.arc(x, 190 + len, 6, Math.PI, 0, true); drip.lineTo(x + 7, 190); drip.closePath();
    shade(ctx, drip, lin(ctx, x - 7, 190, x + 7, 196 + len, [[0, '#ffe08a'], [1, '#c87810']]), [x - 7, 190, 14, len + 6], { lw: 3.5, drop: false });
  }
  for (const [x, y] of [[86, 74], [128, 56], [170, 74]]) shade(ctx, circle(x, y - 6, 10), rad(ctx, x - 3, y - 9, 1, 11, [[0, '#ffffff'], [0.4, '#ffe08a'], [1, '#b06a08']]), [x - 10, y - 16, 20, 20], { lw: 3, drop: false });
  sparkle(ctx, 104, 110, 14, '#fff8d0');
}

/** The Kiln Heart: a heart of fused ash, cracked open on the fire inside, shedding embers. */
function kilnHeart(ctx: Ctx) {
  glow(ctx, 128, 136, 124, 'rgba(255,120,40,0.5)');
  const heart = new Path2D();
  heart.moveTo(128, 222); heart.bezierCurveTo(40, 164, 36, 96, 70, 70); heart.bezierCurveTo(98, 50, 122, 66, 128, 88);
  heart.bezierCurveTo(134, 66, 158, 50, 186, 70); heart.bezierCurveTo(220, 96, 216, 164, 128, 222); heart.closePath();
  shade(ctx, heart, lin(ctx, 60, 60, 200, 220, [[0, '#8a7a72'], [0.35, '#4a3e3a'], [0.7, '#2a2020'], [1, '#120c0a']]), [36, 52, 184, 170], { outline: 'none', hi: 0.25 });
  ctx.save(); ctx.clip(heart);
  speckle(ctx, 36, 52, 184, 170, 260, 59, ['#a89890', '#1a1210', '#6a5a52'], [0.8, 2.6]);
  const rnd = seeded(591);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  for (let i = 0; i < 9; i++) {
    let x = 128 + (rnd() - 0.5) * 30, y = 140 + (rnd() - 0.5) * 30, ang = rnd() * Math.PI * 2;
    const p = new Path2D(); p.moveTo(x, y);
    for (let k = 0; k < 6; k++) { ang += (rnd() - 0.5) * 1.1; x += Math.cos(ang) * 12; y += Math.sin(ang) * 12; p.lineTo(x, y); }
    ctx.shadowColor = '#ff7a1a'; ctx.shadowBlur = 14; ctx.lineWidth = 5; ctx.strokeStyle = '#ff6a14'; ctx.stroke(p);
    ctx.shadowBlur = 0; ctx.lineWidth = 2; ctx.strokeStyle = '#fff0b0'; ctx.stroke(p);
  }
  glow(ctx, 128, 140, 40, 'rgba(255,220,140,0.75)');
  ctx.restore();
  outline(ctx, heart);
  const rnd2 = seeded(592);
  for (let i = 0; i < 7; i++) { const x = 80 + rnd2() * 96, y = 30 + rnd2() * 40; glow(ctx, x, y, 7, 'rgba(255,150,50,0.9)'); ctx.fillStyle = '#fff0c0'; ctx.fillRect(x - 1, y - 1, 2.5, 2.5); }
}

const MIRROR_RAMP = ['#ffffff', '#e6ecf3', '#aeb9c8', '#5f6b7e', '#262c38'];

/** The Second Keeper: a standing mirror, and in it a hooded keeper who is not you, one eye gold and one eye cold. */
function secondKeeper(ctx: Ctx) {
  glow(ctx, 128, 120, 124, 'rgba(200,225,255,0.45)');
  // the stand and its feet
  bar(ctx, (c) => { c.moveTo(128, 214); c.lineTo(128, 236); c.moveTo(92, 238); c.lineTo(164, 238); }, 8, metal(ctx, MIRROR_RAMP, 90, 214, 166, 240));
  const glass = ellipse(128, 118, 66, 92);
  ctx.save(); ctx.fillStyle = lin(ctx, 60, 30, 196, 210, [[0, '#e8f2ff'], [0.35, '#8aa4c4'], [0.7, '#34465e'], [1, '#141c2a']]); ctx.fill(glass); ctx.restore();
  ctx.save(); ctx.clip(glass);
  // the keeper in the glass: a hood, a robe, a face in shadow
  const robe = smooth([[128, 48], [168, 80], [182, 150], [196, 222], [60, 222], [74, 150], [88, 80]], 0.45);
  ctx.fillStyle = lin(ctx, 60, 48, 196, 222, [[0, '#c8d8ee'], [0.4, '#5a6e8a'], [1, '#1a2232']]); ctx.fill(robe);
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(10,14,24,0.8)'; ctx.stroke(robe);
  ctx.strokeStyle = 'rgba(220,235,255,0.35)'; ctx.lineWidth = 2;
  for (const x of [104, 128, 152]) { ctx.beginPath(); ctx.moveTo(x, 140); ctx.lineTo(x + (x - 128) * 0.3, 222); ctx.stroke(); }
  ctx.fillStyle = rad(ctx, 128, 104, 4, 34, [[0, '#0a0e18'], [0.8, '#1a2436'], [1, 'rgba(26,36,54,0)']]); ctx.fill(ellipse(128, 104, 26, 30));
  eyes(ctx, [[116, 102]], 5.5, '#ffd05a');
  eyes(ctx, [[140, 102]], 5.5, '#8fe0ff');
  // mirror light: hard diagonal glints, and a crack across the glass
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.save(); ctx.translate(128, 118); ctx.rotate(0.6); ctx.fillRect(-62, -120, 14, 240); ctx.fillRect(-40, -120, 5, 240); ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(190, 70); ctx.lineTo(162, 96); ctx.lineTo(170, 112); ctx.lineTo(140, 146); ctx.moveTo(162, 96); ctx.lineTo(186, 104); ctx.stroke();
  ctx.restore();
  // the frame: heavy silver, beaded, with a crest
  bar(ctx, (c) => { c.ellipse(128, 118, 70, 96, 0, 0, Math.PI * 2); }, 11, chrome(ctx, MIRROR_RAMP, 50, 0, 206, 0));
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; shade(ctx, circle(128 + Math.cos(a) * 70, 118 + Math.sin(a) * 96, 4), rad(ctx, 127 + Math.cos(a) * 70, 117 + Math.sin(a) * 96, 0.5, 5, [[0, '#ffffff'], [1, '#6a7a90']]), [120 + Math.cos(a) * 70, 110 + Math.sin(a) * 96, 16, 16], { lw: 2, drop: false }); }
  shade(ctx, star(128, 20, 5, 9, 22), metal(ctx, MIRROR_RAMP, 106, 0, 150, 42), [106, 0, 44, 42], { lw: 4 });
  gem(ctx, 128, 20, 7, ['#fff8d0', '#ffd05a', '#e8a020', '#8a5a08', '#3a2404']);
  sparkle(ctx, 92, 60, 14, '#ffffff');
}

/** The Taproot Reliquary: a cage of living root around a green heart, a taproot running down out of it, drinking. */
function taprootReliquary(ctx: Ctx) {
  glow(ctx, 128, 108, 118, 'rgba(143,216,112,0.5)');
  const bark = ['#e8d0a8', '#a8845a', '#7a5a30', '#4a3218', '#1e1208'];
  // the taproot, tapering to a point, with rootlets off it
  const tap = new Path2D(); tap.moveTo(108, 150); tap.bezierCurveTo(112, 190, 122, 214, 130, 246); tap.bezierCurveTo(138, 212, 146, 186, 150, 150); tap.closePath();
  shade(ctx, tap, metal(ctx, bark, 108, 150, 150, 246), [108, 150, 42, 96], { lw: 5 });
  for (const [x, y, dx, dy] of [[118, 190, -34, 16], [140, 184, 32, 20], [126, 218, -24, 18], [136, 206, 22, 22]]) bar(ctx, (c) => { c.moveTo(x, y); c.quadraticCurveTo(x + dx * 0.6, y + dy * 0.2, x + dx, y + dy); }, 3, bark[2]);
  // the heart inside the cage
  shade(ctx, circle(128, 108, 50), rad(ctx, 120, 98, 4, 56, [[0, '#ffffff'], [0.25, '#e0ffc8'], [0.6, '#8fd870'], [1, '#2a6a22']]), [78, 58, 100, 100], { lw: 4, rim: 'rgba(230,255,210,0.9)' });
  glow(ctx, 128, 108, 34, 'rgba(240,255,210,0.8)');
  ctx.save(); ctx.strokeStyle = 'rgba(30,90,30,0.55)'; ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(128, 108); ctx.quadraticCurveTo(128 + Math.cos(a + 0.5) * 20, 108 + Math.sin(a + 0.5) * 20, 128 + Math.cos(a) * 40, 108 + Math.sin(a) * 40); ctx.stroke(); }
  ctx.restore();
  // the cage: roots woven round it, crossing
  const woven: [number, number, number, number, number, number, number, number][] = [
    [74, 150, 60, 80, 110, 40, 150, 52], [182, 150, 196, 80, 146, 40, 106, 52], [78, 124, 92, 60, 164, 60, 178, 124], [84, 148, 110, 168, 146, 168, 172, 148],
  ];
  for (const [x0, y0, c1x, c1y, c2x, c2y, x1, y1] of woven) bar(ctx, (c) => { c.moveTo(x0, y0); c.bezierCurveTo(c1x, c1y, c2x, c2y, x1, y1); }, 8, metal(ctx, bark, 60, 40, 196, 170));
  // it is still growing: two leaves up top
  for (const [x, ang] of [[118, -0.5], [140, 0.55]]) {
    ctx.save(); ctx.translate(x, 50); ctx.rotate(ang);
    const leaf = new Path2D(); leaf.moveTo(0, 0); leaf.bezierCurveTo(-14, -18, -8, -40, 0, -48); leaf.bezierCurveTo(8, -40, 14, -18, 0, 0); leaf.closePath();
    shade(ctx, leaf, lin(ctx, -14, -48, 14, 0, [[0, '#e0ffc8'], [0.5, '#6ad050'], [1, '#1f6a20']]), [-14, -48, 28, 48], { lw: 3.5, drop: false });
    ctx.restore();
  }
  sparkle(ctx, 112, 92, 14, '#f0ffe0');
}

/** The Debt in Ice: the ledger itself, open, frozen in a block of ice with its ink caught rising off the page. */
function debtInIce(ctx: Ctx) {
  glow(ctx, 128, 128, 122, 'rgba(95,216,255,0.45)');
  // the ledger, open
  for (const s of [-1, 1]) {
    const page = poly([[128, 118], [128 + s * 78, 104], [128 + s * 76, 184], [128, 196]]);
    shade(ctx, page, lin(ctx, 128, 110, 128 + s * 78, 184, [[0, '#f4f8fc'], [1, '#b8c8d8']]), [s < 0 ? 50 : 128, 104, 78, 92], { lw: 4, drop: false });
    ctx.save(); ctx.clip(page);
    ctx.fillStyle = 'rgba(14,30,60,0.6)';
    for (let i = 0; i < 6; i++) { const y = 130 + i * 10; for (let k = 0; k < 4; k++) ctx.fillRect(128 + s * (16 + k * 14) - (s < 0 ? 10 : 0), y - k * 1.2,10 - (k % 2) * 3, 2.5); }
    ctx.fillStyle = 'rgba(170,30,40,0.6)'; ctx.fillRect(128 + s * 12 - 1, 110, 2, 80);
    ctx.restore();
  }
  bar(ctx, (c) => { c.moveTo(128, 118); c.lineTo(128, 196); }, 4, '#2a3a50');
  // the signature at the head of the page, in the hand from the hints
  ctx.save(); ctx.strokeStyle = '#c8962a'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(142, 118); ctx.bezierCurveTo(150, 106, 156, 122, 162, 112); ctx.bezierCurveTo(168, 104, 170, 120, 180, 110); ctx.stroke(); ctx.restore();
  // the ink, caught rising off the page as it froze
  const plume = new Path2D();
  plume.moveTo(100, 150); plume.bezierCurveTo(84, 120, 118, 104, 100, 80); plume.bezierCurveTo(90, 64, 108, 50, 118, 62);
  plume.bezierCurveTo(108, 72, 124, 88, 118, 112); plume.bezierCurveTo(114, 130, 116, 140, 110, 150); plume.closePath();
  shade(ctx, plume, lin(ctx, 84, 50, 124, 150, [[0, '#3a5a8a'], [0.5, '#0e1a36'], [1, '#050a18']]), [84, 50, 40, 100], { lw: 3, drop: false, rim: 'rgba(143,224,255,0.9)' });
  // the block of ice over all of it
  const block = poly([[56, 52], [108, 30], [176, 34], [214, 70], [212, 184], [170, 216], [84, 214], [44, 176], [42, 92]]);
  ctx.save(); ctx.fillStyle = lin(ctx, 42, 30, 214, 216, [[0, 'rgba(230,248,255,0.5)'], [0.45, 'rgba(120,210,255,0.28)'], [1, 'rgba(20,90,150,0.5)']]); ctx.fill(block);
  ctx.clip(block);
  ctx.fillStyle = 'rgba(255,255,255,0.22)';
  for (const tri of [[[56, 52], [108, 30], [96, 96]], [[176, 34], [214, 70], [170, 90]], [[44, 176], [84, 214], [80, 170]]]) { ctx.beginPath(); ctx.moveTo(tri[0][0], tri[0][1]); ctx.lineTo(tri[1][0], tri[1][1]); ctx.lineTo(tri[2][0], tri[2][1]); ctx.closePath(); ctx.fill(); }
  speckle(ctx, 40, 28, 176, 190, 220, 891, ['#ffffff', '#e0f6ff'], [0.6, 2]);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.save(); ctx.translate(128, 120); ctx.rotate(-0.8); ctx.fillRect(-120, -60, 240, 8); ctx.restore();
  ctx.restore();
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(240,252,255,0.95)'; ctx.stroke(block); ctx.restore();
  outline(ctx, block, 4);
  // icicles off the underside
  for (const [x, len] of [[96, 22], [120, 30], [150, 18], [174, 26]]) {
    const y = x < 128 ? 214 : 214 - (x - 128) * 0.02;
    const ic = poly([[x - 6, y - 2], [x + 6, y - 2], [x, y + len]]);
    shade(ctx, ic, lin(ctx, x - 6, y, x + 6, y + len, [[0, '#ffffff'], [1, '#6ac8f0']]), [x - 6, y - 2, 12, len + 2], { lw: 2.5, drop: false });
  }
  sparkle(ctx, 70, 64, 14, '#e8fbff');
  sparkle(ctx, 190, 150, 9, '#e8fbff');
}

/** The Hour Unspent: a stopped watch in brass, its glass cracked across, one hour on the dial still lit. */
function hourUnspent(ctx: Ctx) {
  glow(ctx, 128, 136, 124, 'rgba(255,220,120,0.45)');
  bar(ctx, (c) => { c.arc(128, 30, 14, 0, Math.PI * 2); }, 6, chrome(ctx, MAT_BRASS, 110, 14, 146, 46));
  shade(ctx, rrPath(116, 40, 24, 22, 5), metal(ctx, MAT_BRASS, 116, 40, 140, 62), [116, 40, 24, 22], { lw: 4, drop: false });
  const caseP = circle(128, 138, 86);
  shade(ctx, caseP, chrome(ctx, MAT_BRASS, 42, 0, 214, 0), [42, 52, 172, 172], { lw: 5, hi: 0.4 });
  const face = circle(128, 138, 70);
  shade(ctx, face, rad(ctx, 116, 124, 4, 76, [[0, '#fffaf0'], [0.7, '#efe2c0'], [1, '#bfa870']]), [58, 68, 140, 140], { lw: 4, drop: false });
  ctx.save(); ctx.clip(face);
  // the one hour left: its twelfth of the dial lit
  ctx.fillStyle = 'rgba(255,200,80,0.55)'; ctx.beginPath(); ctx.moveTo(128, 138); ctx.arc(128, 138, 70, -Math.PI / 2, -Math.PI / 2 + Math.PI / 6); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3a2a10'; ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; ctx.lineWidth = i % 3 ? 2 : 4; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 58, 138 + Math.sin(a) * 58); ctx.lineTo(128 + Math.cos(a) * (i % 3 ? 64 : 66), 138 + Math.sin(a) * (i % 3 ? 64 : 66)); ctx.stroke(); }
  // the hands, stopped at the top of the unspent hour
  ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(128, 138); ctx.lineTo(128, 88); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(128, 138); ctx.lineTo(158, 128); ctx.stroke();
  ctx.fillStyle = '#3a2a10'; ctx.beginPath(); ctx.arc(128, 138, 6, 0, Math.PI * 2); ctx.fill();
  // the glass, cracked from a strike at the rim
  ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(186, 104); ctx.lineTo(160, 124); ctx.lineTo(150, 152); ctx.moveTo(160, 124); ctx.lineTo(132, 118); ctx.lineTo(108, 128); ctx.moveTo(186, 104); ctx.lineTo(170, 90); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.save(); ctx.translate(128, 138); ctx.rotate(-0.7); ctx.fillRect(-80, -48, 160, 12); ctx.restore();
  ctx.restore();
  sparkle(ctx, 186, 104, 12, '#fff8d8');
}

/** The Name of the Vault: a tome in gold leaf, its true name rising off the page as letters of light, a wax seal on a ribbon. */
function nameOfTheVault(ctx: Ctx) {
  glow(ctx, 128, 110, 122, 'rgba(255,232,154,0.45)');
  for (const s of [-1, 1]) {
    const page = poly([[128, 150], [128 + s * 100, 136], [128 + s * 96, 214], [128, 228]]);
    shade(ctx, page, lin(ctx, 128, 140, 128 + s * 96, 214, [[0, '#fbf2dc'], [1, '#d0bc8c']]), [s < 0 ? 28 : 128, 136, 100, 92], { lw: 5 });
    ctx.save(); ctx.clip(page); ctx.fillStyle = 'rgba(30,24,50,0.55)';
    for (let i = 0; i < 5; i++) { const y = 166 + i * 11; for (let k = 0; k < 5; k++) ctx.fillRect(128 + s * (14 + k * 15) - (s < 0 ? 11 : 0), y - k * 1.3, 11 - (k % 2) * 4, 2.2); }
    ctx.restore();
  }
  bar(ctx, (c) => { c.moveTo(128, 150); c.lineTo(128, 228); }, 5, '#6a4a18');
  // the name, in gold, lifting off the page as it is read
  const glyphs = [[128, 118, 22], [104, 90, 15], [152, 86, 16], [124, 60, 12], [146, 44, 9], [108, 40, 8]];
  for (const [x, y, r] of glyphs) {
    glow(ctx, x, y, r * 1.8, 'rgba(255,220,120,0.6)');
    ctx.save(); ctx.translate(x, y);
    // a letter of a script nobody taught you: each glyph its own strokes
    const g = new Path2D(), k = glyphs.findIndex((q) => q[0] === x && q[1] === y);
    const strokes = [[[-0.5, 0.6], [0, -0.7], [0.5, 0.6]], [[-0.4, -0.6], [0.4, -0.6], [-0.4, 0.6], [0.4, 0.6]], [[0, -0.7], [0, 0.7], [0.5, 0.2]], [[-0.5, 0], [0.5, -0.6], [0.2, 0.7]], [[-0.4, -0.5], [0.4, 0], [-0.4, 0.5]], [[0.4, -0.6], [-0.4, -0.1], [0.4, 0.6]]][k % 6];
    strokes.forEach(([px, py], i) => (i ? g.lineTo(px * r, py * r) : g.moveTo(px * r, py * r)));
    g.moveTo(-r * 0.3, r * 0.15); g.lineTo(r * 0.1, r * 0.15);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, r * 0.22); ctx.strokeStyle = '#7a4a08'; ctx.stroke(g);
    ctx.lineWidth = Math.max(1, r * 0.12); ctx.strokeStyle = '#fff2b0'; ctx.stroke(g);
    ctx.restore();
  }
  // the ribbon and its seal
  bar(ctx, (c) => { c.moveTo(160, 212); c.quadraticCurveTo(174, 232, 196, 238); }, 7, '#a82020');
  const seal = circle(196, 236, 14);
  shade(ctx, seal, rad(ctx, 192, 232, 1, 15, [[0, '#ff8a7a'], [0.5, '#c02828'], [1, '#5a0808']]), [182, 222, 28, 28], { lw: 3, drop: false });
  ctx.save(); ctx.fillStyle = 'rgba(70,6,6,0.9)'; ctx.fill(star(196, 236, 5, 3, 7)); ctx.restore();
  sparkle(ctx, 146, 44, 12, '#fff8d0');
}

/** The Empty Setting: a mount of vault-iron, claws and all, around a socket in the shape of a relic, and nothing in it. */
function emptySetting(ctx: Ctx) {
  glow(ctx, 128, 128, 118, 'rgba(184,184,255,0.35)');
  // the mount: an iron plate with four claws reaching in
  const plate = circle(128, 128, 92);
  shade(ctx, plate, rad(ctx, 110, 104, 10, 100, [[0, '#8a8aa0'], [0.5, '#4a4a60'], [1, '#1a1a28']]), [36, 36, 184, 184], { lw: 5, hi: 0.3 });
  ctx.save(); ctx.clip(plate); ctx.strokeStyle = 'rgba(210,210,255,0.25)'; ctx.lineWidth = 2;
  for (const r of [80, 72]) { ctx.beginPath(); ctx.arc(128, 128, r, 0, Math.PI * 2); ctx.stroke(); }
  speckle(ctx, 36, 36, 184, 184, 90, 1191, ['#b8b8d0', '#2a2a3a'], [0.8, 2]);
  ctx.restore();
  // the socket: a relic's shape, cut out of the plate, with the void behind it
  const socket = new Path2D();
  socket.moveTo(128, 186); socket.bezierCurveTo(72, 150, 70, 104, 92, 86); socket.bezierCurveTo(110, 72, 124, 82, 128, 96);
  socket.bezierCurveTo(132, 82, 146, 72, 164, 86); socket.bezierCurveTo(186, 104, 184, 150, 128, 186); socket.closePath();
  ctx.save(); ctx.fillStyle = rad(ctx, 128, 128, 4, 70, [[0, '#1c1c3a'], [1, '#02020a']]); ctx.fill(socket); ctx.clip(socket);
  speckle(ctx, 70, 72, 116, 116, 40, 1192, ['#ffffff', '#b8b8ff'], [0.6, 1.6]);
  ctx.restore();
  ctx.save(); ctx.shadowColor = '#b8b8ff'; ctx.shadowBlur = 12; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(216,216,255,0.95)'; ctx.stroke(socket); ctx.restore();
  outline(ctx, socket, 3);
  for (const a of [-0.75, -0.25, 0.25, 0.75].map((k) => k * Math.PI + Math.PI / 2)) {
    const x0 = 128 + Math.cos(a) * 96, y0 = 128 + Math.sin(a) * 96, x1 = 128 + Math.cos(a) * 58, y1 = 128 + Math.sin(a) * 58;
    bar(ctx, (c) => { c.moveTo(x0, y0); c.quadraticCurveTo((x0 + x1) / 2 + Math.cos(a + 1.2) * 10, (y0 + y1) / 2 + Math.sin(a + 1.2) * 10, x1, y1); }, 8, metal(ctx, MAT_IRON, x0, y0, x1, y1));
  }
}

const MAT_BRASS = ['#fff6d0', '#ffd878', '#d8a838', '#7a5410', '#2a1c04'];
const MAT_IRON = ['#b8b8d0', '#7a7a92', '#4a4a60', '#22222e', '#0c0c14'];

const CAPSTONE_PAINTERS: Record<number, (ctx: Ctx) => void> = { 39: tideLedger, 49: sapCrown, 59: kilnHeart, 69: secondKeeper, 79: taprootReliquary, 89: debtInIce, 99: hourUnspent, 109: nameOfTheVault, 119: emptySetting };

// ---------------------------------------------------------------- routing

export type FloorPainter = { kind: 'capstone'; id: number } | { kind: 'form'; form: Form; floor: number; tier: number };

/** Which painter draws floor relic `id` (chains 3-11), or null when `id` is not a floor relic. Pure: no canvas. */
export function floorPainterFor(id: number): FloorPainter | null {
  const chain = Math.floor(id / 10), tier = id % 10;
  const floor = FLOORS.findIndex((f) => f.chain === chain);
  if (floor < 1 || tier < 1 || tier > CAPSTONE_TIER) return null;
  if (CAPSTONE_PAINTERS[id]) return { kind: 'capstone', id };
  const form = FLOORS[floor].relics[tier - 1]?.form;
  return form && FORM_PAINTERS[form] ? { kind: 'form', form, floor, tier } : null;
}

/** Every form has a painter (the unit test holds this against data/floors.ts's Form type). */
export const PAINTED_FORMS: readonly Form[] = FORMS.filter((f) => !!FORM_PAINTERS[f]);
export const CAPSTONE_IDS: readonly number[] = Object.keys(CAPSTONE_PAINTERS).map(Number);
/** The floors (by index) with their own finish and ornament; the unit test holds that every floor 2-10 has one. */
export const STYLED_FLOORS: readonly number[] = Object.keys(FLOOR_STYLE).map(Number);

/** Paint floor relic `id` into a 256 canvas context: capstone, or form + finish + ornament. Throws for a non-floor id. */
export function paintFloorRelic(ctx: Ctx, id: number) {
  const route = floorPainterFor(id);
  if (!route) throw new Error(`FloorArt: no painter for relic ${id}`);
  if (route.kind === 'capstone') { CAPSTONE_PAINTERS[id](ctx); return; }
  const def = FLOORS[route.floor].relics[route.tier - 1];
  const style = FLOOR_STYLE[route.floor] ?? PLAIN;
  const r = rampOf(def.color);
  const rnd = seeded(id * 7919);
  const [layer, l] = makeCanvas(256, 256);
  l.save();
  // tier is size: a tier-1 relic sits small in its frame, a tier-8 fills it
  const s = 0.92 + route.tier * 0.028; // tier 1 about the Antechamber's size, tier 8 filling the frame
  l.translate(128, 136); l.scale(s, s); l.translate(-128, -136);
  FORM_PAINTERS[route.form](l, r, route.tier, rnd, style.accent);
  l.restore();
  l.save(); l.globalCompositeOperation = 'source-atop'; style.finish(l, rnd, r); l.restore();
  l.save(); l.globalCompositeOperation = 'source-atop'; style.ornament(l, rnd, r, route.tier); l.restore();
  ctx.drawImage(layer, 0, 0);
}
