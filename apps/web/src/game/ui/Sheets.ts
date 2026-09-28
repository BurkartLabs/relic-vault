import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, fmt, dur, badge, Scroller } from './kit';
import { priceLabel } from '../systems/Prices'; // AB#4725: the store's price in a Play build
import { storeCopy } from '../buildMode';
import { keeperLayout } from './keeperLayout';
import { ctx } from '../GameCtx';
import { RELICS, ECON, COPY, SKUS, GEM_CHEST_ODDS, EARNED_CHEST_ODDS, CHEST_PITY_TIER, MAX_TIER } from '../data/catalog';
import { lowest, sell, sellValue, findPair } from '../systems/BoardSystem';
import { gemClear, QUESTS, questProgress, claimQuest, questPowerUpDue, xpToNext, grantGold } from '../systems/Economy';
import { computeLuck } from '../systems/LuckSystem';
import { DAY } from '../systems/State';
import type { VaultScene } from '../scenes/VaultScene';
import { CHAINS, ITEMS, BINDINGS, itemId, chainOf, tierOf, isTop } from '../data/items';
import { genUpgradeCost, upgradeGenerator } from '../systems/Economy';
import { GEN_MAX_LEVEL } from '../data/items';

// ---------------------------------------------------------------- Vault Jammed
/*
 * JammedSheet lived here: a full board opened a sheet offering to sell the lowest relic, gem-clear three, or
 * watch an ad for a salvage. The Board removed it on 2026-09-20 - if the board is full, the player can almost
 * always merge two like relics and find them unaided, so the sheet answered a question nobody had and
 * interrupted the one moment they were already reacting to. A full board now shows a line that fades
 * (COPY.boardFull) and nothing else. Vault Jammed was also the only offer a minor could ever see; with it gone,
 * minors are sold nothing at all.
 */
export class InspectCard extends Modal {
  constructor(vs: VaultScene, index: number) {
    const tier = ctx.state.board[index]; // item id
    super(vs, { w: 900, h: 1280, title: ITEMS[tier].name.toUpperCase() });
    this.kind = 'InspectCard';
    const B = this.box, top = this.top;
    const def = ITEMS[tier];
    const rays = vs.add.image(0, top + 380, 'relicGlow').setDisplaySize(700, 700).setTint(def.color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
    const img = vs.add.image(0, top + 380, 'relic256', `R${tier}`).setDisplaySize(440, 440);
    B.add([rays, img]);
    vs.tweens.add({ targets: img, y: img.y - 14, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    vs.tweens.add({ targets: rays, angle: 360, duration: 20000, repeat: -1 });
    B.add(txt(vs, 0, top + 660, `${CHAINS[chainOf(tier)].name.toUpperCase()} · TIER ${tierOf(tier)} · ${def.material.toUpperCase()}`, { size: 34, font: 'num', weight: '700', color: '#b9a9c6' }));
    B.add(txt(vs, 0, top + 760, `“${def.lore}”`, { size: 32, font: 'title', weight: '700', color: '#FFE9A3', wrap: 760 }));
    if (!isTop(tier)) {
      const bind = BINDINGS[tier + 1];
      B.add(txt(vs, bind ? -170 : -80, top + 880, 'Merge two to make', { size: 28, font: 'body', color: '#b9a9c6' }));
      B.add(vs.add.image(bind ? 40 : 140, top + 880, 'relic96', `i${tier + 1}`).setDisplaySize(96, 96));
      if (bind) {
        B.add(txt(vs, 120, top + 880, '+', { size: 44, font: 'num', weight: '700', color: '#FFE9A3' }));
        B.add(vs.add.image(200, top + 880, 'relic96', `i${bind}`).setDisplaySize(84, 84));
        B.add(vs.add.image(200, top + 830, 'ic_link').setDisplaySize(44, 44));
        B.add(txt(vs, 0, top + 950, `Binding: one ${ITEMS[bind].name} on the board is consumed`, { size: 24, font: 'body', color: '#7EE0FF' }));
      }
    } else B.add(txt(vs, 0, top + 880, 'Merge two to ASCEND: a jackpot of gold and gems', { size: 28, font: 'body', color: '#FF7AD9' }));
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
    // AB#382: the day's first claim also gives an Auto-Merge, said up front and only while it is still to come
    if (questPowerUpDue(s, now)) B.add(txt(vs, 0, top + 140, 'The first quest you claim today also gives a free Auto-Merge.', { size: 26, font: 'body', color: '#8CF08A' }));
    QUESTS.forEach((q, i) => {
      const y = top + 290 + i * 250; // AB#382: 40 lower, so the free Auto-Merge line above the first card is not under it
      const prog = questProgress(s, i);
      const done = prog >= q.goal, claimed = s.quests.claimed.includes(i);
      B.add(vs.add.nineslice(0, y, done && !claimed ? 'panel' : 'panelDark', undefined, 880, 220, 70, 70, 70, 70));
      const icon = i === 0 ? vs.add.image(-350, y, 'forge').setDisplaySize(130, 130) : i === 1 ? vs.add.image(-350, y, 'relic256', 'R4').setDisplaySize(140, 140) : vs.add.image(-350, y, 'patron0').setDisplaySize(130, 130);
      B.add(icon);
      B.add(txt(vs, -260, y - 50, q.label, { size: 36, weight: '900', gold: true, origin: [0, 0.5] }));
      const g = vs.add.graphics();
      g.fillStyle(0x07050a).fillRoundedRect(-260, y - 10, 340, 28, 14);
      g.fillStyle(done ? 0x8cf08a : 0xf4c45a).fillRoundedRect(-260, y - 10, Math.max(28, 340 * prog / q.goal), 28, 14);
      B.add(g);
      B.add(txt(vs, -90, y + 50, `${prog}/${q.goal} · ${ECON.questGold} gold + ${ECON.questGems} gems + ${ECON.questPassXp} pass XP`, { size: 26, font: 'num', weight: '500', color: '#b9a9c6' }));
      if (claimed) B.add(txt(vs, 290, y, 'DONE', { size: 40, font: 'num', weight: '700', color: '#8CF08A' }));
      else {
        const b: Button = new Button(vs, 290, y, 220, 100, 'CLAIM', () => {
          const powerUp = questPowerUpDue(s, Date.now());
          if (!claimQuest(s, i, Date.now())) return;
          if (powerUp) vs.toast(`+${ECON.questAutoMerges} Auto-Merge: use it from the Shop's Power-ups.`);
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
      const b = new Button(vs, 0, top + 1020, 520, 140, priceLabel('comeback'), () => { vs.buy('comeback', `comeback:${trigger}`); this.close(); }, { color: 'green', size: 56 });
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
      B.add(new Button(vs, 0, top + 1040, 520, 140, `${priceLabel('vip')} / MONTH`, () => { vs.buy('vip', `vip:${trigger}`); this.close(); }, { color: 'purple', size: 46 }));
      B.add(txt(vs, 0, top + 1160, storeCopy().vipSheet, { size: 22, font: 'body', color: '#8a7a98', strokeW: 0 }));
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
    // Bug #2036: the hint goes below the line as it actually wrapped, not at a fixed y the line can run over; a line
    // too long even for that is set smaller until it fits (setText re-applies the gold fill for the new height).
    let size = 44;
    let at = keeperLayout(t.height, cont.height);
    while (!at.fits && size > 30) {
      size -= 4;
      t.setFontSize(size).setStroke('#2a1402', Math.round(size / 7)).setText(line);
      at = keeperLayout(t.height, cont.height);
    }
    t.setY(at.msgY);
    cont.setY(at.hintY);
    vs.tweens.add({ targets: cont, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    this.onClosed = onDone;
    // never block input for more than 1.2s: dismiss on any tap, auto-arm immediately
    const dismiss = () => this.close();
    // closed within the 250 ms (another modal, a programmatic close): the dimmer is gone, and a throw here
    // would stop Phaser's game loop for good
    vs.time.delayedCall(250, () => {
      if (!this.dimmer?.active) return;
      this.dimmer.on('pointerup', dismiss);
      (this.frame.list[0] as Phaser.GameObjects.NineSlice | undefined)?.on('pointerup', dismiss);
    });
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
    // The shop sells the gem chest, so this is its table (AB#380); earned chests are one line below and in full
    // under Settings > Odds & Disclosures.
    B.add(txt(vs, 0, top + 90, `Lucky Chest for ${ECON.chestGemCost} gems · disclosed before you spend`, { size: 30, font: 'body', color: '#b9a9c6' }));
    GEM_CHEST_ODDS.forEach((o, i) => {
      const y = top + 210 + i * 150;
      B.add(vs.add.nineslice(0, y, 'panelDark', undefined, 820, 136, 60, 60, 56, 56));
      B.add(vs.add.image(-320, y, 'relic96', `i${o.tier}`).setDisplaySize(110, 110));
      B.add(txt(vs, -240, y, RELICS[o.tier].name, { size: 36, weight: '900', gold: true, origin: [0, 0.5] }));
      const g = vs.add.graphics();
      g.fillStyle(0x07050a).fillRoundedRect(110, y - 14, 200, 28, 14);
      g.fillStyle(RELICS[o.tier].color).fillRoundedRect(110, y - 14, Math.max(20, 200 * o.chance / Math.max(...GEM_CHEST_ODDS.map((x) => x.chance))), 28, 14);
      B.add(g);
      B.add(txt(vs, 370, y, `${Math.round(o.chance * 100)}%`, { size: 44, font: 'num', weight: '700' }));
    });
    // Follows the rows, so a table of any length has no gap under it (a fixed top + 1000 left one under four rows).
    const below = top + 210 + GEM_CHEST_ODDS.length * 150 + 40;
    B.add(txt(vs, 0, below, `Pity: every ${ECON.pityEvery}th chest without a ${RELICS[CHEST_PITY_TIER].name} or better guarantees one.\nYour counter: ${ctx.state.pity}/${ECON.pityEvery - 1}. Luck may upgrade any result by one tier.`, { size: 26, font: 'body', color: '#8CF08A', wrap: 820 }));
    const earned = EARNED_CHEST_ODDS.map((o) => `${RELICS[o.tier].name} ${Math.round(o.chance * 100)}%`).join(' · ');
    B.add(txt(vs, 0, below + 100, `Chests you earn roll differently: ${earned}.`, { size: 22, font: 'body', color: '#b9a9c6', wrap: 820 }));
    if (back) B.add(new Button(vs, 0, this.bottom - 100, 360, 110, 'BACK', () => { this.close(); vs.time.delayedCall(220, back); }, { color: 'dark', size: 40 }));
  }
}

export { sell };

// ---------------------------------------------------------------- generator (RV-D3)
export class GeneratorSheet extends Modal {
  constructor(vs: VaultScene, private chain: number) {
    super(vs, { w: 980, h: 1420, title: CHAINS[chain].gen.toUpperCase(), panelKey: chain === 2 ? 'panelBlue' : 'panelDark' });
    this.kind = 'GeneratorSheet';
    this.build();
  }
  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = this.top, c = CHAINS[this.chain];
    const lvl = s.gens[this.chain] ?? 0;
    B.add(vs.add.image(0, top + 250, 'relicGlow').setDisplaySize(620, 620).setTint(c.color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45));
    B.add(vs.add.image(0, top + 250, this.chain === 0 ? 'forge' : `gen${this.chain}`).setDisplaySize(330, 330));
    B.add(txt(vs, 0, top + 450, c.genBlurb, { size: 30, font: 'title', weight: '700', color: '#FFE9A3', wrap: 820 }));
    if (lvl <= 0) {
      B.add(vs.add.image(0, top + 250, 'ic_lock').setDisplaySize(150, 150));
      B.add(txt(vs, 0, top + 540, `Wakes at Vault Rank ${c.unlockRank}`, { size: 40, weight: '900', gold: true }));
    } else {
      B.add(txt(vs, 0, top + 540, `LEVEL ${lvl} / ${GEN_MAX_LEVEL}  ·  +${Math.round((lvl - 1) * ECON.genLevelLuck * 100)}% higher-tier output`, { size: 34, font: 'num', weight: '700', color: '#8CF08A' }));
      const cost = genUpgradeCost(s, this.chain);
      if (cost != null) {
        const b: Button = new Button(vs, 0, top + 650, 520, 120, `UPGRADE · ${fmt(cost)}`, () => {
          if (!upgradeGenerator(s, this.chain)) { ctx.sfx.play('error'); vs.toast('Not enough gold. Patrons pay best.'); return; }
          ctx.sfx.play('purchase');
          vs.hud.tickGold();
          vs.refreshGenerators();
          ctx.persist();
          const m = b.getWorldTransformMatrix();
          vs.fx.ring(m.tx, m.ty - 400, c.color, 2.4); vs.fx.burst(m.tx, m.ty - 400, 40, c.color);
          this.box.removeAll(true); this.build();
        }, { color: 'gold', size: 38, icon: 'coin', iconScale: 0.45 });
        B.add(b);
      } else B.add(txt(vs, 0, top + 650, 'MASTERWORK', { size: 44, weight: '900', gold: true }));
      B.add(txt(vs, 0, top + 730, 'Upgrades are paid in gold only. A generator never runs out and never needs waiting.', { size: 22, font: 'body', color: '#8a7a98', strokeW: 0 }));
    }
    // the chain ladder with its bindings
    B.add(txt(vs, 0, top + 820, 'THE CHAIN', { size: 34, weight: '900', gold: true }));
    const n = c.maxTier, gap = Math.min(110, 900 / n);
    for (let t = 1; t <= n; t++) {
      const id = itemId(this.chain, t);
      const x = (t - (n + 1) / 2) * gap, y = top + 930;
      const seen = (s.best[this.chain] ?? 0) >= t;
      const ic = vs.add.image(x, y, 'relic96', `i${id}`).setDisplaySize(gap - 12, gap - 12);
      if (!seen) ic.setTint(0x000000).setAlpha(0.55);
      B.add(ic);
      const bind = BINDINGS[id];
      if (bind) {
        B.add(vs.add.image(x, y + 80, 'ic_link').setDisplaySize(40, 40));
        B.add(vs.add.image(x, y + 132, 'relic96', `i${bind}`).setDisplaySize(64, 64));
      }
    }
    B.add(txt(vs, 0, top + 1130, 'A chain link means the merge also consumes that relic from another chain.', { size: 24, font: 'body', color: '#b9a9c6', wrap: 820 }));
    void chainOf; void tierOf; void isTop; void ITEMS;
  }
}
