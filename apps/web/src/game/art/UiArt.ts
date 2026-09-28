import type Phaser from 'phaser';
import { installLazyTextures, lazyTexture, type TextureLookup } from './lazy'; // AB#4737
import { Ctx, makeCanvas, lin, rad, rr, rrPath, glow, speckle, MAT, chrome, metal, shade, star, poly, smooth, sparkle, seeded } from './paint';
import { paintRelic } from './RelicFactory';
import { paintCryptBrazier, paintStarWell, paintPatron } from './ChainArt';
import { PATRONS } from '../data/items';

/** Premium gacha-shop chrome: plaques, buttons, seals, ribbons, currencies, icons, particles. */

const OUT = '#120904';

function circlePath(x: number, y: number, r: number) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; }

// ---------------------------------------------------------------- panel (nine-slice source)
export const PANEL = { size: 256, corner: 84 };
function paintPanel(ctx: Ctx, velvet: [string, string, string]) {
  const S = PANEL.size;
  // outer iron frame
  const outer = rrPath(4, 4, S - 8, S - 8, 34);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.7)'; ctx.shadowBlur = 0;
  ctx.fillStyle = lin(ctx, 0, 0, 0, S, [[0, '#4a4452'], [0.12, '#2a2530'], [0.88, '#1a171f'], [1, '#08070a']]);
  ctx.fill(outer); ctx.restore();
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = '#000'; ctx.stroke(outer); ctx.restore();
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.beginPath(); rr(ctx, 7, 7, S - 14, S - 14, 31); ctx.stroke(); ctx.restore();
  // gold channel
  ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, 0, S);
  ctx.beginPath(); rr(ctx, 20, 20, S - 40, S - 40, 22); ctx.stroke();
  ctx.lineWidth = 1.5; ctx.strokeStyle = OUT;
  ctx.beginPath(); rr(ctx, 16, 16, S - 32, S - 32, 25); ctx.stroke();
  ctx.beginPath(); rr(ctx, 24, 24, S - 48, S - 48, 19); ctx.stroke();
  ctx.restore();
  // velvet
  const inner = rrPath(26, 26, S - 52, S - 52, 18);
  ctx.save();
  ctx.fillStyle = rad(ctx, S / 2, S * 0.35, 10, S * 0.75, [[0, velvet[0]], [0.6, velvet[1]], [1, velvet[2]]]);
  ctx.fill(inner);
  ctx.clip(inner);
  speckle(ctx, 26, 26, S - 52, S - 52, 1400, 3, ['#000000', 'rgba(255,255,255,0.3)'], [0.5, 1.4]);
  // inner shadow
  ctx.lineWidth = 16; ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.stroke(inner);
  ctx.restore();
  // corner filigree
  for (const [cx, cy, sx, sy] of [[0, 0, 1, 1], [S, 0, -1, 1], [0, S, 1, -1], [S, S, -1, -1]]) {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(sx, sy);
    const orn = new Path2D();
    orn.moveTo(8, 8); orn.lineTo(70, 8); orn.quadraticCurveTo(52, 16, 44, 28); orn.quadraticCurveTo(30, 30, 28, 44);
    orn.quadraticCurveTo(16, 52, 8, 70); orn.closePath();
    shade(ctx, orn, chrome(ctx, MAT.gold, 8, 8, 70, 70), [8, 8, 62, 62], { lw: 3, hi: 0.4 });
    // curl
    ctx.lineWidth = 4; ctx.strokeStyle = MAT.gold[1]; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(50, 50, 10, Math.PI, Math.PI * 2.4); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.strokeStyle = OUT; ctx.stroke();
    // ruby rivet
    shade(ctx, circlePath(24, 24, 8), rad(ctx, 21, 21, 1, 9, [[0, '#ffd0d8'], [0.4, '#ff4d6d'], [1, '#5a0014']]), [16, 16, 16, 16], { lw: 2.5, drop: false });
    ctx.restore();
  }
}

// ---------------------------------------------------------------- buttons (nine-slice)
export const BTN = { w: 240, h: 128, corner: 56 };
const BTN_COLORS: Record<string, string[]> = {
  gold: ['#FFF6CF', '#FFD86B', '#E9A92E', '#9A5A08', '#3a1e02'],
  green: ['#E8FFD8', '#7CE06A', '#2FA84A', '#11562A', '#062410'],
  red: ['#FFE0E4', '#FF7A88', '#E0304A', '#7A0A1E', '#2a0208'],
  blue: ['#E6FBFF', '#7EE0FF', '#3AA0C8', '#16507A', '#06203a'],
  purple: ['#F2E6FF', '#C79BFF', '#8A4AE0', '#44187A', '#1a0630'],
  dark: ['#9a93a8', '#5c5468', '#3a3344', '#1c1822', '#0a080d'],
};
function paintButton(ctx: Ctx, col: string[]) {
  const { w, h } = BTN;
  const outer = rrPath(4, 4, w - 8, h - 12, 44);
  // drop plinth
  ctx.save(); ctx.fillStyle = col[4]; ctx.beginPath(); rr(ctx, 4, 12, w - 8, h - 14, 44); ctx.fill(); ctx.restore();
  // gold rim
  ctx.save(); ctx.fillStyle = chrome(ctx, MAT.gold, 0, 4, 0, h - 8); ctx.fill(outer);
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(outer); ctx.restore();
  // face
  const face = rrPath(12, 11, w - 24, h - 28, 36);
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 11, 0, h - 17, [[0, col[1]], [0.5, col[2]], [1, col[3]]]);
  ctx.fill(face);
  ctx.clip(face);
  // gloss
  ctx.fillStyle = lin(ctx, 0, 11, 0, h * 0.5, [[0, 'rgba(255,255,255,0.65)'], [1, 'rgba(255,255,255,0.05)']]);
  ctx.beginPath(); rr(ctx, 22, 15, w - 44, h * 0.34, 24); ctx.fill();
  // bottom inner shade
  ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.translate(0, 4); ctx.stroke(face);
  ctx.restore();
  ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = col[4]; ctx.stroke(face); ctx.restore();
}

// ---------------------------------------------------------------- pill (HUD)
export const PILL = { w: 220, h: 84, corner: 40 };
function paintPill(ctx: Ctx) {
  const { w, h } = PILL;
  const p = rrPath(3, 3, w - 6, h - 6, 38);
  ctx.save(); ctx.fillStyle = chrome(ctx, MAT.gold, 0, 3, 0, h - 3); ctx.fill(p); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(p); ctx.restore();
  const inner = rrPath(10, 10, w - 20, h - 20, 30);
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 10, 0, h - 10, [[0, '#07050a'], [0.5, '#1b1424'], [1, '#2a2033']]);
  ctx.fill(inner); ctx.clip(inner);
  ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.translate(0, 3); ctx.stroke(inner);
  ctx.restore();
}

// ---------------------------------------------------------------- ribbon title
function paintRibbon(ctx: Ctx, w: number, h: number, c: [string, string, string]) {
  const tail = 70, fold = 22;
  // tails
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(w / 2, 0); ctx.scale(s, 1); ctx.translate(-w / 2, 0);
    const t = poly([[0, 34], [tail + 10, 34], [tail + 10, h - 8], [0, h - 8], [26, (34 + h - 8) / 2]]);
    shade(ctx, t, lin(ctx, 0, 34, 0, h, [[0, c[1]], [1, c[2]]]), [0, 34, tail + 10, h - 42], { lw: 4, hi: 0.1 });
    const f = poly([[tail - fold + 10, h - 8], [tail + 10, h - 8], [tail + 10 + fold, h - 22]]);
    ctx.fillStyle = '#1a0206'; ctx.fill(f);
    ctx.restore();
  }
  const body = new Path2D();
  body.moveTo(tail, 10); body.quadraticCurveTo(w / 2, -2, w - tail, 10); body.lineTo(w - tail, h - 22);
  body.quadraticCurveTo(w / 2, h - 34, tail, h - 22); body.closePath();
  shade(ctx, body, lin(ctx, 0, 10, 0, h - 22, [[0, c[0]], [0.5, c[1]], [1, c[2]]]), [tail, 4, w - tail * 2, h - 26], { lw: 4, hi: 0.3 });
  ctx.save(); ctx.clip(body);
  ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, 0, h); ctx.lineWidth = 4;
  ctx.beginPath(); ctx.moveTo(tail, 20); ctx.quadraticCurveTo(w / 2, 8, w - tail, 20); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(tail, h - 32); ctx.quadraticCurveTo(w / 2, h - 44, w - tail, h - 32); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- wax seal
function paintSeal(ctx: Ctx, S: number, c: [string, string, string]) {
  const r = seeded(S + c[1].length);
  const pts: number[][] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2, rr0 = S * 0.44 + (r() - 0.5) * S * 0.08;
    pts.push([S / 2 + Math.cos(a) * rr0, S / 2 + Math.sin(a) * rr0]);
  }
  const blob = smooth(pts, 0.6);
  shade(ctx, blob, rad(ctx, S * 0.4, S * 0.35, 2, S * 0.55, [[0, c[0]], [0.5, c[1]], [1, c[2]]]), [0, 0, S, S], { lw: 3, hi: 0.35 });
  ctx.save();
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.arc(S / 2, S / 2, S * 0.33, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(S / 2 - 1, S / 2 - 1, S * 0.33, Math.PI, Math.PI * 1.7); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- currencies
function paintCoin(ctx: Ctx, S: number) {
  const c = S / 2, R = S * 0.44;
  ctx.save(); ctx.fillStyle = MAT.gold[4]; ctx.beginPath(); ctx.arc(c, c + S * 0.04, R, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  shade(ctx, circlePath(c, c, R), rad(ctx, c - R * 0.4, c - R * 0.4, 2, R * 1.4, [[0, MAT.gold[0]], [0.35, MAT.gold[1]], [0.7, MAT.gold[2]], [1, MAT.gold[3]]]), [c - R, c - R, R * 2, R * 2], { lw: S * 0.04, hi: 0.4 });
  ctx.save();
  ctx.lineWidth = S * 0.035; ctx.strokeStyle = 'rgba(122,74,12,0.9)';
  ctx.beginPath(); ctx.arc(c, c, R * 0.74, 0, Math.PI * 2); ctx.stroke();
  // keyhole emblem
  ctx.fillStyle = lin(ctx, 0, c - R * 0.5, 0, c + R * 0.5, [[0, '#7A4A0C'], [1, '#4A2A05']]);
  ctx.beginPath(); ctx.arc(c, c - R * 0.14, R * 0.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(c - R * 0.1, c - R * 0.05); ctx.lineTo(c + R * 0.1, c - R * 0.05); ctx.lineTo(c + R * 0.17, c + R * 0.42); ctx.lineTo(c - R * 0.17, c + R * 0.42); ctx.fill();
  ctx.restore();
  sparkle(ctx, c - R * 0.45, c - R * 0.5, S * 0.14);
}
function paintGem(ctx: Ctx, S: number) {
  const c = S / 2;
  const pts = [[c, S * 0.06], [S * 0.86, S * 0.34], [S * 0.72, S * 0.86], [S * 0.28, S * 0.86], [S * 0.14, S * 0.34]];
  const p = poly(pts);
  shade(ctx, p, lin(ctx, 0, 0, S, S, [[0, '#e6fbff'], [0.35, '#7EE0FF'], [0.7, '#3AA0C8'], [1, '#0b3a5a']]), [S * 0.14, S * 0.06, S * 0.72, S * 0.8], { lw: S * 0.04, hi: 0.4, rim: 'rgba(255,255,255,0.9)' });
  const t = poly([[c, S * 0.24], [S * 0.66, S * 0.4], [S * 0.58, S * 0.66], [S * 0.42, S * 0.66], [S * 0.34, S * 0.4]]);
  ctx.save(); ctx.clip(p);
  const cx = c, cy = S * 0.48;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length];
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.closePath();
    ctx.fillStyle = i % 2 ? 'rgba(255,255,255,0.18)' : 'rgba(0,30,60,0.18)'; ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill(t);
  ctx.restore();
  ctx.save(); ctx.lineWidth = S * 0.02; ctx.strokeStyle = 'rgba(8,40,70,0.6)'; ctx.stroke(t); ctx.restore();
  sparkle(ctx, S * 0.34, S * 0.3, S * 0.15);
}

// ---------------------------------------------------------------- pig idol
function paintPig(ctx: Ctx, S: number) {
  const c = S / 2;
  // legs
  for (const x of [0.3, 0.44, 0.58, 0.72]) shade(ctx, rrPath(S * x - 9, S * 0.7, 18, S * 0.16, 6), metal(ctx, MAT.gold, 0, S * 0.7, 0, S * 0.86), [S * x - 9, S * 0.7, 18, S * 0.16], { lw: 3.5, drop: false });
  // ears
  for (const s of [-1, 1]) shade(ctx, poly([[c + s * S * 0.12, S * 0.26], [c + s * S * 0.3, S * 0.12], [c + s * S * 0.3, S * 0.34]]), metal(ctx, MAT.gold, c, S * 0.12, c + s * S * 0.3, S * 0.34), [c - S * 0.3, S * 0.12, S * 0.6, S * 0.22], { lw: 3.5 });
  // body
  const body = new Path2D(); body.ellipse(c, S * 0.52, S * 0.4, S * 0.3, 0, 0, Math.PI * 2);
  shade(ctx, body, rad(ctx, c - S * 0.14, S * 0.38, 4, S * 0.5, [[0, MAT.gold[0]], [0.3, MAT.gold[1]], [0.7, MAT.gold[2]], [1, MAT.gold[3]]]), [c - S * 0.4, S * 0.22, S * 0.8, S * 0.6], { lw: 4.5, hi: 0.45 });
  // engraved band
  ctx.save(); ctx.clip(body);
  ctx.strokeStyle = 'rgba(122,74,12,0.8)'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.ellipse(c, S * 0.52, S * 0.4, S * 0.1, 0, 0, Math.PI); ctx.stroke();
  ctx.restore();
  // snout
  const snout = new Path2D(); snout.ellipse(c + S * 0.3, S * 0.52, S * 0.09, S * 0.11, 0, 0, Math.PI * 2);
  shade(ctx, snout, metal(ctx, MAT.gold, c + S * 0.2, S * 0.4, c + S * 0.4, S * 0.64), [c + S * 0.21, S * 0.41, S * 0.18, S * 0.22], { lw: 3.5, drop: false });
  ctx.fillStyle = '#4A2A05';
  for (const dy of [-0.035, 0.035]) { ctx.beginPath(); ctx.ellipse(c + S * 0.32, S * (0.52 + dy), 3, 5, 0, 0, Math.PI * 2); ctx.fill(); }
  // ruby eye
  ctx.save(); ctx.shadowColor = '#ff4d6d'; ctx.shadowBlur = 8;
  ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(c + S * 0.16, S * 0.42, S * 0.035, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // coin slot
  ctx.fillStyle = '#2a1602'; ctx.beginPath(); rr(ctx, c - S * 0.12, S * 0.25, S * 0.2, S * 0.045, 4); ctx.fill();
  // tail curl
  ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = MAT.gold[3]; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.arc(c - S * 0.42, S * 0.45, S * 0.05, 0, Math.PI * 1.6); ctx.stroke(); ctx.restore();
  sparkle(ctx, c - S * 0.14, S * 0.36, S * 0.1);
}

// ---------------------------------------------------------------- rank medallion
function paintMedallion(ctx: Ctx, S: number) {
  const c = S / 2;
  // laurel
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a = Math.PI / 2 + s * (0.5 + i * 0.3);
      const x = c + Math.cos(a) * S * 0.42, y = c + Math.sin(a) * S * 0.42;
      const leaf = new Path2D(); leaf.ellipse(x, y, S * 0.07, S * 0.03, a + s * 1.2, 0, Math.PI * 2);
      shade(ctx, leaf, metal(ctx, MAT.gold, x - 10, y - 10, x + 10, y + 10), [x - 12, y - 12, 24, 24], { lw: 2.5, drop: false, hi: 0.2 });
    }
  }
  const disc = circlePath(c, c, S * 0.36);
  shade(ctx, disc, chrome(ctx, MAT.gold, c - S * 0.36, c - S * 0.36, c + S * 0.36, c + S * 0.36), [c - S * 0.36, c - S * 0.36, S * 0.72, S * 0.72], { lw: 4, hi: 0.4 });
  const inner = circlePath(c, c, S * 0.28);
  shade(ctx, inner, rad(ctx, c, c - S * 0.1, 2, S * 0.32, [[0, '#4a1a3a'], [1, '#12060e']]), [c - S * 0.28, c - S * 0.28, S * 0.56, S * 0.56], { lw: 3, drop: false, hi: 0.15 });
}

function paintCrown(ctx: Ctx, S: number) {
  const p = poly([[S * 0.1, S * 0.8], [S * 0.1, S * 0.3], [S * 0.3, S * 0.55], [S * 0.5, S * 0.18], [S * 0.7, S * 0.55], [S * 0.9, S * 0.3], [S * 0.9, S * 0.8]]);
  shade(ctx, p, chrome(ctx, MAT.gold, 0, 0, S, 0), [S * 0.1, S * 0.18, S * 0.8, S * 0.62], { lw: 3 });
  ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.64, S * 0.07, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------- tab icons
function iconVault(ctx: Ctx, S: number) {
  const c = S / 2;
  shade(ctx, circlePath(c, c, S * 0.42), chrome(ctx, MAT.bronze, 0, 0, S, S), [c - S * 0.42, c - S * 0.42, S * 0.84, S * 0.84], { lw: 4 });
  shade(ctx, circlePath(c, c, S * 0.32), rad(ctx, c - 8, c - 8, 2, S * 0.36, [[0, '#6a6078'], [1, '#1a1620']]), [c - S * 0.32, c - S * 0.32, S * 0.64, S * 0.64], { lw: 3, drop: false });
  ctx.save(); ctx.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(c, c); ctx.lineTo(c + Math.cos(a) * S * 0.26, c + Math.sin(a) * S * 0.26); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = MAT.gold[1]; ctx.stroke();
  }
  ctx.restore();
  shade(ctx, circlePath(c, c, S * 0.08), MAT.gold[2], [c - 8, c - 8, 16, 16], { lw: 3, drop: false });
}
function iconAlbum(ctx: Ctx, S: number) {
  const book = rrPath(S * 0.16, S * 0.12, S * 0.68, S * 0.78, 8);
  shade(ctx, book, lin(ctx, 0, 0, S, 0, [[0, '#5a0a1e'], [0.5, '#a01a3a'], [1, '#3a0612']]), [S * 0.16, S * 0.12, S * 0.68, S * 0.78], { lw: 4 });
  ctx.fillStyle = '#f7eed8'; ctx.fillRect(S * 0.8, S * 0.16, S * 0.05, S * 0.7);
  ctx.save(); ctx.strokeStyle = MAT.gold[2]; ctx.lineWidth = 3; ctx.strokeRect(S * 0.24, S * 0.2, S * 0.52, S * 0.62); ctx.restore();
  ctx.save(); ctx.shadowColor = '#7ee0ff'; ctx.shadowBlur = 8; ctx.fillStyle = '#7ee0ff';
  ctx.fill(star(S * 0.5, S * 0.5, 4, S * 0.05, S * 0.16, 0)); ctx.restore();
}
function iconPass(ctx: Ctx, S: number) {
  const p = poly([[S * 0.22, S * 0.1], [S * 0.78, S * 0.1], [S * 0.78, S * 0.88], [S * 0.5, S * 0.72], [S * 0.22, S * 0.88]]);
  shade(ctx, p, lin(ctx, 0, 0, S, 0, [[0, '#2a1a6a'], [0.5, '#6a3ac8'], [1, '#1a0e40']]), [S * 0.22, S * 0.1, S * 0.56, S * 0.78], { lw: 4 });
  ctx.save(); ctx.strokeStyle = MAT.gold[1]; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(S * 0.3, S * 0.2); ctx.lineTo(S * 0.7, S * 0.2); ctx.stroke(); ctx.restore();
  shade(ctx, star(S * 0.5, S * 0.42, 5, S * 0.08, S * 0.18), chrome(ctx, MAT.gold, 0, S * 0.24, 0, S * 0.6), [S * 0.32, S * 0.24, S * 0.36, S * 0.36], { lw: 3, drop: false });
}
function iconEvents(ctx: Ctx, S: number) {
  // trophy
  const cup = new Path2D();
  cup.moveTo(S * 0.24, S * 0.14); cup.lineTo(S * 0.76, S * 0.14); cup.quadraticCurveTo(S * 0.76, S * 0.56, S * 0.5, S * 0.6); cup.quadraticCurveTo(S * 0.24, S * 0.56, S * 0.24, S * 0.14); cup.closePath();
  for (const s of [-1, 1]) {
    ctx.save(); ctx.lineWidth = 9; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(S * 0.5 + s * S * 0.27, S * 0.3, S * 0.1, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 5; ctx.strokeStyle = MAT.gold[2]; ctx.stroke(); ctx.restore();
  }
  shade(ctx, cup, chrome(ctx, MAT.gold, S * 0.24, 0, S * 0.76, 0), [S * 0.24, S * 0.14, S * 0.52, S * 0.46], { lw: 4 });
  shade(ctx, rrPath(S * 0.44, S * 0.58, S * 0.12, S * 0.14, 3), MAT.gold[3], [S * 0.44, S * 0.58, S * 0.12, S * 0.14], { lw: 3, drop: false });
  shade(ctx, rrPath(S * 0.3, S * 0.72, S * 0.4, S * 0.14, 5), chrome(ctx, MAT.bronze, 0, S * 0.72, 0, S * 0.86), [S * 0.3, S * 0.72, S * 0.4, S * 0.14], { lw: 3.5, drop: false });
  ctx.save(); ctx.fillStyle = '#ff4d6d'; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.32, S * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function iconShop(ctx: Ctx, S: number) {
  // coin sack
  const sack = new Path2D();
  sack.moveTo(S * 0.38, S * 0.3); sack.bezierCurveTo(S * 0.06, S * 0.5, S * 0.12, S * 0.9, S * 0.5, S * 0.9);
  sack.bezierCurveTo(S * 0.88, S * 0.9, S * 0.94, S * 0.5, S * 0.62, S * 0.3); sack.closePath();
  shade(ctx, sack, rad(ctx, S * 0.4, S * 0.5, 4, S * 0.5, [[0, '#c89a5a'], [0.6, '#8a5a2a'], [1, '#3a2008']]), [S * 0.1, S * 0.3, S * 0.8, S * 0.6], { lw: 4 });
  const neck = poly([[S * 0.34, S * 0.18], [S * 0.66, S * 0.18], [S * 0.6, S * 0.32], [S * 0.4, S * 0.32]]);
  shade(ctx, neck, '#8a5a2a', [S * 0.34, S * 0.18, S * 0.32, S * 0.14], { lw: 3.5 });
  ctx.save(); ctx.strokeStyle = '#ff4d6d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(S * 0.36, S * 0.3); ctx.lineTo(S * 0.64, S * 0.3); ctx.stroke(); ctx.restore();
  const [cc, cctx] = makeCanvas(64, 64); paintCoin(cctx, 64);
  ctx.drawImage(cc, S * 0.36, S * 0.5, S * 0.32, S * 0.32);
}
function iconLock(ctx: Ctx, S: number) {
  ctx.save(); ctx.lineWidth = S * 0.1; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.42, S * 0.2, Math.PI, 0); ctx.stroke();
  ctx.lineWidth = S * 0.06; ctx.strokeStyle = MAT.silver[2]; ctx.stroke(); ctx.restore();
  shade(ctx, rrPath(S * 0.22, S * 0.42, S * 0.56, S * 0.44, 8), chrome(ctx, MAT.gold, S * 0.22, 0, S * 0.78, 0), [S * 0.22, S * 0.42, S * 0.56, S * 0.44], { lw: 4 });
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.6, S * 0.06, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(S * 0.48, S * 0.62, S * 0.04, S * 0.12);
}
function iconGear(ctx: Ctx, S: number) {
  const c = S / 2;
  const g = star(c, c, 8, S * 0.33, S * 0.44, 0);
  shade(ctx, g, chrome(ctx, MAT.silver, 0, 0, S, S), [S * 0.06, S * 0.06, S * 0.88, S * 0.88], { lw: 4 });
  shade(ctx, circlePath(c, c, S * 0.15), '#1b1424', [c - S * 0.15, c - S * 0.15, S * 0.3, S * 0.3], { lw: 3, drop: false });
}
function iconClose(ctx: Ctx, S: number) {
  const c = S / 2;
  shade(ctx, circlePath(c, c, S * 0.44), chrome(ctx, MAT.gold, 0, 0, 0, S), [c - S * 0.44, c - S * 0.44, S * 0.88, S * 0.88], { lw: 4 });
  shade(ctx, circlePath(c, c, S * 0.35), rad(ctx, c - 6, c - 8, 2, S * 0.4, [[0, '#ff7a88'], [0.6, '#c01a36'], [1, '#5a0014']]), [c - S * 0.35, c - S * 0.35, S * 0.7, S * 0.7], { lw: 2, drop: false });
  ctx.save(); ctx.lineCap = 'round';
  for (const w of [S * 0.13, S * 0.08]) {
    ctx.lineWidth = w; ctx.strokeStyle = w > S * 0.1 ? OUT : '#fff4e0';
    ctx.beginPath(); ctx.moveTo(c - S * 0.14, c - S * 0.14); ctx.lineTo(c + S * 0.14, c + S * 0.14);
    ctx.moveTo(c + S * 0.14, c - S * 0.14); ctx.lineTo(c - S * 0.14, c + S * 0.14); ctx.stroke();
  }
  ctx.restore();
}
function iconScroll(ctx: Ctx, S: number) {
  const p = rrPath(S * 0.2, S * 0.18, S * 0.6, S * 0.64, 6);
  shade(ctx, p, lin(ctx, 0, 0, S, 0, [[0, '#d8c49a'], [0.5, '#f7eed8'], [1, '#b89a6a']]), [S * 0.2, S * 0.18, S * 0.6, S * 0.64], { lw: 4 });
  for (const y of [0.14, 0.78]) shade(ctx, rrPath(S * 0.14, S * y, S * 0.72, S * 0.1, 5), chrome(ctx, MAT.bronze, 0, S * y, 0, S * (y + 0.1)), [S * 0.14, S * y, S * 0.72, S * 0.1], { lw: 3 });
  ctx.save(); ctx.strokeStyle = '#6a4a2a'; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.moveTo(S * 0.3, S * (0.36 + i * 0.12)); ctx.lineTo(S * 0.7, S * (0.36 + i * 0.12)); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#c01a36'; ctx.beginPath(); ctx.arc(S * 0.66, S * 0.66, S * 0.08, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}
function iconWheel(ctx: Ctx, S: number) {
  const c = S / 2, R = S * 0.42;
  const cols = ['#e0304a', '#f4c45a', '#3aa0c8', '#f4c45a', '#8a4ae0', '#f4c45a', '#2fa84a', '#f4c45a'];
  for (let i = 0; i < 8; i++) {
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, (i / 8) * Math.PI * 2, ((i + 1) / 8) * Math.PI * 2); ctx.closePath();
    ctx.fillStyle = cols[i]; ctx.fill();
  }
  ctx.save(); ctx.lineWidth = S * 0.06; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, 0, S); ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 2.5; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.arc(c, c, R + S * 0.03, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  shade(ctx, circlePath(c, c, S * 0.1), chrome(ctx, MAT.gold, 0, c - 10, 0, c + 10), [c - S * 0.1, c - S * 0.1, S * 0.2, S * 0.2], { lw: 3, drop: false });
  shade(ctx, poly([[c - S * 0.08, S * 0.02], [c + S * 0.08, S * 0.02], [c, S * 0.18]]), '#ff4d6d', [c - S * 0.08, S * 0.02, S * 0.16, S * 0.16], { lw: 3 });
}
function iconSatchel(ctx: Ctx, S: number) {
  const bag = rrPath(S * 0.14, S * 0.3, S * 0.72, S * 0.56, 14);
  shade(ctx, bag, lin(ctx, 0, 0, 0, S, [[0, '#a06a3a'], [1, '#4a2a10']]), [S * 0.14, S * 0.3, S * 0.72, S * 0.56], { lw: 4 });
  const flap = new Path2D(); flap.moveTo(S * 0.14, S * 0.34); flap.lineTo(S * 0.86, S * 0.34); flap.lineTo(S * 0.86, S * 0.5); flap.quadraticCurveTo(S * 0.5, S * 0.66, S * 0.14, S * 0.5); flap.closePath();
  shade(ctx, flap, lin(ctx, 0, 0, 0, S * 0.6, [[0, '#c88a4a'], [1, '#6a3a18']]), [S * 0.14, S * 0.34, S * 0.72, S * 0.26], { lw: 3.5, drop: false });
  ctx.save(); ctx.lineWidth = 7; ctx.strokeStyle = '#4a2a10'; ctx.beginPath(); ctx.arc(S * 0.5, S * 0.3, S * 0.2, Math.PI, 0); ctx.stroke(); ctx.restore();
  shade(ctx, circlePath(S * 0.5, S * 0.54, S * 0.06), MAT.gold[2], [S * 0.44, S * 0.48, S * 0.12, S * 0.12], { lw: 3, drop: false });
}
function iconAd(ctx: Ctx, S: number) {
  const p = rrPath(S * 0.1, S * 0.2, S * 0.8, S * 0.6, 14);
  shade(ctx, p, lin(ctx, 0, 0, 0, S, [[0, '#7EE0FF'], [1, '#16507A']]), [S * 0.1, S * 0.2, S * 0.8, S * 0.6], { lw: 4 });
  shade(ctx, poly([[S * 0.42, S * 0.34], [S * 0.66, S * 0.5], [S * 0.42, S * 0.66]]), '#fff', [S * 0.42, S * 0.34, S * 0.24, S * 0.32], { lw: 3, drop: false });
}
function iconSell(ctx: Ctx, S: number) {
  // scales
  ctx.save(); ctx.lineCap = 'round';
  ctx.lineWidth = 8; ctx.strokeStyle = OUT;
  ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.16); ctx.lineTo(S * 0.5, S * 0.82); ctx.moveTo(S * 0.18, S * 0.28); ctx.lineTo(S * 0.82, S * 0.28); ctx.stroke();
  ctx.lineWidth = 4.5; ctx.strokeStyle = MAT.gold[2]; ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = MAT.gold[3];
  ctx.beginPath(); ctx.moveTo(S * 0.18, S * 0.28); ctx.lineTo(S * 0.1, S * 0.56); ctx.moveTo(S * 0.18, S * 0.28); ctx.lineTo(S * 0.3, S * 0.56);
  ctx.moveTo(S * 0.82, S * 0.28); ctx.lineTo(S * 0.7, S * 0.56); ctx.moveTo(S * 0.82, S * 0.28); ctx.lineTo(S * 0.9, S * 0.56); ctx.stroke();
  ctx.restore();
  for (const x of [0.2, 0.8]) {
    const pan = new Path2D(); pan.moveTo(S * (x - 0.14), S * 0.56); pan.quadraticCurveTo(S * x, S * 0.72, S * (x + 0.14), S * 0.56); pan.closePath();
    shade(ctx, pan, chrome(ctx, MAT.gold, 0, S * 0.56, 0, S * 0.66), [S * (x - 0.14), S * 0.56, S * 0.28, S * 0.1], { lw: 3, drop: false });
  }
  shade(ctx, rrPath(S * 0.34, S * 0.8, S * 0.32, S * 0.08, 4), chrome(ctx, MAT.gold, 0, S * 0.8, 0, S * 0.88), [S * 0.34, S * 0.8, S * 0.32, S * 0.08], { lw: 3, drop: false });
}
function iconHand(ctx: Ctx, S: number) {
  // ghostly pointing gauntlet
  const p = new Path2D();
  p.moveTo(S * 0.42, S * 0.08); p.quadraticCurveTo(S * 0.5, S * 0.02, S * 0.56, S * 0.1);
  p.lineTo(S * 0.58, S * 0.42); p.quadraticCurveTo(S * 0.66, S * 0.36, S * 0.72, S * 0.44);
  p.quadraticCurveTo(S * 0.8, S * 0.42, S * 0.84, S * 0.52); p.quadraticCurveTo(S * 0.92, S * 0.54, S * 0.9, S * 0.66);
  p.quadraticCurveTo(S * 0.88, S * 0.9, S * 0.62, S * 0.96); p.lineTo(S * 0.44, S * 0.96);
  p.quadraticCurveTo(S * 0.3, S * 0.9, S * 0.2, S * 0.66); p.quadraticCurveTo(S * 0.14, S * 0.56, S * 0.24, S * 0.54);
  p.lineTo(S * 0.4, S * 0.64); p.closePath();
  ctx.save(); ctx.shadowColor = 'rgba(126,224,255,0.9)'; ctx.shadowBlur = 18;
  ctx.fillStyle = lin(ctx, 0, 0, S, S, [[0, 'rgba(255,255,255,0.95)'], [1, 'rgba(180,230,255,0.85)']]);
  ctx.fill(p); ctx.restore();
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(20,40,70,0.8)'; ctx.stroke(p); ctx.restore();
}
function iconChestSmall(ctx: Ctx, S: number) {
  const body = rrPath(S * 0.12, S * 0.42, S * 0.76, S * 0.46, 6);
  shade(ctx, body, lin(ctx, 0, 0, 0, S, [[0, '#8a3a1a'], [1, '#3a1206']]), [S * 0.12, S * 0.42, S * 0.76, S * 0.46], { lw: 4 });
  const lid = new Path2D(); lid.moveTo(S * 0.12, S * 0.44); lid.quadraticCurveTo(S * 0.5, S * 0.06, S * 0.88, S * 0.44); lid.closePath();
  shade(ctx, lid, lin(ctx, 0, S * 0.1, 0, S * 0.44, [[0, '#b85a2a'], [1, '#5a1a08']]), [S * 0.12, S * 0.16, S * 0.76, S * 0.28], { lw: 4 });
  ctx.save(); ctx.fillStyle = chrome(ctx, MAT.gold, 0, 0, S, 0);
  ctx.fillRect(S * 0.2, S * 0.2, S * 0.08, S * 0.66); ctx.fillRect(S * 0.72, S * 0.2, S * 0.08, S * 0.66); ctx.restore();
  shade(ctx, rrPath(S * 0.42, S * 0.4, S * 0.16, S * 0.18, 3), chrome(ctx, MAT.gold, S * 0.42, 0, S * 0.58, 0), [S * 0.42, S * 0.4, S * 0.16, S * 0.18], { lw: 3, drop: false });
}
function iconCard(ctx: Ctx, S: number) {
  for (const [dx, rot] of [[-0.1, -0.2], [0.1, 0.18]]) {
    ctx.save(); ctx.translate(S * (0.5 + dx), S * 0.52); ctx.rotate(rot);
    const p = rrPath(-S * 0.24, -S * 0.34, S * 0.48, S * 0.68, 6);
    shade(ctx, p, lin(ctx, 0, -S * 0.34, 0, S * 0.34, [[0, '#3a2a6a'], [1, '#140a2a']]), [-S * 0.24, -S * 0.34, S * 0.48, S * 0.68], { lw: 3.5 });
    ctx.strokeStyle = MAT.gold[2]; ctx.lineWidth = 2.5; ctx.strokeRect(-S * 0.18, -S * 0.28, S * 0.36, S * 0.56);
    ctx.fillStyle = '#7ee0ff'; ctx.fill(star(0, 0, 4, S * 0.03, S * 0.1, 0));
    ctx.restore();
  }
}
function iconBoost(ctx: Ctx, S: number) {
  const f = new Path2D();
  f.moveTo(S * 0.5, S * 0.06); f.bezierCurveTo(S * 0.9, S * 0.4, S * 0.86, S * 0.92, S * 0.5, S * 0.94);
  f.bezierCurveTo(S * 0.14, S * 0.92, S * 0.1, S * 0.5, S * 0.34, S * 0.3); f.quadraticCurveTo(S * 0.36, S * 0.5, S * 0.46, S * 0.52); f.quadraticCurveTo(S * 0.4, S * 0.26, S * 0.5, S * 0.06); f.closePath();
  shade(ctx, f, lin(ctx, 0, S * 0.06, 0, S * 0.94, [[0, '#fff2a0'], [0.4, '#ffb03a'], [1, '#e0304a']]), [S * 0.14, S * 0.06, S * 0.72, S * 0.88], { lw: 4 });
}
function iconLuck(ctx: Ctx, S: number) {
  // four-leaf emerald clover
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = S / 2 + Math.cos(a) * S * 0.18, y = S * 0.46 + Math.sin(a) * S * 0.18;
    shade(ctx, circlePath(x, y, S * 0.16), rad(ctx, x - 4, y - 4, 1, S * 0.18, [[0, '#d8ffe9'], [0.4, '#3fe39a'], [1, '#063a24']]), [x - S * 0.16, y - S * 0.16, S * 0.32, S * 0.32], { lw: 3 });
  }
  ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = MAT.gold[2]; ctx.beginPath(); ctx.moveTo(S * 0.5, S * 0.5); ctx.quadraticCurveTo(S * 0.52, S * 0.8, S * 0.66, S * 0.92); ctx.stroke(); ctx.restore();
}

// ---------------------------------------------------------------- forge (anvil on brazier)
function paintForge(ctx: Ctx, S: number) {
  const c = S / 2;
  // outer ring
  shade(ctx, circlePath(c, c, S * 0.47), chrome(ctx, MAT.gold, 0, 0, 0, S), [c - S * 0.47, c - S * 0.47, S * 0.94, S * 0.94], { lw: 5, hi: 0.35 });
  const inner = circlePath(c, c, S * 0.4);
  ctx.save();
  ctx.fillStyle = rad(ctx, c, c + S * 0.18, 4, S * 0.46, [[0, '#ffdf7a'], [0.25, '#ff8a2a'], [0.55, '#8a1a0a'], [1, '#1a0404']]);
  ctx.fill(inner); ctx.clip(inner);
  // flames
  const r = seeded(5);
  for (let i = 0; i < 9; i++) {
    const x = c + (i - 4) * S * 0.08, h = S * (0.2 + r() * 0.16);
    const f = new Path2D(); f.moveTo(x - S * 0.06, c + S * 0.36); f.quadraticCurveTo(x - S * 0.05, c + S * 0.2 - h * 0.4, x, c + S * 0.36 - h - S * 0.1);
    f.quadraticCurveTo(x + S * 0.05, c + S * 0.2 - h * 0.4, x + S * 0.06, c + S * 0.36); f.closePath();
    ctx.fillStyle = lin(ctx, 0, c + S * 0.36 - h, 0, c + S * 0.36, [[0, 'rgba(255,240,160,0.9)'], [1, 'rgba(255,90,20,0.2)']]);
    ctx.fill(f);
  }
  ctx.restore();
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(inner); ctx.restore();
  // anvil
  const anvil = new Path2D();
  anvil.moveTo(c - S * 0.3, c - S * 0.08); anvil.lineTo(c + S * 0.22, c - S * 0.08); anvil.quadraticCurveTo(c + S * 0.34, c - S * 0.06, c + S * 0.36, c - S * 0.12);
  anvil.quadraticCurveTo(c + S * 0.34, c + S * 0.02, c + S * 0.14, c + S * 0.04); anvil.lineTo(c + S * 0.08, c + S * 0.06); anvil.lineTo(c + S * 0.1, c + S * 0.2);
  anvil.lineTo(c + S * 0.2, c + S * 0.24); anvil.lineTo(c - S * 0.2, c + S * 0.24); anvil.lineTo(c - S * 0.12, c + S * 0.2);
  anvil.lineTo(c - S * 0.1, c + S * 0.06); anvil.lineTo(c - S * 0.3, c + S * 0.02); anvil.closePath();
  shade(ctx, anvil, lin(ctx, 0, c - S * 0.1, 0, c + S * 0.24, [[0, '#8f8a9c'], [0.2, '#56535F'], [1, '#141218']]), [c - S * 0.3, c - S * 0.12, S * 0.66, S * 0.36], { lw: 5, hi: 0.3, rim: 'rgba(255,160,60,0.9)' });
  // glowing ingot
  ctx.save(); ctx.shadowColor = '#ffb03a'; ctx.shadowBlur = 20;
  ctx.fillStyle = lin(ctx, 0, c - S * 0.16, 0, c - S * 0.08, [[0, '#fff6cf'], [1, '#ff8a2a']]);
  ctx.beginPath(); rr(ctx, c - S * 0.12, c - S * 0.16, S * 0.2, S * 0.08, 4); ctx.fill(); ctx.restore();
}

// ---------------------------------------------------------------- chest (body + lid separately)
function paintChestBody(ctx: Ctx, w: number, h: number) {
  const b = rrPath(10, 10, w - 20, h - 20, 16);
  shade(ctx, b, lin(ctx, 0, 0, 0, h, [[0, '#7a2a14'], [0.6, '#4a140a'], [1, '#1a0604']]), [10, 10, w - 20, h - 20], { lw: 6 });
  ctx.save(); ctx.clip(b);
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 3;
  for (let y = 40; y < h; y += 34) { ctx.beginPath(); ctx.moveTo(10, y); ctx.lineTo(w, y); ctx.stroke(); }
  ctx.restore();
  for (const x of [34, w - 70]) {
    shade(ctx, rrPath(x, 6, 36, h - 12, 6), chrome(ctx, MAT.gold, x, 0, x + 36, 0), [x, 6, 36, h - 12], { lw: 4 });
    for (const y of [30, h - 30]) shade(ctx, circlePath(x + 18, y, 6), MAT.gold[1], [x + 12, y - 6, 12, 12], { lw: 2, drop: false });
  }
  // lock plate
  shade(ctx, rrPath(w / 2 - 36, 4, 72, 80, 10), chrome(ctx, MAT.gold, w / 2 - 36, 0, w / 2 + 36, 0), [w / 2 - 36, 4, 72, 80], { lw: 5 });
  ctx.fillStyle = OUT; ctx.beginPath(); ctx.arc(w / 2, 36, 10, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(w / 2 - 5, 38, 10, 28);
  shade(ctx, circlePath(w / 2, 70, 7), '#ff4d6d', [w / 2 - 7, 63, 14, 14], { lw: 2, drop: false });
}
function paintChestLid(ctx: Ctx, w: number, h: number) {
  const lid = new Path2D();
  lid.moveTo(10, h - 8); lid.lineTo(10, h * 0.5); lid.quadraticCurveTo(w / 2, -h * 0.35, w - 10, h * 0.5); lid.lineTo(w - 10, h - 8); lid.closePath();
  shade(ctx, lid, lin(ctx, 0, 0, 0, h, [[0, '#b04a22'], [0.7, '#6a1e0c'], [1, '#3a0e06']]), [10, 0, w - 20, h - 8], { lw: 6, hi: 0.3 });
  for (const x of [34, w - 70]) {
    ctx.save(); ctx.clip(lid);
    ctx.fillStyle = chrome(ctx, MAT.gold, x, 0, x + 36, 0); ctx.fillRect(x, 0, 36, h);
    ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.strokeRect(x, -4, 36, h + 8);
    ctx.restore();
  }
  ctx.save(); ctx.lineWidth = 6; ctx.strokeStyle = OUT; ctx.stroke(lid); ctx.restore();
  ctx.save(); ctx.fillStyle = chrome(ctx, MAT.gold, 0, h - 20, 0, h); ctx.fillRect(10, h - 18, w - 20, 12);
  ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.strokeRect(10, h - 18, w - 20, 12); ctx.restore();
}

// ---------------------------------------------------------------- album card frame + back
function paintCardBack(ctx: Ctx, w: number, h: number) {
  const p = rrPath(4, 4, w - 8, h - 8, 16);
  shade(ctx, p, lin(ctx, 0, 0, w, h, [[0, '#2a1e44'], [0.5, '#1a1230'], [1, '#0c0818']]), [4, 4, w - 8, h - 8], { lw: 4 });
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = 'rgba(244,196,90,0.25)'; ctx.lineWidth = 2;
  for (let i = -h; i < w + h; i += 18) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + h, h); ctx.moveTo(i + h, 0); ctx.lineTo(i, h); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.lineWidth = 4; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, 0, h); ctx.beginPath(); rr(ctx, 14, 14, w - 28, h - 28, 10); ctx.stroke(); ctx.restore();
  shade(ctx, circlePath(w / 2, h / 2, w * 0.2), rad(ctx, w / 2 - 6, h / 2 - 6, 2, w * 0.22, [[0, '#4a3a6a'], [1, '#140a2a']]), [w * 0.3, h / 2 - w * 0.2, w * 0.4, w * 0.4], { lw: 4 });
  ctx.save(); ctx.fillStyle = 'rgba(244,196,90,0.9)'; ctx.font = `700 ${Math.floor(w * 0.24)}px Cinzel, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('?', w / 2, h / 2 + 3); ctx.restore();
}
function paintCardFront(ctx: Ctx, w: number, h: number, tier: number, hue: number, pageColor: string) {
  const p = rrPath(4, 4, w - 8, h - 8, 16);
  shade(ctx, p, lin(ctx, 0, 0, 0, h, [[0, `hsl(${hue},45%,28%)`], [0.6, `hsl(${hue},55%,14%)`], [1, '#07060B']]), [4, 4, w - 8, h - 8], { lw: 4 });
  ctx.save(); ctx.clip(p);
  // rays
  ctx.globalAlpha = 0.25;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.fillStyle = i % 2 ? pageColor : 'rgba(255,255,255,0.2)';
    ctx.beginPath(); ctx.moveTo(w / 2, h * 0.42); ctx.arc(w / 2, h * 0.42, h, a, a + Math.PI / 16); ctx.closePath(); ctx.fill();
  }
  ctx.globalAlpha = 1;
  glow(ctx, w / 2, h * 0.42, w * 0.5, `hsla(${hue},80%,60%,0.5)`);
  ctx.restore();
  const [rc, rctx] = makeCanvas(256, 256); paintRelic(rctx, tier, true);
  ctx.drawImage(rc, w * 0.1, h * 0.1, w * 0.8, w * 0.8);
  ctx.save(); ctx.lineWidth = 5; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, 0, h); ctx.beginPath(); rr(ctx, 12, 12, w - 24, h - 24, 10); ctx.stroke(); ctx.restore();
  // name plate
  shade(ctx, rrPath(14, h * 0.74, w - 28, h * 0.18, 8), lin(ctx, 0, h * 0.74, 0, h * 0.92, [[0, '#2a1a10'], [1, '#0c0604']]), [14, h * 0.74, w - 28, h * 0.18], { lw: 3, drop: false });
}

// ---------------------------------------------------------------- keeper portrait
function paintKeeper(ctx: Ctx, S: number) {
  const c = S / 2;
  shade(ctx, circlePath(c, c, S * 0.47), chrome(ctx, MAT.gold, 0, 0, 0, S), [c - S * 0.47, c - S * 0.47, S * 0.94, S * 0.94], { lw: 4 });
  const bg = circlePath(c, c, S * 0.41);
  ctx.save(); ctx.fillStyle = rad(ctx, c, c * 0.8, 4, S * 0.5, [[0, '#3a2a4a'], [1, '#0c0810']]); ctx.fill(bg); ctx.clip(bg);
  // hood
  const hood = new Path2D();
  hood.moveTo(c - S * 0.36, S); hood.quadraticCurveTo(c - S * 0.34, S * 0.2, c, S * 0.14); hood.quadraticCurveTo(c + S * 0.34, S * 0.2, c + S * 0.36, S); hood.closePath();
  shade(ctx, hood, lin(ctx, c - S * 0.36, 0, c + S * 0.36, 0, [[0, '#1a0a14'], [0.4, '#4a1a2a'], [1, '#0c0408']]), [c - S * 0.36, S * 0.14, S * 0.72, S * 0.86], { lw: 3, hi: 0.2 });
  const face = new Path2D(); face.ellipse(c, S * 0.52, S * 0.17, S * 0.22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#040206'; ctx.fill(face);
  for (const s of [-1, 1]) {
    glow(ctx, c + s * S * 0.07, S * 0.48, S * 0.08, 'rgba(244,196,90,0.9)');
    ctx.fillStyle = '#FFE9A3'; ctx.beginPath(); ctx.ellipse(c + s * S * 0.07, S * 0.48, S * 0.025, S * 0.014, 0, 0, Math.PI * 2); ctx.fill();
  }
  // gold chain collar
  ctx.strokeStyle = MAT.gold[2]; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(c, S * 0.62, S * 0.26, 0.3, Math.PI - 0.3); ctx.stroke();
  ctx.restore();
}

// ---------------------------------------------------------------- wheel
export const WHEEL_SIZE = 640;
function paintWheel(ctx: Ctx, S: number, n: number) {
  const c = S / 2, R = S * 0.44;
  glow(ctx, c, c, S * 0.5, 'rgba(244,196,90,0.3)');
  const cols = [['#e0304a', '#7a0a1e'], ['#2a1e44', '#0c0818'], ['#3aa0c8', '#0b3a5a'], ['#2a1e44', '#0c0818'], ['#e9a92e', '#7a4a0c'], ['#2a1e44', '#0c0818'], ['#8a4ae0', '#2a0a5a'], ['#2a1e44', '#0c0818']];
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2 - Math.PI / 2 - Math.PI / n, a1 = a0 + (Math.PI * 2) / n;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, R, a0, a1); ctx.closePath();
    ctx.fillStyle = rad(ctx, c, c, 10, R, [[0, cols[i % 8][0]], [1, cols[i % 8][1]]]);
    ctx.fill();
    ctx.lineWidth = 4; ctx.strokeStyle = MAT.gold[2]; ctx.stroke();
  }
  // rim with bulbs (bulbs are live sprites for chase lights)
  ctx.save(); ctx.lineWidth = S * 0.06; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, 0, S);
  ctx.beginPath(); ctx.arc(c, c, R + S * 0.03, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 3; ctx.strokeStyle = OUT;
  ctx.beginPath(); ctx.arc(c, c, R + S * 0.06, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(c, c, R, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  shade(ctx, circlePath(c, c, S * 0.1), chrome(ctx, MAT.gold, 0, c - S * 0.1, 0, c + S * 0.1), [c - S * 0.1, c - S * 0.1, S * 0.2, S * 0.2], { lw: 4 });
  shade(ctx, circlePath(c, c, S * 0.05), '#ff4d6d', [c - S * 0.05, c - S * 0.05, S * 0.1, S * 0.1], { lw: 2, drop: false });
}
function paintPointer(ctx: Ctx, w: number, h: number) {
  const p = poly([[4, 4], [w - 4, 4], [w / 2, h - 4]]);
  shade(ctx, p, chrome(ctx, MAT.gold, 0, 0, w, 0), [4, 4, w - 8, h - 8], { lw: 4 });
  shade(ctx, circlePath(w / 2, h * 0.3, w * 0.15), '#ff4d6d', [w * 0.35, h * 0.15, w * 0.3, w * 0.3], { lw: 2, drop: false });
}

// ---------------------------------------------------------------- particles
function paintParticles(scene: Phaser.Scene) {
  const add = (key: string, w: number, h: number, fn: (ctx: Ctx) => void) => lazyTexture(key, () => {
    const [c, ctx] = makeCanvas(w, h); fn(ctx); scene.textures.addCanvas(key, c);
  });
  add('p_dot', 32, 32, (ctx) => glow(ctx, 16, 16, 16, 'rgba(255,255,255,1)'));
  add('p_spark', 64, 64, (ctx) => { ctx.fillStyle = '#fff'; ctx.fill(star(32, 32, 4, 3, 30, 0)); glow(ctx, 32, 32, 14, 'rgba(255,255,255,0.8)'); });
  add('p_ring', 256, 256, (ctx) => {
    ctx.lineWidth = 14; ctx.strokeStyle = 'rgba(255,255,255,1)'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 16;
    ctx.beginPath(); ctx.arc(128, 128, 104, 0, Math.PI * 2); ctx.stroke();
  });
  add('p_flare', 256, 256, (ctx) => {
    glow(ctx, 128, 128, 128, 'rgba(255,250,230,1)');
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = lin(ctx, 0, 128, 256, 128, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(0, 124, 256, 8);
    ctx.fillStyle = lin(ctx, 128, 0, 128, 256, [[0, 'rgba(255,255,255,0)'], [0.5, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']]);
    ctx.fillRect(124, 0, 8, 256);
  });
  add('p_shard', 40, 40, (ctx) => {
    const p = poly([[4, 20], [18, 2], [36, 14], [26, 36], [10, 32]]);
    ctx.fillStyle = lin(ctx, 0, 0, 40, 40, [[0, '#ffffff'], [1, '#9a9a9a']]); ctx.fill(p);
    ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.stroke(p);
  });
  add('p_ember', 24, 24, (ctx) => { glow(ctx, 12, 12, 12, 'rgba(255,160,60,1)'); ctx.fillStyle = '#fff2c0'; ctx.beginPath(); ctx.arc(12, 12, 2.5, 0, Math.PI * 2); ctx.fill(); });
  add('p_mote', 16, 16, (ctx) => { glow(ctx, 8, 8, 8, 'rgba(255,233,163,1)'); });
  add('p_confetti', 20, 12, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 20, 12); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, 8, 20, 4); });
  add('p_ash', 16, 16, (ctx) => { ctx.fillStyle = '#3a3440'; ctx.beginPath(); ctx.ellipse(8, 8, 6, 3, 0.5, 0, Math.PI * 2); ctx.fill(); });
  add('shaft', 256, 512, (ctx) => {
    const g = lin(ctx, 0, 512, 0, 0, [[0, 'rgba(255,240,200,0.95)'], [1, 'rgba(255,240,200,0)']]);
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(90, 512); ctx.lineTo(166, 512); ctx.lineTo(256, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
  });
  add('shadow', 128, 48, (ctx) => { ctx.fillStyle = rad(ctx, 64, 24, 0, 64, [[0, 'rgba(0,0,0,0.75)'], [1, 'rgba(0,0,0,0)']]); ctx.scale(1, 0.375); ctx.beginPath(); ctx.arc(64, 64, 64, 0, Math.PI * 2); ctx.fill(); });
  add('select', 180, 180, (ctx) => {
    ctx.lineWidth = 8; ctx.strokeStyle = '#FFE9A3'; ctx.shadowColor = '#F4C45A'; ctx.shadowBlur = 18;
    ctx.beginPath(); rr(ctx, 14, 14, 152, 152, 26); ctx.stroke();
  });
  add('bulb', 40, 40, (ctx) => { glow(ctx, 20, 20, 20, 'rgba(255,240,180,1)'); ctx.fillStyle = '#fffbe8'; ctx.beginPath(); ctx.arc(20, 20, 7, 0, Math.PI * 2); ctx.fill(); });
  add('flame', 40, 70, (ctx) => {
    glow(ctx, 20, 44, 20, 'rgba(255,160,60,0.8)');
    const f = new Path2D(); f.moveTo(20, 4); f.quadraticCurveTo(34, 38, 20, 62); f.quadraticCurveTo(6, 38, 20, 4); f.closePath();
    ctx.fillStyle = lin(ctx, 0, 4, 0, 62, [[0, '#fff8d0'], [0.5, '#ffc04a'], [1, '#ff6a1a']]); ctx.fill(f);
  });
  add('eyeGlow', 64, 40, (ctx) => { ctx.fillStyle = rad(ctx, 32, 20, 0, 30, [[0, 'rgba(255,255,255,1)'], [0.25, 'rgba(255,80,60,0.95)'], [1, 'rgba(255,40,40,0)']]); ctx.scale(1, 0.62); ctx.beginPath(); ctx.arc(32, 32, 32, 0, Math.PI * 2); ctx.fill(); });
  add('dim', 8, 8, (ctx) => { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 8, 8); });
  add('white', 8, 8, (ctx) => { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, 8, 8); });
  add('vignetteRed', 512, 512, (ctx) => { ctx.fillStyle = rad(ctx, 256, 256, 120, 256, [[0, 'rgba(255,40,40,0)'], [1, 'rgba(255,40,30,0.9)']]); ctx.fillRect(0, 0, 512, 512); });
  add('road', 64, 24, (ctx) => { ctx.fillStyle = lin(ctx, 0, 0, 0, 24, [[0, '#07050a'], [0.5, '#2a2033'], [1, '#07050a']]); ctx.fillRect(0, 0, 64, 24); });
  add('roadFill', 64, 24, (ctx) => { ctx.fillStyle = chrome(ctx, MAT.gold, 0, 0, 0, 24); ctx.fillRect(0, 0, 64, 24); });
}

/**
 * The UI's art. AB#4737: registered here and painted on its first lookup (art/lazy.ts): the first screen paints what it
 * shows, and the shop's ribbons and seals, the wheel, the piggy bank and the rest wait until a screen asks for them.
 */
export function bakeUi(scene: Phaser.Scene) {
  installLazyTextures(scene.textures as unknown as TextureLookup);
  const add = (key: string, w: number, h: number, fn: (ctx: Ctx) => void) => lazyTexture(key, () => {
    const [c, ctx] = makeCanvas(w, h); fn(ctx); scene.textures.addCanvas(key, c);
  });
  add('panel', PANEL.size, PANEL.size, (ctx) => paintPanel(ctx, ['#4a1838', '#2a0f22', '#12060e']));
  add('panelBlue', PANEL.size, PANEL.size, (ctx) => paintPanel(ctx, ['#1a3a5a', '#0e1f36', '#060c18']));
  add('panelDark', PANEL.size, PANEL.size, (ctx) => paintPanel(ctx, ['#2e2638', '#1b1424', '#0b080f']));
  for (const k of Object.keys(BTN_COLORS)) add(`btn_${k}`, BTN.w, BTN.h, (ctx) => paintButton(ctx, BTN_COLORS[k]));
  add('pill', PILL.w, PILL.h, paintPill);
  add('ribbon', 760, 150, (ctx) => paintRibbon(ctx, 760, 150, ['#ff5d6c', '#b0142e', '#4a0410']));
  add('ribbonBlue', 760, 150, (ctx) => paintRibbon(ctx, 760, 150, ['#7ee0ff', '#1a6aa0', '#06203a']));
  add('ribbonPurple', 760, 150, (ctx) => paintRibbon(ctx, 760, 150, ['#c79bff', '#6a2ac0', '#1a0640']));
  add('seal_red', 160, 160, (ctx) => paintSeal(ctx, 160, ['#ff7a88', '#c01a36', '#4a0010']));
  add('seal_blue', 160, 160, (ctx) => paintSeal(ctx, 160, ['#9ae8ff', '#2a7ab0', '#08284a']));
  add('seal_gold', 160, 160, (ctx) => paintSeal(ctx, 160, ['#fff2b0', '#e0a02a', '#6a3a04']));
  add('seal_green', 160, 160, (ctx) => paintSeal(ctx, 160, ['#b0ffb8', '#2fa84a', '#0a3a14']));
  add('coin', 96, 96, (ctx) => paintCoin(ctx, 96));
  add('gem', 96, 96, (ctx) => paintGem(ctx, 96));
  add('pig', 200, 200, (ctx) => paintPig(ctx, 200));
  add('medallion', 180, 180, (ctx) => paintMedallion(ctx, 180));
  add('crown', 80, 80, (ctx) => paintCrown(ctx, 80));
  const icons: Record<string, (ctx: Ctx, S: number) => void> = {
    ic_vault: iconVault, ic_album: iconAlbum, ic_pass: iconPass, ic_events: iconEvents, ic_shop: iconShop, ic_lock: iconLock,
    ic_gear: iconGear, ic_close: iconClose, ic_scroll: iconScroll, ic_wheel: iconWheel, ic_satchel: iconSatchel, ic_ad: iconAd,
    ic_sell: iconSell, ic_hand: iconHand, ic_chest: iconChestSmall, ic_card: iconCard, ic_boost: iconBoost, ic_luck: iconLuck,
  };
  for (const k of Object.keys(icons)) add(k, 128, 128, (ctx) => icons[k](ctx, 128));
  add('forge', 300, 300, (ctx) => paintForge(ctx, 300));
  add('gen1', 300, 300, (ctx) => paintCryptBrazier(ctx, 300));
  add('gen2', 300, 300, (ctx) => paintStarWell(ctx, 300));
  for (const p of PATRONS) add(`patron${p.id}`, 160, 160, (ctx) => paintPatron(ctx, 160, p.hue));
  add('ic_link', 96, 96, (ctx) => {
    for (const [x, y, r] of [[34, 48, -0.6], [62, 48, -0.6]] as const) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(r);
      ctx.lineWidth = 12; ctx.strokeStyle = '#120904'; ctx.beginPath(); ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 6; ctx.strokeStyle = chrome(ctx, MAT.gold, -20, -10, 20, 10); ctx.stroke();
      ctx.restore();
    }
  });
  add('chestBody', 300, 190, (ctx) => paintChestBody(ctx, 300, 190));
  add('chestLid', 300, 140, (ctx) => paintChestLid(ctx, 300, 140));
  add('cardBack', 200, 280, (ctx) => paintCardBack(ctx, 200, 280));
  add('keeper', 200, 200, (ctx) => paintKeeper(ctx, 200));
  add('wheel', WHEEL_SIZE, WHEEL_SIZE, (ctx) => paintWheel(ctx, WHEEL_SIZE, 8));
  add('pointer', 70, 90, (ctx) => paintPointer(ctx, 70, 90));
  paintParticles(scene);
}

/** The album's cards, painted when the album (or anything else) first asks for them (AB#4737). */
export function bakeCards(scene: Phaser.Scene, cards: { id: number; tier: number; hue: number; page: number }[], pageColors: number[]) {
  installLazyTextures(scene.textures as unknown as TextureLookup);
  lazyTexture('cards', () => {
    const W = 200, H = 280;
    const cols = 12;
    const [c, ctx] = makeCanvas(W * cols, H * Math.ceil(cards.length / cols));
    for (const card of cards) {
      const [cc, cctx] = makeCanvas(W, H);
      paintCardFront(cctx, W, H, card.tier, card.hue, '#' + pageColors[card.page].toString(16).padStart(6, '0'));
      ctx.drawImage(cc, (card.id % cols) * W, Math.floor(card.id / cols) * H);
    }
    const tex = scene.textures.addCanvas('cards', c)!;
    for (const card of cards) tex.add(`c${card.id}`, 0, (card.id % cols) * W, Math.floor(card.id / cols) * H, W, H);
  });
}
