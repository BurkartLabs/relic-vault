import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { Modal } from './Modal';
import { Button, Scroller, txt, fmt } from './kit';
import { ITEMS, PATRONS } from '../data/items';
import {
  bubble, claimErrand, claimMain, currentMain, liveErrands, mainDone, mainProgress, refillErrands, swapErrand,
  beatsHeard, errandsDone, mainQuestsOnFloor,
} from '../systems/Chronicle';
import {
  canDescend, canRestore, currentFloor, descend, isLastFloor, mementoChoices, renownGold, renownGoldAt, restore,
} from '../systems/Floors';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * The Keeper's Chronicle screen (docs/STORY.md): what he is asking for now, the two errands beside it, and
 * every beat heard so far — re-readable, because a story you can only hear once is a story nobody follows.
 */
export class ChronicleModal extends Modal {
  constructor(vs: VaultScene) {
    super(vs, { w: 980, h: 1560, title: 'THE CHRONICLE', panelKey: 'panelDark' });
    this.kind = 'ChronicleModal';
    this.build();
  }

  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = -this.ph / 2;
    const floor = currentFloor(s);
    B.removeAll(true);

    B.add(vs.add.image(-360, top + 120, 'keeper').setDisplaySize(190, 190));
    B.add(txt(vs, -240, top + 78, floor.name, { size: 40, gold: true, weight: '900', origin: [0, 0.5] }));
    B.add(txt(vs, -240, top + 132, floor.subtitle, { size: 26, font: 'body', color: '#b9a9c6', origin: [0, 0.5], wrap: 600 }));
    const chapter = mainQuestsOnFloor(s.floor ?? 0).filter((q) => (s.chronicle?.claimed ?? []).includes(q.id)).length;
    B.add(txt(vs, -240, top + 186, `Chapter ${(s.floor ?? 0) + 1} · ${chapter} of 3 beats`, { size: 26, font: 'num', weight: '700', color: '#7EE0FF', origin: [0, 0.5] }));

    const sc = new Scroller(vs, B, -470, top + 240, 940, this.ph - 320);
    // the scroller's content container is anchored at its own left edge; this puts the rows back on the panel's
    // centre line, so every x below reads the same way as the rest of this file
    const row = vs.add.container(470, 0);
    sc.content.add(row);
    this.row = row;
    let y = 0;

    // ---- the main line
    const q = currentMain(s);
    y = this.section(sc, y, 'HE IS ASKING FOR');
    if (!q) {
      row.add(txt(vs, 0, y + 40, 'Nothing, for now. You have heard everything this floor has to say.', { size: 30, font: 'body', color: '#b9a9c6', wrap: 860 }));
      y += 110;
    } else {
      const done = mainDone(s, q);
      row.add(vs.add.nineslice(0, y + 70, done ? 'panel' : 'panelDark', undefined, 900, 200, 70, 70, 70, 70));
      row.add(txt(vs, -410, y + 24, q.label, { size: 34, weight: '900', gold: true, origin: [0, 0.5], wrap: 640 }));
      const prog = mainProgress(s, q);
      const g = vs.add.graphics();
      g.fillStyle(0x07050a).fillRoundedRect(-410, y + 62, 560, 26, 13);
      g.fillStyle(done ? 0x8cf08a : 0xf4c45a).fillRoundedRect(-410, y + 62, Math.max(26, 560 * prog / q.goal), 26, 13);
      row.add(g);
      row.add(txt(vs, -410, y + 122, `${prog} / ${q.goal}${done ? ' · ready' : ''}`, { size: 26, font: 'num', weight: '700', color: done ? '#8CF08A' : '#b9a9c6', origin: [0, 0.5] }));
      row.add(txt(vs, 30, y + 122, q.rewards.map((r) => rewardLabel(r)).join(' · '), { size: 26, font: 'num', weight: '500', color: '#FFE9A3', origin: [0, 0.5] }));
      if (done) {
        row.add(new Button(vs, 300, y + 70, 220, 104, 'CLAIM', () => this.claimMain(), { color: 'green', size: 34 }));
      }
      y += 230;
    }

    // ---- errands
    refillErrands(s);
    y = this.section(sc, y, `ERRANDS · ${errandsDone(s)} filled`);
    for (const e of liveErrands(s)) {
      if (!e) continue;
      const p = PATRONS[e.def.patron];
      row.add(vs.add.nineslice(0, y + 66, e.done ? 'panel' : 'panelDark', undefined, 900, 184, 70, 70, 70, 70));
      row.add(vs.add.image(-390, y + 66, `patron${e.def.patron}`).setDisplaySize(110, 110));
      row.add(txt(vs, -310, y + 26, e.label, { size: 28, weight: '900', gold: true, origin: [0, 0.5], wrap: 560 }));
      row.add(txt(vs, -310, y + 74, `${p.name}${p.title ? ' ' + p.title : ''}`, { size: 24, font: 'body', color: '#b9a9c6', origin: [0, 0.5] }));
      row.add(txt(vs, -310, y + 118, `${e.progress} / ${e.goal} · ${e.def.pay(s.floor ?? 0, e.goal).map((r) => rewardLabel(r)).join(' · ')}`,
        { size: 24, font: 'num', weight: '500', color: e.done ? '#8CF08A' : '#b9a9c6', origin: [0, 0.5] }));
      if (e.done) row.add(new Button(vs, 320, y + 66, 230, 96, 'COLLECT', () => this.claimErrand(e.slot), { color: 'green', size: 30 }));
      else row.add(new Button(vs, 320, y + 66, 190, 88, 'SWAP', () => { swapErrand(s, e.slot); ctx.persist(); this.build(); }, { color: 'dark', size: 28 }));
      y += 210;
    }
    row.add(txt(vs, -410, y + 10, 'Errands never expire. Swapping one is free — it costs the progress, not a wait.',
      { size: 24, font: 'body', color: '#8a7a98', origin: [0, 0.5], wrap: 880 }));
    y += 70;

    // ---- the story so far
    const beats = beatsHeard(s);
    if (beats.length) {
      y = this.section(sc, y, 'THE STORY SO FAR');
      for (const b of beats) {
        row.add(txt(vs, -410, y + 20, `${b.floor + 1}·${(b.id % 3) + 1}`, { size: 24, font: 'num', weight: '700', color: '#7EE0FF', origin: [0, 0.5] }));
        const t = txt(vs, -330, y + 18, b.beat, { size: 27, font: 'body', color: '#e8dcf0', origin: [0, 0], wrap: 800 });
        row.add(t);
        y += Math.max(70, t.height + 34);
      }
    }
    sc.setContentHeight(y + 40);
  }

  private row?: Phaser.GameObjects.Container;

  private section(_sc: Scroller, y: number, label: string) {
    this.row?.add(txt(this.vs, -410, y + 10, label, { size: 26, font: 'num', weight: '700', color: '#8a7a98', origin: [0, 0.5] }));
    return y + 46;
  }

  private claimMain() {
    const c = claimMain(ctx.state, ctx.rng);
    if (!c) return;
    ctx.sfx.play('rank');
    ctx.persist();
    ctx.telemetry.track('chronicle_claim', { quest: c.quest.id, floor: c.quest.floor, chapterDone: c.chapterDone });
    this.close();
    // the beat is the reward; the Keeper says it himself, then the doors open if the chapter closed
    this.vs.keeperSays(c.quest.beat, () => {
      this.vs.showGrant(c.grant, { x: this.vs.W / 2, y: this.vs.H * 0.4 });
      if (c.chapterDone) this.vs.offerFloorDoors();
    });
  }

  private claimErrand(slot: number) {
    const c = claimErrand(ctx.state, slot, ctx.rng);
    if (!c) return;
    ctx.sfx.play('coin');
    ctx.persist();
    ctx.telemetry.track('errand_claim', { patron: c.errand.def.patron, floor: ctx.state.floor, total: c.total });
    this.vs.showGrant(c.grant, { x: this.vs.W / 2, y: this.vs.H * 0.5 });
    this.build();
  }
}

function rewardLabel(r: { kind: string; n?: number; tier?: number }): string {
  switch (r.kind) {
    case 'gold': return `${fmt(r.n ?? 0)} gold`;
    case 'gems': return `${r.n} gems`;
    case 'chest': return r.n === 1 ? 'a chest' : `${r.n} chests`;
    case 'card': return r.n === 1 ? 'a card' : `${r.n} cards`;
    case 'relic': return `a tier ${r.tier} relic`;
    case 'crumb': return `${r.n} crumb`;
    default: return r.kind;
  }
}

/**
 * The choice at the bottom of a floor (docs/ROOMS.md). Both doors are free and neither is recommended over the
 * other — descending is more content, restoring is more power, and which of those a player wants is not
 * something the game gets to decide for them.
 */
export class FloorDoorsModal extends Modal {
  private memento: number;

  constructor(vs: VaultScene) {
    super(vs, { w: 980, h: 1420, title: 'THE FLOOR IS CLEAR', panelKey: 'panelDark' });
    this.kind = 'FloorDoorsModal';
    this.memento = mementoChoices(ctx.state)[0] ?? 0;
    this.build();
  }

  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = -this.ph / 2;
    B.removeAll(true);
    const floor = currentFloor(s);

    B.add(vs.add.image(-350, top + 130, 'keeper').setDisplaySize(200, 200));
    B.add(txt(vs, -230, top + 100, `${floor.name} is finished.`, { size: 38, gold: true, weight: '900', origin: [0, 0.5], wrap: 580 }));
    B.add(txt(vs, -230, top + 166,
      isLastFloor(s)
        ? 'There is nothing under us. You may begin it again, as many times as you like.'
        : 'Two doors. Neither is the clever answer, whatever the other keepers told you.',
      { size: 27, font: 'body', color: '#e8dcf0', origin: [0, 0.5], wrap: 580 }));

    // ---- the memento
    const choices = mementoChoices(s).slice(0, 12);
    B.add(txt(vs, 0, top + 262, 'TAKE ONE RELIC WITH YOU', { size: 28, font: 'num', weight: '700', color: '#8a7a98' }));
    if (!choices.length) {
      B.add(txt(vs, 0, top + 320, 'You are holding nothing. The next floor starts clean.', { size: 26, font: 'body', color: '#b9a9c6' }));
    } else {
      choices.forEach((id, i) => {
        const x = -390 + (i % 6) * 156;
        const y = top + 340 + Math.floor(i / 6) * 150;
        const on = id === this.memento;
        const cell = vs.add.container(x, y);
        cell.add(vs.add.nineslice(0, 0, on ? 'panel' : 'panelDark', undefined, 140, 140, 60, 60, 60, 60));
        cell.add(vs.add.image(0, -8, 'relic96', `i${Math.min(9, id % 10)}`).setDisplaySize(84, 84).setTint(ITEMS[id]?.color ?? 0xffffff));
        cell.add(txt(vs, 0, 52, `T${id % 10}`, { size: 22, font: 'num', weight: '700', color: on ? '#FFE9A3' : '#8a7a98' }));
        cell.setSize(140, 140).setInteractive({ useHandCursor: true });
        cell.on('pointerup', () => { this.memento = id; ctx.sfx.play('tick'); this.build(); });
        B.add(cell);
      });
      const m = ITEMS[this.memento];
      if (m) B.add(txt(vs, 0, top + 340 + Math.ceil(choices.length / 6) * 150 + 10, `${m.name} — ${m.lore}`,
        { size: 25, font: 'body', color: '#e8dcf0', wrap: 840 }));
    }

    // ---- the doors
    const dy = top + this.ph - 300;
    if (canDescend(s)) {
      B.add(vs.add.nineslice(-235, dy, 'panelDark', undefined, 440, 300, 70, 70, 70, 70));
      B.add(txt(vs, -235, dy - 104, 'DESCEND', { size: 38, gold: true, weight: '900' }));
      B.add(txt(vs, -235, dy - 30, 'A new ladder, new relics,\nand the next chapter.', { size: 25, font: 'body', color: '#e8dcf0', wrap: 380 }));
      B.add(new Button(vs, -235, dy + 90, 360, 118, 'GO DOWN', () => this.doDescend(), { color: 'gold', size: 36 }));
    }
    if (canRestore(s)) {
      const x = canDescend(s) ? 235 : 0;
      B.add(vs.add.nineslice(x, dy, 'panelDark', undefined, 440, 300, 70, 70, 70, 70));
      B.add(txt(vs, x, dy - 104, 'RESTORE', { size: 38, gold: true, weight: '900' }));
      // the multiplier *after* restoring, not the current one: "Gold is now ×1.00" reads as "this gives nothing"
      const next = renownGoldAt((s.renown ?? 0) + 1);
      const capped = next === renownGold(s);
      B.add(txt(vs, x, dy - 30,
        `This floor begins again.\n+1 Renown, for ever.\nGold ×${renownGold(s).toFixed(2)} → ×${next.toFixed(2)}${capped ? ' (capped)' : ''}`,
        { size: 25, font: 'body', color: '#e8dcf0', wrap: 380 }));
      B.add(new Button(vs, x, dy + 90, 360, 118, 'BEGIN AGAIN', () => this.doRestore(), { color: 'purple', size: 34 }));
    }
    B.add(txt(vs, 0, top + this.ph - 92, 'Neither door costs anything, and both stay open. Nothing you leave behind is lost.',
      { size: 24, font: 'body', color: '#8a7a98', wrap: 880 }));
  }

  private doDescend() {
    const r = descend(ctx.state, this.memento || undefined);
    if (!r.ok) return;
    this.vs.onFloorChanged('descend', r);
    this.close();
  }

  private doRestore() {
    const r = restore(ctx.state, this.memento || undefined);
    if (!r.ok) return;
    this.vs.onFloorChanged('restore', r);
    this.close();
  }
}
