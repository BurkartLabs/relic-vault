import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, money, fmt, dur, badge, Scroller } from './kit';
import { ctx } from '../GameCtx';
import { RELICS, ECON, COPY, SKUS, CHEST_ODDS, MAX_TIER } from '../data/catalog';
import { lowest, sell, sellValue, findPair } from '../systems/BoardSystem';
import { gemClear, adSalvage, QUESTS, questProgress, claimQuest, xpToNext, grantGold } from '../systems/Economy';
import { computeLuck } from '../systems/LuckSystem';
import { DAY } from '../systems/State';
import type { VaultScene } from '../scenes/VaultScene';

// ---------------------------------------------------------------- Vault Jammed
export class JammedSheet extends Modal {
  constructor(vs: VaultScene) {
    super(vs, { w: 960, h: 1400, title: 'VAULT JAMMED', offer: 'jammed' });
    this.kind = 'JammedSheet';
    const s = ctx.state, B = this.box, top = this.top;
    keeperLine(vs, B, 0, top + 120, 860, COPY.jammedLine, 120);
    const pair = findPair(s);
    let y = top + 290;
    if (pair) {
      B.add(vs.add.nineslice(0, y, 'panelBlue', undefined, 860, 120, 60, 60, 50, 50));
      B.add(txt(vs, -140, y, 'A merge is still waiting on the board!', { size: 30, font: 'body', weight: '700', color: '#8CF08A' }));
      B.add(new Button(vs, 290, y, 220, 84, 'SHOW ME', () => { this.close(); vs.tut.hintPair(pair); }, { color: 'green', size: 32 }));
      y += 150;
    }
    const lo = lowest(s, 1)[0];
    const opt = (icon: string, frame: string | undefined, title: string, sub: string, btn: Button) => {
      B.add(vs.add.nineslice(0, y + 110, 'panelDark', undefined, 880, 210, 70, 70, 70, 70));
      B.add(vs.add.image(-350, y + 110, icon, frame).setDisplaySize(130, 130));
      B.add(txt(vs, -260, y + 76, title, { size: 36, weight: '900', gold: true, origin: [0, 0.5] }));
      B.add(txt(vs, -260, y + 124, sub, { size: 24, font: 'body', color: '#b9a9c6', origin: [0, 0.5], wrap: 380 }));
      btn.setPosition(290, y + 110);
      B.add(btn);
      y += 235;
    };
    if (lo !== undefined) {
      const t = s.board[lo];
      opt('relic256', `R${t}`, 'SELL THE LOWEST', `${RELICS[t].name} · poor rate`, new Button(vs, 0, 0, 230, 96, `+${sellValue(t)}`, () => {
        this.close(); vs.sellAt(lo);
      }, { color: 'gold', size: 36, icon: 'coin', iconScale: 0.4 }));
    }
    opt('gem', undefined, 'CLEAR LOWEST 3', 'Shatter the three weakest relics for their gold', new Button(vs, 0, 0, 230, 96, String(ECON.gemClearCost), () => {
      ctx.analytics.log('gem_spend_click', { item: 'gem_clear', cost: ECON.gemClearCost });
      if (s.gems < ECON.gemClearCost) { ctx.sfx.play('error'); vs.toast('Not enough gems.'); vs.openShop('jammed', 'gems'); return; }
      const r = gemClear(s);
      if (!r.ok) return;
      this.close();
      vs.hud.tickGems();
      vs.shatterCells(r.cleared);
      ctx.persist();
    }, { color: 'blue', size: 36, icon: 'gem', iconScale: 0.45 }));
    opt('ic_ad', undefined, 'SALVAGE', 'A crier buys your weakest relic at double', new Button(vs, 0, 0, 230, 96, 'FREE', () => {
      const go = () => { const r = adSalvage(s); if (r.index >= 0) vs.shatterCells([r.index]); ctx.persist(); };
      this.close();
      if (ctx.adsSuppressed) go(); else vs.watchAd('salvage', go);
    }, { color: 'purple', size: 36, icon: 'ic_ad', iconScale: 0.45 }));
    B.add(txt(vs, 0, this.bottom - 90, 'Tip: drag relics onto the scales to sell. Merges free space too.', { size: 26, font: 'body', color: '#8a7a98', strokeW: 0 }));
  }
}

// ---------------------------------------------------------------- Inspect (long-press)
export class InspectCard extends Modal {
  constructor(vs: VaultScene, index: number) {
    const tier = ctx.state.board[index];
    super(vs, { w: 900, h: 1280, title: RELICS[tier].name.toUpperCase() });
    this.kind = 'InspectCard';
    const B = this.box, top = this.top;
    const def = RELICS[tier];
    const rays = vs.add.image(0, top + 380, 'relicGlow').setDisplaySize(700, 700).setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    const img = vs.add.image(0, top + 380, 'relic256', `R${tier}`).setDisplaySize(440, 440);
    B.add([rays, img]);
    vs.tweens.add({ targets: img, y: img.y - 14, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    vs.tweens.add({ targets: rays, angle: 360, duration: 20000, repeat: -1 });
    B.add(txt(vs, 0, top + 660, `TIER ${tier} · ${def.material.toUpperCase()}`, { size: 34, font: 'num', weight: '700', color: '#b9a9c6' }));
    B.add(txt(vs, 0, top + 760, `“${def.lore}”`, { size: 32, font: 'title', weight: '700', color: '#FFE9A3', wrap: 760 }));
    if (tier < MAX_TIER) {
      B.add(txt(vs, -80, top + 880, 'Merge two to make', { size: 28, font: 'body', color: '#b9a9c6' }));
      B.add(vs.add.image(140, top + 880, 'relic96', `i${tier + 1}`).setDisplaySize(96, 96));
    } else B.add(txt(vs, 0, top + 880, `Merge two to ASCEND: ${fmt(ECON.ascendGold)} gold + ${ECON.ascendGems} gems`, { size: 28, font: 'body', color: '#FF7AD9' }));
    B.add(new Button(vs, -200, top + 1060, 340, 120, `SELL +${sellValue(tier)}`, () => { this.close(); vs.sellAt(index); }, { color: 'red', size: 38 }));
    B.add(new Button(vs, 200, top + 1060, 340, 120, 'KEEP', () => this.close(), { color: 'gold', size: 42 }));
  }
}

// ---------------------------------------------------------------- Daily quests
export class QuestsModal extends Modal {
  constructor(vs: VaultScene) {
    super(vs, { w: 960, h: 1180, title: 'DAILY QUESTS' });
    this.kind = 'QuestsModal';
    this.build();
  }
  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = this.top;
    const now = Date.now();
    const reset = (Math.floor(now / DAY) + 1) * DAY - now;
    B.add(txt(vs, 0, top + 90, `New quests in ${dur(reset)} · never required to play`, { size: 28, font: 'body', color: '#b9a9c6' }));
    QUESTS.forEach((q, i) => {
      const y = top + 250 + i * 250;
      const prog = questProgress(s, i);
      const done = prog >= q.goal, claimed = s.quests.claimed.includes(i);
      B.add(vs.add.nineslice(0, y, done && !claimed ? 'panel' : 'panelDark', undefined, 880, 220, 70, 70, 70, 70));
      const icon = i === 0 ? vs.add.image(-350, y, 'forge').setDisplaySize(130, 130) : i === 1 ? vs.add.image(-350, y, 'relic256', 'R4').setDisplaySize(140, 140) : vs.add.image(-350, y, 'ic_chest').setDisplaySize(130, 130);
      B.add(icon);
      B.add(txt(vs, -260, y - 50, q.label, { size: 36, weight: '900', gold: true, origin: [0, 0.5] }));
      const g = vs.add.graphics();
      g.fillStyle(0x07050a).fillRoundedRect(-260, y - 10, 340, 28, 14);
      g.fillStyle(done ? 0x8cf08a : 0xf4c45a).fillRoundedRect(-260, y - 10, Math.max(28, 340 * prog / q.goal), 28, 14);
      B.add(g);
      B.add(txt(vs, -90, y + 50, `${prog}/${q.goal} · ${ECON.questGold} gold + ${ECON.questGems} gems`, { size: 26, font: 'num', weight: '500', color: '#b9a9c6' }));
      if (claimed) B.add(txt(vs, 290, y, 'DONE', { size: 40, font: 'num', weight: '700', color: '#8CF08A' }));
      else {
        const b: Button = new Button(vs, 290, y, 220, 100, 'CLAIM', () => {
          if (!claimQuest(s, i, Date.now())) return;
          ctx.sfx.play('purchase');
          const m = b.getWorldTransformMatrix();
          vs.fx.flyTo('coin', m.tx, m.ty, vs.hud.anchor('gold'), 8, (k) => { if (k === 7) vs.hud.tickGold(); });
          vs.fx.flyTo('gem', m.tx, m.ty, vs.hud.anchor('gems'), ECON.questGems, (k) => { if (k === ECON.questGems - 1) vs.hud.tickGems(); });
          ctx.persist();
          vs.hud.refresh();
          this.box.removeAll(true);
          this.build();
        }, { color: 'green', size: 36, disabled: !done });
        B.add(b);
      }
    });
  }
}

// ---------------------------------------------------------------- generic offer sheets
export class OfferSheet extends Modal {
  constructor(vs: VaultScene, kind: 'comeback' | 'doubleIt' | 'vip', trigger: string) {
    const titles = { comeback: 'SO CLOSE', doubleIt: 'DOUBLE IT?', vip: 'VAULT VIP' };
    super(vs, { w: 960, h: 1300, title: titles[kind], ribbon: kind === 'vip' ? 'ribbonPurple' : 'ribbon', offer: `${kind}:${trigger}` });
    this.kind = 'OfferSheet';
    const B = this.box, top = this.top;
    const line = kind === 'comeback' ? COPY.comebackLine : kind === 'vip' ? COPY.vipLine : COPY.doubleLine;
    keeperLine(vs, B, 0, top + 120, 860, line, 120);
    const glow = vs.add.image(0, top + 460, 'relicGlow').setDisplaySize(760, 760).setTint(kind === 'vip' ? 0xc79bff : 0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45);
    B.add(glow);
    vs.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
    if (kind === 'comeback') {
      const r = vs.add.image(0, top + 440, 'relic256', 'R5').setDisplaySize(340, 340);
      B.add(r);
      vs.tweens.add({ targets: r, y: r.y - 14, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      B.add(txt(vs, 0, top + 650, 'EMERALD SCARAB', { size: 44, weight: '900', gold: true }));
      this.items(top + 770, [['gem', '60'], ['coin', '1,500']]);
      const b = new Button(vs, 0, top + 1020, 520, 140, money(SKUS.comeback.price), () => { vs.buy('comeback', `comeback:${trigger}`); this.close(); }, { color: 'green', size: 56 });
      B.add(b);
      B.add(badge(vs, 320, top + 980, 'SALE', 'red', 130));
      B.add(txt(vs, 0, top + 1140, 'One time. Not a cent more.', { size: 26, font: 'body', color: '#8a7a98', strokeW: 0 }));
    } else if (kind === 'vip') {
      B.add(vs.add.image(0, top + 420, 'crown').setDisplaySize(300, 300));
      const perks = ['Daily crate: free Lucky Chest + 5 gems', '+2% luck on every forge and chest', 'A crown on your medallion', 'No interstitials, no banner, free wheel spins without ads'];
      perks.forEach((p, i) => {
        B.add(vs.add.image(-360, top + 640 + i * 70, 'ic_luck').setDisplaySize(48, 48));
        B.add(txt(vs, -320, top + 640 + i * 70, p, { size: 28, font: 'body', weight: '700', color: '#e8dcf0', origin: [0, 0.5] }));
      });
      B.add(new Button(vs, 0, top + 1040, 520, 140, `${money(SKUS.vip.price)} / MONTH`, () => { vs.buy('vip', `vip:${trigger}`); this.close(); }, { color: 'purple', size: 46 }));
      B.add(txt(vs, 0, top + 1160, 'Demo subscription. Cancel anytime in your store account.', { size: 22, font: 'body', color: '#8a7a98', strokeW: 0 }));
    } else {
      B.add(vs.add.image(0, top + 430, 'ic_ad').setDisplaySize(260, 260));
      B.add(txt(vs, 0, top + 640, 'Watch one more, double the gold.', { size: 36, weight: '900', gold: true }));
      B.add(new Button(vs, 0, top + 820, 560, 130, 'DOUBLE IT', () => {
        this.close();
        vs.watchAd('double_it', () => {
          const n = 150;
          grantGold(ctx.state, n);
          const bc = vs.boardCenter;
          vs.fx.flyTo('coin', bc.x, bc.y, vs.hud.anchor('gold'), 10, (k) => { if (k === 9) vs.hud.tickGold(); });
          vs.toast(`Doubled: +${n} gold`);
        });
      }, { color: 'purple', size: 46, icon: 'ic_ad', iconScale: 0.55 }));
      B.add(new Button(vs, 0, top + 1000, 560, 120, 'OR SKIP THE ADS: SHOP', () => { this.close(); vs.openShop(`double_it:${trigger}`, 'best'); }, { color: 'gold', size: 34 }));
    }
  }
  private items(y: number, list: [string, string][]) {
    list.forEach(([k, n], i) => {
      const x = (i - (list.length - 1) / 2) * 320;
      this.box.add(this.vs.add.nineslice(x, y, 'panelDark', undefined, 280, 130, 60, 60, 56, 56));
      this.box.add(this.vs.add.image(x - 70, y, k).setDisplaySize(90, 90));
      this.box.add(txt(this.vs, x + 40, y, n, { size: 46, font: 'num', weight: '700', color: k === 'gem' ? '#7EE0FF' : '#FFE9A3' }));
    });
  }
}

// ---------------------------------------------------------------- rank
export class RankInfo extends Modal {
  constructor(vs: VaultScene) {
    super(vs, { w: 900, h: 1060, title: 'VAULT RANK' });
    this.kind = 'RankInfo';
    const s = ctx.state, B = this.box, top = this.top;
    const aura = vs.add.image(0, top + 300, 'relicGlow').setDisplaySize(600, 600).setTint(0x7ee0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    B.add([aura, vs.add.image(0, top + 300, 'medallion').setDisplaySize(340, 340), txt(vs, 0, top + 304, String(s.rank), { size: 120, font: 'num', weight: '700', gold: true })]);
    if (s.ent.vip) B.add(vs.add.image(0, top + 130, 'crown').setDisplaySize(130, 130));
    B.add(txt(vs, 0, top + 540, `${s.xp} / ${xpToNext(s.rank)} XP to rank ${s.rank + 1}`, { size: 36, font: 'num', weight: '700', color: '#7EE0FF' }));
    B.add(txt(vs, 0, top + 640, `Every rank: +${ECON.rankGems} gems and a brighter medallion.\nRanks raise your luck a little, up to rank 10.`, { size: 30, font: 'body', color: '#e8dcf0', wrap: 760 }));
    B.add(txt(vs, 0, top + 790, `Current luck ${(computeLuck(s) * 100).toFixed(1)}%`, { size: 36, font: 'num', weight: '700', color: '#8CF08A' }));
    B.add(txt(vs, 0, top + 900, 'Rank is cosmetic power. It never gates play.', { size: 26, font: 'body', color: '#8a7a98', strokeW: 0 }));
  }
}

// ---------------------------------------------------------------- keeper dialog (onboarding lines)
export class KeeperDialog extends Modal {
  constructor(vs: VaultScene, line: string, onDone?: () => void) {
    super(vs, { w: 920, h: 560, closable: false, panelKey: 'panelDark', dim: 0.35 });
    this.kind = 'KeeperDialog';
    this.frame.y = vs.H * 0.3;
    const B = this.box;
    const k = vs.add.image(-300, -40, 'keeper').setDisplaySize(240, 240);
    B.add(k);
    const t = txt(vs, 110, -60, line, { size: 44, weight: '900', gold: true, wrap: 520 });
    B.add(t);
    const cont = txt(vs, 110, 140, 'tap to continue', { size: 28, font: 'body', color: '#b9a9c6' });
    B.add(cont);
    vs.tweens.add({ targets: cont, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.onClosed = onDone;
    // never block input for more than 1.2s: dismiss on any tap, auto-arm immediately
    const dismiss = () => this.close();
    vs.time.delayedCall(250, () => { this.dimmer.on('pointerup', dismiss); (this.frame.list[0] as Phaser.GameObjects.NineSlice).on('pointerup', dismiss); });
  }
}

// ---------------------------------------------------------------- plain info
export class InfoSheet extends Modal {
  constructor(vs: VaultScene, title: string, body: string, back?: () => void) {
    super(vs, { w: 940, h: 1400, title, panelKey: 'panelDark' });
    this.kind = 'InfoSheet';
    const sc = new Scroller(vs, this.box, -430, this.top + 70, 860, this.ph - 260);
    const t = txt(vs, 430, 10, body, { size: 30, font: 'body', color: '#e8dcf0', wrap: 820, align: 'left', origin: [0.5, 0], lineSpacing: 6 });
    sc.content.add(t);
    sc.setContentHeight(t.height + 40);
    if (back) this.box.add(new Button(vs, 0, this.bottom - 110, 360, 110, 'BACK', () => { this.close(); vs.time.delayedCall(220, back); }, { color: 'dark', size: 40 }));
  }
}

// ---------------------------------------------------------------- chest odds panel
export class OddsModal extends Modal {
  constructor(vs: VaultScene, back?: () => void) {
    super(vs, { w: 920, h: 1320, title: 'CHEST ODDS', ribbon: 'ribbonBlue', panelKey: 'panelBlue' });
    this.kind = 'OddsModal';
    const B = this.box, top = this.top;
    B.add(txt(vs, 0, top + 90, 'Lucky Chest · disclosed before you spend', { size: 30, font: 'body', color: '#b9a9c6' }));
    CHEST_ODDS.forEach((o, i) => {
      const y = top + 210 + i * 150;
      B.add(vs.add.nineslice(0, y, 'panelDark', undefined, 820, 136, 60, 60, 56, 56));
      B.add(vs.add.image(-320, y, 'relic96', `i${o.tier}`).setDisplaySize(110, 110));
      B.add(txt(vs, -240, y, RELICS[o.tier].name, { size: 36, weight: '900', gold: true, origin: [0, 0.5] }));
      const g = vs.add.graphics();
      g.fillStyle(0x07050a).fillRoundedRect(110, y - 14, 200, 28, 14);
      g.fillStyle(RELICS[o.tier].color).fillRoundedRect(110, y - 14, Math.max(20, 200 * o.chance / 0.45), 28, 14);
      B.add(g);
      B.add(txt(vs, 370, y, `${Math.round(o.chance * 100)}%`, { size: 44, font: 'num', weight: '700' }));
    });
    B.add(txt(vs, 0, top + 1000, `Pity: every ${ECON.pityEvery}th chest without a Gold Mask or better guarantees one.\nYour counter: ${ctx.state.pity}/${ECON.pityEvery - 1}. Luck may upgrade any result by one tier.`, { size: 26, font: 'body', color: '#8CF08A', wrap: 820 }));
    if (back) B.add(new Button(vs, 0, this.bottom - 100, 360, 110, 'BACK', () => { this.close(); vs.time.delayedCall(220, back); }, { color: 'dark', size: 40 }));
  }
}

export { sell };
