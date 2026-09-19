import { Ctx, lin, rad, poly, smooth, star, glow, shade, MAT, chrome, metal, facets, sparkle, rrPath } from './paint';

/**
 * Painters for the Crypt (ids 11–17) and Star Well (ids 21–27) chains. Same lighting model and ink
 * outline as RelicFactory so all 23 relics read as one world; each tier has its own silhouette.
 */

const OUT = '#160b05';
const BONE = ['#FFFBF0', '#F2EAD8', '#D8CBAE', '#9C8A6A', '#4A3E2A'];
const IRON = MAT.iron;

function outline(ctx: Ctx, p: Path2D, lw = 5, color = OUT) {
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.lineWidth = lw; ctx.strokeStyle = color; ctx.stroke(p); ctx.restore();
}
function circle(x: number, y: number, r: number) { const p = new Path2D(); p.arc(x, y, r, 0, Math.PI * 2); return p; }
function ellipse(x: number, y: number, rx: number, ry: number, rot = 0) { const p = new Path2D(); p.ellipse(x, y, rx, ry, rot, 0, Math.PI * 2); return p; }
function bar(ctx: Ctx, draw: (c: Ctx) => void, w: number, fill: string | CanvasGradient) {
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath(); draw(ctx); ctx.lineWidth = w + 7; ctx.strokeStyle = OUT; ctx.stroke();
  ctx.beginPath(); draw(ctx); ctx.lineWidth = w; ctx.strokeStyle = fill; ctx.stroke();
  ctx.restore();
}
function ghostFire(ctx: Ctx, x: number, y: number, h: number, color: string, core = '#eafff2') {
  ctx.save();
  glow(ctx, x, y - h * 0.4, h * 0.9, color.replace('1)', '0.55)'));
  const f = new Path2D();
  f.moveTo(x, y - h); f.bezierCurveTo(x + h * 0.45, y - h * 0.5, x + h * 0.35, y, x, y);
  f.bezierCurveTo(x - h * 0.35, y, x - h * 0.45, y - h * 0.5, x, y - h); f.closePath();
  ctx.fillStyle = lin(ctx, 0, y - h, 0, y, [[0, core], [0.5, color], [1, 'rgba(0,0,0,0)']]);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fill(f);
  ctx.restore();
}
function skullPath(cx: number, cy: number, s: number) {
  const p = new Path2D();
  p.moveTo(cx - 52 * s, cy + 10 * s);
  p.bezierCurveTo(cx - 62 * s, cy - 70 * s, cx + 62 * s, cy - 70 * s, cx + 52 * s, cy + 10 * s);
  p.quadraticCurveTo(cx + 50 * s, cy + 30 * s, cx + 34 * s, cy + 36 * s);
  p.lineTo(cx + 32 * s, cy + 58 * s); p.lineTo(cx - 32 * s, cy + 58 * s); p.lineTo(cx - 34 * s, cy + 36 * s);
  p.quadraticCurveTo(cx - 50 * s, cy + 30 * s, cx - 52 * s, cy + 10 * s);
  p.closePath();
  return p;
}
function skullFace(ctx: Ctx, cx: number, cy: number, s: number, eye = 'rgba(125,255,176,0.9)') {
  for (const d of [-1, 1]) {
    const e = ellipse(cx + d * 22 * s, cy + 2 * s, 15 * s, 17 * s, d * 0.2);
    ctx.save(); ctx.fillStyle = '#1a120a'; ctx.fill(e); ctx.clip(e); glow(ctx, cx + d * 22 * s, cy + 6 * s, 14 * s, eye); ctx.restore();
  }
  const n = poly([[cx, cy + 16 * s], [cx - 7 * s, cy + 30 * s], [cx + 7 * s, cy + 30 * s]]);
  ctx.fillStyle = '#2a1e12'; ctx.fill(n);
  ctx.save(); ctx.strokeStyle = '#4A3E2A'; ctx.lineWidth = 2.5 * s;
  ctx.beginPath(); ctx.moveTo(cx - 28 * s, cy + 44 * s); ctx.lineTo(cx + 28 * s, cy + 44 * s);
  for (let i = -3; i <= 3; i++) { ctx.moveTo(cx + i * 8 * s, cy + 38 * s); ctx.lineTo(cx + i * 8 * s, cy + 56 * s); }
  ctx.stroke(); ctx.restore();
}

// ============================================================ CRYPT
function boneShard(ctx: Ctx) {
  ctx.save(); ctx.translate(128, 128); ctx.rotate(-0.6); ctx.translate(-128, -128);
  const p = new Path2D();
  p.moveTo(96, 112); p.lineTo(160, 112); p.lineTo(160, 144); p.lineTo(96, 144); p.closePath();
  for (const [x, y] of [[80, 106], [80, 150], [176, 106], [176, 150]]) p.addPath(circle(x, y, 22));
  const body = new Path2D(); body.addPath(p);
  shade(ctx, body, metal(ctx, BONE, 60, 90, 200, 170), [58, 84, 140, 88], { outline: 'none', hi: 0.3 });
  ctx.restore();
  // outline via the same transform
  ctx.save(); ctx.translate(128, 128); ctx.rotate(-0.6); ctx.translate(-128, -128);
  const o = new Path2D();
  o.moveTo(96, 112); o.lineTo(160, 112); o.moveTo(96, 144); o.lineTo(160, 144);
  outline(ctx, o, 5);
  for (const [x, y] of [[80, 106], [80, 150], [176, 106], [176, 150]]) outline(ctx, circle(x, y, 22), 5);
  ctx.strokeStyle = 'rgba(74,62,42,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(118, 118); ctx.lineTo(126, 130); ctx.lineTo(120, 138); ctx.stroke();
  ctx.restore();
  sparkle(ctx, 104, 92, 10);
}
function skull(ctx: Ctx) {
  const p = skullPath(128, 128, 1.35);
  shade(ctx, p, rad(ctx, 108, 80, 4, 120, [[0, BONE[0]], [0.5, BONE[2]], [1, BONE[3]]]), [56, 40, 144, 170], { outline: 'none', rim: 'rgba(125,255,176,0.7)' });
  ctx.save(); ctx.clip(p); ctx.strokeStyle = 'rgba(74,62,42,0.6)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(128, 42); ctx.quadraticCurveTo(120, 70, 132, 90); ctx.stroke(); ctx.restore();
  outline(ctx, p, 6);
  skullFace(ctx, 128, 128, 1.35);
}
function candleSkull(ctx: Ctx) {
  const p = skullPath(128, 150, 1.15);
  shade(ctx, p, rad(ctx, 108, 110, 4, 110, [[0, BONE[0]], [0.5, BONE[2]], [1, BONE[3]]]), [66, 70, 124, 150], { outline: 'none', rim: 'rgba(255,196,106,0.8)' });
  outline(ctx, p, 6);
  skullFace(ctx, 128, 150, 1.15, 'rgba(255,190,90,0.9)');
  // candle + drips
  const c = rrPath(110, 40, 36, 56, 6);
  shade(ctx, c, lin(ctx, 110, 0, 146, 0, [[0, '#d8c8a0'], [0.4, '#fff6dc'], [1, '#b8a47a']]), [110, 40, 36, 56], { lw: 4, drop: false });
  ctx.save(); ctx.fillStyle = '#fff6dc';
  for (const [x, h] of [[100, 30], [150, 40], [128, 22]]) { ctx.beginPath(); ctx.ellipse(x, 96 + h / 2, 6, h / 2, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  glow(ctx, 128, 26, 40, 'rgba(255,190,90,0.7)');
  const f = new Path2D(); f.moveTo(128, 4); f.quadraticCurveTo(142, 26, 128, 40); f.quadraticCurveTo(114, 26, 128, 4); f.closePath();
  ctx.fillStyle = lin(ctx, 0, 4, 0, 40, [[0, '#fffbe0'], [0.6, '#ffc04a'], [1, '#ff6a1a']]); ctx.fill(f);
}
function canopicJar(ctx: Ctx) {
  const jar = new Path2D();
  jar.moveTo(86, 110); jar.bezierCurveTo(60, 150, 70, 214, 98, 226); jar.lineTo(158, 226);
  jar.bezierCurveTo(186, 214, 196, 150, 170, 110); jar.closePath();
  shade(ctx, jar, lin(ctx, 60, 0, 196, 0, [[0, '#8fd8cc'], [0.35, '#f2fffb'], [0.7, '#9fe0d6'], [1, '#3a8a80']]), [60, 110, 136, 116], { outline: 'none' });
  ctx.save(); ctx.clip(jar);
  ctx.fillStyle = '#1a4a6a'; ctx.fillRect(40, 160, 180, 26);
  ctx.fillStyle = MAT.gold[1];
  for (let x = 78; x < 186; x += 18) { ctx.fillRect(x, 166, 4, 14); ctx.beginPath(); ctx.arc(x + 10, 173, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  outline(ctx, jar);
  // jackal-head lid
  const lid = new Path2D();
  lid.moveTo(84, 112); lid.quadraticCurveTo(96, 82, 112, 76); lid.lineTo(104, 30); lid.lineTo(122, 62); lid.lineTo(134, 62);
  lid.lineTo(152, 30); lid.lineTo(144, 76); lid.quadraticCurveTo(160, 82, 172, 112); lid.closePath();
  shade(ctx, lid, lin(ctx, 84, 30, 172, 112, [[0, '#3a4a6a'], [0.5, '#1a2238'], [1, '#07090f']]), [84, 30, 88, 82], { lw: 5, hi: 0.2, rim: 'rgba(244,196,90,0.8)' });
  const snout = poly([[112, 84], [144, 84], [128, 112]]);
  shade(ctx, snout, '#1a2238', [112, 84, 32, 28], { lw: 3, drop: false, rim: 'rgba(244,196,90,0.6)' });
  for (const d of [-1, 1]) { ctx.fillStyle = MAT.gold[1]; ctx.beginPath(); ctx.ellipse(128 + d * 12, 80, 5, 3, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.save(); ctx.strokeStyle = MAT.gold[2]; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(90, 108); ctx.quadraticCurveTo(128, 118, 166, 108); ctx.stroke(); ctx.restore();
}
function wraithLantern(ctx: Ctx) {
  bar(ctx, (c) => { c.arc(128, 34, 16, Math.PI, 0); }, 6, chrome(ctx, IRON, 100, 0, 156, 0));
  const top = poly([[92, 70], [164, 70], [150, 48], [106, 48]]);
  shade(ctx, top, chrome(ctx, IRON, 92, 0, 164, 0), [92, 48, 72, 22], { lw: 4 });
  const glass = rrPath(90, 70, 76, 128, 10);
  ctx.save(); ctx.fillStyle = 'rgba(20,60,40,0.85)'; ctx.fill(glass); ctx.clip(glass);
  glow(ctx, 128, 140, 70, 'rgba(125,255,176,0.8)');
  ctx.restore();
  ghostFire(ctx, 128, 176, 88, 'rgba(125,255,176,1)');
  // ghostly face in the flame
  ctx.save(); ctx.fillStyle = 'rgba(10,40,24,0.7)';
  ctx.beginPath(); ctx.ellipse(118, 124, 5, 8, 0, 0, Math.PI * 2); ctx.ellipse(138, 124, 5, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(128, 146, 6, 10, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  // cage bars
  for (const x of [90, 128, 166]) bar(ctx, (c) => { c.moveTo(x, 72); c.lineTo(x, 196); }, 5, chrome(ctx, IRON, x - 4, 0, x + 4, 0));
  const base = poly([[82, 196], [174, 196], [160, 222], [96, 222]]);
  shade(ctx, base, chrome(ctx, IRON, 82, 0, 174, 0), [82, 196, 92, 26], { lw: 4 });
  for (const [x, y] of [[64, 110], [194, 150], [76, 176]]) { ctx.save(); ctx.globalAlpha = 0.7; glow(ctx, x, y, 16, 'rgba(125,255,176,0.8)'); ctx.restore(); }
}
function ossuaryChest(ctx: Ctx) {
  const body = rrPath(54, 110, 148, 100, 10);
  shade(ctx, body, lin(ctx, 0, 110, 0, 210, [[0, BONE[1]], [0.5, BONE[2]], [1, BONE[3]]]), [54, 110, 148, 100], { outline: 'none' });
  ctx.save(); ctx.clip(body); ctx.strokeStyle = 'rgba(74,62,42,0.5)'; ctx.lineWidth = 3;
  for (let x = 70; x < 200; x += 22) { ctx.beginPath(); ctx.moveTo(x, 112); ctx.lineTo(x, 210); ctx.stroke(); } ctx.restore();
  outline(ctx, body);
  for (const x of [54, 190]) shade(ctx, rrPath(x, 106, 14, 108, 4), chrome(ctx, MAT.bronze, x, 0, x + 14, 0), [x, 106, 14, 108], { lw: 3.5, drop: false });
  const lid = new Path2D(); lid.moveTo(48, 114); lid.quadraticCurveTo(128, 48, 208, 114); lid.closePath();
  shade(ctx, lid, lin(ctx, 0, 60, 0, 114, [[0, '#d6b27a'], [1, '#6a4a22']]), [48, 60, 160, 54], { lw: 5 });
  // crossed bones on lid
  for (const d of [-1, 1]) bar(ctx, (c) => { c.moveTo(128 - 44 * d, 104); c.lineTo(128 + 44 * d, 76); }, 7, BONE[1]);
  // skull emblem
  const sk = skullPath(128, 158, 0.55);
  shade(ctx, sk, rad(ctx, 120, 146, 2, 40, [[0, BONE[0]], [1, BONE[2]]]), [96, 130, 64, 60], { lw: 3.5, drop: false });
  skullFace(ctx, 128, 158, 0.55);
  sparkle(ctx, 78, 128, 10);
}
function phylactery(ctx: Ctx) {
  glow(ctx, 128, 128, 120, 'rgba(181,125,255,0.5)');
  const pts = [[128, 24], [168, 80], [160, 196], [128, 232], [96, 196], [88, 80]];
  const p = poly(pts);
  shade(ctx, p, lin(ctx, 88, 24, 168, 232, [[0, '#f2e6ff'], [0.35, '#b57dff'], [0.7, '#5a1ea0'], [1, '#1a0630']]), [88, 24, 80, 208], { outline: 'none', rim: 'rgba(255,255,255,0.8)' });
  facets(ctx, p, 128, 124, pts, 'rgba(240,220,255,0.22)', 'rgba(20,0,40,0.25)');
  outline(ctx, p);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 128, 128, 34, 'rgba(255,230,255,0.9)'); ctx.restore();
  // bone rib cage
  for (let i = 0; i < 4; i++) {
    const y = 76 + i * 38;
    bar(ctx, (c) => { c.moveTo(70, y + 12); c.quadraticCurveTo(128, y - 18, 186, y + 12); }, 7, BONE[1]);
  }
  bar(ctx, (c) => { c.moveTo(128, 56); c.lineTo(128, 212); }, 6, BONE[2]);
  for (const [x, y] of [[48, 70], [210, 110], [52, 170]]) { ctx.save(); ctx.fillStyle = 'rgba(214,180,255,0.9)'; ctx.shadowColor = '#b57dff'; ctx.shadowBlur = 10; ctx.fill(star(x, y, 4, 2, 9, 0)); ctx.restore(); }
}

// ============================================================ STAR WELL
function stardustVial(ctx: Ctx) {
  const flask = new Path2D();
  flask.moveTo(112, 70); flask.lineTo(112, 104); flask.bezierCurveTo(64, 120, 64, 214, 128, 216);
  flask.bezierCurveTo(192, 214, 192, 120, 144, 104); flask.lineTo(144, 70); flask.closePath();
  ctx.save(); ctx.fillStyle = 'rgba(150,190,255,0.25)'; ctx.fill(flask); ctx.clip(flask);
  ctx.fillStyle = rad(ctx, 128, 176, 4, 70, [[0, '#ffffff'], [0.3, '#bfe0ff'], [1, '#2a4aa0']]);
  ctx.fillRect(60, 132, 140, 90);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(255,255,255,${0.4 + (i % 5) * 0.12})`; ctx.fillRect(74 + (i * 37) % 108, 140 + (i * 23) % 70, 2.5, 2.5); }
  ctx.fillStyle = lin(ctx, 70, 0, 186, 0, [[0, 'rgba(255,255,255,0)'], [0.3, 'rgba(255,255,255,0.5)'], [0.4, 'rgba(255,255,255,0)']]);
  ctx.fillRect(60, 100, 140, 120);
  ctx.restore();
  outline(ctx, flask, 5);
  const cork = rrPath(106, 44, 44, 30, 6);
  shade(ctx, cork, lin(ctx, 0, 44, 0, 74, [[0, '#d8a870'], [1, '#7a4a22']]), [106, 44, 44, 30], { lw: 4, drop: false });
  bar(ctx, (c) => { c.moveTo(106, 80); c.lineTo(150, 80); }, 5, MAT.gold[2]);
  sparkle(ctx, 88, 150, 12, '#dff0ff'); sparkle(ctx, 170, 60, 10, '#dff0ff');
}
function meteorite(ctx: Ctx) {
  // fire trail
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  const tr = new Path2D(); tr.moveTo(150, 90); tr.lineTo(236, 22); tr.lineTo(206, 70); tr.lineTo(178, 150); tr.closePath();
  ctx.fillStyle = lin(ctx, 236, 22, 150, 110, [[0, 'rgba(255,120,40,0)'], [1, 'rgba(255,190,90,0.8)']]); ctx.fill(tr); ctx.restore();
  const pts = [[92, 76], [140, 66], [182, 96], [194, 146], [170, 196], [118, 210], [74, 186], [58, 136], [70, 100]];
  const p = smooth(pts, 0.35);
  shade(ctx, p, rad(ctx, 110, 110, 4, 110, [[0, '#6a5a52'], [0.6, '#322824'], [1, '#140e0c']]), [58, 66, 136, 144], { outline: 'none', rim: 'rgba(255,154,90,0.9)' });
  // molten veins
  ctx.save(); ctx.clip(p); ctx.shadowColor = '#ff8a2a'; ctx.shadowBlur = 12; ctx.strokeStyle = '#ffb45a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(80, 120); ctx.lineTo(112, 132); ctx.lineTo(126, 110); ctx.lineTo(160, 124);
  ctx.moveTo(112, 132); ctx.lineTo(118, 168); ctx.lineTo(150, 180); ctx.moveTo(126, 110); ctx.lineTo(140, 84);
  ctx.stroke(); ctx.strokeStyle = '#fff2c0'; ctx.lineWidth = 1.5; ctx.shadowBlur = 0; ctx.stroke();
  for (const [x, y, r] of [[96, 90, 10], [164, 160, 12], [140, 196, 8]]) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
  outline(ctx, p, 6);
}
function astrolabe(ctx: Ctx) {
  bar(ctx, (c) => { c.arc(128, 34, 14, 0, Math.PI * 2); }, 6, MAT.gold[2]);
  const disc = circle(128, 136, 88);
  shade(ctx, disc, chrome(ctx, MAT.gold, 40, 50, 216, 220), [40, 48, 176, 176], { outline: 'none', hi: 0.4 });
  const inner = circle(128, 136, 70);
  ctx.save(); ctx.fillStyle = rad(ctx, 128, 136, 4, 72, [[0, '#2a3a6a'], [1, '#0a1230']]); ctx.fill(inner); ctx.clip(inner);
  for (let i = 0; i < 30; i++) { ctx.fillStyle = 'rgba(220,235,255,0.8)'; ctx.fillRect(64 + (i * 41) % 128, 72 + (i * 29) % 128, 2, 2); }
  ctx.strokeStyle = 'rgba(244,196,90,0.6)'; ctx.lineWidth = 2;
  for (const r of [30, 50]) { ctx.beginPath(); ctx.arc(128, 136, r, 0, Math.PI * 2); ctx.stroke(); }
  ctx.beginPath(); ctx.ellipse(128, 150, 62, 34, -0.3, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
  outline(ctx, disc, 6);
  // rete pointer
  const rete = poly([[128, 136], [200, 96], [134, 142]]);
  shade(ctx, rete, chrome(ctx, MAT.gold, 128, 96, 200, 142), [128, 96, 72, 46], { lw: 3, drop: false });
  ctx.save(); ctx.fillStyle = '#ffe9a3'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.fill(star(200, 96, 4, 3, 12, 0)); ctx.restore();
  shade(ctx, circle(128, 136, 10), MAT.gold[1], [118, 126, 20, 20], { lw: 3, drop: false });
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; ctx.fillStyle = MAT.gold[4]; ctx.fillRect(128 + Math.cos(a) * 78 - 2, 136 + Math.sin(a) * 78 - 2, 4, 4); }
}
function moonSickle(ctx: Ctx) {
  glow(ctx, 138, 100, 110, 'rgba(223,232,255,0.45)');
  const b = new Path2D();
  b.moveTo(86, 170); b.bezierCurveTo(40, 110, 80, 20, 180, 30);
  b.bezierCurveTo(118, 50, 96, 110, 120, 160); b.closePath();
  shade(ctx, b, lin(ctx, 40, 30, 180, 170, [[0, '#ffffff'], [0.4, '#dfe8ff'], [0.75, '#8a9ac8'], [1, '#3a4270']]), [40, 26, 140, 148], { lw: 5, hi: 0.5, rim: 'rgba(154,184,255,0.9)' });
  ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(90, 150); ctx.bezierCurveTo(60, 100, 90, 44, 170, 34); ctx.stroke(); ctx.restore();
  // handle
  bar(ctx, (c) => { c.moveTo(104, 164); c.lineTo(158, 230); }, 16, lin(ctx, 104, 164, 158, 230, [[0, '#7a4a22'], [1, '#3a1e0a']]));
  ctx.save(); ctx.strokeStyle = '#c89a5a'; ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) { const t = i / 5; const x = 108 + t * 46, y = 170 + t * 56; ctx.beginPath(); ctx.moveTo(x - 8, y + 6); ctx.lineTo(x + 8, y - 6); ctx.stroke(); }
  ctx.restore();
  shade(ctx, circle(104, 164, 13), rad(ctx, 100, 160, 1, 14, [[0, '#ffffff'], [0.4, '#9ab8ff'], [1, '#1a2a6a']]), [91, 151, 26, 26], { lw: 3.5 });
  sparkle(ctx, 150, 44, 14);
}
function armillary(ctx: Ctx) {
  // stand
  const st = poly([[104, 196], [152, 196], [170, 228], [86, 228]]);
  shade(ctx, st, chrome(ctx, MAT.gold, 86, 0, 170, 0), [86, 196, 84, 32], { lw: 4 });
  bar(ctx, (c) => { c.moveTo(128, 196); c.lineTo(128, 176); }, 8, MAT.gold[2]);
  glow(ctx, 128, 112, 80, 'rgba(154,184,255,0.6)');
  const orb = circle(128, 112, 30);
  shade(ctx, orb, rad(ctx, 118, 102, 2, 34, [[0, '#ffffff'], [0.35, '#9ab8ff'], [1, '#1a2a6a']]), [98, 82, 60, 60], { lw: 4 });
  for (const [rx, ry, rot] of [[80, 80, 0], [80, 26, 0.35], [80, 26, -0.6], [26, 80, 0.2]]) {
    bar(ctx, (c) => { c.ellipse(128, 112, rx, ry, rot, 0, Math.PI * 2); }, 6, chrome(ctx, MAT.gold, 40, 30, 216, 200));
  }
  sparkle(ctx, 76, 64, 11, '#dff0ff');
}
function starLyre(ctx: Ctx) {
  glow(ctx, 128, 120, 110, 'rgba(201,168,255,0.45)');
  // frame: two horns
  for (const d of [-1, 1]) {
    bar(ctx, (c) => { c.moveTo(128 + d * 22, 210); c.bezierCurveTo(128 + d * 90, 190, 128 + d * 90, 90, 128 + d * 50, 60); c.quadraticCurveTo(128 + d * 36, 40, 128 + d * 52, 26); }, 12,
      chrome(ctx, ['#FFFFFF', '#F2E6FF', '#C9A8FF', '#6A3AC8', '#24104A'], 40, 20, 216, 220));
  }
  bar(ctx, (c) => { c.moveTo(80, 70); c.lineTo(176, 70); }, 9, MAT.gold[2]);
  const base = rrPath(92, 200, 72, 24, 8);
  shade(ctx, base, chrome(ctx, MAT.gold, 92, 0, 164, 0), [92, 200, 72, 24], { lw: 4 });
  // glowing strings
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.shadowColor = '#e8d8ff'; ctx.shadowBlur = 8; ctx.strokeStyle = 'rgba(255,245,255,0.95)'; ctx.lineWidth = 2;
  for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(128 + i * 14, 72); ctx.lineTo(128 + i * 10, 202); ctx.stroke(); }
  ctx.restore();
  ctx.save(); ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 16; ctx.fill(star(128, 44, 5, 8, 20)); ctx.restore();
  for (const [x, y] of [[56, 120], [200, 150]]) { ctx.save(); ctx.fillStyle = '#e8d8ff'; ctx.fill(star(x, y, 4, 2, 8, 0)); ctx.restore(); }
}
function heartOfSky(ctx: Ctx) {
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    ctx.fillStyle = lin(ctx, 128, 128, 128 + Math.cos(a) * 128, 128 + Math.sin(a) * 128, [[0, 'rgba(255,242,168,0.6)'], [1, 'rgba(255,242,168,0)']]);
    ctx.beginPath(); ctx.moveTo(128, 128); ctx.arc(128, 128, i % 2 ? 110 : 126, a - 0.06, a + 0.06); ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  glow(ctx, 128, 128, 100, 'rgba(255,242,168,0.7)');
  for (const r of [96, 82]) { ctx.save(); ctx.strokeStyle = `rgba(255,236,170,${r === 96 ? 0.5 : 0.8})`; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(128, 128, r, r * 0.34, -0.4, 0, Math.PI * 2); ctx.stroke(); ctx.restore(); }
  const pts: number[][] = [];
  for (let i = 0; i < 16; i++) { const a = -Math.PI / 2 + (i / 16) * Math.PI * 2; const r = i % 2 ? 36 : 76; pts.push([128 + Math.cos(a) * r, 128 + Math.sin(a) * r]); }
  const p = poly(pts);
  shade(ctx, p, rad(ctx, 116, 112, 4, 80, [[0, '#ffffff'], [0.3, '#fff6c0'], [0.7, '#ffcf5a'], [1, '#c07a10']]), [52, 52, 152, 152], { lw: 5, hi: 0.5, rim: 'rgba(255,255,255,0.9)' });
  facets(ctx, p, 128, 128, pts, 'rgba(255,255,255,0.25)', 'rgba(160,90,0,0.2)');
  outline(ctx, p, 5);
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; glow(ctx, 128, 128, 30, 'rgba(255,255,255,1)'); ctx.restore();
}

export const CHAIN_PAINTERS: Record<number, (ctx: Ctx) => void> = {
  11: boneShard, 12: skull, 13: candleSkull, 14: canopicJar, 15: wraithLantern, 16: ossuaryChest, 17: phylactery,
  21: stardustVial, 22: meteorite, 23: astrolabe, 24: moonSickle, 25: armillary, 26: starLyre, 27: heartOfSky,
};

// ============================================================ generators + patrons
export function paintCryptBrazier(ctx: Ctx, S: number) {
  const c = S / 2;
  shade(ctx, circle(c, c, S * 0.47), chrome(ctx, MAT.bronze, 0, 0, 0, S), [c - S * 0.47, c - S * 0.47, S * 0.94, S * 0.94], { lw: 5, hi: 0.3 });
  const inner = circle(c, c, S * 0.4);
  ctx.save(); ctx.fillStyle = rad(ctx, c, c + S * 0.12, 4, S * 0.46, [[0, '#7dffb0'], [0.3, '#1a8a5a'], [0.7, '#06301e'], [1, '#020a06']]); ctx.fill(inner); ctx.clip(inner);
  ghostFire(ctx, c - S * 0.1, c + S * 0.06, S * 0.34, 'rgba(125,255,176,1)');
  ghostFire(ctx, c + S * 0.1, c + S * 0.06, S * 0.3, 'rgba(125,255,176,1)');
  ghostFire(ctx, c, c + S * 0.02, S * 0.42, 'rgba(125,255,176,1)');
  ctx.restore();
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(inner); ctx.restore();
  // bone bowl + legs
  for (const d of [-1, 1]) {
    const lx = c + d * S * 0.16;
    ctx.save(); ctx.lineCap = 'round'; ctx.lineWidth = S * 0.05; ctx.strokeStyle = OUT; ctx.beginPath(); ctx.moveTo(lx, c + S * 0.14); ctx.lineTo(lx + d * S * 0.08, c + S * 0.36); ctx.stroke();
    ctx.lineWidth = S * 0.03; ctx.strokeStyle = BONE[2]; ctx.stroke(); ctx.restore();
  }
  const bowl = new Path2D(); bowl.moveTo(c - S * 0.28, c + S * 0.04); bowl.quadraticCurveTo(c, c + S * 0.34, c + S * 0.28, c + S * 0.04); bowl.closePath();
  shade(ctx, bowl, lin(ctx, 0, c, 0, c + S * 0.22, [[0, BONE[1]], [1, BONE[3]]]), [c - S * 0.28, c + S * 0.04, S * 0.56, S * 0.2], { lw: 4 });
  const sk = skullPath(c, c + S * 0.13, S * 0.0015);
  shade(ctx, sk, BONE[1], [c - 30, c, 60, 60], { lw: 2.5, drop: false });
  skullFace(ctx, c, c + S * 0.13, S * 0.0015);
}
export function paintStarWell(ctx: Ctx, S: number) {
  const c = S / 2;
  shade(ctx, circle(c, c, S * 0.47), chrome(ctx, ['#FFFFFF', '#E2F0FF', '#9AB8FF', '#3A4A9A', '#12183A'], 0, 0, 0, S), [c - S * 0.47, c - S * 0.47, S * 0.94, S * 0.94], { lw: 5, hi: 0.3 });
  const inner = circle(c, c, S * 0.4);
  ctx.save(); ctx.fillStyle = rad(ctx, c, c, 4, S * 0.46, [[0, '#2a3a8a'], [1, '#050818']]); ctx.fill(inner); ctx.clip(inner);
  for (let i = 0; i < 40; i++) { ctx.fillStyle = `rgba(230,240,255,${0.4 + (i % 4) * 0.15})`; ctx.fillRect(c - S * 0.4 + (i * 47) % (S * 0.8), c - S * 0.4 + (i * 31) % (S * 0.5), 2.5, 2.5); }
  // starlight beam
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = lin(ctx, 0, c - S * 0.4, 0, c + S * 0.1, [[0, 'rgba(220,235,255,0)'], [1, 'rgba(220,235,255,0.8)']]);
  ctx.beginPath(); ctx.moveTo(c - S * 0.08, c + S * 0.1); ctx.lineTo(c + S * 0.08, c + S * 0.1); ctx.lineTo(c + S * 0.2, c - S * 0.45); ctx.lineTo(c - S * 0.2, c - S * 0.45); ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.save(); ctx.lineWidth = 3; ctx.strokeStyle = OUT; ctx.stroke(inner); ctx.restore();
  // stone well ring (front)
  const well = rrPath(c - S * 0.26, c + S * 0.06, S * 0.52, S * 0.26, 10);
  shade(ctx, well, lin(ctx, 0, c, 0, c + S * 0.32, [[0, '#8a8698'], [1, '#2a2632']]), [c - S * 0.26, c + S * 0.06, S * 0.52, S * 0.26], { lw: 4 });
  ctx.save(); ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) { ctx.beginPath(); ctx.moveTo(c - S * 0.26 + i * S * 0.13, c + S * 0.06); ctx.lineTo(c - S * 0.26 + i * S * 0.13, c + S * 0.32); ctx.stroke(); }
  ctx.restore();
  const water = ellipse(c, c + S * 0.06, S * 0.26, S * 0.06);
  ctx.save(); ctx.fillStyle = rad(ctx, c, c + S * 0.06, 2, S * 0.26, [[0, '#ffffff'], [0.4, '#9ab8ff'], [1, '#1a2a6a']]); ctx.fill(water); ctx.restore();
  outline(ctx, water, 3);
  ctx.save(); ctx.fillStyle = '#fff6c8'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 14; ctx.fill(star(c, c - S * 0.2, 5, S * 0.03, S * 0.08)); ctx.restore();
}
export function paintPatron(ctx: Ctx, S: number, hue: number) {
  const c = S / 2;
  shade(ctx, circle(c, c, S * 0.47), chrome(ctx, MAT.gold, 0, 0, 0, S), [c - S * 0.47, c - S * 0.47, S * 0.94, S * 0.94], { lw: 4 });
  const bg = circle(c, c, S * 0.41);
  ctx.save(); ctx.fillStyle = rad(ctx, c, c * 0.8, 4, S * 0.5, [[0, `hsl(${hue},35%,30%)`], [1, `hsl(${hue},40%,8%)`]]); ctx.fill(bg); ctx.clip(bg);
  const hood = new Path2D();
  hood.moveTo(c - S * 0.36, S); hood.quadraticCurveTo(c - S * 0.34, S * 0.2, c, S * 0.14); hood.quadraticCurveTo(c + S * 0.34, S * 0.2, c + S * 0.36, S); hood.closePath();
  shade(ctx, hood, lin(ctx, c - S * 0.36, 0, c + S * 0.36, 0, [[0, `hsl(${hue},50%,12%)`], [0.4, `hsl(${hue},55%,34%)`], [1, `hsl(${hue},50%,8%)`]]), [c - S * 0.36, S * 0.14, S * 0.72, S * 0.86], { lw: 3, hi: 0.25 });
  const face = new Path2D(); face.ellipse(c, S * 0.52, S * 0.16, S * 0.21, 0, 0, Math.PI * 2);
  ctx.fillStyle = lin(ctx, 0, S * 0.3, 0, S * 0.75, [[0, '#d8b89a'], [1, '#6a4a3a']]); ctx.fill(face);
  ctx.save(); ctx.clip(face); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(c - S * 0.2, S * 0.3, S * 0.4, S * 0.1); ctx.restore();
  for (const s of [-1, 1]) { ctx.fillStyle = '#1a0e08'; ctx.beginPath(); ctx.ellipse(c + s * S * 0.065, S * 0.5, S * 0.022, S * 0.014, 0, 0, Math.PI * 2); ctx.fill(); }
  ctx.strokeStyle = '#5a2a1a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(c - S * 0.05, S * 0.63); ctx.quadraticCurveTo(c, S * 0.66, c + S * 0.05, S * 0.63); ctx.stroke();
  ctx.fillStyle = `hsl(${(hue + 40) % 360},80%,60%)`; ctx.beginPath(); ctx.arc(c, S * 0.84, S * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
