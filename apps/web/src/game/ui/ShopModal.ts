import Phaser from 'phaser';
import { Modal, keeperLine } from './Modal';
import { Button, txt, Scroller, badge, money, fmt, iconAmount } from './kit';
import { ctx } from '../GameCtx';
import { SKUS, SkuId, COPY, ECON, CHEST_ODDS, CHEST_PITY_TIER, CHEST_TOP_TIER, RELICS, skuValuePct, GEMS_PER_DOLLAR_BASELINE } from '../data/catalog';
import { skuAvailable } from '../systems/PurchaseService';
import { computeLuck } from '../systems/LuckSystem';
import { chestsAllowed, buyExact, buyMarket, openChest, exactRelicOffer, exactRelicCost } from '../systems/Economy';
import { empties } from '../systems/BoardSystem';
import type { VaultScene } from '../scenes/VaultScene';
import { OddsModal } from './Sheets';

type Focus = 'gems' | 'best' | 'chest' | 'exact' | 'offers' | undefined;

export class ShopModal extends Modal {
  private sc!: Scroller;
  private anchors: Record<string, number> = {};
  constructor(vs: VaultScene, private trigger: string, private focus?: Focus) {
    super(vs, { w: 1030, h: 1760, title: 'THE VAULT SHOP', offer: `shop:${trigger}` });
    this.kind = 'ShopModal';
    this.build();
    if (focus) {
      const key = focus === 'best' ? 'gems' : focus === 'exact' ? 'chest' : focus;
      this.sc.scrollTo(Math.max(0, (this.anchors[key] ?? 0) - 20));
      if (focus === 'best') this.vs.time.delayedCall(350, () => this.pulseBest());
    }
  }

  private best?: Phaser.GameObjects.Container;
  private pulseBest() {
    if (!this.best) return;
    this.vs.tweens.add({ targets: this.best, scale: 1.06, duration: 260, yoyo: true, repeat: 2 });
  }

  private build() {
    const vs = this.vs, s = ctx.state;
    const top = this.top + 50;
    const bannerH = ctx.adsSuppressed ? 0 : 84;
    const viewH = this.ph - 100 - bannerH;
    this.sc = new Scroller(vs, this.box, -490, top, 980, viewH);
    const C = this.sc.content;
    const guard = this.sc.inView;
    let y = 20;
    const header = (label: string, key: string) => {
      this.anchors[key] = y;
      const l = vs.add.image(490, y + 30, 'road').setDisplaySize(860, 6).setAlpha(0.8);
      const t = txt(vs, 490, y + 28, label, { size: 40, gold: true, weight: '900' });
      const plate = vs.add.nineslice(490, y + 30, 'pill', undefined, t.width + 90, 70, 34, 34, 30, 30);
      C.add([l, plate, t]);
      y += 84;
    };

    keeperLine(vs, C, 490, y + 60, 900, COPY.shopLine, 120);
    y += 140;

    // ---------------------------------------------------------- hero
    const allowedRandom = chestsAllowed(s);
    const heroSku: SkuId | null = skuAvailable(s, 'welcome') ? 'welcome' : skuAvailable(s, 'comeback') ? 'comeback' : skuAvailable(s, 'vip') ? 'vip' : null;
    if (heroSku) {
      const h = 330;
      const card = vs.add.container(490, y + h / 2);
      const bg = vs.add.nineslice(0, 0, heroSku === 'vip' ? 'panelBlue' : 'panel', undefined, 940, h, 84, 84, 84, 84);
      const glow = vs.add.image(-270, 0, 'relicGlow').setDisplaySize(420, 420).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
      card.add([bg, glow]);
      if (heroSku === 'welcome') {
        card.add(vs.add.image(-340, -10, 'relic256', 'R4').setDisplaySize(170, 170));
        card.add(vs.add.image(-210, 20, 'relic256', 'R4').setDisplaySize(150, 150));
        card.add(vs.add.image(-290, 90, 'gem').setDisplaySize(90, 90));
        card.add(vs.add.image(-190, 100, 'coin').setDisplaySize(80, 80));
        const rib = vs.add.image(160, -112, 'ribbon').setDisplaySize(560, 100);
        const rt = txt(vs, 160, -122, `ONE TIME · ${skuValuePct('welcome')}% VALUE`, { size: 34, weight: '900', gold: true });
        card.add([rib, rt]);
      } else if (heroSku === 'comeback') {
        card.add(vs.add.image(-290, 0, 'relic256', 'R5').setDisplaySize(220, 220));
      } else {
        card.add(vs.add.image(-290, 0, 'crown').setDisplaySize(200, 200));
      }
      const sku = SKUS[heroSku];
      card.add(txt(vs, 160, -40, sku.title, { size: 50, gold: true, weight: '900' }));
      const blurb = heroSku === 'welcome' && !allowedRandom ? sku.blurb.replace('a Lucky Chest on the house', 'a third Gold Mask') : sku.blurb;
      card.add(txt(vs, 160, 22, blurb, { size: 26, font: 'body', color: '#e8dcf0', wrap: 520 }));
      const b = new Button(vs, 160, 112, 340, 104, money(sku.price), () => this.purchase(heroSku), { color: 'green', size: 44, guard });
      card.add(b);
      if (heroSku === 'welcome') card.add(badge(vs, 420, 90, 'ONE TIME', 'red', 130));
      if (heroSku === 'comeback') card.add(badge(vs, 420, 90, 'SALE', 'red', 120));
      C.add(card);
      vs.tweens.add({ targets: glow, alpha: 0.25, duration: 900, yoyo: true, repeat: -1 });
      y += h + 30;
    }

    // ---------------------------------------------------------- gems
    header('GEMS', 'gems');
    const packs: SkuId[] = ['gems200', 'gems500', 'gems1200'];
    packs.forEach((id, k) => {
      const sku = SKUS[id];
      const cw = 300, ch = 440, cx = 170 + k * 320;
      const card = vs.add.container(cx, y + ch / 2);
      const bg = vs.add.nineslice(0, 0, id === 'gems1200' ? 'panelBlue' : 'panelDark', undefined, cw, ch, 84, 84, 84, 84);
      const glow = vs.add.image(0, -70, 'relicGlow').setDisplaySize(300, 300).setTint(0x7ee0ff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35 + k * 0.15);
      card.add([bg, glow]);
      const n = [3, 6, 10][k];
      for (let g = 0; g < n; g++) {
        const row = g < 4 ? 0 : g < 7 ? 1 : 2;
        const inRow = row === 0 ? Math.min(n, 4) : row === 1 ? Math.min(n - 4, 3) : n - 7;
        const idx = row === 0 ? g : row === 1 ? g - 4 : g - 7;
        const gx = (idx - (inRow - 1) / 2) * 62, gy = -40 - row * 44;
        card.add(vs.add.image(gx, gy, 'gem').setDisplaySize(84 - row * 6, 84 - row * 6).setAngle((g * 37) % 30 - 15));
      }
      card.add(txt(vs, 0, 40, fmt(sku.gems!), { size: 60, font: 'num', weight: '700', color: '#7EE0FF' }));
      const pct = skuValuePct(id);
      card.add(txt(vs, 0, 94, pct > 100 ? `+${pct - 100}% VALUE` : 'STANDARD', { size: 26, font: 'num', weight: '700', color: pct > 100 ? '#8CF08A' : '#b9a9c6' }));
      card.add(txt(vs, 0, 126, `${(sku.gems! / sku.price).toFixed(1)} gems per $`, { size: 22, font: 'body', color: '#b9a9c6', strokeW: 0 }));
      card.add(new Button(vs, 0, 182, 240, 92, money(sku.price), () => this.purchase(id), { color: 'green', size: 38, guard }));
      if (sku.badge) card.add(badge(vs, 108, -190, sku.badge, sku.badge === 'BEST VALUE' ? 'gold' : 'red', 116));
      if (id === 'gems1200') this.best = card;
      C.add(card);
      void cw;
    });
    y += 470;

    // ---------------------------------------------------------- chests: random vs exact (disclosed pair)
    header('CHESTS & RELICS', 'chest');
    const allowed = chestsAllowed(s);
    {
      const ch = 520;
      // random
      const left = vs.add.container(250, y + ch / 2);
      left.add(vs.add.nineslice(0, 0, 'panel', undefined, 460, ch, 84, 84, 84, 84));
      left.add(txt(vs, 0, -214, 'LUCKY CHEST', { size: 40, gold: true, weight: '900' }));
      left.add(txt(vs, 0, -170, 'Random item', { size: 26, font: 'body', color: '#b9a9c6' }));
      if (allowed) {
        const lid = vs.add.image(0, -86, 'chestLid').setDisplaySize(220, 102);
        const body = vs.add.image(0, -8, 'chestBody').setDisplaySize(220, 140);
        left.add([vs.add.image(0, -50, 'relicGlow').setDisplaySize(300, 300).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.4), body, lid]);
        vs.tweens.add({ targets: lid, y: -94, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
        left.add(txt(vs, 0, 84, `Up to a ${RELICS[CHEST_TOP_TIER].name} · ${RELICS[CHEST_PITY_TIER].name}+ in ${ECON.pityEvery - s.pity}`, { size: 22, font: 'body', color: '#8CF08A' }));
        left.add(txt(vs, 0, 112, `Your luck ${(computeLuck(s) * 100).toFixed(0)}% can upgrade a result`, { size: 20, font: 'body', color: '#b9a9c6' }));
        left.add(new Button(vs, 0, 170, 280, 96, `${ECON.chestGemCost}`, () => this.gemChest(), { color: 'blue', size: 40, icon: 'gem', iconScale: 0.5, guard }));
        const info = new Button(vs, 0, 238, 190, 58, 'ODDS', () => vs.openModal(new OddsModal(vs, () => vs.openShop(this.trigger, 'chest'))), { color: 'dark', size: 26, guard });
        left.add(info);
      } else {
        left.add(vs.add.image(0, -40, 'ic_lock').setDisplaySize(140, 140));
        left.add(txt(vs, 0, 90, s.age === 'minor' ? 'Random paid chests are disabled\nfor players under 16.' : 'Random chests are not offered\nin your region.', { size: 26, font: 'body', color: '#e8dcf0' }));
        left.add(txt(vs, 0, 180, 'Buy exact relics instead →', { size: 28, font: 'body', color: '#8CF08A' }));
      }
      C.add(left);
      // exact
      const right = vs.add.container(730, y + ch / 2);
      right.add(vs.add.nineslice(0, 0, 'panelBlue', undefined, 460, ch, 84, 84, 84, 84));
      right.add(txt(vs, 0, -214, 'EXACT RELIC', { size: 40, gold: true, weight: '900' }));
      right.add(txt(vs, 0, -170, 'You get exactly this', { size: 26, font: 'body', color: '#b9a9c6' }));
      // Board RV-B4: the offer rotates near the player's best tier and is priced from what it is worth in merges
      const offerTier = exactRelicOffer(s);
      right.add(vs.add.image(0, -50, 'relicGlow').setDisplaySize(300, 300).setTint(RELICS[offerTier].color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45));
      right.add(vs.add.image(0, -50, 'relic256', `R${offerTier}`).setDisplaySize(190, 190));
      right.add(txt(vs, 0, 80, RELICS[offerTier].name, { size: 34, weight: '900', gold: true }));
      right.add(txt(vs, 0, 118, 'today’s relic', { size: 22, font: 'body', color: '#b9a9c6' }));
      right.add(new Button(vs, 0, 170, 280, 96, `${exactRelicCost(offerTier)}`, () => this.exactRelic(offerTier), { color: 'blue', size: 40, icon: 'gem', iconScale: 0.5, guard }));
      right.add(badge(vs, 196, -262, 'NO LUCK NEEDED', 'blue', 110));
      C.add(right);
      y += ch + 30;
    }

    // ---------------------------------------------------------- offers
    header('KEEPER’S OFFERS', 'offers');
    const offerList: { id: SkuId; icon: string; frame?: string; color: 'green' | 'purple' | 'red' }[] = [
      { id: 'pass', icon: 'ic_pass', color: 'purple' },
      { id: 'vip', icon: 'crown', color: 'purple' },
      { id: 'piggy', icon: 'pig', color: 'green' },
      { id: 'noads', icon: 'ic_ad', color: 'green' },
      { id: 'comeback', icon: 'relic256', frame: 'R5', color: 'red' },
      { id: 'welcome', icon: 'relic256', frame: 'R4', color: 'red' },
    ];
    const avail = offerList.filter((o) => o.id !== heroSku);
    avail.forEach((o, k) => {
      const col = k % 3, row = Math.floor(k / 3);
      const cw = 300, ch = 400, cx = 170 + col * 320, cy = y + row * (ch + 24) + ch / 2;
      const card = vs.add.container(cx, cy);
      const sku = SKUS[o.id];
      const owned = !skuAvailable(s, o.id);
      card.add(vs.add.nineslice(0, 0, 'panelDark', undefined, cw, ch, 84, 84, 84, 84));
      card.add(vs.add.image(0, -86, 'relicGlow').setDisplaySize(240, 240).setTint(o.color === 'purple' ? 0xc79bff : 0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35));
      card.add(o.frame ? vs.add.image(0, -86, o.icon, o.frame).setDisplaySize(150, 150) : vs.add.image(0, -86, o.icon).setDisplaySize(140, 140));
      const title = txt(vs, 0, 10, sku.title, { size: 32, gold: true, weight: '900' });
      if (title.width > 270) title.setScale(270 / title.width);
      card.add(title);
      card.add(txt(vs, 0, 76, o.id === 'piggy' ? `Holds ${fmt(Math.floor(s.piggy))} gems` : sku.blurb, { size: 21, font: 'body', color: '#d8cce4', wrap: 260, strokeW: 0 }));
      if (owned) card.add(txt(vs, 0, 156, o.id === 'piggy' ? 'EMPTY' : 'OWNED', { size: 36, font: 'num', weight: '700', color: '#8CF08A' }));
      else card.add(new Button(vs, 0, 156, 230, 88, money(sku.price), () => this.purchase(o.id), { color: o.color, size: 36, guard }));
      if (sku.badge && !owned) card.add(badge(vs, 110, -170, sku.badge, 'red', 100));
      C.add(card);
    });
    y += Math.ceil(avail.length / 3) * 424 + 10;

    // ---------------------------------------------------------- gold market (deterministic, gold sink)
    header('RELIC MARKET · GOLD', 'market');
    [2, 3, 4, 5].forEach((t, k) => {
      const cx = 125 + k * 245, ch = 300;
      const card = vs.add.container(cx, y + ch / 2);
      card.add(vs.add.nineslice(0, 0, 'panelDark', undefined, 230, ch, 70, 70, 70, 70));
      card.add(vs.add.image(0, -60, 'relic256', `R${t}`).setDisplaySize(130, 130));
      card.add(txt(vs, 0, 26, RELICS[t].name, { size: 24, font: 'body', weight: '700', color: '#FFE9A3' }));
      card.add(new Button(vs, 0, 96, 190, 80, fmt(ECON.marketGold[t]), () => this.market(t), { color: 'gold', size: 32, icon: 'coin', iconScale: 0.4, guard }));
      C.add(card);
    });
    y += 330;

    // ---------------------------------------------------------- legal footer
    const odds = CHEST_ODDS.map((o) => `${RELICS[o.tier].name} ${Math.round(o.chance * 100)}%`).join(' · ');
    const legal = txt(vs, 490, y + 70,
      `Lucky Chest odds: ${odds}. Every ${ECON.pityEvery}th chest without a ${RELICS[CHEST_PITY_TIER].name} or better is guaranteed one. ` +
      `Luck may upgrade a result by one tier. Exact relics are always available for gems or gold.\n` +
      `Value ribbons compare gems per dollar against the ${money(4.99)} pack (${GEMS_PER_DOLLAR_BASELINE.toFixed(1)} gems/$); the Welcome figure counts its chest at ${ECON.chestGemCost} gems, gold and relics are extra. ` +
      `DEMO MODE: purchases are simulated. No real money is charged. Restore & manage purchases in Settings.`,
      { size: 22, font: 'body', color: '#9a8aa8', wrap: 900, strokeW: 0, shadow: false, lineSpacing: 4 });
    C.add(legal);
    y += legal.height + 120;
    this.sc.setContentHeight(y);

    // ---------------------------------------------------------- thin banner (shop only, non-VIP, non-remove-ads)
    if (bannerH) {
      const b = vs.add.container(0, this.bottom - 70);
      const bg = vs.add.nineslice(0, 0, 'pill', undefined, 900, 76, 36, 36, 34, 34);
      const t = txt(vs, -40, 0, 'SPONSORED · The Criers’ Guild wishes you luck', { size: 24, font: 'body', color: '#b9a9c6', strokeW: 0 });
      const ad = vs.add.image(390, 0, 'ic_ad').setDisplaySize(56, 56);
      b.add([bg, t, ad]);
      this.box.add(b);
    }
  }

  private rebuild() {
    this.box.removeAll(true);
    this.build();
  }

  private purchase(id: SkuId) {
    this.vs.buy(id, `shop:${this.trigger}`, () => {
      if (this.active && !this.closing) this.rebuild();
    });
  }

  private gemChest() {
    const s = ctx.state;
    ctx.analytics.log('gem_spend_click', { item: 'chest', cost: ECON.chestGemCost, trigger: this.trigger });
    if (!empties(s).length) { ctx.sfx.play('error'); this.vs.toast('No free socket for the chest’s relic. Merge or sell first.'); return; }
    if (s.gems < ECON.chestGemCost) { ctx.sfx.play('error'); this.vs.toast('Not enough gems.'); this.sc.scrollTo(this.anchors.gems - 20); return; }
    const r = openChest(s, ctx.rng, 'gems');
    if (!r.ok) { ctx.sfx.play('error'); return; }
    this.vs.hud.tickGems();
    this.vs.openChest('gems', `shop:${this.trigger}`, r);
  }

  private exactRelic(tier: number) {
    const s = ctx.state;
    const cost = exactRelicCost(tier);
    ctx.analytics.log('gem_spend_click', { item: `exact_t${tier}`, cost, trigger: this.trigger });
    if (s.gems < cost) { ctx.sfx.play('error'); this.vs.toast('Not enough gems.'); this.sc.scrollTo(this.anchors.gems - 20); return; }
    const i = buyExact(s, tier, ctx.rng);
    if (i === null) return;
    ctx.sfx.play('purchase');
    this.vs.hud.tickGems();
    if (i >= 0) this.vs.dropRelic(i, tier, 400); else this.vs.toast('Board full: it waits in your satchel.');
    this.vs.refreshButtons();
    ctx.persist();
    this.close();
  }

  private market(t: number) {
    const s = ctx.state;
    if (!empties(s).length) { ctx.sfx.play('error'); this.vs.toast('No free socket.'); return; }
    if (s.gold < ECON.marketGold[t]) { ctx.sfx.play('error'); this.vs.toast('Not enough gold. Merge more, or smash the pig.'); return; }
    const i = buyMarket(s, t, ctx.rng);
    if (i === null) return;
    ctx.sfx.play('coin');
    this.vs.hud.tickGold();
    this.vs.dropRelic(i, t, 300);
    ctx.persist();
    this.close();
  }
}

