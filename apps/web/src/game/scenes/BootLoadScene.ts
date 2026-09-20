import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { bakeRelics } from '../art/RelicFactory';
import { bakeVault } from '../art/VaultBackground';
import { bakeUi, bakeCards } from '../art/UiArt';
import { CARDS, ALBUM_PAGES } from '../data/catalog';

/**
 * Bakes every procedural texture once, a step per frame so the progress bar breathes,
 * then waits for save/fonts/age gate and fades into the vault.
 */
export class BootLoadScene extends Phaser.Scene {
  constructor() { super('BootLoad'); }

  create() {
    const { width: W, height: H } = this.scale;
    const bw = 620, by = H / 2 + 600;
    const g = this.add.graphics();
    const steps: [string, () => void][] = [
      ['Waking the relics', () => bakeRelics(this, ctx.state.floor ?? 0)],
      ['Carving the vault', () => bakeVault(this)],
      ['Gilding the frames', () => bakeUi(this)],
      ['Shuffling the album', () => bakeCards(this, CARDS, ALBUM_PAGES.map((p) => p.color))],
    ];
    const label = this.add.text(W / 2, by - 50, '', { fontFamily: 'Cinzel, Georgia, serif', fontSize: '34px', fontStyle: '700', color: '#b9a9c6' }).setOrigin(0.5);
    const draw = (p: number) => {
      g.clear();
      g.fillStyle(0x07050a, 0.9).fillRoundedRect(W / 2 - bw / 2 - 6, by - 6, bw + 12, 36, 18);
      g.lineStyle(3, 0xa56a12).strokeRoundedRect(W / 2 - bw / 2 - 6, by - 6, bw + 12, 36, 18);
      g.fillStyle(0xf4c45a).fillRoundedRect(W / 2 - bw / 2, by, Math.max(24, bw * p), 24, 12);
      g.fillStyle(0xfff6cf, 0.6).fillRoundedRect(W / 2 - bw / 2 + 6, by + 3, Math.max(12, bw * p - 12), 7, 4);
    };
    draw(0);
    let i = 0;
    const next = () => {
      if (i < steps.length) {
        label.setText(steps[i][0] + '…');
        this.time.delayedCall(16, () => {
          steps[i][1]();
          i++;
          draw(i / steps.length);
          next();
        });
      } else {
        label.setText('Opening the vault…');
        const ready: Promise<void> = (window as any).__ready ?? Promise.resolve();
        /**
         * Bug #443: this used to be a bare `.then`, so anything that rejected during boot left the splash sitting
         * at "Opening the vault…" for ever — the only trace being an "Uncaught (in promise)" in a console the
         * player never opens. One unreadable field in the save cost a player their entire game that way.
         *
         * The vault now opens whatever happened. A failed boot is a degraded game, which the player can see and
         * report; a hung splash is a dead one that tells them nothing.
         */
        ready.catch((e) => {
          console.error('[boot] continuing with a degraded start:', e);
          try { (window as any).__rv?.telemetry?.track('boot_error', { why: String((e as Error)?.message ?? e).slice(0, 200) }); } catch { /* telemetry must never be the thing that stops the boot */ }
        }).then(() => {
          this.cameras.main.fadeOut(350, 7, 6, 11);
          this.scene.get('Boot').cameras.main.fadeOut(350, 7, 6, 11);
          this.time.delayedCall(360, () => {
            this.scene.stop('Boot');
            this.scene.start('Vault');
          });
        });
      }
    };
    next();
  }
}
