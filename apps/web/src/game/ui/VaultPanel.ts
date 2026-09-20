import Phaser from 'phaser';
import { Modal } from './Modal';
import { Button, txt, fmt, Scroller } from './kit';
import { ctx } from '../GameCtx';
import { xpToNext, claimRankReward, claimCyclePrize } from '../systems/Economy';
import { RANK_REWARDS, TITLES, earnedTitles, unclaimedRankRewards, profileName, NAME_PARTS, CRESTS } from '../systems/Profile';
import { standings, cyclePrize, playerPlace } from '../systems/Standings';
import { rewardVisual } from './PassRoad';
import type { VaultScene } from '../scenes/VaultScene';

/**
 * The Vault: who you are, what your rank has earned you, and where you stand.
 *
 * Board, 2026-09-19: *"Vault doesn't do anything?"* — and it did not. The Vault tab is the first tab in the
 * dock, and tapping it only closed whatever modal was open, so the first control anyone touches appeared dead.
 * It is now the room the game is named after, and the home for three other things the Board asked for that had
 * nowhere to live: level-up rewards, account personalisation, and leaderboards.
 */
export class VaultPanel extends Modal {
  constructor(vs: VaultScene) {
    super(vs, { w: 1020, h: 1680, title: 'THE VAULT' });
    this.kind = 'VaultPanel';
    this.build();
  }

  private rebuild() { const vs = this.vs; this.close(); vs.openModal(new VaultPanel(vs)); }

  private build() {
    const vs = this.vs, s = ctx.state, B = this.box, top = this.top;
    const sc = new Scroller(vs, B, -470, top + 120, 940, this.ph / 2 - (top + 120) - 40);
    const L = sc.content;
    let y = 0;

    // ---------------------------------------------------------------- who you are
    L.add(txt(vs, 30, y, 'WHO YOU ARE', { size: 28, weight: '900', color: '#b9a9c6', origin: [0, 0.5] }));
    y += 60;
    const p = s.profile;
    L.add(vs.add.image(90, y + 40, p.crest).setDisplaySize(140, 140).setAlpha(0.95));
    L.add(txt(vs, 190, y + 10, profileName(p), { size: 46, weight: '900', gold: true, origin: [0, 0.5] }));
    const title = TITLES.find((t) => t.id === p.title);
    L.add(txt(vs, 190, y + 62, title ? title.label : 'No title yet', { size: 30, font: 'body', color: title ? '#8CF08A' : '#7d7089', origin: [0, 0.5] }));

    // Personalisation with no text field anywhere: the Board's standing all-ages choice is generated names,
    // no chat and no player-authored strings, so everything here is a cycle through a fixed list.
    L.add(new Button(vs, 620, y + 40, 200, 88, 'Name', () => {
      p.noun = (p.noun + 1) % NAME_PARTS.nouns.length;
      if (p.noun === 0) p.adjective = (p.adjective + 1) % NAME_PARTS.adjectives.length;
      ctx.persist(); this.rebuild();
    }, { color: 'dark', size: 28 }));
    L.add(new Button(vs, 840, y + 40, 180, 88, 'Crest', () => {
      p.crest = CRESTS[(CRESTS.indexOf(p.crest) + 1) % CRESTS.length];
      ctx.persist(); this.rebuild();
    }, { color: 'dark', size: 28 }));
    y += 150;

    const earned = earnedTitles(s);
    if (earned.length) {
      L.add(txt(vs, 30, y, 'Titles you have earned — tap to wear', { size: 24, font: 'body', color: '#b9a9c6', origin: [0, 0.5] }));
      y += 50;
      earned.forEach((t, i) => {
        const on = p.title === t.id;
        L.add(new Button(vs, 180 + (i % 3) * 300, y + Math.floor(i / 3) * 100, 280, 84, t.label,
          () => { p.title = on ? null : t.id; ctx.persist(); this.rebuild(); }, { color: on ? 'gold' : 'dark', size: 26 }));
      });
      y += Math.ceil(earned.length / 3) * 100 + 20;
    } else {
      L.add(txt(vs, 30, y, `No titles yet. ${TITLES[0].why} for your first.`, { size: 24, font: 'body', color: '#7d7089', origin: [0, 0.5] }));
      y += 60;
    }

    // ---------------------------------------------------------------- rank and its landmarks
    y += 30;
    L.add(txt(vs, 30, y, 'VAULT RANK', { size: 28, weight: '900', color: '#b9a9c6', origin: [0, 0.5] }));
    y += 60;
    L.add(txt(vs, 30, y, `Rank ${s.rank}`, { size: 52, weight: '900', gold: true, origin: [0, 0.5] }));
    L.add(txt(vs, 30, y + 52, `${fmt(s.xp)} / ${fmt(xpToNext(s.rank))} to rank ${s.rank + 1}`, { size: 26, font: 'num', color: '#b9a9c6', origin: [0, 0.5] }));
    const bar = vs.add.graphics();
    bar.fillStyle(0x2a2233).fillRoundedRect(30, y + 88, 880, 26, 13);
    bar.fillStyle(0xf4c45a).fillRoundedRect(30, y + 88, Math.max(6, 880 * Math.min(1, s.xp / xpToNext(s.rank))), 26, 13);
    L.add(bar);
    y += 150;

    const owed = unclaimedRankRewards(s);
    if (owed.length) {
      L.add(txt(vs, 30, y, `${owed.length} rank reward${owed.length > 1 ? 's' : ''} waiting`, { size: 28, weight: '900', color: '#8CF08A', origin: [0, 0.5] }));
      y += 60;
      for (const r of owed.slice(0, 4)) {
        const entry = RANK_REWARDS[r];
        L.add(txt(vs, 30, y + 30, `Rank ${r} — ${entry.note}`, { size: 26, font: 'body', color: '#e8dcf0', origin: [0, 0.5] }));
        entry.rewards.forEach((rw, i) => L.add(rewardVisual(vs, rw, 400 + i * 110, y + 30, 70)));
        L.add(new Button(vs, 800, y + 30, 190, 84, 'Claim', () => {
          const g = claimRankReward(s, r, ctx.rng);
          if (g) { ctx.persist(); this.vs.showGrant(g, { x: 0, y: 0 }); this.rebuild(); }
        }, { color: 'green', size: 28 }));
        y += 110;
      }
    } else {
      const next = Object.keys(RANK_REWARDS).map(Number).sort((a, b) => a - b).find((r) => r > s.rank);
      L.add(txt(vs, 30, y, next ? `Next landmark at rank ${next}: ${RANK_REWARDS[next].note}` : 'Every landmark claimed.',
        { size: 26, font: 'body', color: '#b9a9c6', origin: [0, 0.5] }));
      y += 70;
    }

    // ---------------------------------------------------------------- standings
    y += 30;
    L.add(txt(vs, 30, y, 'GOLD RUSH STANDINGS', { size: 28, weight: '900', color: '#b9a9c6', origin: [0, 0.5] }));
    y += 56;
    // Soul forbids fabricated social proof. These rivals are automatons and the panel says so, plainly, above
    // the board rather than in a footnote. When real players exist the rows stay and this line changes.
    L.add(txt(vs, 30, y, 'You are practising against the vault itself. Every name below is an', { size: 22, font: 'body', color: '#7d7089', origin: [0, 0.5] }));
    L.add(txt(vs, 30, y + 30, 'automaton keeper, not a player. Real rivals arrive when the vault opens.', { size: 22, font: 'body', color: '#7d7089', origin: [0, 0.5] }));
    y += 80;

    const prize = cyclePrize(s);
    L.add(txt(vs, 30, y, `You are ${ordinal(playerPlace(s))} with ${fmt(s.event.points)} points`, { size: 34, weight: '900', gold: true, origin: [0, 0.5] }));
    y += 50;
    if (prize.placeLabel) {
      L.add(txt(vs, 30, y, `Holding: ${prize.placeLabel}${prize.diligenceRewards.length ? ` + ${prize.milestones} milestones` : ''}`,
        { size: 26, font: 'body', color: '#8CF08A', origin: [0, 0.5] }));
      const claimed = !!s.flags[`cyclePrize:${s.event.cycle}`];
      L.add(new Button(vs, 780, y, 250, 84, claimed ? 'Claimed' : 'Claim prize', () => {
        const g = claimCyclePrize(s, ctx.rng);
        if (g) { ctx.persist(); this.vs.showGrant(g, { x: 0, y: 0 }); this.rebuild(); }
      }, { color: claimed ? 'dark' : 'green', size: 26 }));
      y += 70;
    } else {
      L.add(txt(vs, 30, y, 'Score any Rush points to place and earn a prize.', { size: 24, font: 'body', color: '#7d7089', origin: [0, 0.5] }));
      y += 60;
    }

    const rows = standings(s);
    const you = rows.findIndex((r) => r.isPlayer);
    const window = rows.slice(Math.max(0, you - 4), Math.max(9, you + 5)); // always show the player in context
    for (const r of window) {
      const place = rows.indexOf(r) + 1;
      const c = r.isPlayer ? '#f4c45a' : '#cbbfd6';
      L.add(txt(vs, 30, y, `${place}`, { size: 26, font: 'num', color: c, origin: [0, 0.5] }));
      L.add(txt(vs, 100, y, r.name, { size: 26, font: 'body', weight: r.isPlayer ? '900' : '500', color: c, origin: [0, 0.5] }));
      if (!r.isHuman) L.add(txt(vs, 520, y, 'keeper', { size: 20, font: 'body', color: '#6b5f75', origin: [0, 0.5] }));
      L.add(txt(vs, 780, y, fmt(r.points), { size: 26, font: 'num', color: c, origin: [1, 0.5] }));
      L.add(txt(vs, 890, y, `${r.milestones}`, { size: 24, font: 'num', color: '#7d7089', origin: [1, 0.5] }));
      y += 52;
    }
    y += 40;
    sc.setContentHeight(y);
  }
}

function ordinal(n: number) {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}
