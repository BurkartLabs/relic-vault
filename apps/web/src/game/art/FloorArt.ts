/**
 * The floor relics (chains 3-11), composed rather than drawn one at a time (docs/ROOMS.md, "The relics, and how
 * nine floors' worth get made"; AB#444 slice 1):
 *
 *  1. a **form** painter draws the silhouette (the twelve `Form` families in data/floors.ts), lit with the house
 *     model, in a ramp made from the relic's own colour. Each is parameterised by tier: a tier-8 vessel is a larger,
 *     more worked version of a tier-2 vessel, so the family reads and so does the rank;
 *  2. the floor's **finish** is a pass over the painted pixels only (salt grain and nacre on the Drowned Wing,
 *     glass and amber translucency in the Orchard, soot and ember in the Kilns);
 *  3. the floor's **ornament** pass is drawn over that (the Drowned Wing's barnacle line, the Orchard's graft seam,
 *     the Kilns' crackle).
 *
 * The capstones (tier 9) are hand-painted, because the capstone is the image the player remembers. Floors 5-10
 * take their finishes and capstones in slices 2 and 3; until then their relics are form-composed in their own
 * colours with no floor pass, never a recoloured Antechamber relic.
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

/** Floors 5-10 until slices 2 and 3 give them their own: their colours only, no floor pass. */
const PLAIN: FloorStyle = { accent: ['#ffffff', '#cfe8ff', '#8fb8e0', '#3a5a80', '#101a28'], finish() {}, ornament() {} };

const FLOOR_STYLE: Record<number, FloorStyle> = { 1: DROWNED, 2: ORCHARD, 3: KILNS };

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

const CAPSTONE_PAINTERS: Record<number, (ctx: Ctx) => void> = { 39: tideLedger, 49: sapCrown, 59: kilnHeart };

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
