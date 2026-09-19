import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { panel, txt } from './kit';
import type { VaultScene } from '../scenes/VaultScene';

export type TabId = 'vault' | 'album' | 'pass' | 'events' | 'shop';
const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'vault', label: 'Vault', icon: 'ic_vault' },
  { id: 'album', label: 'Album', icon: 'ic_album' },
  { id: 'pass', label: 'Pass', icon: 'ic_pass' },
  { id: 'events', label: 'Events', icon: 'ic_events' },
  { id: 'shop', label: 'Shop', icon: 'ic_shop' },
];

/** Bottom dock: 5 tabs, unlocks gated by onboarding milestones (never gating the core verb). */
export class Dock extends Phaser.GameObjects.Container {
  private items: Record<string, { c: Phaser.GameObjects.Container; icon: Phaser.GameObjects.Image; lock: Phaser.GameObjects.Image; dot: Phaser.GameObjects.Container; glow: Phaser.GameObjects.Image }> = {};
  current: TabId = 'vault';

  constructor(private vs: VaultScene, x: number, y: number) {
    super(vs, x, y);
    this.setDepth(40);
    const bg = panel(vs, 540, 82, 1100, 176, 'panelDark');
    bg.setInteractive();
    this.add(bg);
    TABS.forEach((t, i) => {
      const cx = 108 + i * 216;
      const c = vs.add.container(cx, 62);
      const glow = vs.add.image(0, -6, 'relicGlow').setDisplaySize(220, 220).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      const icon = vs.add.image(0, -14, t.icon).setDisplaySize(108, 108);
      const label = txt(vs, 0, 50, t.label, { size: 28, font: 'title', weight: '900', gold: true, strokeW: 4 });
      const lock = vs.add.image(30, 16, 'ic_lock').setDisplaySize(58, 58);
      const dot = vs.add.container(40, -52);
      dot.add([vs.add.image(0, 0, 'seal_red').setDisplaySize(44, 44), txt(vs, 0, 0, '!', { size: 26, font: 'num', weight: '700' })]);
      dot.setVisible(false);
      c.add([glow, icon, label, lock, dot]);
      c.setSize(200, 170).setInteractive({ useHandCursor: true });
      c.on('pointerdown', () => vs.tweens.add({ targets: icon, scale: icon.scaleX * 0.9, duration: 60 }));
      c.on('pointerup', () => {
        vs.tweens.add({ targets: icon, displayWidth: 108, displayHeight: 108, duration: 160, ease: 'Back.Out' });
        if (!this.unlocked(t.id)) { ctx.sfx.play('error'); vs.toast(this.lockHint(t.id)); return; }
        ctx.sfx.play('tick');
        vs.openTab(t.id);
      });
      this.add(c);
      this.items[t.id] = { c, icon, lock, dot, glow };
    });
    vs.add.existing(this);
    this.refresh();
  }

  unlocked(id: TabId) {
    const s = ctx.state;
    if (id === 'album') return s.album.some((x) => x > 0) || !!s.flags.albumUnlocked;
    if (id === 'pass') return s.rank >= 2;
    if (id === 'events') return s.stats.merges >= 5;
    return true;
  }
  lockHint(id: TabId) {
    if (id === 'album') return 'Album opens with your first card. Merge Gold Masks and up.';
    if (id === 'pass') return 'The Pass opens at Vault Rank 2.';
    if (id === 'events') return 'Events open after 5 merges.';
    return '';
  }

  selectTab(id: TabId) {
    this.current = id;
    for (const k of Object.keys(this.items)) {
      const it = this.items[k];
      const on = k === id;
      this.vs.tweens.add({ targets: it.glow, alpha: on ? 0.45 : 0, duration: 200 });
      this.vs.tweens.add({ targets: it.c, y: on ? 48 : 62, duration: 200, ease: 'Back.Out' });
    }
  }

  setDot(id: TabId, on: boolean) { this.items[id].dot.setVisible(on && this.unlocked(id)); }

  refresh() {
    for (const t of TABS) {
      const it = this.items[t.id];
      const un = this.unlocked(t.id);
      it.lock.setVisible(!un);
      it.icon.setAlpha(un ? 1 : 0.45);
      if (un && !ctx.state.flags[`tab_${t.id}`] && t.id !== 'vault' && t.id !== 'shop') {
        ctx.state.flags[`tab_${t.id}`] = 1;
        this.unlockFx(t.id);
      }
    }
  }

  unlockFx(id: TabId) {
    const it = this.items[id];
    const m = it.c.getWorldTransformMatrix();
    this.vs.fx.ring(m.tx, m.ty, 0xf4c45a, 1.6);
    this.vs.fx.burst(m.tx, m.ty, 24);
    this.vs.tweens.add({ targets: it.icon, angle: { from: -20, to: 0 }, duration: 600, ease: 'Elastic.Out' });
    this.setDot(id, true);
    this.vs.toast(`${id[0].toUpperCase() + id.slice(1)} unlocked!`);
  }

  anchor(id: TabId) {
    const m = this.items[id].c.getWorldTransformMatrix();
    return { x: m.tx, y: m.ty };
  }
}
