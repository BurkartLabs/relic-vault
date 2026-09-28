import Phaser from 'phaser';
import { makeCanvas, lin, rad, glow, chrome, MAT } from '../art/paint';
import { paintRelic } from '../art/RelicFactory';

/** Paints the splash instantly (no network assets), then hands off to BootLoadScene for baking. */
export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }

  create() {
    const t0 = performance.now(); // AB#4737
    const { width: W, height: H } = this.scale;
    const [c, ctx] = makeCanvas(1080, 1920);
    ctx.fillStyle = lin(ctx, 0, 0, 0, 1920, [[0, '#07060B'], [0.45, '#1B1424'], [1, '#07060B']]);
    ctx.fillRect(0, 0, 1080, 1920);
    glow(ctx, 540, 820, 700, 'rgba(244,196,90,0.28)');
    // vault door rings
    for (const [r, a] of [[430, 0.5], [380, 0.3], [300, 0.2]] as const) {
      ctx.lineWidth = 18; ctx.strokeStyle = `rgba(165,106,18,${a})`;
      ctx.beginPath(); ctx.arc(540, 820, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.lineWidth = 6; ctx.strokeStyle = chrome(ctx, MAT.gold, 0, 390, 0, 1250);
    ctx.beginPath(); ctx.arc(540, 820, 440, 0, Math.PI * 2); ctx.stroke();
    // hero relic
    const [rc, rctx] = makeCanvas(256, 256);
    paintRelic(rctx, 4, true);
    ctx.save(); ctx.shadowColor = 'rgba(255,190,80,0.8)'; ctx.shadowBlur = 60;
    ctx.drawImage(rc, 540 - 280, 820 - 300, 560, 560); ctx.restore();
    ctx.fillStyle = rad(ctx, 540, 960, 300, 1100, [[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.8)']]);
    ctx.fillRect(0, 0, 1080, 1920);
    this.textures.addCanvas('splash', c);

    const s = Math.max(W / 1080, H / 1920);
    this.add.image(W / 2, H / 2, 'splash').setScale(s);
    const title = this.add.text(W / 2, H / 2 + 360, 'RELIC VAULT', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '124px', fontStyle: '900', color: '#FFE9A3', stroke: '#2a1402', strokeThickness: 14,
    }).setOrigin(0.5).setShadow(0, 10, 'rgba(0,0,0,0.8)', 20, true, true);
    const g = title.context.createLinearGradient(0, 0, 0, title.height);
    g.addColorStop(0.15, '#FFF6CF'); g.addColorStop(0.5, '#F4C45A'); g.addColorStop(0.9, '#A56A12');
    title.setFill(g);
    this.add.text(W / 2, H / 2 + 470, 'Fuse the cursed gold.', {
      fontFamily: 'Cinzel, Georgia, serif', fontSize: '46px', fontStyle: '700', color: '#F7EED8', stroke: '#0c0608', strokeThickness: 6,
    }).setOrigin(0.5).setAlpha(0.9);
    performance.measure('rv:splash', { start: t0, end: performance.now() });
    this.scene.launch('BootLoad');
  }
}
