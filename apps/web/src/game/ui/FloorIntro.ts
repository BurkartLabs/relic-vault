import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { Modal, keeperLine } from './Modal';
import { Button, txt } from './kit';
import { COPY } from '../data/catalog';
import { ITEMS } from '../data/items';
import { floorDef } from '../data/floors';
import type { ChapterCard } from '../systems/Chapters';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * AB#444 slice 5: the chapter card. It opens a floor: when the descent's transition ends (before any input), when a
 * floor is restored ("again"), once on a fresh game's Antechamber, and again whenever the Chronicle asks for it. What
 * it says is systems/Chapters.ts; this only draws it. One Continue, no close seal and no tap-outside: it is read, not
 * dismissed by accident. Android's back is the Continue.
 */
export class FloorIntro extends Modal {
  constructor(vs: VaultScene, readonly card: ChapterCard, private onDone?: () => void) {
    // sized to what it says: an arrival has a Renown and a memento row, a first floor or a re-read does not
    super(vs, { w: 980, h: card.renown !== null ? 1380 : 1260, title: `CHAPTER ${card.chapter}${card.again ? ` · ${COPY.chapterAgain}` : ''}`, ribbon: 'ribbonBlue', panelKey: 'panelDark', closable: false, tapOutside: false });
    this.kind = 'FloorIntro';
    this.onBack = () => this.done();
    this.build();
    // for the browser tests: every card shown, in order
    ((window as any).__chapterCards ??= []).push({ kind: card.kind, floor: card.floor, chapter: card.chapter });
    ctx.telemetry.track('chapter_card', { kind: card.kind, floor: card.floor });
  }

  private build() {
    const vs = this.vs, c = this.card, B = this.box, top = this.top;
    const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
    const tint = floorDef(c.floor).color;
    let y = top + 96;
    B.add(txt(vs, 0, y, c.name, { size: 58, gold: true, weight: '900', strokeW: 6 }));
    y += 66;
    const sub = txt(vs, 0, y, c.subtitle, { size: 30, font: 'body', color: '#e8dcf0', wrap: 820, align: 'center' });
    B.add(sub);
    y += sub.height / 2 + 44;
    B.add(txt(vs, 0, y, `${COPY.chapterMaterialLabel} · ${c.material}`, { size: 28, font: 'num', weight: '700', color: hex(tint), wrap: 860 }));
    y += 58;
    B.add(txt(vs, 0, y, c.gen, { size: 36, gold: true, weight: '900' }));
    y += 46;
    const blurb = txt(vs, 0, y, c.genBlurb, { size: 26, font: 'body', color: '#b9a9c6', wrap: 780, align: 'center' });
    B.add(blurb);
    y += blurb.height / 2 + 190;

    // the capstone, veiled: its shape and the floor's light, not its face
    const glow = vs.add.image(0, y, 'relicGlow').setDisplaySize(420, 420).setTint(tint).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55);
    const veiled = vs.add.image(0, y, 'relic256', `R${c.capstone}`).setDisplaySize(300, 300).setTintFill(0x0b0810).setAlpha(0.92);
    B.add([glow, veiled]);
    vs.tweens.add({ targets: glow, alpha: 0.3, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    y += 170;
    B.add(txt(vs, 0, y, COPY.chapterMakeHere, { size: 28, font: 'title', weight: '700', color: '#FFE9A3' }));
    y += 64;

    // what arriving brought: Renown, and the relic carried down or kept
    if (c.renown !== null) {
      const renown = c.renownGained ? `+${c.renownGained} Renown · ${c.renown} in all` : `Renown ${c.renown}`;
      B.add(txt(vs, 0, y, renown, { size: 30, font: 'num', weight: '700', color: '#7EE0FF' }));
      y += 54;
      if (c.memento) {
        const label = `${c.kind === 'restore' ? COPY.chapterKept : COPY.chapterCarried}: ${ITEMS[c.memento]?.name ?? ''}`;
        const t = txt(vs, 36, y, label, { size: 28, font: 'body', color: '#e8dcf0' });
        B.add([vs.add.image(-t.width / 2 - 14, y, 'relic96', `i${c.memento}`).setDisplaySize(64, 64), t]);
      } else {
        B.add(txt(vs, 0, y, COPY.chapterNothingCarried, { size: 26, font: 'body', color: '#b9a9c6' }));
      }
      y += 70;
    }

    keeperLine(vs, B, 0, Math.max(y + 70, this.bottom - 290), 880, c.keeper, 130);
    B.add(new Button(vs, 0, this.bottom - 110, 440, 118, COPY.chapterContinue, () => this.done(), { color: 'green', size: 44 }));
  }

  private done() {
    if (this.closing) return;
    ctx.sfx.play('tick');
    this.onClosed = this.onDone;
    this.close();
  }
}
