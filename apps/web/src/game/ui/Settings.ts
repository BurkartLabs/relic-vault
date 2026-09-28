import { Modal } from './Modal';
import { Button, txt, Scroller } from './kit';
import { ctx } from '../GameCtx';
import { chestOddsDisclosure, ECON, SKUS, SkuId } from '../data/catalog';
import { InfoSheet } from './Sheets';
import type { VaultScene } from '../scenes/VaultScene';
import { adsSentence, openPublicPage, openExternal, storeCopy } from '../buildMode'; // AB#4726, AB#4725
import { priceLabel } from '../systems/Prices'; // AB#4725
import { deleteMyData } from '../systems/DataEraser'; // AB#4726

export class SettingsModal extends Modal {
  sc!: Scroller; // AB#4726: kept, so a test can bring a row into view as a player's drag would
  constructor(vs: VaultScene) {
    super(vs, { w: 980, h: 1640, title: 'SETTINGS', panelKey: 'panelDark' });
    this.kind = 'SettingsModal';
    this.build();
  }

  private build() {
    const vs = this.vs, s = ctx.state, top = this.top;
    const sc = this.sc = new Scroller(vs, this.box, -470, top + 60, 940, this.ph - 110);
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
      if (ctx.purchases.mode === 'play') {
        // AB#4725: what Google Play has for this account. Only unlocks and VIP come back; gem packs were spent in play.
        vs.toast('Asking Google Play…');
        const r = await ctx.purchases.restore(s).catch(() => null);
        if (!r) { vs.toast('Google Play did not answer. Try again in a moment.'); return; }
        ctx.persistNow();
        vs.refreshButtons();
        const names = r.entitlements.map((sku) => SKUS[sku].title);
        ctx.analytics.log('restore_purchases', { count: names.length });
        vs.toast(names.length ? `Restored from Google Play: ${names.join(', ')}.` : 'Google Play has no unlocks or VIP for this account. Gem packs are not restored.');
        return;
      }
      await ctx.purchases.restore();
      const n = s.purchases.length;
      ctx.analytics.log('restore_purchases', { count: n });
      vs.toast(n ? `Restored ${n} purchase${n > 1 ? 's' : ''} on this device.` : 'Nothing to restore on this device.');
    });
    // AB#4725: Vault VIP is a Play subscription, cancelled and changed in Play's own subscription centre
    if (ctx.purchases.mode === 'play') row('MANAGE SUBSCRIPTION', 'dark', async () => openExternal(await ctx.purchases.manageUrl()));
    row('MANAGE PURCHASES', 'dark', () => {
      const owned: string[] = [];
      if (s.ent.passPremium) owned.push('Keeper’s Pass (this season)');
      if (s.ent.vip) owned.push(s.ent.vipUntil ? `Vault VIP — renews ${new Date(s.ent.vipUntil).toLocaleDateString()}` : 'Vault VIP');
      if (s.ent.removeAds) owned.push('Silence the Criers (no interstitials)');
      if (s.ent.welcome) owned.push('Keeper’s Welcome');
      // AB#4725: a Play build shows no price here: what was paid, in which currency, is Play's record, not ours
      const paid = (sku: string) => (ctx.purchases.mode === 'play' || !SKUS[sku as SkuId] ? '' : ` · ${priceLabel(sku as SkuId)}`);
      const hist = s.purchases.slice(-8).reverse().map((p) => `${new Date(p.t).toLocaleString()} · ${SKUS[p.sku as SkuId]?.title ?? p.sku}${paid(p.sku)}`);
      vs.openModal(new InfoSheet(vs, 'PURCHASES', [
        owned.length ? 'Active:\n' + owned.join('\n') : 'No active subscriptions.',
        hist.length ? storeCopy().historyHeading + '\n' + hist.join('\n') : 'No purchases yet.',
        s.ent.vip ? storeCopy().vipNote : '',
      ].filter(Boolean).join('\n\n'), () => vs.openSettings()));
    });
    row('PRIVACY', 'dark', () => vs.openModal(new InfoSheet(vs, 'PRIVACY',
      'Relic Vault stores your progress on this device only (IndexedDB, with localStorage as a fallback).\n\n' +
      'A local analytics log records offers shown and purchase buttons pressed (item, trigger, session time, rank, gems, gold) to tune the game. In this build it stays on your device unless the operator configures a telemetry endpoint; if one is configured, anonymous gameplay events (a random device id, no name or contact details) are sent to it.\n\n' +
      `No account. No tracking pixels. ${adsSentence()}\n\nThe full privacy policy and terms open from Settings. Delete My Data below erases everything this game keeps on this device.`, () => vs.openSettings())));
    row('PRIVACY POLICY', 'dark', () => openPublicPage('privacy.html')); // AB#4726: the public pages, outside the invite wall
    row('TERMS', 'dark', () => openPublicPage('terms.html'));
    row('ODDS & DISCLOSURES', 'dark', () => vs.openModal(new InfoSheet(vs, 'ODDS',
      chestOddsDisclosure() + '\n\n' +
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
    y += 120;
    // AB#4726: beside Reset Progress, which clears the game; this also clears the device id and any SDK caches.
    let armedDelete = false;
    const erase: Button = new Button(vs, 470, y + 50, 780, 100, 'DELETE MY DATA', async () => {
      if (!armedDelete) { armedDelete = true; erase.setLabel('TAP AGAIN TO DELETE ALL YOUR DATA'); ctx.sfx.play('error'); return; }
      const left = await deleteMyData(ctx.save);
      console.info('[rv] delete-my-data remaining', JSON.stringify(left));
      location.reload();
    }, { color: 'red', size: 34, guard });
    C.add(erase);
    y += 140;
    C.add(txt(vs, 470, y + 30, `Relic Vault v${ctx.telemetry.version} · ${storeCopy().footer}`, { size: 22, font: 'body', color: '#6a5a78', strokeW: 0 }));
    y += 100;
    sc.setContentHeight(y);
  }
}
