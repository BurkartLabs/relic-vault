import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { pill, txt, fmt, dur, hotImage } from './kit';
import { xpToNext, QUESTS, questProgress } from '../systems/Economy';
import { eventEndsAt } from '../systems/State';
import { ECON } from '../data/catalog';
import type { VaultScene } from '../scenes/VaultScene';

/** Always-visible top HUD. All currency art is illustrated. */
export class Hud extends Phaser.GameObjects.Container {
  goldText: Phaser.GameObjects.Text;
  gemText: Phaser.GameObjects.Text;
  rankText: Phaser.GameObjects.Text;
  piggyText: Phaser.GameObjects.Text;
  eventText: Phaser.GameObjects.Text;
  eventPts: Phaser.GameObjects.Text;
  goldIcon: Phaser.GameObjects.Image;
  gemIcon: Phaser.GameObjects.Image;
  pig: Phaser.GameObjects.Image;
  medal: Phaser.GameObjects.Container;
  crown: Phaser.GameObjects.Image;
  xpBar: Phaser.GameObjects.Graphics;
  questDot: Phaser.GameObjects.Container;
  ticket: Phaser.GameObjects.Container;
  shownGold = 0;
  shownGems = 0;
  private goldTween?: Phaser.Tweens.Tween;
  private gemTween?: Phaser.Tweens.Tween;
  private medalAura: Phaser.GameObjects.Image;
  private lastJiggle = 0;
  private baseScale: Record<string, number> = {};

  constructor(private vs: VaultScene, x: number, y: number) {
    super(vs, x, y);
    const s = ctx.state;
    this.setDepth(40);

    // --- rank medallion
    this.medal = vs.add.container(100, 96);
    this.medalAura = vs.add.image(0, 0, 'relicGlow').setDisplaySize(260, 260).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35);
    const m = vs.add.image(0, 0, 'medallion').setDisplaySize(176, 176);
    this.rankText = txt(vs, 0, 2, String(s.rank), { size: 58, font: 'num', weight: '700', gold: true, strokeW: 6 });
    this.xpBar = vs.add.graphics();
    this.crown = vs.add.image(0, -86, 'crown').setDisplaySize(70, 70).setVisible(s.ent.vip);
    this.medal.add([this.medalAura, this.xpBar, m, this.rankText, this.crown]);
    this.add(this.medal);
    hotImage(vs, m, () => vs.showRankInfo());

    // --- gold pill
    const gx = 330;
    this.add(pill(vs, gx, 70, 250));
    this.goldIcon = vs.add.image(gx - 118, 68, 'coin').setDisplaySize(86, 86);
    this.goldText = txt(vs, gx + 14, 70, fmt(s.gold), { size: 46, font: 'num', weight: '700' });
    this.add([this.goldIcon, this.goldText]);
    // --- gem pill w/ plus
    const mx = 610;
    this.add(pill(vs, mx, 70, 250));
    this.gemIcon = vs.add.image(mx - 118, 66, 'gem').setDisplaySize(86, 86);
    this.gemText = txt(vs, mx + 4, 70, fmt(s.gems), { size: 46, font: 'num', weight: '700' });
    const plus = vs.add.image(mx + 110, 70, 'btn_green').setDisplaySize(62, 56);
    const plusT = txt(vs, mx + 110, 64, '+', { size: 48, font: 'num', weight: '700' });
    this.add([this.gemIcon, this.gemText, plus, plusT]);
    plus.setInteractive({ useHandCursor: true }).on('pointerup', () => { ctx.sfx.play('tick'); vs.openShop('hud_plus', 'gems'); });

    // --- piggy idol
    this.pig = vs.add.image(850, 76, 'pig').setDisplaySize(150, 150);
    this.piggyText = txt(vs, 866, 148, '', { size: 30, font: 'num', weight: '700', color: '#FFE9A3' });
    this.add(vs.add.image(826, 148, 'coin').setDisplaySize(34, 34));
    this.add([this.pig, this.piggyText]);
    hotImage(vs, this.pig, () => vs.openPiggy('hud'));

    // --- gear
    const gear = vs.add.image(1008, 72, 'ic_gear').setDisplaySize(92, 92);
    this.add(gear);
    hotImage(vs, gear, () => vs.openSettings());

    // --- event ticket (row 2)
    this.ticket = vs.add.container(430, 200);
    const tp = pill(vs, 0, 0, 440, 88);
    const troph = vs.add.image(-190, -4, 'ic_events').setDisplaySize(96, 96);
    const title = txt(vs, -130, -16, 'GOLD RUSH', { size: 28, font: 'title', weight: '900', gold: true, origin: [0, 0.5], strokeW: 4 });
    this.eventText = txt(vs, -130, 18, '', { size: 26, font: 'num', weight: '500', color: '#b9a9c6', origin: [0, 0.5], strokeW: 3 });
    this.eventPts = txt(vs, 196, 0, '', { size: 34, font: 'num', weight: '700', color: '#FFE9A3', origin: [1, 0.5] });
    this.ticket.add([tp, troph, title, this.eventText, this.eventPts]);
    this.ticket.setSize(440, 88).setInteractive({ useHandCursor: true }).on('pointerup', () => { ctx.sfx.play('tick'); vs.openEvents('hud'); });
    this.add(this.ticket);

    // --- quests + wheel
    const q = vs.add.image(736, 204, 'ic_scroll').setDisplaySize(100, 100);
    const w = vs.add.image(1000, 206, 'ic_wheel').setDisplaySize(100, 100);
    this.questDot = vs.add.container(776, 168);
    this.questDot.add([vs.add.image(0, 0, 'seal_red').setDisplaySize(44, 44), txt(vs, 0, 0, '!', { size: 28, font: 'num', weight: '700' })]);
    this.add([q, w, this.questDot]);
    hotImage(vs, q, () => vs.openQuests());
    hotImage(vs, w, () => vs.openWheel('hud'));
    vs.tweens.add({ targets: w, angle: 360, duration: 12000, repeat: -1 });

    this.shownGold = s.gold;
    this.shownGems = s.gems;
    vs.add.existing(this);
    this.refresh(true);
  }

  anchor(which: 'gold' | 'gems' | 'piggy' | 'rank' | 'event' | 'quests') {
    const m = this.getWorldTransformMatrix();
    const local = { gold: [212, 68], gems: [492, 66], piggy: [850, 76], rank: [100, 96], event: [240, 200], quests: [736, 204] }[which];
    return { x: m.tx + local[0], y: m.ty + local[1] };
  }

  bump(which: 'gold' | 'gems' | 'piggy' | 'rank') {
    const target = which === 'gold' ? this.goldIcon : which === 'gems' ? this.gemIcon : which === 'piggy' ? this.pig : this.medal;
    // base scale is captured once; re-reading it mid-tween compounds into a screen-filling coin
    const base = (this.baseScale[which] ??= which === 'rank' ? 1 : (target as Phaser.GameObjects.Image).scaleX);
    if (which === 'piggy') return; // the pig's size encodes fill; it jiggles instead
    this.vs.tweens.killTweensOf(target);
    target.setScale(base * 1.25);
    this.vs.tweens.add({ targets: target, scale: base, duration: 220, ease: 'Back.Out' });
  }

  /** Count-up display so coin fountains feel like they fill the pill. */
  tickGold(to = ctx.state.gold) {
    this.goldTween?.stop();
    const o = { v: this.shownGold };
    this.goldTween = this.vs.tweens.add({ targets: o, v: to, duration: 420, ease: 'Cubic.Out', onUpdate: () => { this.shownGold = o.v; this.goldText.setText(fmt(o.v)); } });
  }
  tickGems(to = ctx.state.gems) {
    this.gemTween?.stop();
    const o = { v: this.shownGems };
    this.gemTween = this.vs.tweens.add({ targets: o, v: to, duration: 420, ease: 'Cubic.Out', onUpdate: () => { this.shownGems = o.v; this.gemText.setText(fmt(o.v)); } });
  }

  refresh(instant = false) {
    const s = ctx.state;
    if (instant) {
      this.shownGold = s.gold; this.shownGems = s.gems;
      this.goldText.setText(fmt(s.gold)); this.gemText.setText(fmt(s.gems));
    }
    this.rankText.setText(String(s.rank));
    this.crown.setVisible(s.ent.vip);
    // xp ring
    const p = s.xp / xpToNext(s.rank);
    this.xpBar.clear();
    this.xpBar.lineStyle(14, 0x07050a, 0.9).beginPath().arc(0, 0, 80, 0, Math.PI * 2).strokePath();
    this.xpBar.lineStyle(10, 0x7ee0ff, 1).beginPath().arc(0, 0, 80, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * p).strokePath();
    // piggy swell
    const fill = Math.min(1, s.piggy / ECON.piggyCap);
    this.pig.setDisplaySize(130 + fill * 40, 130 + fill * 40);
    this.piggyText.setText(fmt(s.piggy));
    this.piggyText.setColor(s.piggy >= ECON.piggyNagAt ? '#8CF08A' : '#FFE9A3');
    // quests badge
    const claimable = QUESTS.some((q) => questProgress(s, q.id) >= q.goal && !s.quests.claimed.includes(q.id));
    this.questDot.setVisible(claimable);
    this.medalAura.setAlpha(0.25 + Math.min(0.5, s.rank * 0.03));
  }

  /** once a second */
  tick(now: number) {
    const s = ctx.state;
    this.eventText.setText('ends in ' + dur(eventEndsAt(now) - now));
    this.eventPts.setText(fmt(s.event.points));
    if (s.piggy >= ECON.piggyNagAt && now - this.lastJiggle > 90000) {
      this.lastJiggle = now;
      this.jiggle();
    }
  }

  jiggle() {
    const base = this.pig.scaleX;
    this.vs.tweens.chain({
      targets: this.pig,
      tweens: [
        { angle: -14, scaleY: base * 1.1, duration: 90 }, { angle: 12, duration: 90 }, { angle: -9, duration: 90 },
        { angle: 6, duration: 90 }, { angle: 0, scaleY: base, duration: 120 },
      ],
    });
    ctx.sfx.play('coin', 3);
  }

  rankUpFx() {
    const a = this.anchor('rank');
    this.vs.fx.ring(a.x, a.y, 0x7ee0ff, 2.2, 700);
    this.vs.fx.burst(a.x, a.y, 30, 0x7ee0ff);
    this.bump('rank');
  }
}
