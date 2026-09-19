import Phaser from 'phaser';
import { Modal } from './Modal';
import { Button, txt } from './kit';
import { ctx } from '../GameCtx';
import { RELICS, MAX_TIER } from '../data/catalog';
import { makeCanvas, lin, glow, chrome, MAT } from '../art/paint';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * "New relic discovered" — the product's one shareable moment (Doctrine: distribution taste).
 * Shows the relic, its lore, the ladder so far, and renders a branded share card on demand.
 */
export class DiscoveryCard extends Modal {
  constructor(vs: VaultScene, private tier: number) {
    super(vs, { w: 960, h: 1500, title: 'NEW RELIC', ribbon: 'ribbonBlue', panelKey: 'panelBlue', offer: undefined });
    this.kind = 'DiscoveryCard';
    const B = this.box, top = this.top, def = RELICS[tier];
    const rays = vs.add.image(0, top + 420, 'relicGlow').setDisplaySize(900, 900).setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    const img = vs.add.image(0, top + 420, 'relic256', `R${tier}`).setDisplaySize(10, 10);
    B.add([rays, img]);
    vs.tweens.add({ targets: img, displayWidth: 480, displayHeight: 480, duration: 600, ease: 'Back.Out' });
    vs.tweens.add({ targets: rays, angle: 360, duration: 16000, repeat: -1 });
    vs.tweens.add({ targets: img, y: img.y - 14, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 600 });
    B.add(txt(vs, 0, top + 110, 'NEVER SEEN IN THIS VAULT', { size: 30, font: 'num', weight: '700', color: '#7EE0FF' }));
    B.add(txt(vs, 0, top + 720, def.name.toUpperCase(), { size: 66, gold: true, weight: '900' }));
    B.add(txt(vs, 0, top + 820, `“${def.lore}”`, { size: 30, font: 'title', weight: '700', color: '#FFE9A3', wrap: 800 }));
    // the ladder so far
    const max = ctx.state.stats.maxTier;
    for (let t = 1; t <= MAX_TIER; t++) {
      const x = (t - 5) * 96;
      const ic = vs.add.image(x, top + 990, 'relic96', `i${t}`).setDisplaySize(84, 84);
      if (t > max) ic.setTint(0x000000).setAlpha(0.55);
      if (t === tier) B.add(vs.add.image(x, top + 990, 'relicGlow').setDisplaySize(150, 150).setTint(def.color).setBlendMode(Phaser.BlendModes.ADD));
      B.add(ic);
    }
    B.add(txt(vs, 0, top + 1070, `${max} of ${MAX_TIER} relics discovered`, { size: 28, font: 'num', weight: '500', color: '#b9a9c6' }));
    B.add(new Button(vs, -210, top + 1230, 380, 130, 'SHARE', () => this.share(), { color: 'purple', size: 46 }));
    B.add(new Button(vs, 210, top + 1230, 380, 130, 'ONWARD', () => this.close(), { color: 'gold', size: 46 }));
    vs.fx.confetti(vs.W / 2, vs.H * 0.3, 70);
    ctx.sfx.play('rank');
    ctx.telemetry.track('discovery', { tier });
  }

  /** Branded 1080x1350 card: relic, name, tier ladder, title. */
  private renderCard(): HTMLCanvasElement {
    const tier = this.tier, def = RELICS[tier];
    const [c, g] = makeCanvas(1080, 1350);
    g.fillStyle = lin(g, 0, 0, 0, 1350, [[0, '#07060B'], [0.45, '#1B1424'], [1, '#07060B']]);
    g.fillRect(0, 0, 1080, 1350);
    glow(g, 540, 560, 560, `#${def.color.toString(16).padStart(6, '0')}88`);
    g.lineWidth = 16; g.strokeStyle = chrome(g, MAT.gold, 0, 0, 0, 1350);
    g.strokeRect(34, 34, 1012, 1282);
    g.lineWidth = 3; g.strokeStyle = '#2a1402'; g.strokeRect(22, 22, 1036, 1306); g.strokeRect(46, 46, 988, 1258);
    const src = this.vs.textures.get('relic256').getSourceImage() as HTMLCanvasElement;
    g.save(); g.shadowColor = 'rgba(255,200,120,0.6)'; g.shadowBlur = 50;
    g.drawImage(src, (tier - 1) * 256, 0, 256, 256, 540 - 300, 560 - 320, 600, 600); g.restore();
    const title = (s: string, y: number, size: number, fill: string | CanvasGradient) => {
      g.font = `900 ${size}px Cinzel, Georgia, serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = size / 7; g.strokeStyle = '#1a0a02'; g.strokeText(s, 540, y); g.fillStyle = fill; g.fillText(s, 540, y);
    };
    const gold = lin(g, 0, 900, 0, 1000, [[0, '#FFF6CF'], [0.5, '#F4C45A'], [1, '#A56A12']]);
    title('I FORGED', 150, 60, '#7EE0FF');
    title(def.name.toUpperCase(), 960, 96, gold);
    g.font = '500 40px Oswald, sans-serif'; g.fillStyle = '#d8cce4';
    g.fillText(`Tier ${tier} of ${MAX_TIER} · ${ctx.state.stats.merges} merges in`, 540, 1050);
    title('RELIC VAULT', 1210, 64, lin(g, 0, 1180, 0, 1240, [[0, '#FFF6CF'], [1, '#A56A12']]));
    g.font = '700 30px Cinzel, serif'; g.fillStyle = '#b9a9c6'; g.fillText('Fuse the cursed gold.', 540, 1268);
    return c;
  }

  private async share() {
    const canvas = this.renderCard();
    const blob: Blob | null = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    if (!blob) return;
    const file = new File([blob], `relic-vault-${RELICS[this.tier].name.replace(/\s+/g, '-').toLowerCase()}.png`, { type: 'image/png' });
    const text = `I forged a ${RELICS[this.tier].name} in Relic Vault.`;
    let method = 'download';
    try {
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean };
      if (nav.share && nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], text, title: 'Relic Vault' }); method = 'native'; }
      else {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.name;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        this.vs.toast('Relic card saved. Show it off.');
      }
    } catch { method = 'cancelled'; }
    ctx.telemetry.track('share', { tier: this.tier, method });
  }
}
