import type Phaser from 'phaser';
import { CHAIN_PAINTERS } from './ChainArt';
import { ITEM_IDS, ITEMS, chainOf } from '../data/items';
import { floorDef } from '../data/floors';
import {
  Ctx, makeCanvas, lin, rad, poly, smooth, star, glow, shade, MAT, metal, chrome, facets, sparkle, rrPath,
} from './paint';

/**
 * Procedural relic painter. Every tier is a distinct silhouette in a distinct material,
 * lit with the house model (warm key top-left, cold rune rim bottom-right, ink outline).
 * Baked once at boot into atlases:
 *  - 'relic256'  : 256px masters (R1..R9) for inspect / chest / album hero shots
 *  - 'relics'    : 160px board frames with a 6-frame specular sheen sweep (r{t}_{0..6})
 *  - 'relic96'   : 96px icons (i1..i9)
 * The Living Relic (T9) is baked without its iris on the board atlas; the iris is a live sprite.
 */

const OUT = '#160b05';

function outline(ctx: Ctx, p: Path2D, lw = 5, color = OUT) {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = lw;
  ctx.strokeStyle = color;
  ctx.stroke(p);
  ctx.restore();
}

function circle(x: number, y: number, r: number) {
  const p = new Path2D();
  p.arc(x, y, r, 0, Math.PI * 2);
  return p;
}
function ellipse(x: number, y: number, rx: number, ry: number, rot = 0) {
  const p = new Path2D();
  p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2);
  return p;
}

function strokeBar(ctx: Ctx, draw: (c: Ctx) => void, w: number, fill: string | CanvasGradient) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath(); draw(ctx);
  ctx.lineWidth = w + 7; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); draw(ctx);
  ctx.lineWidth = w; ctx.strokeStyle = fill; ctx.stroke();
  ctx.restore();
}

function emberRune(ctx: Ctx, x: number, y: number, s: number, color = '#ff9a3c') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = 'round';
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = color;
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -18); ctx.lineTo(0, 18);
  ctx.moveTo(0, -10); ctx.lineTo(12, -18);
  ctx.moveTo(0, 0); ctx.lineTo(12, -8);
  ctx.moveTo(0, 6); ctx.lineTo(-10, 14);
  ctx.stroke();
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#fff1c8';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- T1
function flint(ctx: Ctx) {
  const pts = [[128, 24], [152, 56], [188, 80], [174, 128], [198, 176], [160, 220], [116, 234], [78, 208], [60, 160], [82, 118], [66, 76], [100, 50]];
  const p = poly(pts);
  shade(ctx, p, metal(ctx, MAT.flint, 60, 30, 200, 230), [60, 24, 140, 210], { outline: 'none', hi: 0.3 });
  facets(ctx, p, 132, 136, pts, 'rgba(255,248,235,0.13)', 'rgba(20,12,6,0.2)');
  // chipped edge flecks
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = 'rgba(255,250,240,0.55)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(100, 52); ctx.lineTo(128, 26); ctx.lineTo(150, 58); ctx.stroke();
  ctx.restore();
  outline(ctx, p);
  // bone chip bound with twine
  const b = smooth([[150, 176], [184, 160], [206, 172], [196, 196], [160, 200]]);
  shade(ctx, b, lin(ctx, 150, 160, 200, 200, [[0, '#fff5e0'], [1, '#bda985']]), [150, 160, 56, 40], { lw: 4, hi: 0.2, drop: false });
  emberRune(ctx, 124, 140, 1.1);
}

// ---------------------------------------------------------------- T2
function copperIdol(ctx: Ctx) {
  const plinth = rrPath(70, 198, 116, 34, 7);
  shade(ctx, plinth, metal(ctx, MAT.bronze, 70, 198, 70, 232), [70, 198, 116, 34], { lw: 5, hi: 0.2 });
  const body = smooth([[98, 108], [158, 108], [180, 158], [176, 204], [80, 204], [76, 158]], 0.45);
  shade(ctx, body, chrome(ctx, MAT.copper, 70, 0, 186, 0), [74, 106, 108, 100], { outline: 'none' });
  // verdigris
  ctx.save(); ctx.clip(body);
  for (const [x, y, r] of [[92, 186, 16], [168, 150, 12], [140, 196, 10]]) glow(ctx, x, y, r * 1.6, 'rgba(70,200,160,0.75)');
  ctx.restore();
  outline(ctx, body);
  // folded arms
  const arms = rrPath(88, 138, 80, 24, 12);
  shade(ctx, arms, metal(ctx, MAT.copper, 88, 138, 88, 162), [88, 138, 80, 24], { lw: 4, drop: false });
  // belt gem
  const gem = circle(128, 180, 9);
  shade(ctx, gem, rad(ctx, 124, 176, 1, 10, [[0, '#d0fff0'], [0.4, '#2fd6a0'], [1, '#0a4a3a']]), [119, 171, 18, 18], { lw: 3, drop: false });
  // head + ears + crest
  const crest = poly([[104, 56], [128, 14], [152, 56]]);
  shade(ctx, crest, metal(ctx, MAT.copper, 104, 14, 152, 56), [104, 14, 48, 42], { lw: 4 });
  for (const x of [86, 170]) shade(ctx, circle(x, 86, 11), metal(ctx, MAT.copper, x - 11, 75, x + 11, 97), [x - 11, 75, 22, 22], { lw: 4, drop: false });
  const head = circle(128, 82, 40);
  shade(ctx, head, rad(ctx, 112, 66, 4, 48, [[0, MAT.copper[0]], [0.35, MAT.copper[1]], [0.75, MAT.copper[2]], [1, MAT.copper[3]]]), [88, 42, 80, 80], { outline: 'none' });
  ctx.save(); ctx.clip(head); glow(ctx, 150, 110, 22, 'rgba(70,200,160,0.6)'); ctx.restore();
  outline(ctx, head);
  // face: glowing eyes
  for (const x of [113, 143]) {
    ctx.save();
    ctx.fillStyle = '#2a0f04';
    ctx.fill(ellipse(x, 82, 9, 6));
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 10;
    ctx.fillStyle = '#ffd27a';
    ctx.fill(ellipse(x, 82, 5, 3.5));
    ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = '#3a1706'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(118, 104); ctx.quadraticCurveTo(128, 100, 138, 104); ctx.stroke(); ctx.restore();
  // crest gem
  shade(ctx, circle(128, 42, 6), '#ff4d6d', [122, 36, 12, 12], { lw: 3, drop: false });
}

// ---------------------------------------------------------------- T3
function silverUrn(ctx: Ctx) {
  // handles behind
  for (const s of [-1, 1]) {
    strokeBar(ctx, (c) => {
      c.moveTo(128 + s * 22, 74);
      c.bezierCurveTo(128 + s * 80, 60, 128 + s * 86, 116, 128 + s * 50, 128);
    }, 11, chrome(ctx, MAT.silver, 40, 60, 220, 130));
  }
  const p = new Path2D();
  p.moveTo(94, 50); p.lineTo(162, 50);
  p.quadraticCurveTo(168, 60, 150, 66);
  p.lineTo(150, 84);
  p.bezierCurveTo(200, 98, 208, 152, 178, 186);
  p.quadraticCurveTo(164, 200, 152, 204);
  p.lineTo(170, 228); p.lineTo(86, 228); p.lineTo(104, 204);
  p.quadraticCurveTo(92, 200, 78, 186);
  p.bezierCurveTo(48, 152, 56, 98, 106, 84);
  p.lineTo(106, 66);
  p.quadraticCurveTo(88, 60, 94, 50);
  p.closePath();
  shade(ctx, p, chrome(ctx, MAT.silver, 56, 0, 204, 0), [56, 50, 150, 178], { outline: 'none', rim: 'rgba(126,224,255,0.9)' });
  // engraved band with meander
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = lin(ctx, 0, 124, 0, 150, [[0, '#262c38'], [0.5, '#3d4658'], [1, '#1b2029']]);
  ctx.fillRect(40, 124, 180, 26);
  ctx.strokeStyle = '#dfe8f4'; ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = 44; x < 216; x += 16) {
    ctx.moveTo(x, 144); ctx.lineTo(x, 130); ctx.lineTo(x + 10, 130); ctx.lineTo(x + 10, 140); ctx.lineTo(x + 5, 140);
  }
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fillRect(40, 120, 180, 3); ctx.fillRect(40, 151, 180, 2);
  // neck rings
  ctx.fillStyle = 'rgba(38,44,56,0.7)'; ctx.fillRect(100, 72, 56, 4);
  ctx.restore();
  outline(ctx, p);
  // sapphire inset
  shade(ctx, circle(128, 137, 12), rad(ctx, 124, 132, 1, 13, [[0, '#e6fbff'], [0.35, '#7ee0ff'], [0.7, '#2a6fb0'], [1, '#0a1f45']]), [116, 125, 24, 24], { lw: 4, drop: false });
  // lid + knob
  const lid = ellipse(128, 50, 36, 10);
  shade(ctx, lid, chrome(ctx, MAT.silver, 92, 0, 164, 0), [92, 40, 72, 20], { lw: 4, drop: false });
  const knob = circle(128, 34, 10);
  shade(ctx, knob, rad(ctx, 124, 30, 1, 12, [[0, '#fff'], [0.5, MAT.silver[2]], [1, MAT.silver[3]]]), [118, 24, 20, 20], { lw: 4, drop: false });
  sparkle(ctx, 88, 108, 12);
}

// ---------------------------------------------------------------- T4
function goldMask(ctx: Ctx) {
  // sunburst crown behind
  const sun = star(128, 116, 14, 78, 120);
  shade(ctx, sun, rad(ctx, 128, 116, 30, 120, [[0, MAT.gold[1]], [0.6, MAT.gold[2]], [1, MAT.gold[3]]]), [8, 0, 240, 236], { lw: 4, hi: 0.2 });
  const face = smooth([[128, 34], [174, 46], [194, 98], [184, 150], [162, 196], [128, 226], [94, 196], [72, 150], [62, 98], [82, 46]], 0.5);
  shade(ctx, face, chrome(ctx, MAT.gold, 62, 0, 194, 0), [62, 34, 132, 192], { outline: 'none', hi: 0.45 });
  ctx.save(); ctx.clip(face);
  // brow + cheek engraving
  ctx.strokeStyle = 'rgba(90,50,5,0.75)'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(80, 96); ctx.quadraticCurveTo(104, 80, 124, 94);
  ctx.moveTo(176, 96); ctx.quadraticCurveTo(152, 80, 132, 94);
  ctx.moveTo(84, 150); ctx.quadraticCurveTo(96, 170, 110, 176);
  ctx.moveTo(172, 150); ctx.quadraticCurveTo(160, 170, 146, 176);
  ctx.stroke();
  // nose ridge
  ctx.fillStyle = lin(ctx, 116, 0, 140, 0, [[0, 'rgba(255,250,220,0.9)'], [0.5, 'rgba(255,220,120,0.2)'], [1, 'rgba(90,50,5,0.6)']]);
  ctx.beginPath(); ctx.moveTo(126, 100); ctx.lineTo(116, 158); ctx.quadraticCurveTo(128, 166, 140, 158); ctx.lineTo(130, 100); ctx.fill();
  ctx.restore();
  outline(ctx, face);
  // eye slits with cursed ember inside
  for (const s of [-1, 1]) {
    const eye = new Path2D();
    const cx = 128 + s * 30;
    eye.moveTo(cx - 20, 116); eye.quadraticCurveTo(cx, 100, cx + 20, 116); eye.quadraticCurveTo(cx, 126, cx - 20, 116); eye.closePath();
    ctx.save();
    ctx.fillStyle = '#140602'; ctx.fill(eye);
    ctx.clip(eye); glow(ctx, cx, 116, 16, 'rgba(255,70,60,0.9)');
    ctx.restore();
    outline(ctx, eye, 3, '#3a1c02');
  }
  // lips
  const lips = new Path2D();
  lips.moveTo(110, 190); lips.quadraticCurveTo(128, 180, 146, 190); lips.quadraticCurveTo(128, 202, 110, 190); lips.closePath();
  shade(ctx, lips, metal(ctx, MAT.bronze, 110, 180, 110, 202), [110, 180, 36, 22], { lw: 3, drop: false });
  // forehead turquoise teardrop
  const tear = new Path2D();
  tear.moveTo(128, 54); tear.bezierCurveTo(142, 70, 140, 84, 128, 86); tear.bezierCurveTo(116, 84, 114, 70, 128, 54); tear.closePath();
  shade(ctx, tear, rad(ctx, 124, 70, 1, 18, [[0, '#e4fffa'], [0.4, '#3fd8d0'], [1, '#08545a']]), [114, 54, 28, 32], { lw: 3.5, drop: false });
  sparkle(ctx, 96, 60, 13);
}

// ---------------------------------------------------------------- T5
function scarab(ctx: Ctx) {
  // wings
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(128, 0); ctx.scale(s, 1); ctx.translate(-128, 0);
    const w = new Path2D();
    w.moveTo(112, 118); w.bezierCurveTo(70, 70, 30, 72, 8, 96);
    w.bezierCurveTo(24, 110, 20, 128, 12, 140);
    w.bezierCurveTo(40, 150, 60, 160, 108, 150); w.closePath();
    shade(ctx, w, lin(ctx, 110, 110, 10, 110, [[0, '#f4c45a'], [0.35, '#6ef0b8'], [1, 'rgba(20,120,90,0.85)']]), [8, 72, 104, 88], { lw: 4, hi: 0.2 });
    ctx.strokeStyle = 'rgba(255,240,180,0.7)'; ctx.lineWidth = 2;
    ctx.beginPath();
    for (const y of [92, 110, 128, 144]) { ctx.moveTo(108, 130); ctx.quadraticCurveTo(60, y + 4, 20, y); }
    ctx.stroke();
    ctx.restore();
  }
  // legs
  for (const s of [-1, 1]) {
    for (const [y0, dx, dy] of [[128, 50, -18], [160, 58, 6], [188, 48, 30]]) {
      strokeBar(ctx, (c) => { c.moveTo(128 + s * 30, y0); c.lineTo(128 + s * dx, y0 + dy * 0.4); c.lineTo(128 + s * (dx + 10), y0 + dy); }, 5, MAT.gold[2]);
    }
  }
  // sun disk held aloft
  glow(ctx, 128, 40, 44, 'rgba(255,120,60,0.7)');
  shade(ctx, circle(128, 40, 26), rad(ctx, 120, 32, 2, 28, [[0, '#fff2c0'], [0.4, '#ffb03a'], [1, '#b8420c']]), [102, 14, 52, 52], { lw: 4 });
  // head w/ horns
  const head = new Path2D();
  head.moveTo(104, 96); head.quadraticCurveTo(128, 60, 152, 96); head.closePath();
  shade(ctx, head, metal(ctx, MAT.gold, 104, 64, 152, 96), [104, 64, 48, 32], { lw: 4 });
  // pronotum
  const pro = ellipse(128, 112, 44, 24);
  shade(ctx, pro, chrome(ctx, MAT.gold, 84, 0, 172, 0), [84, 88, 88, 48], { lw: 5 });
  // elytra
  const ely = ellipse(128, 170, 50, 58);
  shade(ctx, ely, rad(ctx, 110, 140, 4, 70, [[0, '#d8ffe9'], [0.25, '#3fe39a'], [0.7, '#0f8a55'], [1, '#063a24']]), [78, 112, 100, 116], { outline: 'none', rim: 'rgba(200,255,120,0.7)' });
  const e = [] as number[][];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * Math.PI * 2; e.push([128 + Math.cos(a) * 52, 170 + Math.sin(a) * 60]); }
  facets(ctx, ely, 128, 162, e, 'rgba(220,255,230,0.14)', 'rgba(0,40,20,0.18)');
  outline(ctx, ely);
  // gold seam + rims
  ctx.save(); ctx.strokeStyle = MAT.gold[1]; ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(128, 114); ctx.lineTo(128, 226); ctx.stroke();
  ctx.strokeStyle = OUT; ctx.lineWidth = 1.5; ctx.stroke(); ctx.restore();
  sparkle(ctx, 104, 146, 14);
}

// ---------------------------------------------------------------- T6
function heartPath() {
  const p = new Path2D();
  p.moveTo(128, 222);
  p.bezierCurveTo(36, 156, 30, 72, 88, 60);
  p.bezierCurveTo(110, 56, 122, 68, 128, 84);
  p.bezierCurveTo(134, 68, 146, 56, 168, 60);
  p.bezierCurveTo(226, 72, 220, 156, 128, 222);
  p.closePath();
  return p;
}
function sapphireHeart(ctx: Ctx) {
  // chain loop
  strokeBar(ctx, (c) => { c.arc(128, 44, 14, 0, Math.PI * 2); }, 6, MAT.gold[2]);
  const p = heartPath();
  shade(ctx, p, rad(ctx, 100, 100, 6, 150, [[0, '#e6fbff'], [0.25, '#7ee0ff'], [0.55, '#2a6fc8'], [1, '#081a48']]), [36, 56, 188, 168], { outline: 'none', rim: 'rgba(255,255,255,0.7)' });
  const pts = [[128, 222], [84, 184], [50, 140], [44, 100], [62, 70], [96, 60], [128, 84], [160, 60], [194, 70], [212, 100], [206, 140], [172, 184]];
  facets(ctx, p, 124, 124, pts, 'rgba(220,250,255,0.2)', 'rgba(4,14,50,0.25)');
  // inner table facet
  const table = poly([[104, 104], [150, 104], [162, 132], [128, 170], [94, 132]]);
  ctx.save(); ctx.globalAlpha = 0.5; ctx.fillStyle = lin(ctx, 94, 104, 162, 170, [[0, '#ffffff'], [1, '#3aa0c8']]); ctx.fill(table); ctx.restore();
  outline(ctx, table, 2, 'rgba(10,30,70,0.6)');
  outline(ctx, p);
  // gold filigree cage
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = MAT.gold[1]; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(128, 84); ctx.bezierCurveTo(116, 130, 140, 170, 128, 222);
  ctx.moveTo(52, 110); ctx.bezierCurveTo(90, 120, 110, 100, 128, 130); ctx.bezierCurveTo(146, 100, 166, 120, 206, 110);
  ctx.stroke();
  ctx.strokeStyle = MAT.gold[3]; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();
  // clasp crown
  const clasp = poly([[108, 76], [112, 58], [120, 68], [128, 54], [136, 68], [144, 58], [148, 76], [128, 86]]);
  shade(ctx, clasp, chrome(ctx, MAT.gold, 108, 0, 148, 0), [108, 54, 40, 32], { lw: 3.5 });
  sparkle(ctx, 86, 94, 16);
  sparkle(ctx, 170, 150, 9, '#bff4ff');
}

// ---------------------------------------------------------------- T7
function rubyCrown(ctx: Ctx) {
  // velvet cap
  const cap = new Path2D();
  cap.moveTo(58, 150); cap.bezierCurveTo(58, 70, 198, 70, 198, 150); cap.closePath();
  shade(ctx, cap, rad(ctx, 110, 90, 4, 110, [[0, '#ff7a8a'], [0.4, '#b0142e'], [1, '#3a0410']]), [58, 70, 140, 80], { lw: 4 });
  // cap cross on top
  glow(ctx, 128, 36, 30, 'rgba(255,90,110,0.6)');
  const cross = poly([[122, 20], [134, 20], [134, 30], [144, 30], [144, 42], [134, 42], [134, 62], [122, 62], [122, 42], [112, 42], [112, 30], [122, 30]]);
  shade(ctx, cross, chrome(ctx, MAT.gold, 112, 0, 144, 0), [112, 20, 32, 42], { lw: 3.5 });
  // crown band with points
  const tips: number[][] = [[56, 86], [92, 70], [128, 56], [164, 70], [200, 86]];
  const p = new Path2D();
  p.moveTo(48, 200); p.lineTo(56, 86); p.lineTo(76, 134); p.lineTo(92, 70); p.lineTo(110, 128);
  p.lineTo(128, 56); p.lineTo(146, 128); p.lineTo(164, 70); p.lineTo(180, 134); p.lineTo(200, 86);
  p.lineTo(208, 200); p.quadraticCurveTo(128, 222, 48, 200); p.closePath();
  shade(ctx, p, chrome(ctx, MAT.gold, 48, 0, 208, 0), [48, 56, 160, 160], { outline: 'none', hi: 0.4 });
  ctx.save(); ctx.clip(p);
  ctx.fillStyle = lin(ctx, 0, 160, 0, 204, [[0, MAT.gold[3]], [0.1, MAT.gold[1]], [0.5, MAT.gold[2]], [1, MAT.gold[4]]]);
  ctx.fillRect(40, 160, 180, 60);
  ctx.fillStyle = 'rgba(255,250,220,0.9)'; ctx.fillRect(40, 160, 180, 3);
  ctx.restore();
  outline(ctx, p);
  // pearls on tips
  for (const [x, y] of tips) shade(ctx, circle(x, y, 9), rad(ctx, x - 3, y - 3, 1, 10, [[0, '#ffffff'], [0.6, '#e8e0f0'], [1, '#8a7fa0']]), [x - 9, y - 9, 18, 18], { lw: 3, drop: false });
  // gems on band
  const ruby = ellipse(128, 184, 22, 16);
  glow(ctx, 128, 184, 40, 'rgba(255,40,70,0.55)');
  shade(ctx, ruby, rad(ctx, 120, 176, 1, 24, [[0, '#ffe0e6'], [0.3, '#ff4d6d'], [0.7, '#a0081f'], [1, '#3a0008']]), [106, 168, 44, 32], { lw: 4, drop: false, rim: 'rgba(255,200,210,0.8)' });
  const rp = [] as number[][];
  for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; rp.push([128 + Math.cos(a) * 22, 184 + Math.sin(a) * 16]); }
  facets(ctx, ruby, 126, 182, rp, 'rgba(255,220,230,0.25)', 'rgba(60,0,10,0.25)');
  shade(ctx, circle(80, 184, 9), rad(ctx, 77, 181, 1, 10, [[0, '#d8ffe9'], [0.4, '#3fe39a'], [1, '#063a24']]), [71, 175, 18, 18], { lw: 3, drop: false });
  shade(ctx, circle(176, 184, 9), rad(ctx, 173, 181, 1, 10, [[0, '#e6fbff'], [0.4, '#7ee0ff'], [1, '#0a1f45']]), [167, 175, 18, 18], { lw: 3, drop: false });
  sparkle(ctx, 116, 176, 10);
  sparkle(ctx, 70, 100, 12);
}

// ---------------------------------------------------------------- T8
function starArk(ctx: Ctx) {
  const SM = ['#ffffff', '#e2f6ff', '#bfb0f6', '#7a62d0', '#2a1c5c'];
  // wings rising and meeting overhead
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(128, 0); ctx.scale(s, 1); ctx.translate(-128, 0);
    const w = new Path2D();
    w.moveTo(70, 112); w.bezierCurveTo(24, 96, 16, 40, 40, 18);
    w.bezierCurveTo(70, 26, 108, 22, 124, 30);
    w.bezierCurveTo(118, 60, 116, 90, 114, 112); w.closePath();
    shade(ctx, w, lin(ctx, 30, 20, 120, 110, [[0, SM[0]], [0.3, SM[1]], [0.6, SM[2]], [1, SM[3]]]), [16, 18, 108, 94], { lw: 4.5, hi: 0.3 });
    ctx.save(); ctx.clip(w);
    ctx.strokeStyle = 'rgba(60,40,140,0.45)'; ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) { const y = 34 + i * 14; ctx.moveTo(118, y + 6); ctx.quadraticCurveTo(70, y - 4, 30 + i * 4, y + 16); }
    ctx.stroke(); ctx.restore();
    ctx.restore();
  }
  // carrying poles
  strokeBar(ctx, (c) => { c.moveTo(18, 190); c.lineTo(238, 190); }, 9, chrome(ctx, MAT.gold, 0, 185, 0, 196));
  // body
  const body = rrPath(52, 120, 152, 88, 10);
  shade(ctx, body, chrome(ctx, SM, 52, 0, 204, 0), [52, 120, 152, 88], { outline: 'none', rim: 'rgba(255,170,255,0.8)' });
  ctx.save(); ctx.clip(body);
  // gold frame
  ctx.strokeStyle = MAT.gold[1]; ctx.lineWidth = 6; ctx.strokeRect(62, 132, 132, 66);
  ctx.strokeStyle = MAT.gold[3]; ctx.lineWidth = 1.5; ctx.strokeRect(62, 132, 132, 66);
  ctx.restore();
  outline(ctx, body);
  for (const [x, y, r] of [[92, 164, 12], [128, 158, 16], [164, 166, 11]]) {
    ctx.save();
    ctx.shadowColor = '#b8f0ff'; ctx.shadowBlur = 14;
    ctx.fillStyle = '#ffffff';
    ctx.fill(star(x, y, 4, r * 0.22, r, 0));
    ctx.restore();
  }
  // lid
  const lid = rrPath(44, 100, 168, 26, 7);
  shade(ctx, lid, chrome(ctx, MAT.gold, 44, 0, 212, 0), [44, 100, 168, 26], { lw: 4.5 });
  // glowing seam
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, 52, 0, 204, 0, [[0, 'rgba(126,224,255,0)'], [0.5, 'rgba(220,250,255,1)'], [1, 'rgba(126,224,255,0)']]);
  ctx.fillRect(52, 125, 152, 5);
  glow(ctx, 128, 128, 70, 'rgba(150,220,255,0.35)');
  ctx.restore();
  // feet
  for (const x of [62, 180]) shade(ctx, rrPath(x, 206, 14, 16, 3), metal(ctx, MAT.gold, x, 206, x + 14, 222), [x, 206, 14, 16], { lw: 3.5, drop: false });
  sparkle(ctx, 60, 40, 12);
  sparkle(ctx, 198, 60, 9, '#ffd6ff');
}

// ---------------------------------------------------------------- T9
function livingRelic(ctx: Ctx, withIris: boolean) {
  // tendrils
  ctx.save();
  ctx.lineCap = 'round';
  const tend = [[-1, 60], [1, 60], [-1, 100], [1, 100], [0, 120]];
  for (const [s, len] of tend) {
    ctx.beginPath();
    ctx.moveTo(128 + s * 30, 190);
    ctx.bezierCurveTo(128 + s * 60, 200 + len * 0.2, 128 + s * (len * 0.9), 220, 128 + s * (len * 0.8 + 10), 244 - (s === 0 ? 0 : 10));
    ctx.lineWidth = 16; ctx.strokeStyle = OUT; ctx.stroke();
    ctx.lineWidth = 9; ctx.strokeStyle = lin(ctx, 128, 190, 128, 244, [[0, '#5a1a6a'], [1, '#ff7ad9']]); ctx.stroke();
  }
  ctx.restore();
  // halo spikes
  const halo = star(128, 124, 16, 90, 124);
  ctx.save(); ctx.globalAlpha = 0.95;
  shade(ctx, halo, rad(ctx, 128, 124, 60, 124, [[0, MAT.gold[1]], [0.7, MAT.gold[3]], [1, '#5a1a6a']]), [4, 0, 248, 248], { lw: 4, hi: 0.15 });
  ctx.restore();
  // orb
  const orb = circle(128, 124, 78);
  shade(ctx, orb, rad(ctx, 104, 96, 6, 96, [[0, '#8a3aa8'], [0.45, '#3b1450'], [1, '#0c0414']]), [50, 46, 156, 156], { outline: 'none', rim: 'rgba(255,122,217,0.9)' });
  ctx.save(); ctx.clip(orb);
  for (let i = 0; i < 26; i++) {
    const a = i * 2.39, r = 20 + (i * 13) % 56;
    ctx.fillStyle = `rgba(255,${180 + (i * 7) % 70},255,${0.25 + (i % 5) * 0.1})`;
    ctx.fillRect(128 + Math.cos(a) * r, 124 + Math.sin(a) * r, 2.5, 2.5);
  }
  ctx.restore();
  outline(ctx, orb, 6);
  // gold ring cage
  for (const rot of [-0.45, 0.45]) {
    strokeBar(ctx, (c) => { c.ellipse(128, 124, 96, 30, rot, Math.PI * 0.05, Math.PI * 0.95); }, 7, chrome(ctx, MAT.gold, 30, 90, 226, 160));
  }
  // eye
  const eye = new Path2D();
  eye.moveTo(76, 124); eye.quadraticCurveTo(128, 72, 180, 124); eye.quadraticCurveTo(128, 176, 76, 124); eye.closePath();
  ctx.save();
  ctx.fillStyle = rad(ctx, 128, 124, 4, 56, [[0, '#fff8e0'], [0.7, '#f4d890'], [1, '#b0703a']]);
  ctx.fill(eye);
  ctx.clip(eye);
  // veins
  ctx.strokeStyle = 'rgba(200,40,80,0.45)'; ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(78, 124); ctx.lineTo(96, 118); ctx.lineTo(104, 126);
  ctx.moveTo(178, 124); ctx.lineTo(160, 130); ctx.lineTo(154, 120);
  ctx.stroke();
  if (withIris) drawIris(ctx, 128, 124, 1);
  ctx.restore();
  outline(ctx, eye, 5);
  // lashes
  ctx.save(); ctx.strokeStyle = OUT; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) { const x = 128 + i * 20; const y = 98 + Math.abs(i) * 6; ctx.moveTo(x, y); ctx.lineTo(x + i * 5, y - 14); }
  ctx.stroke(); ctx.restore();
}

export function drawIris(ctx: Ctx, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = rad(ctx, -4, -4, 1, 28, [[0, '#ffe2ff'], [0.3, '#ff7ad9'], [0.7, '#7a1ea0'], [1, '#1a0228']]);
  ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 2); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#1a0228'; ctx.stroke();
  // radial iris fibres
  ctx.strokeStyle = 'rgba(255,220,255,0.35)'; ctx.lineWidth = 1.2;
  ctx.beginPath();
  for (let i = 0; i < 18; i++) { const a = (i / 18) * Math.PI * 2; ctx.moveTo(Math.cos(a) * 9, Math.sin(a) * 9); ctx.lineTo(Math.cos(a) * 23, Math.sin(a) * 23); }
  ctx.stroke();
  ctx.fillStyle = '#07000c';
  ctx.beginPath(); ctx.ellipse(0, 0, 6, 20, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.arc(-9, -9, 5, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.6;
  ctx.beginPath(); ctx.arc(8, 8, 2.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

const PAINTERS: ((ctx: Ctx, full: boolean) => void)[] = [
  () => {}, flint, copperIdol, silverUrn, goldMask, scarab, sapphireHeart, rubyCrown, starArk, livingRelic,
];

/** Paint any relic by item id (1–9 Forge, 11–17 Crypt, 21–27 Star Well) into a 256×256 box. */
/**
 * Recolour a painted relic to a floor's material without flattening it: `color` keeps the hue and chroma of the
 * new material and the luminance of the painting underneath, so the metal still reads as metal. A plain tint
 * would wash the whole silhouette one shade and look like a bug.
 */
function recolour(src: HTMLCanvasElement, hex: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'color';
  ctx.fillStyle = '#' + hex.toString(16).padStart(6, '0');
  ctx.fillRect(0, 0, src.width, src.height);
  ctx.restore();
  // keep the shape: the recolour pass must not bleed outside the painted pixels
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(src, 0, 0);
  return c;
}

export function paintRelic(ctx: Ctx, id: number, withIris = true) {
  ctx.save();
  // keep everything inside the frame with a small margin
  ctx.translate(128, 128); ctx.scale(0.94, 0.94); ctx.translate(-128, -128);
  if (id <= 9) PAINTERS[id](ctx, withIris);
  else if (CHAIN_PAINTERS[id]) CHAIN_PAINTERS[id](ctx);
  else {
    /**
     * A floor relic (chains 3+, docs/ROOMS.md). Until the form-and-material grammar is painted, these borrow the
     * silhouette of the same tier on the Antechamber ladder and wear their own floor's material. That is a
     * deliberate placeholder and it is *visible* — the alternative, which this replaced, was
     * `CHAIN_PAINTERS[id]?.(ctx)`, which painted nothing at all and would have shipped ninety invisible relics
     * with no error anywhere (P-WIRED-NOTHING).
     */
    const tier = id % 10;
    const [master, mctx] = makeCanvas(256, 256);
    PAINTERS[Math.max(1, Math.min(9, tier))](mctx, withIris);
    ctx.drawImage(recolour(master, ITEMS[id]?.color ?? 0xffffff), 0, 0);
  }
  ctx.restore();
}

function sheenOver(src: HTMLCanvasElement, t: number): HTMLCanvasElement {
  const [c, ctx] = makeCanvas(src.width, src.height);
  ctx.drawImage(src, 0, 0);
  if (t < 0) return c;
  const S = src.width;
  ctx.globalCompositeOperation = 'source-atop';
  const x = -S * 0.6 + t * S * 2.2;
  const g = ctx.createLinearGradient(x - S * 0.25, 0, x + S * 0.25, S * 0.5);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.45, 'rgba(255,252,235,0.55)');
  g.addColorStop(0.5, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.55, 'rgba(255,252,235,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  return c;
}

export const SHEEN_FRAMES = 6;
export const BOARD_FRAME = 160;

/**
 * Which relics can appear on the board right now: the floor's own ladder, plus the two chains that run the whole
 * depth. With ten floors the board atlas would otherwise be 104 items tall (over 16,000px, past the maximum
 * texture size on every phone we care about), for 81 relics that cannot be on the board.
 */
export function boardIds(floor: number): number[] {
  const chains = [floorDef(floor).chain, 1, 2];
  return ITEM_IDS.filter((id) => chains.includes(Math.floor(id / 10)));
}

/** The sheen-sweep atlas for one floor's relics. Rebaked when the floor changes, so it never grows. */
export function bakeBoardAtlas(scene: Phaser.Scene, ids: number[], masters: Record<number, HTMLCanvasElement>) {
  const F = BOARD_FRAME, cols = SHEEN_FRAMES + 1;
  if (scene.textures.exists('relics')) scene.textures.remove('relics');
  const [ab, xb] = makeCanvas(F * cols, F * ids.length);
  ids.forEach((id, row) => {
    const [small, sctx] = makeCanvas(F, F);
    const [mid, mctx] = makeCanvas(F * 1.25, F * 1.25);
    mctx.drawImage(masters[id], 0, 0, F * 1.25, F * 1.25);
    sctx.drawImage(mid, 0, 0, F, F);
    for (let f = 0; f < cols; f++) {
      const frame = sheenOver(small, f === 0 ? -1 : (f - 1) / (SHEEN_FRAMES - 1));
      xb.drawImage(frame, f * F, row * F);
    }
  });
  const texB = scene.textures.addCanvas('relics', ab)!;
  ids.forEach((id, row) => { for (let f = 0; f < cols; f++) texB.add(`r${id}_${f}`, 0, f * F, row * F, F, F); });
}

/**
 * AB#4737: the relics a boot paints. On a low-end phone painting all 120 took most of the boot, for 70 relics that
 * live on floors 3 to 9. A boot paints the Crypt and the Star Well (every floor's bindings come from them, and from
 * the Antechamber) and each floor down to the deeper of floor 2 and the player's own; any other chain is painted the
 * first time a screen asks for one of its relics (paintOnLookup), and then kept for the session.
 */
export function bootChains(floor: number): number[] {
  const chains = new Set([1, 2]);
  for (let f = 0; f <= Math.max(2, floor); f++) chains.add(floorDef(f).chain);
  return [...chains].sort((a, b) => a - b);
}

/** The item a frame name in an atlas stands for ('R53' in relic256, 'i53' in relic96), or null. */
export function frameItem(name: unknown, prefix: string): number | null {
  if (typeof name !== 'string' || !name.startsWith(prefix)) return null;
  const rest = name.slice(prefix.length);
  return /^\d+$/.test(rest) && ITEMS[Number(rest)] ? Number(rest) : null;
}

/** Masters painted so far, kept for the session: the atlases, the board re-lay and a floor change reuse them. */
const masters: Record<number, HTMLCanvasElement> = {};
const mastersNoIris: Record<number, HTMLCanvasElement> = {};
const ATLAS_COLS = 8;
let atlas: { x256: CanvasRenderingContext2D; x96: CanvasRenderingContext2D; tex256: Phaser.Textures.Texture; tex96: Phaser.Textures.Texture } | null = null;

/** Paints the masters `ids` lack, into both atlases, and refreshes their GPU copies. How many it painted. */
function paintIds(ids: number[]): number {
  const fresh = ids.filter((id) => ITEMS[id] && !masters[id]);
  for (const id of fresh) {
    const [c, ctx] = makeCanvas(256, 256);
    paintRelic(ctx, id, true);
    masters[id] = c;
    if (id === 9) {
      const [c2, ctx2] = makeCanvas(256, 256);
      paintRelic(ctx2, id, false);
      mastersNoIris[id] = c2;
    } else mastersNoIris[id] = c;
    if (atlas) {
      const k = ITEM_IDS.indexOf(id), x = k % ATLAS_COLS, y = Math.floor(k / ATLAS_COLS);
      atlas.x256.drawImage(c, x * 256, y * 256);
      atlas.x96.drawImage(c, x * 96, y * 96, 96, 96);
    }
  }
  if (fresh.length && atlas) { atlas.tex256.source[0].update(); atlas.tex96.source[0].update(); }
  return fresh.length;
}

/** Paints a whole chain (a screen that shows one of its relics will show its neighbours next). */
export const paintChain = (chain: number) => paintIds(ITEM_IDS.filter((id) => chainOf(id) === chain));

/** An atlas whose frames are all defined, painting a relic's chain the first time any of its frames is looked up. */
function paintOnLookup(tex: Phaser.Textures.Texture, prefix: string) {
  const get = tex.get.bind(tex);
  tex.get = ((name?: string | number) => {
    const id = frameItem(name, prefix);
    if (id !== null && !masters[id]) paintChain(chainOf(id));
    return get(name);
  }) as typeof tex.get;
}

/** A floor change re-lays the board atlas, painting that floor's relics first if no screen has asked for them yet. */
export function rebakeBoardFor(scene: Phaser.Scene, floor: number) {
  const ids = boardIds(floor);
  paintIds(ids);
  if (ids.length) bakeBoardAtlas(scene, ids, mastersNoIris);
}

export function bakeRelics(scene: Phaser.Scene, floor = 0) {
  // grid atlases keep every texture under 4096px for older phones; every frame is defined now, painted when needed
  const ids = ITEM_IDS;
  const rows = Math.ceil(ids.length / ATLAS_COLS);
  const grid = (k: number, size: number) => ({ x: (k % ATLAS_COLS) * size, y: Math.floor(k / ATLAS_COLS) * size });
  const [a256, x256] = makeCanvas(256 * ATLAS_COLS, 256 * rows);
  const tex256 = scene.textures.addCanvas('relic256', a256)!;
  ids.forEach((id, k) => { const p = grid(k, 256); tex256.add(`R${id}`, 0, p.x, p.y, 256, 256); });
  const [a96, x96] = makeCanvas(96 * ATLAS_COLS, 96 * rows);
  const tex96 = scene.textures.addCanvas('relic96', a96)!;
  ids.forEach((id, k) => { const p = grid(k, 96); tex96.add(`i${id}`, 0, p.x, p.y, 96, 96); });
  atlas = { x256, x96, tex256, tex96 };
  const first = bootChains(floor);
  paintIds(ids.filter((id) => first.includes(chainOf(id))));
  paintOnLookup(tex256, 'R');
  paintOnLookup(tex96, 'i');

  // board atlas with sheen frames: one row per item, for this floor's relics only
  rebakeBoardFor(scene, floor);

  // live iris for the Living Relic
  const [ic, ictx] = makeCanvas(64, 64);
  drawIris(ictx, 32, 32, 1.1);
  scene.textures.addCanvas('iris', ic);

  // glow disc used behind high tiers
  const [gc, gctx] = makeCanvas(256, 256);
  gctx.fillStyle = rad(gctx, 128, 128, 0, 128, [[0, 'rgba(255,255,255,0.9)'], [0.35, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
  gctx.fillRect(0, 0, 256, 256);
  scene.textures.addCanvas('relicGlow', gc);
}
