import { Modal } from './Modal';
import { Button, txt, Scroller } from './kit';
import { ctx } from '../GameCtx';
import { CHEST_ODDS, RELICS, ECON, SKUS, SkuId } from '../data/catalog';
import { InfoSheet } from './Sheets';
import type { VaultScene } from '../scenes/VaultScene';

export class SettingsModal extends Modal {
  constructor(vs: VaultScene) {
    super(vs, { w: 980, h: 1640, title: 'SETTINGS', panelKey: 'panelDark' });
    this.kind = 'SettingsModal';
    this.build();
  }

  private build() {
    const vs = this.vs, s = ctx.state, top = this.top;
    const sc = new Scroller(vs, this.box, -470, top + 60, 940, this.ph - 110);
    const C = sc.content;
    const guard = sc.inView;
    let y = 40;
    const toggle = (label: string, get: () => boolean, set: (v: boolean) => void) => {
      C.add(txt(vs, 60, y + 50, label, { size: 40, weight: '700', color: '#FFE9A3', origin: [0, 0.5] }));
      const b: Button = new Button(vs, 760, y + 50, 240, 96, get() ? 'ON' : 'OFF', () => { set(!get()); b.setLabel(get() ? 'ON' : 'OFF'); ctx.persist(); }, { color: get() ? 'green' : 'dark', size: 38, guard });
      C.add(b);
      y += 120;
    };
    toggle('Sound', () => !s.settings.muted, (v) => { s.settings.muted = !v; ctx.sfx.setMuted(!v); });
    toggle('Vault drone', () => s.settings.music, (v) => { s.settings.music = v; ctx.sfx.setMusic(v); });
    toggle('Haptics', () => s.settings.haptics, (v) => { s.settings.haptics = v; if (v) ctx.haptic(20); });
    toggle('Loot boxes in region', () => s.lootboxesAllowed, (v) => { s.lootboxesAllowed = v; vs.refreshButtons(); });
    y += 10;
    const row = (label: string, color: 'gold' | 'dark' | 'blue' | 'red' | 'purple', fn: () => void) => {
      C.add(new Button(vs, 470, y + 50, 780, 100, label, fn, { color, size: 36, guard }));
      y += 120;
    };
    const install = (window as any).__installPrompt;
    if (install) row('INSTALL RELIC VAULT', 'gold', async () => { install.prompt(); (window as any).__installPrompt = null; ctx.analytics.log('install_prompt'); });
    row('RESTORE PURCHASES', 'blue', async () => {
      await ctx.purchases.restore();
      const n = s.purchases.length;
      ctx.analytics.log('restore_purchases', { count: n });
      vs.toast(n ? `Restored ${n} purchase${n > 1 ? 's' : ''} on this device.` : 'Nothing to restore on this device.');
    });
    row('MANAGE PURCHASES', 'dark', () => {
      const owned: string[] = [];
      if (s.ent.passPremium) owned.push('Keeper’s Pass (this season)');
      if (s.ent.vip) owned.push(`Vault VIP — renews ${new Date(s.ent.vipUntil).toLocaleDateString()}`);
      if (s.ent.removeAds) owned.push('Silence the Criers (no interstitials)');
      if (s.ent.welcome) owned.push('Keeper’s Welcome');
      const hist = s.purchases.slice(-8).reverse().map((p) => `${new Date(p.t).toLocaleString()} · ${SKUS[p.sku as SkuId]?.title ?? p.sku} · $${SKUS[p.sku as SkuId]?.price ?? '?'}`);
      vs.openModal(new InfoSheet(vs, 'PURCHASES', [
        owned.length ? 'Active:\n' + owned.join('\n') : 'No active subscriptions.',
        hist.length ? 'Recent (demo, not charged):\n' + hist.join('\n') : 'No purchases yet.',
        s.ent.vip ? 'Subscriptions are managed in your app store account. In this demo, VIP simply expires after 30 days.' : '',
      ].filter(Boolean).join('\n\n'), () => vs.openSettings()));
    });
    row('PRIVACY', 'dark', () => vs.openModal(new InfoSheet(vs, 'PRIVACY',
      'Relic Vault stores your progress on this device only (IndexedDB, with localStorage as a fallback).\n\n' +
      'A local analytics log records offers shown and purchase buttons pressed (item, trigger, session time, rank, gems, gold) to tune the game. It never leaves your device in this build.\n\n' +
      'No account. No tracking pixels. Ads in this build are simulated veils.\n\nYou can erase everything with Reset Progress below.', () => vs.openSettings())));
    row('ODDS & DISCLOSURES', 'dark', () => vs.openModal(new InfoSheet(vs, 'ODDS',
      'Lucky Chest (40 gems or $2.99):\n' + CHEST_ODDS.map((o) => `  ${RELICS[o.tier].name} — ${Math.round(o.chance * 100)}%`).join('\n') +
      `\n\nPity: every ${ECON.pityEvery}th chest without a Gold Mask or better is guaranteed one.\nLuck (${(ECON.luckBase * 100).toFixed(0)}%–${ECON.luckCap * 100}%) can upgrade a chest result by one tier.\n\n` +
      `Exact relics are always for sale: Emerald Scarab for ${ECON.exactT5Gems} gems, lower relics for gold.\n\n` +
      `Players under 16 and regions without loot boxes see only exact-item offers.`, () => vs.openSettings())));
    C.add(txt(vs, 470, y + 40, `Age: ${s.age === 'minor' ? 'under 16 (random paid chests off)' : s.age === 'adult' ? '16+' : 'unknown'}`, { size: 28, font: 'body', color: '#b9a9c6' }));
    y += 90;
    let armed = false;
    const reset: Button = new Button(vs, 470, y + 50, 780, 100, 'RESET PROGRESS', async () => {
      if (!armed) { armed = true; reset.setLabel('TAP AGAIN TO ERASE EVERYTHING'); ctx.sfx.play('error'); return; }
      await ctx.save.reset();
      location.reload();
    }, { color: 'red', size: 34, guard });
    C.add(reset);
    y += 140;
    C.add(txt(vs, 470, y + 30, 'Relic Vault v1.0 · DEMO STORE MODE · no real charges', { size: 22, font: 'body', color: '#6a5a78', strokeW: 0 }));
    y += 100;
    sc.setContentHeight(y);
  }
}
