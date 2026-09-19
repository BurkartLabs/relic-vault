import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, dur, fmt, Scroller } from './kit';
import { ctx } from '../GameCtx';
import { EVENT_MILESTONES, ECON, COPY } from '../data/catalog';
import { claimEvent, fakeGlobalRank, buyBoost } from '../systems/Economy';
import { eventEndsAt } from '../systems/State';
import { rewardVisual } from './PassRoad';
import type { VaultScene } from '../scenes/VaultScene';

export class EventPanel extends Modal {
  private timerT!: Phaser.GameObjects.Text;
  private ev?: Phaser.Time.TimerEvent;
  constructor(vs: VaultScene, private trigger: string, private boostFocus = false) {
    super(vs, { w: 1020, h: 1680, title: 'GOLD RUSH', offer: boostFocus ? `boost:${trigger}` : undefined });
    this.kind = 'EventPanel';
    this.build();
    this.ev = vs.time.addEvent({ delay: 1000, loop: true, callback: () => this.tick() });
    this.once('destroy', () => this.ev?.remove());
  }

  private tick() {
    const now = Date.now();
    this.timerT?.setText(`Ends in ${dur(eventEndsAt(now) - now)}`);
  }

  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = this.top;
    const now = Date.now();
    const left = eventEndsAt(now) - now;
    // banner art
    const hero = vs.add.container(0, top + 170);
    hero.add(vs.add.image(0, 0, 'relicGlow').setDisplaySize(700, 360).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45));
    hero.add(vs.add.image(-300, 0, 'ic_events').setDisplaySize(190, 190));
    for (let k = 0; k < 7; k++) hero.add(vs.add.image(-180 + k * 26, 60 - (k % 3) * 18, 'coin').setDisplaySize(60, 60).setAngle(k * 23));
    hero.add(txt(vs, 90, -64, fmt(s.event.points), { size: 96, font: 'num', weight: '700', gold: true }));
    hero.add(txt(vs, 90, 6, 'RUSH POINTS', { size: 30, weight: '900', color: '#b9a9c6' }));
    hero.add(txt(vs, 90, 58, `Global rank #${fmt(fakeGlobalRank(s.event.points))}`, { size: 34, font: 'num', weight: '700', color: '#8CF08A' }));
    this.timerT = txt(vs, 90, 102, '', { size: 28, font: 'num', weight: '500', color: '#FF5D6C' });
    hero.add(this.timerT);
    B.add(hero);
    this.tick();
    B.add(txt(vs, 0, top + 320, 'Every merge scores. Bigger relics score more. It never stops.', { size: 26, font: 'body', color: '#e8dcf0' }));

    // boost (last 48h)
    const boosted = s.event.boostUntil > now;
    const boostY = top + 420;
    if (left < 48 * 3600000 || boosted) {
      const plate = vs.add.nineslice(0, boostY, 'panelBlue', undefined, 920, 150, 70, 70, 70, 70);
      const ic = vs.add.image(-380, boostY, 'ic_boost').setDisplaySize(110, 110);
      B.add([plate, ic]);
      vs.tweens.add({ targets: ic, scale: ic.scale * 1.1, duration: 400, yoyo: true, repeat: -1 });
      if (boosted) {
        B.add(txt(vs, 20, boostY, `x2 POINTS ACTIVE · ${dur(s.event.boostUntil - now)} left`, { size: 36, font: 'num', weight: '700', color: '#FFB03A' }));
      } else {
        B.add(txt(vs, -320, boostY - 26, 'x2 RUSH BOOST', { size: 36, weight: '900', gold: true, origin: [0, 0.5] }));
        B.add(txt(vs, -320, boostY + 24, `${ECON.boostMinutes} min of double points`, { size: 24, font: 'body', color: '#b9a9c6', origin: [0, 0.5] }));
        const b = new Button(vs, 300, boostY, 240, 100, String(ECON.boostGemCost), () => this.boost(), { color: 'red', size: 40, icon: 'gem', iconScale: 0.46 });
        B.add(b);
        if (this.boostFocus) vs.tweens.add({ targets: b, scale: 1.1, duration: 300, yoyo: true, repeat: 3 });
      }
      if (this.boostFocus && !boosted) keeperLine(vs, B, 0, boostY + 150, 900, COPY.boostLine, 100);
    }

    // milestone ladder
    const ly = top + (this.boostFocus ? 640 : 540);
    const sc = new Scroller(vs, this.box, -470, ly, 940, this.ph / 2 - ly - 40);
    const C = sc.content;
    let reached = 0;
    EVENT_MILESTONES.forEach((m, i) => {
      const y = 20 + i * 190 + 85;
      const got = s.event.points >= m.pts;
      if (got) reached++;
      const claimed = s.event.claimed.includes(i);
      C.add(vs.add.nineslice(470, y, got && !claimed ? 'panel' : 'panelDark', undefined, 920, 176, 64, 64, 64, 64));
      C.add(txt(vs, 70, y, String(i + 1), { size: 56, font: 'num', weight: '700', gold: got }));
      C.add(rewardVisual(vs, m.reward, 220, y - 6, 92));
      const pct = Math.min(1, s.event.points / m.pts);
      const g = vs.add.graphics();
      g.fillStyle(0x07050a).fillRoundedRect(320, y - 12, 320, 24, 12);
      g.fillStyle(got ? 0x8cf08a : 0xf4c45a).fillRoundedRect(320, y - 12, Math.max(24, 320 * pct), 24, 12);
      C.add(g);
      C.add(txt(vs, 480, y - 44, `${fmt(Math.min(s.event.points, m.pts))} / ${fmt(m.pts)}`, { size: 26, font: 'num', weight: '500', color: '#b9a9c6' }));
      if (claimed) C.add(txt(vs, 790, y, 'CLAIMED', { size: 30, font: 'num', weight: '700', color: '#8CF08A' }));
      else if (got) {
        const cb: Button = new Button(vs, 790, y, 200, 90, 'CLAIM', () => {
          const gr = claimEvent(s, i, ctx.rng);
          if (!gr) return;
          ctx.sfx.play('purchase');
          const mm = cb.getWorldTransformMatrix();
          vs.showGrant(gr, { x: mm.tx, y: mm.ty });
          ctx.analytics.log('event_claim', { milestone: i });
          this.box.removeAll(true);
          this.build();
          vs.time.delayedCall(800, () => vs.maybeInterstitial('event_claim'));
        }, { color: 'green', size: 34, guard: sc.inView });
        C.add(cb);
      } else C.add(vs.add.image(790, y, 'ic_lock').setDisplaySize(70, 70).setAlpha(0.6));
    });
    sc.setContentHeight(20 + EVENT_MILESTONES.length * 190 + 40);
    sc.scrollTo(Math.max(0, (reached - 1) * 190));
  }

  private boost() {
    const vs = this.vs, s = ctx.state;
    ctx.analytics.log('gem_spend_click', { item: 'boost', cost: ECON.boostGemCost, trigger: this.trigger });
    if (s.gems < ECON.boostGemCost) { ctx.sfx.play('error'); vs.toast('Not enough gems.'); vs.openShop('boost', 'gems'); return; }
    if (!buyBoost(s, Date.now())) return;
    ctx.sfx.play('purchase');
    vs.hud.tickGems();
    ctx.persist();
    this.boostFocus = false;
    this.box.removeAll(true);
    this.build();
  }
}
