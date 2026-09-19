import Phaser from 'phaser';
import { Modal } from './Modal';
import { Button, txt } from './kit';
import { ctx } from '../GameCtx';
import { CARDS, ALBUM_PAGES, CARDS_PER_PAGE, ECON } from '../data/catalog';
import { pageOwned, fillCard, cardsOwned } from '../systems/Economy';
import { computeLuck } from '../systems/LuckSystem';
import type { VaultScene } from '../scenes/VaultScene';

export class AlbumBook extends Modal {
  private page = 0;
  private pageC!: Phaser.GameObjects.Container;
  private tabs: Phaser.GameObjects.Container[] = [];
  constructor(vs: VaultScene) {
    super(vs, { w: 1020, h: 1680, title: 'RELIC ALBUM', ribbon: 'ribbonBlue', panelKey: 'panelBlue' });
    this.kind = 'AlbumBook';
    const s = ctx.state;
    // open on the first incomplete page
    this.page = Math.max(0, s.pagesDone.findIndex((d) => !d));
    const top = this.top;
    ALBUM_PAGES.forEach((p, i) => {
      const t = vs.add.container(-310 + i * 310, top + 90);
      const bg = vs.add.nineslice(0, 0, 'pill', undefined, 290, 84, 40, 40, 36, 36);
      const label = txt(vs, 0, 0, `${['I', 'II', 'III'][i]} · ${pageOwned(s, i)}/12`, { size: 32, font: 'num', weight: '700', color: s.pagesDone[i] ? '#8CF08A' : '#FFE9A3' });
      t.add([bg, label]);
      t.setSize(290, 84).setInteractive({ useHandCursor: true }).on('pointerup', () => { ctx.sfx.play('page'); this.show(i); });
      this.tabs.push(t);
      this.box.add(t);
    });
    this.pageC = vs.add.container(0, 0);
    this.box.add(this.pageC);
    this.show(this.page);
  }

  private show(p: number) {
    const vs = this.vs, s = ctx.state;
    this.page = p;
    this.tabs.forEach((t, i) => t.setAlpha(i === p ? 1 : 0.55).setScale(i === p ? 1.05 : 1));
    this.pageC.removeAll(true);
    const C = this.pageC;
    const top = this.top;
    const def = ALBUM_PAGES[p];
    C.add(txt(vs, 0, top + 180, def.name, { size: 52, gold: true, weight: '900' }));
    // progress bar
    const owned = pageOwned(s, p);
    const bar = vs.add.graphics();
    bar.fillStyle(0x07050a, 1).fillRoundedRect(-340, top + 225, 680, 30, 15);
    bar.fillStyle(def.color, 1).fillRoundedRect(-340, top + 225, Math.max(30, 680 * owned / 12), 30, 15);
    bar.lineStyle(3, 0xa56a12).strokeRoundedRect(-340, top + 225, 680, 30, 15);
    C.add(bar);
    // cards 4x3
    for (let k = 0; k < CARDS_PER_PAGE; k++) {
      const id = p * CARDS_PER_PAGE + k;
      const x = -345 + (k % 4) * 230, y = top + 440 + Math.floor(k / 4) * 300;
      const have = s.album[id] > 0;
      const img = vs.add.image(x, y, have ? 'cards' : 'cardBack', have ? `c${id}` : undefined).setDisplaySize(196, 274);
      C.add(img);
      if (have) {
        const nm = txt(vs, x, y + 106, CARDS[id].name, { size: 20, font: 'body', weight: '700', color: '#FFE9A3', strokeW: 3 });
        if (nm.width > 170) nm.setScale(170 / nm.width);
        C.add(nm);
        if (s.album[id] > 1) C.add(txt(vs, x + 70, y - 110, `x${s.album[id]}`, { size: 26, font: 'num', weight: '700', color: '#7EE0FF' }));
      } else img.setAlpha(0.8);
      img.setInteractive({ useHandCursor: true }).on('pointerup', () => {
        ctx.sfx.play('page');
        if (have) {
          vs.tweens.add({ targets: img, scale: img.scale * 1.12, duration: 120, yoyo: true });
          vs.toast(`${CARDS[id].name} · Page ${['I', 'II', 'III'][p]}`);
        } else vs.toast('Missing. Drops from Gold Mask+ merges, Lucky Chests, events and the Pass.');
      });
    }
    // reward strip
    const ry = top + 1340;
    const plate = vs.add.nineslice(0, ry, 'panelDark', undefined, 900, 170, 70, 70, 70, 70);
    const decor = vs.add.image(-360, ry, `decor${p}`).setScale(p === 0 ? 0.36 : 0.46);
    const rt = txt(vs, 40, ry - 30, s.pagesDone[p] ? `COMPLETE · ${def.reward} hangs in your vault` : `Complete for: ${def.reward} + permanent luck`, { size: 28, font: 'body', weight: '700', color: s.pagesDone[p] ? '#8CF08A' : '#FFE9A3', wrap: 640 });
    const lk = vs.add.image(-120, ry + 38, 'ic_luck').setDisplaySize(52, 52);
    const lt = txt(vs, -86, ry + 38, `Your luck: ${(computeLuck(s) * 100).toFixed(1)}%  (cap ${ECON.luckCap * 100}%)`, { size: 26, font: 'num', weight: '500', color: '#8CF08A', origin: [0, 0.5] });
    C.add([plate, decor, rt, lk, lt]);
    if (!s.pagesDone[p]) decor.setTint(0x333333);
    // gem sink
    const all = cardsOwned(s) >= CARDS.length;
    const fill = new Button(vs, 0, top + 1530, 620, 110, all ? 'ALBUM COMPLETE' : `FILL 1 MISSING CARD · ${ECON.fillCardGems}`, () => this.fill(), { color: 'blue', size: 36, disabled: all, icon: all ? undefined : 'gem', iconScale: 0.45 });
    C.add(fill);
  }

  private fill() {
    const vs = this.vs, s = ctx.state;
    ctx.analytics.log('gem_spend_click', { item: 'fill_card', cost: ECON.fillCardGems });
    if (s.gems < ECON.fillCardGems) { ctx.sfx.play('error'); vs.toast('Not enough gems.'); vs.openShop('album_fill', 'gems'); return; }
    const r = fillCard(s, ctx.rng);
    if (!r) return;
    ctx.sfx.play('card');
    vs.hud.tickGems();
    ctx.persist();
    const page = CARDS[r.id].page;
    this.show(page);
    this.tabs.forEach((t, i) => (t.list[1] as Phaser.GameObjects.Text).setText(`${['I', 'II', 'III'][i]} · ${pageOwned(s, i)}/12`));
    const k = r.id % CARDS_PER_PAGE;
    const x = this.frame.x - 345 + (k % 4) * 230, y = this.frame.y + this.top + 440 + Math.floor(k / 4) * 300;
    vs.fx.ring(x, y, 0x7ee0ff, 1.6);
    vs.fx.burst(x, y, 30, 0x7ee0ff);
    vs.toast(`New card: ${CARDS[r.id].name}`);
    if (r.pageCompleted >= 0) { vs.time.delayedCall(600, () => { vs.pageComplete(r.pageCompleted); this.show(page); }); }
  }
}
