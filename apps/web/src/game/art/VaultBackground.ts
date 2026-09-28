import type Phaser from 'phaser';
import { Ctx, makeCanvas, lin, rad, rr, rrPath, glow, speckle, seeded, MAT, chrome, metal, shade, star, poly } from './paint';

/**
 * Painted vault: far architecture, mid chains, near fog, the sarcophagus,
 * the stone dais with 36 carved sockets, candles, coin drifts and album decorations.
 */

export const W = 1080;
export const H = 1920;
export const CELL = 150;
export const BOARD_X = 90; // left of cell grid in design space
export const BOARD_Y = 600; // top of cell grid

function stoneWall(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number, tint = [34, 26, 42]) {
  const r = seeded(seed);
  const bh = 64;
  for (let row = 0; row * bh < h; row++) {
    const off = row % 2 ? 0 : 60;
    for (let bx = -off; bx < w; bx += 120 + Math.floor(r() * 40)) {
      const bw = 110 + r() * 50;
      const k = 0.7 + r() * 0.5;
      const [cr, cg, cb] = tint.map((v) => Math.floor(v * k));
      ctx.fillStyle = lin(ctx, 0, y + row * bh, 0, y + row * bh + bh, [
        [0, `rgb(${cr + 10},${cg + 8},${cb + 12})`], [1, `rgb(${cr - 6},${cg - 6},${cb - 4})`],
      ]);
      ctx.beginPath();
      rr(ctx, x + bx + 3, y + row * bh + 3, bw - 6, bh - 6, 6);
      ctx.fill();
      // bevel
      ctx.strokeStyle = 'rgba(255,220,170,0.05)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x + bx + 6, y + row * bh + 5); ctx.lineTo(x + bx + bw - 6, y + row * bh + 5); ctx.stroke();
      ctx.strokeStyle = 'rgba(0,0,0,0.45)';
      ctx.beginPath(); ctx.moveTo(x + bx + 6, y + row * bh + bh - 4); ctx.lineTo(x + bx + bw - 6, y + row * bh + bh - 4); ctx.stroke();
    }
  }
  speckle(ctx, x, y, w, h, Math.floor((w * h) / 900), seed + 1, ['#000000', '#2a2233', '#3b2f45', '#51443a']);
}

function runeGlyph(ctx: Ctx, x: number, y: number, s: number, seed: number, color: string) {
  const r = seeded(seed);
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 14;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, -s); ctx.lineTo(0, s);
  for (let i = 0; i < 3; i++) {
    const yy = -s + r() * s * 2;
    ctx.moveTo(0, yy);
    ctx.lineTo((r() > 0.5 ? 1 : -1) * s * (0.4 + r() * 0.5), yy + (r() - 0.5) * s);
  }
  ctx.stroke();
  ctx.restore();
}

function coinPile(ctx: Ctx, cx: number, cy: number, w: number, h: number, seed: number) {
  const r = seeded(seed);
  // mound
  ctx.save();
  ctx.fillStyle = rad(ctx, cx, cy + h * 0.3, 10, w * 0.6, [[0, '#8a5a12'], [1, 'rgba(40,20,4,0)']]);
  ctx.beginPath(); ctx.ellipse(cx, cy + h * 0.3, w * 0.6, h * 0.55, 0, Math.PI, 0); ctx.fill();
  ctx.restore();
  const n = Math.floor(w * h / 90);
  for (let i = 0; i < n; i++) {
    const t = r();
    const px = cx + (r() - 0.5) * w * (1 - t * 0.6);
    const py = cy + h * 0.35 - t * h * 0.8 + r() * 10;
    const s = 9 + r() * 7;
    const tilt = 0.35 + r() * 0.4;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = MAT.gold[4];
    ctx.beginPath(); ctx.ellipse(0, 2.5, s, s * tilt, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = lin(ctx, -s, -s, s, s, [[0, MAT.gold[0]], [0.4, MAT.gold[2]], [1, MAT.gold[3]]]);
    ctx.beginPath(); ctx.ellipse(0, 0, s, s * tilt, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(90,50,5,0.7)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(0, 0, s * 0.62, s * tilt * 0.62, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  // a few gems and a goblet glint
  for (let i = 0; i < 5; i++) {
    const px = cx + (r() - 0.5) * w * 0.7, py = cy - r() * h * 0.3;
    const col = ['#ff4d6d', '#7ee0ff', '#3fe39a'][i % 3];
    ctx.save();
    ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 12;
    ctx.fill(star(px, py, 4, 3, 8, 0));
    ctx.restore();
  }
}

function candle(ctx: Ctx, x: number, y: number, h: number) {
  ctx.save();
  // wax drips
  ctx.fillStyle = lin(ctx, x - 12, 0, x + 12, 0, [[0, '#b8a888'], [0.4, '#f7eed8'], [1, '#8a7a5a']]);
  ctx.beginPath(); rr(ctx, x - 12, y - h, 24, h, 5); ctx.fill();
  ctx.fillStyle = '#f7eed8';
  ctx.beginPath(); ctx.ellipse(x, y - h, 12, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillRect(x + 4, y - h, 5, 18);
  ctx.beginPath(); ctx.arc(x + 6.5, y - h + 18, 2.5, 0, Math.PI * 2); ctx.fill();
  // holder
  ctx.fillStyle = metal(ctx, MAT.bronze, x - 22, y, x + 22, y + 12);
  ctx.beginPath(); ctx.ellipse(x, y + 4, 24, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function chainLink(ctx: Ctx, x: number, y: number, ang: number, s: number, flat: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.lineWidth = flat ? 4 * s : 6 * s;
  ctx.strokeStyle = '#0c0a10';
  ctx.beginPath();
  if (flat) { ctx.moveTo(-10 * s, 0); ctx.lineTo(10 * s, 0); }
  else ctx.ellipse(0, 0, 12 * s, 7 * s, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = flat ? 2.5 * s : 3.5 * s;
  ctx.strokeStyle = lin(ctx, -12 * s, -7 * s, 12 * s, 7 * s, [[0, '#8f8a9c'], [0.5, '#3d3946'], [1, '#6a5f4a']]);
  ctx.stroke();
  ctx.restore();
}

function chain(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, sag: number, s = 1) {
  const n = Math.floor(Math.hypot(x1 - x0, y1 - y0) / (17 * s));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const x = x0 + (x1 - x0) * t;
    const y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag;
    const dx = (x1 - x0) / n, dy = (y1 - y0) / n + Math.cos(t * Math.PI) * sag * Math.PI / n;
    chainLink(ctx, x, y, Math.atan2(dy, dx), s, i % 2 === 1);
  }
}

// ------------------------------------------------------------------ far layer
/** The vault's back wall, 1080x1920. Exported for the store's feature graphic (tools/icons.html, AB#4729). */
export function paintFar(ctx: Ctx) {
  ctx.fillStyle = lin(ctx, 0, 0, 0, H, [[0, '#07060B'], [0.3, '#140E18'], [0.62, '#1B1424'], [1, '#07060B']]);
  ctx.fillRect(0, 0, W, H);
  stoneWall(ctx, 0, 0, W, H, 11);

  // great arch recess
  const arch = new Path2D();
  arch.moveTo(120, H); arch.lineTo(120, 560); arch.arc(540, 560, 420, Math.PI, 0); arch.lineTo(960, H); arch.closePath();
  ctx.save();
  ctx.fillStyle = lin(ctx, 0, 140, 0, H, [[0, 'rgba(6,4,10,0.9)'], [0.5, 'rgba(12,8,16,0.75)'], [1, 'rgba(6,4,10,0.9)']]);
  ctx.fill(arch);
  ctx.clip(arch);
  stoneWall(ctx, 120, 140, 840, H, 23, [22, 16, 28]);
  ctx.restore();

  // vault door (behind sarcophagus)
  const dx = 540, dy = 440;
  glow(ctx, dx, dy, 460, 'rgba(244,196,90,0.18)');
  ctx.save();
  ctx.fillStyle = chrome(ctx, MAT.bronze, dx - 360, 0, dx + 360, 0);
  ctx.beginPath(); ctx.arc(dx, dy, 360, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = rad(ctx, dx - 60, dy - 80, 20, 330, [[0, '#4a4452'], [0.6, '#2a2530'], [1, '#110e15']]);
  ctx.beginPath(); ctx.arc(dx, dy, 318, 0, Math.PI * 2); ctx.fill();
  // concentric rings & rune band
  ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  for (const r of [300, 250, 140]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(244,196,90,0.35)';
  for (const r of [297, 247, 137]) { ctx.beginPath(); ctx.arc(dx, dy, r, 0, Math.PI * 2); ctx.stroke(); }
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    runeGlyph(ctx, dx + Math.cos(a) * 275, dy + Math.sin(a) * 275, 12, 100 + i, 'rgba(126,224,255,0.55)');
  }
  // bolts
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const bx = dx + Math.cos(a) * 340, by = dy + Math.sin(a) * 340;
    ctx.fillStyle = rad(ctx, bx - 3, by - 3, 1, 12, [[0, MAT.gold[0]], [0.5, MAT.gold[2]], [1, MAT.gold[4]]]);
    ctx.beginPath(); ctx.arc(bx, by, 10, 0, Math.PI * 2); ctx.fill();
  }
  // spokes / handle wheel
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.3;
    ctx.lineWidth = 22; ctx.strokeStyle = '#0c0a10';
    ctx.beginPath(); ctx.moveTo(dx, dy); ctx.lineTo(dx + Math.cos(a) * 230, dy + Math.sin(a) * 230); ctx.stroke();
    ctx.lineWidth = 14; ctx.strokeStyle = chrome(ctx, MAT.bronze, dx - 230, dy - 230, dx + 230, dy + 230);
    ctx.stroke();
  }
  ctx.restore();

  // pillars
  for (const px of [0, 960]) {
    ctx.save();
    ctx.fillStyle = lin(ctx, px, 0, px + 120, 0, [[0, '#0b090f'], [0.3, '#2c2336'], [0.6, '#1c1622'], [1, '#07060B']]);
    ctx.fillRect(px, 0, 120, H);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    for (let i = 0; i < 4; i++) ctx.fillRect(px + 18 + i * 24, 0, 6, H);
    // gold bands
    for (const by of [300, 980, 1560]) {
      ctx.fillStyle = chrome(ctx, MAT.gold, px, by, px, by + 34);
      ctx.fillRect(px, by, 120, 34);
      ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(px, by + 34, 120, 6);
    }
    ctx.restore();
  }

  // runes on walls
  for (let i = 0; i < 10; i++) {
    const r = seeded(500 + i);
    runeGlyph(ctx, 160 + r() * 760, 900 + r() * 700, 14 + r() * 10, 300 + i, 'rgba(126,224,255,0.22)');
  }

  // floor + coin drifts at the bottom
  ctx.fillStyle = lin(ctx, 0, 1560, 0, H, [[0, 'rgba(7,6,11,0)'], [0.3, 'rgba(20,14,24,0.9)'], [1, '#07060B']]);
  ctx.fillRect(0, 1560, W, H - 1560);
  coinPile(ctx, 120, 1700, 300, 180, 7);
  coinPile(ctx, 960, 1720, 320, 200, 8);
  coinPile(ctx, 540, 1880, 900, 120, 9);

  // vignette
  ctx.fillStyle = rad(ctx, W / 2, H * 0.45, H * 0.25, H * 0.75, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.75)']]);
  ctx.fillRect(0, 0, W, H);
}

// ------------------------------------------------------------------ mid layer (chains)
function paintChains(ctx: Ctx) {
  chain(ctx, -20, 60, 360, 90, 180, 1.2);
  chain(ctx, 720, 90, 1100, 50, 170, 1.2);
  chain(ctx, 40, 160, 260, 170, 120, 0.9);
  chain(ctx, 820, 170, 1060, 150, 110, 0.9);
  // hanging chains with weights
  for (const [x, len] of [[70, 520], [1010, 600]]) {
    for (let y = 0; y < len; y += 17) chainLink(ctx, x, y, Math.PI / 2, 1.1, (y / 17) % 2 === 1);
    const hook = new Path2D();
    hook.arc(x, len + 26, 22, 0, Math.PI * 2);
    shade(ctx, hook, rad(ctx, x - 6, len + 18, 2, 26, [[0, '#8f8a9c'], [1, '#1a1720']]), [x - 22, len + 4, 44, 44], { lw: 4 });
  }
}

// ------------------------------------------------------------------ fog tile
function paintFog(ctx: Ctx, w: number, h: number) {
  const r = seeded(77);
  for (let i = 0; i < 70; i++) {
    const x = r() * w, y = h * 0.2 + r() * h * 0.7, rr0 = 40 + r() * 120;
    for (const ox of [-w, 0, w]) glow(ctx, x + ox, y, rr0, 'rgba(120,100,150,0.16)');
  }
}

// ------------------------------------------------------------------ sarcophagus
function paintSarcophagus(ctx: Ctx) {
  const w = 420, h = 330, cx = w / 2;
  const body = new Path2D();
  body.moveTo(cx - 120, h); body.lineTo(cx - 150, 150); body.quadraticCurveTo(cx - 150, 20, cx, 14);
  body.quadraticCurveTo(cx + 150, 20, cx + 150, 150); body.lineTo(cx + 120, h); body.closePath();
  shade(ctx, body, lin(ctx, cx - 150, 0, cx + 150, 0, [[0, '#15111a'], [0.35, '#3a3044'], [0.6, '#241d2c'], [1, '#0b090e']]), [cx - 150, 14, 300, h], { lw: 6, hi: 0.18 });
  ctx.save(); ctx.clip(body);
  speckle(ctx, 0, 0, w, h, 900, 91, ['#000', '#4a3f55', '#2a2333']);
  // gold headdress stripes
  for (let i = -4; i <= 4; i++) {
    ctx.fillStyle = i % 2 ? 'rgba(244,196,90,0.9)' : 'rgba(30,60,120,0.9)';
    ctx.beginPath();
    ctx.moveTo(cx + i * 30 - 12, 60); ctx.lineTo(cx + i * 30 + 12, 60); ctx.lineTo(cx + i * 38 + 14, 200); ctx.lineTo(cx + i * 38 - 14, 200); ctx.fill();
  }
  ctx.restore();
  // face plate
  const face = new Path2D();
  face.moveTo(cx, 52); face.bezierCurveTo(cx + 76, 54, cx + 80, 150, cx + 58, 196); face.quadraticCurveTo(cx, 250, cx - 58, 196);
  face.bezierCurveTo(cx - 80, 150, cx - 76, 54, cx, 52); face.closePath();
  shade(ctx, face, chrome(ctx, MAT.gold, cx - 80, 0, cx + 80, 0), [cx - 80, 52, 160, 200], { lw: 5, hi: 0.4 });
  // eye sockets (glow is a live sprite)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.fillStyle = '#07030a';
    ctx.beginPath(); ctx.ellipse(cx + s * 30, 128, 22, 11, s * -0.15, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  ctx.save(); ctx.strokeStyle = 'rgba(80,45,5,0.8)'; ctx.lineWidth = 3; ctx.beginPath();
  ctx.moveTo(cx, 138); ctx.lineTo(cx - 8, 178); ctx.lineTo(cx + 8, 178);
  ctx.moveTo(cx - 20, 206); ctx.quadraticCurveTo(cx, 214, cx + 20, 206); ctx.stroke(); ctx.restore();
  // beard
  const beard = poly([[cx - 14, 222], [cx + 14, 222], [cx + 10, 276], [cx, 290], [cx - 10, 276]]);
  shade(ctx, beard, chrome(ctx, MAT.gold, cx - 14, 0, cx + 14, 0), [cx - 14, 222, 28, 68], { lw: 4 });
  // crossing chains + padlock
  chain(ctx, 20, 150, w - 20, 270, 10, 1.3);
  chain(ctx, w - 20, 150, 20, 270, 10, 1.3);
  const lock = rrPath(cx - 34, 208, 68, 58, 10);
  ctx.save(); ctx.lineWidth = 10; ctx.strokeStyle = '#0c0a10';
  ctx.beginPath(); ctx.arc(cx, 210, 22, Math.PI, 0); ctx.stroke();
  ctx.lineWidth = 6; ctx.strokeStyle = MAT.iron[0]; ctx.stroke(); ctx.restore();
  shade(ctx, lock, chrome(ctx, MAT.bronze, cx - 34, 0, cx + 34, 0), [cx - 34, 208, 68, 58], { lw: 5 });
  ctx.fillStyle = '#0c0a10';
  ctx.beginPath(); ctx.arc(cx, 230, 7, 0, Math.PI * 2); ctx.fill(); ctx.fillRect(cx - 3, 232, 6, 18);
}

// ------------------------------------------------------------------ dais + sockets
export const DAIS_PAD = 42;
function paintDais(ctx: Ctx) {
  const bw = CELL * 6 + DAIS_PAD * 2, bh = CELL * 6 + DAIS_PAD * 2;
  // front lip (thickness)
  ctx.fillStyle = lin(ctx, 0, bh - 20, 0, bh + 46, [[0, '#2a2233'], [1, '#07060B']]);
  ctx.beginPath(); rr(ctx, 6, 20, bw - 12, bh + 26, 36); ctx.fill();
  // slab
  const slab = rrPath(0, 0, bw, bh, 36);
  shade(ctx, slab, lin(ctx, 0, 0, bw, bh, [[0, '#3a3044'], [0.5, '#221b2a'], [1, '#141018']]), [0, 0, bw, bh], { lw: 6, hi: 0.15 });
  ctx.save(); ctx.clip(slab);
  speckle(ctx, 0, 0, bw, bh, 5000, 5, ['#000', '#4a3f55', '#2a2333', '#5b4c40']);
  ctx.restore();
  // gold trim
  ctx.save();
  ctx.lineWidth = 10; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 0, bw, bh);
  ctx.beginPath(); rr(ctx, 16, 16, bw - 32, bh - 32, 26); ctx.stroke();
  ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(40,20,4,0.9)';
  ctx.beginPath(); rr(ctx, 11, 11, bw - 22, bh - 22, 30); ctx.stroke();
  ctx.beginPath(); rr(ctx, 21, 21, bw - 42, bh - 42, 22); ctx.stroke();
  ctx.restore();
  // corner ornaments
  for (const [x, y] of [[26, 26], [bw - 26, 26], [26, bh - 26], [bw - 26, bh - 26]]) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.shadowBlur = 6;
    ctx.fillStyle = rad(ctx, x - 5, y - 5, 2, 26, [[0, MAT.gold[0]], [0.5, MAT.gold[2]], [1, MAT.gold[4]]]);
    ctx.fill(star(x, y, 4, 9, 26, 0));
    ctx.restore();
    ctx.fillStyle = '#ff4d6d';
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
  }
  // sockets
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) {
    const x = DAIS_PAD + c * CELL, y = DAIS_PAD + r * CELL;
    const inset = rrPath(x + 8, y + 8, CELL - 16, CELL - 16, 22);
    ctx.save();
    ctx.fillStyle = rad(ctx, x + CELL / 2, y + CELL * 0.6, 10, CELL * 0.7, [[0, '#231c2b'], [1, '#0a080d']]);
    ctx.fill(inset);
    ctx.clip(inset);
    // inner shadow top-left, lit lip bottom-right
    ctx.lineWidth = 14;
    ctx.strokeStyle = 'rgba(0,0,0,0.65)';
    ctx.translate(4, 4); ctx.stroke(inset); ctx.translate(-4, -4);
    ctx.strokeStyle = 'rgba(244,196,90,0.12)';
    ctx.lineWidth = 3;
    ctx.translate(-2, -2); ctx.stroke(inset);
    ctx.restore();
    ctx.save(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,220,170,0.12)'; ctx.stroke(inset); ctx.restore();
    // faint carved sigil
    ctx.save(); ctx.globalAlpha = 0.18; ctx.strokeStyle = '#8a7a9a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x + CELL / 2, y + CELL / 2, 30, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x + CELL / 2, y + CELL / 2 - 20); ctx.lineTo(x + CELL / 2 + 17, y + CELL / 2 + 10); ctx.lineTo(x + CELL / 2 - 17, y + CELL / 2 + 10); ctx.closePath(); ctx.stroke();
    ctx.restore();
  }
}

// ------------------------------------------------------------------ decorations for completed album pages
function paintBanner(ctx: Ctx) {
  // forge banner 180x420
  const p = new Path2D();
  p.moveTo(10, 30); p.lineTo(170, 30); p.lineTo(170, 380); p.lineTo(90, 330); p.lineTo(10, 380); p.closePath();
  shade(ctx, p, lin(ctx, 0, 0, 180, 0, [[0, '#4a0a14'], [0.5, '#a01a2e'], [1, '#3a0610']]), [10, 30, 160, 350], { lw: 5 });
  ctx.save(); ctx.clip(p);
  ctx.strokeStyle = MAT.gold[2]; ctx.lineWidth = 6; ctx.strokeRect(24, 30, 132, 330);
  ctx.restore();
  // anvil emblem
  const anvil = poly([[50, 150], [130, 150], [120, 170], [104, 172], [110, 200], [70, 200], [76, 172], [60, 170]]);
  shade(ctx, anvil, chrome(ctx, MAT.gold, 50, 0, 130, 0), [50, 150, 80, 50], { lw: 3 });
  const rod = rrPath(0, 16, 180, 20, 8);
  shade(ctx, rod, chrome(ctx, MAT.gold, 0, 16, 0, 36), [0, 16, 180, 20], { lw: 4 });
}
function paintChandelier(ctx: Ctx) {
  // 300x260
  ctx.save(); ctx.strokeStyle = '#1a1720'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(150, 0); ctx.lineTo(150, 80); ctx.stroke(); ctx.restore();
  const ring = new Path2D(); ring.ellipse(150, 140, 120, 34, 0, 0, Math.PI * 2);
  ctx.save(); ctx.lineWidth = 12; ctx.strokeStyle = '#0c0a10'; ctx.stroke(ring); ctx.lineWidth = 7; ctx.strokeStyle = chrome(ctx, MAT.gold, 30, 0, 270, 0); ctx.stroke(ring); ctx.restore();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2;
    const x = 150 + Math.cos(a) * 120, y = 140 + Math.sin(a) * 34;
    glow(ctx, x, y - 34, 40, 'rgba(126,224,255,0.45)');
    const cr = poly([[x, y - 56], [x + 10, y - 30], [x, y + 20], [x - 10, y - 30]]);
    shade(ctx, cr, lin(ctx, x - 10, 0, x + 10, 0, [[0, '#e6fbff'], [0.5, '#7ee0ff'], [1, '#2a6fb0']]), [x - 10, y - 56, 20, 76], { lw: 3 });
  }
}
function paintOrrery(ctx: Ctx) {
  // 300x300
  const c = 150;
  for (const [rx, ry, rot] of [[130, 44, 0.3], [110, 36, -0.5], [90, 30, 1.2]]) {
    ctx.save(); ctx.lineWidth = 8; ctx.strokeStyle = '#0c0a10';
    ctx.beginPath(); ctx.ellipse(c, c, rx, ry, rot, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 4; ctx.strokeStyle = chrome(ctx, MAT.gold, 20, 20, 280, 280); ctx.stroke(); ctx.restore();
  }
  glow(ctx, c, c, 90, 'rgba(181,140,255,0.6)');
  shade(ctx, (() => { const p = new Path2D(); p.arc(c, c, 30, 0, Math.PI * 2); return p; })(),
    rad(ctx, c - 8, c - 8, 2, 34, [[0, '#fff'], [0.4, '#c7b8ff'], [1, '#3a1c7a']]), [c - 30, c - 30, 60, 60], { lw: 4 });
  for (const [x, y, col] of [[40, 120, '#ff7ad9'], [250, 180, '#7ee0ff'], [180, 60, '#ffe9a3']]) {
    shade(ctx, (() => { const p = new Path2D(); p.arc(x as number, y as number, 12, 0, Math.PI * 2); return p; })(), col as string, [(x as number) - 12, (y as number) - 12, 24, 24], { lw: 3 });
  }
}

export function bakeVault(scene: Phaser.Scene) {
  const add = (key: string, w: number, h: number, fn: (ctx: Ctx) => void) => {
    const [c, ctx] = makeCanvas(w, h);
    fn(ctx);
    scene.textures.addCanvas(key, c);
  };
  add('bgFar', W, H, paintFar);
  add('bgChains', W, 760, paintChains);
  add('fog', 1024, 400, (ctx) => paintFog(ctx, 1024, 400));
  add('sarcophagus', 420, 330, paintSarcophagus);
  add('dais', CELL * 6 + DAIS_PAD * 2, CELL * 6 + DAIS_PAD * 2 + 50, paintDais);
  add('candle', 60, 120, (ctx) => candle(ctx, 30, 104, 70));
  add('decor0', 180, 400, paintBanner);
  add('decor1', 300, 260, paintChandelier);
  add('decor2', 300, 300, paintOrrery);
}
