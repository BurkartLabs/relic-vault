import Phaser from 'phaser';
import { ctx } from '../GameCtx';
import { BOARD_SIZE, BOARD_COLS, ECON, SKUS, SkuId, COPY, CARDS, ALBUM_PAGES } from '../data/catalog';
import { merge, canMerge, MergeResult } from '../systems/MergeSystem';
import { forge } from '../systems/ForgeSystem';
import { sell, move, fillRatio, canForge, findPair, empties } from '../systems/BoardSystem';
import { applyPurchase, skuAvailable } from '../systems/PurchaseService';
import { chestsAllowed, dropFromSatchel, claimVipCrate, CardResult, Granted } from '../systems/Economy';
import { eventEndsAt, rollover } from '../systems/State';
import { OfferRequest } from '../systems/OfferDirector';
import { CELL, DAIS_PAD } from '../art/VaultBackground';
import { SHEEN_FRAMES, BOARD_FRAME } from '../art/RelicFactory';
import { Fx } from '../art/ParticleCatalog';
import { Hud } from '../ui/Hud';
import { Dock, TabId } from '../ui/Dock';
import { Modal } from '../ui/Modal';
import { txt, fmt } from '../ui/kit';
import { ShopModal } from '../ui/ShopModal';
import { WelcomePack } from '../ui/WelcomePack';
import { ChestOpen } from '../ui/ChestOpen';
import { VaultPanel } from '../ui/VaultPanel';
import { AlbumBook } from '../ui/AlbumBook';
import { PassRoad } from '../ui/PassRoad';
import { EventPanel } from '../ui/EventPanel';
import { PiggySheet } from '../ui/Piggy';
import { WheelModal } from '../ui/Wheel';
import { SettingsModal } from '../ui/Settings';
import { InspectCard, QuestsModal, OfferSheet, RankInfo, KeeperDialog, GeneratorSheet } from '../ui/Sheets';
import { OrdersPanel, patronLine } from '../ui/Orders';
import { ITEMS, CHAINS, tierOf, BINDINGS } from '../data/items';
import { tickOrders, refillOrders, deliver, dismissOrder, matchOrder } from '../systems/OrderSystem';
import { AdVeil } from '../ui/AdVeil';
import { Tutorial } from '../ui/Tutorial';
import { DiscoveryCard } from '../ui/Discovery';
import { grantGold, enforceChestRules } from '../systems/Economy';

interface RelicView {
  /** item id (chain * 10 + tier); Forge ids equal their tier */
  tier: number;
  spr: Phaser.GameObjects.Image;
  shadow: Phaser.GameObjects.Image;
  glow?: Phaser.GameObjects.Image;
  gild?: Phaser.GameObjects.Image;
  iris?: Phaser.GameObjects.Image;
  phase: number;
  lifted?: boolean;
}

const RELIC_SIZE = 160;
/** Board RV-B7: a denser ad load (was 90s). Rewarded ads stay optional and no ad ever gates play. */
const AD_GAP_MS = 45000;
/** Board RV-B8: how long after the last merge a streak still counts as live. */
const STREAK_GRACE_MS = 2200;
/** vertical layout in design space; fits a strict 9:16 1080x1920 screen above the dock */
const BOARD_TOP = 574;
const FORGE_Y = 1628;
const FLOAT_WORD = (t: number, asc: boolean) => asc ? 'ASCENDED!' : t <= 3 ? 'FUSE' : t <= 6 ? 'RELIC!' : t <= 8 ? 'MYTHIC' : 'LIVING!';

export class VaultScene extends Phaser.Scene {
  W = 1080; H = 1920; ox = 0; my = 0; safeTop = 0; safeBottom = 0;
  fx!: Fx;
  hud!: Hud;
  dock!: Dock;
  tut!: Tutorial;
  relics: (RelicView | null)[] = [];
  modal: Modal | null = null;
  selected = -1;
  selRing!: Phaser.GameObjects.Image;
  hoverRing!: Phaser.GameObjects.Image;
  forgeBtn!: Phaser.GameObjects.Container;
  gens: Phaser.GameObjects.Container[] = [];
  orders!: OrdersPanel;
  private knownGens: number[] = [];
  chestBtn!: Phaser.GameObjects.Container;
  chestLabel!: Phaser.GameObjects.Text;
  chestIcon!: Phaser.GameObjects.Image;
  sellBin!: Phaser.GameObjects.Container;
  satchelBtn!: Phaser.GameObjects.Container;
  satchelText!: Phaser.GameObjects.Text;
  vipBtn!: Phaser.GameObjects.Container;
  redVignette!: Phaser.GameObjects.Image;
  sarco!: Phaser.GameObjects.Container;
  eyes: Phaser.GameObjects.Image[] = [];
  decor: Phaser.GameObjects.Image[] = [];
  chains!: Phaser.GameObjects.Image;
  fogs: Phaser.GameObjects.TileSprite[] = [];
  doorGlow!: Phaser.GameObjects.Image;
  busy = 0; // animations that should hold offers
  lastInterstitial = 0;
  private press: { i: number; x: number; y: number; dragging: boolean; timer?: Phaser.Time.TimerEvent } | null = null;
  private dragging = false;
  private offerTimer?: Phaser.Time.TimerEvent;
  private pendingOffer = false;
  private matchPulse: Phaser.Tweens.Tween[] = [];
  private discoveries: number[] = [];
  private combo = 0;
  private lastMergeAt = 0;
  lastActionAt = Date.now();
  private idleHinted = false;
  private parallax = { x: 0, y: 0, tx: 0, ty: 0 };
  private para: { o: Phaser.GameObjects.Components.Transform; bx: number; by: number; k: number }[] = [];

  constructor() { super('Vault'); }

  // ------------------------------------------------------------------ layout helpers
  cellPos(i: number) {
    const c = i % BOARD_COLS, r = Math.floor(i / BOARD_COLS);
    return { x: this.ox + 90 + c * CELL + CELL / 2, y: this.my + BOARD_TOP + r * CELL + CELL / 2 };
  }
  cellAt(x: number, y: number) {
    const lx = x - (this.ox + 90), ly = y - (this.my + BOARD_TOP);
    if (lx < 0 || ly < 0 || lx >= CELL * 6 || ly >= CELL * 6) return -1;
    return Math.floor(ly / CELL) * BOARD_COLS + Math.floor(lx / CELL);
  }
  get boardCenter() { return { x: this.ox + 540, y: this.my + BOARD_TOP + CELL * 3 }; }

  create() {
    this.W = this.scale.width; this.H = this.scale.height;
    this.ox = (this.W - 1080) / 2;
    const ds = this.scale.displayScale.y || 1;
    this.safeTop = ((window as any).__safeTop || 0) * ds;
    this.safeBottom = ((window as any).__safeBottom || 0) * ds;
    const extra = Math.max(0, this.H - 1920 - this.safeTop - this.safeBottom);
    this.my = this.safeTop + extra * 0.5;
    this.relics = new Array(BOARD_SIZE).fill(null);
    this.cameras.main.setBackgroundColor('#07060B');
    // punch-ins may zoom and pan, but never past the painted world
    this.cameras.main.setBounds(0, 0, this.W, this.H);
    this.cameras.main.fadeIn(420, 7, 6, 11);

    this.fx = new Fx(this, 30);
    this.buildBackground();
    this.buildBoard();
    this.buildForgeRow();
    refillOrders(ctx.state, ctx.rng);
    this.orders = new OrdersPanel(this, this.ox, this.my + 432);
    this.hud = new Hud(this, this.ox, this.safeTop + 10);
    this.dock = new Dock(this, this.ox, this.H - 150 - this.safeBottom);
    this.buildInput();
    this.syncBoard();
    this.updateVaultMood(true);
    this.refreshButtons();

    enforceChestRules(ctx.state, ctx.rng);
    this.tut = new Tutorial(this);
    this.listenTilt();
    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.secondTick() });
    this.secondTick();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    (window as any).__vault = this;
    // first ever session: tutorial. Returning: VIP crate / satchel nudges.
    this.time.delayedCall(700, () => this.tut.start());
  }

  private resizeTimer?: number;
  private onResize() {
    clearTimeout(this.resizeTimer);
    this.resizeTimer = window.setTimeout(() => { ctx.persistNow(); this.scene.restart(); }, 250);
  }

  // ------------------------------------------------------------------ background
  private buildBackground() {
    const { W, H, ox, my } = this;
    const far = this.add.image(W / 2, my + 960, 'bgFar').setDepth(0).setScale(1.02);
    if (W > 1080) {
      for (const s of [-1, 1]) this.add.image(W / 2 + s * 1080, my + 960, 'bgFar').setFlipX(true).setTint(0x6a6070).setDepth(0);
    }
    // seam fades above/below the painting when the phone is taller than 9:16
    if (my > 0) {
      const g = this.add.graphics().setDepth(0.5);
      g.fillGradientStyle(0x07060b, 0x07060b, 0x07060b, 0x07060b, 1, 1, 0, 0);
      g.fillRect(0, my - 2, W, 160);
      g.fillStyle(0x07060b, 1).fillRect(0, 0, W, my);
      g.fillGradientStyle(0x07060b, 0x07060b, 0x07060b, 0x07060b, 0, 0, 1, 1);
      g.fillRect(0, my + 1920 - 200, W, 202);
      g.fillStyle(0x07060b, 1).fillRect(0, my + 1920, W, H);
    }
    this.addPara(far, 5);
    // door glow breathing
    this.doorGlow = this.add.image(ox + 540, my + 440, 'relicGlow').setDisplaySize(1100, 1100).setTint(0xf4c45a).setAlpha(0.18).setBlendMode(Phaser.BlendModes.ADD).setDepth(1);
    this.tweens.add({ targets: this.doorGlow, alpha: 0.3, duration: 3200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.addPara(this.doorGlow, 8);
    // decorations from completed album pages
    this.refreshDecor();
    // mid: chains (sway)
    this.chains = this.add.image(ox + 540, my + 0, 'bgChains').setOrigin(0.5, 0).setDepth(2);
    this.tweens.add({ targets: this.chains, angle: { from: -0.35, to: 0.35 }, duration: 5200, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.addPara(this.chains, 18);
    // candles
    for (const [x, y, s] of [[176, 548, 1], [904, 548, 1], [60, 1590, 1.2], [1020, 1590, 1.2]]) {
      const cx = ox + x, cy = my + y;
      const glow = this.add.image(cx, cy - 70 * s, 'relicGlow').setDisplaySize(260 * s, 260 * s).setTint(0xffa040).setAlpha(0.45).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
      this.add.image(cx, cy, 'candle').setScale(s).setOrigin(0.5, 0.87).setDepth(3);
      const flame = this.add.image(cx, cy - 70 * s, 'flame').setScale(s * 0.8).setOrigin(0.5, 0.9).setBlendMode(Phaser.BlendModes.ADD).setDepth(3);
      this.tweens.add({ targets: flame, scaleY: { from: s * 0.7, to: s * 0.95 }, scaleX: { from: s * 0.85, to: s * 0.72 }, duration: 140 + Math.random() * 120, yoyo: true, repeat: -1 });
      this.tweens.add({ targets: glow, alpha: { from: 0.35, to: 0.55 }, duration: 300 + Math.random() * 300, yoyo: true, repeat: -1 });
    }
    // sarcophagus + living eyes
    this.sarco = this.add.container(ox + 540, my + 430).setDepth(4);
    this.addPara(this.sarco, 6);
    const sar = this.add.image(0, 0, 'sarcophagus');
    this.sarco.add(sar);
    for (const s of [-1, 1]) {
      const e = this.add.image(s * 30, 128 - 165, 'eyeGlow').setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25).setDisplaySize(64, 40);
      this.eyes.push(e);
      this.sarco.add(e);
    }
    this.tweens.add({ targets: this.eyes, alpha: this.eyeBase(), duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // fog (near)
    for (const [y, a, sp] of [[1450, 0.55, 0.25], [1650, 0.4, -0.4], [320, 0.25, 0.15]] as const) {
      const f = this.add.tileSprite(W / 2, my + y, W, 400, 'fog').setAlpha(a).setDepth(y < 1000 ? 5 : 16).setBlendMode(Phaser.BlendModes.SCREEN);
      (f as any).speed = sp;
      this.fogs.push(f);
      this.addPara(f, y < 1000 ? 10 : 26);
    }
    // ambient motes + embers
    this.add.particles(0, 0, 'p_mote', {
      x: { min: 0, max: W }, y: { min: my + 200, max: my + 1900 }, lifespan: 7000, speedY: { min: -30, max: -8 }, speedX: { min: -12, max: 12 },
      scale: { min: 0.5, max: 1.4 }, alpha: { start: 0, end: 0, ease: (t: number) => Math.sin(t * Math.PI) }, quantity: 1, frequency: 220, maxAliveParticles: 34,
      blendMode: 'ADD',
    }).setDepth(17).setAlpha(0.9);
    this.add.particles(0, 0, 'p_ember', {
      x: { min: ox + 200, max: ox + 880 }, y: my + 1900, lifespan: 5000, speedY: { min: -140, max: -60 }, speedX: { min: -30, max: 30 },
      scale: { start: 0.9, end: 0 }, frequency: 1400, maxAliveParticles: 6, blendMode: 'ADD',
    }).setDepth(17);
    this.redVignette = this.add.image(W / 2, H / 2, 'vignetteRed').setDisplaySize(W * 1.1, H * 1.1).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD).setDepth(35);
  }

  /** The sarcophagus wakes as the keeper's best relic climbs. */
  eyeBase() { return Math.min(1, 0.3 + ctx.state.stats.maxTier * 0.08); }

  private addPara(o: Phaser.GameObjects.Components.Transform, k: number) { this.para.push({ o, bx: o.x, by: o.y, k }); }
  private listenTilt() {
    const onTilt = (e: DeviceOrientationEvent) => {
      if (e.gamma == null || e.beta == null) return;
      this.parallax.tx = Phaser.Math.Clamp(e.gamma / 30, -1, 1);
      this.parallax.ty = Phaser.Math.Clamp((e.beta - 45) / 30, -1, 1);
    };
    window.addEventListener('deviceorientation', onTilt);
    this.events.once('shutdown', () => window.removeEventListener('deviceorientation', onTilt));
  }

  refreshDecor() {
    this.decor.forEach((d) => d.destroy());
    this.decor = [];
    const { ox, my } = this;
    const spots = [[150, 470, 0.72], [540, 250, 0.9], [940, 440, 0.62]];
    ctx.state.pagesDone.forEach((done, p) => {
      if (!done) return;
      const [x, y, s] = spots[p];
      const d = this.add.image(ox + x, my + y, `decor${p}`).setScale(s).setDepth(p === 1 ? 1.5 : 3.5);
      if (p === 1) this.tweens.add({ targets: d, angle: { from: -2, to: 2 }, duration: 3000, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      if (p === 2) this.tweens.add({ targets: d, angle: 360, duration: 40000, repeat: -1 });
      this.decor.push(d);
    });
  }

  // ------------------------------------------------------------------ board
  private buildBoard() {
    const { ox, my } = this;
    this.add.image(ox + 90 - DAIS_PAD, my + BOARD_TOP - DAIS_PAD, 'dais').setOrigin(0, 0).setDepth(10);
    this.selRing = this.add.image(0, 0, 'select').setDepth(11).setVisible(false).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: this.selRing, alpha: { from: 1, to: 0.5 }, duration: 500, yoyo: true, repeat: -1 });
    this.hoverRing = this.add.image(0, 0, 'select').setDepth(11).setVisible(false).setTint(0x7ee0ff).setBlendMode(Phaser.BlendModes.ADD);
  }

  private makeRelic(i: number, tier: number): RelicView {
    const p = this.cellPos(i);
    const scale = RELIC_SIZE / BOARD_FRAME;
    const shadow = this.add.image(p.x, p.y + 58, 'shadow').setDisplaySize(118, 34).setAlpha(0.7).setDepth(12);
    let glow: Phaser.GameObjects.Image | undefined;
    const t = tierOf(tier);
    if (t >= 5) {
      glow = this.add.image(p.x, p.y, 'relicGlow').setDisplaySize(190 + t * 10, 190 + t * 10).setTint(ITEMS[tier].color).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.45).setDepth(13);
    }
    let gild: Phaser.GameObjects.Image | undefined;
    if (ctx.state.ent.skinOn) gild = this.add.image(p.x, p.y, 'relicGlow').setDisplaySize(170, 170).setTint(0xffd86b).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.35).setDepth(13);
    const spr = this.add.image(p.x, p.y, 'relics', `r${tier}_0`).setScale(scale).setDepth(14);
    let iris: Phaser.GameObjects.Image | undefined;
    if (tier === 9) iris = this.add.image(p.x, p.y, 'iris').setScale(scale * 0.94).setDepth(14.5);
    const v: RelicView = { tier, spr, shadow, glow, gild, iris, phase: Math.random() * Math.PI * 2 };
    this.relics[i] = v;
    return v;
  }

  private destroyRelic(v: RelicView | null) {
    if (!v) return;
    for (const o of [v.spr, v.shadow, v.glow, v.gild, v.iris]) if (o) { this.tweens.killTweensOf(o); o.destroy(); }
  }

  /** Rebuild every sprite from the authoritative state. */
  syncBoard() {
    const b = ctx.state.board;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const v = this.relics[i];
      if (v && v.tier === b[i]) continue;
      this.destroyRelic(v);
      this.relics[i] = null;
      if (b[i]) this.makeRelic(i, b[i]);
    }
  }

  private placeView(i: number, v: RelicView) {
    const p = this.cellPos(i);
    v.spr.setPosition(p.x, p.y);
    v.shadow.setPosition(p.x, p.y + 58);
    v.glow?.setPosition(p.x, p.y);
    v.gild?.setPosition(p.x, p.y);
    v.iris?.setPosition(p.x, p.y);
  }

  update(time: number) {
    // idle bob + specular sheen sweep every 2.5s + glow breathing + living eye tracking
    const ptr = this.input.activePointer;
    for (let i = 0; i < BOARD_SIZE; i++) {
      const v = this.relics[i];
      if (!v || v.lifted) continue;
      const p = this.cellPos(i);
      const bob = Math.sin(time / 520 + v.phase) * 3;
      if (!this.tweens.isTweening(v.spr)) v.spr.y = p.y + bob;
      const ph = (time + i * 173) % 2500;
      const f = ph < SHEEN_FRAMES * 55 ? 1 + Math.floor(ph / 55) : 0;
      v.spr.setFrame(`r${v.tier}_${f}`);
      if (v.glow) v.glow.setAlpha(0.35 + Math.sin(time / 400 + v.phase) * 0.15);
      if (v.iris) {
        const dx = ptr.x - v.spr.x, dy = ptr.y - v.spr.y, d = Math.hypot(dx, dy) || 1;
        const k = Math.min(9, d / 30);
        v.iris.setPosition(v.spr.x + (dx / d) * k, v.spr.y - 3 * (RELIC_SIZE / 256) + (dy / d) * k * 0.6 + (v.spr.y - p.y));
        v.iris.y = v.spr.y + (dy / d) * k * 0.6 - 4;
      }
    }
    for (const f of this.fogs) f.tilePositionX += (f as any).speed;
    if ((this.game.loop.frame & 7) === 0) this.orders?.poll();
    // parallax: tilt on phones, pointer on desktop (never during a drag)
    if (!this.dragging && ptr.x > 0 && !(window as any).DeviceOrientationEvent?.requestPermission && !this.sys.game.device.input.touch) {
      this.parallax.tx = (ptr.x / this.W - 0.5) * 2;
      this.parallax.ty = (ptr.y / this.H - 0.5) * 2;
    }
    this.parallax.x += (this.parallax.tx - this.parallax.x) * 0.05;
    this.parallax.y += (this.parallax.ty - this.parallax.y) * 0.05;
    for (const p of this.para) { p.o.x = p.bx - this.parallax.x * p.k; p.o.y = p.by - this.parallax.y * p.k * 0.5; }
  }

  // ------------------------------------------------------------------ forge row
  private buildForgeRow() {
    const { ox, my } = this;
    const y = my + FORGE_Y;
    // three generators (RV-D3): Crypt Brazier · Forge · Star Well
    const X = [540, 322, 758], SIZE = [220, 168, 168], KEY = ['forge', 'gen1', 'gen2'], LABEL = ['FORGE', 'CRYPT', 'STARS'];
    const AURA = [0xff8a2a, 0x7dffb0, 0x9ab8ff];
    for (let c = 0; c < 3; c++) {
      const g = this.add.container(ox + X[c], y + (c ? 12 : 0)).setDepth(20);
      const aura = this.add.image(0, 0, 'relicGlow').setDisplaySize(SIZE[c] * 1.7, SIZE[c] * 1.7).setTint(AURA[c]).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5);
      const f = this.add.image(0, 0, KEY[c]).setDisplaySize(SIZE[c], SIZE[c]);
      const lbl = txt(this, 0, SIZE[c] / 2 - 6, LABEL[c], { size: c ? 28 : 36, gold: true, weight: '900', strokeW: 6 });
      const lvl = this.add.container(SIZE[c] / 2 - 18, -SIZE[c] / 2 + 18);
      const lvlBg = this.add.image(0, 0, 'seal_gold').setDisplaySize(62, 62);
      const lvlT = txt(this, 0, 0, '1', { size: 26, font: 'num', weight: '700', color: '#3a1c02', strokeW: 0, shadow: false });
      lvl.add([lvlBg, lvlT]);
      lvl.setSize(70, 70).setInteractive({ useHandCursor: true });
      lvl.on('pointerup', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev?.stopPropagation();
        if (this.modal) return;
        ctx.sfx.play('tick');
        this.openModal(new GeneratorSheet(this, c));
      });
      const lock = this.add.container(0, 0);
      lock.add([this.add.image(0, -8, 'ic_lock').setDisplaySize(84, 84), txt(this, 0, 44, `RANK ${CHAINS[c].unlockRank}`, { size: 24, font: 'num', weight: '700', color: '#FFE9A3' })]);
      g.add([aura, f, lbl, lock, lvl]);
      (g as any).parts = { aura, f, lvlT, lock, lvl, size: SIZE[c] };
      this.tweens.add({ targets: aura, alpha: { from: 0.3, to: 0.65 }, duration: 900 + c * 150, yoyo: true, repeat: -1 });
      g.setSize(SIZE[c] + 20, SIZE[c] + 20).setInteractive({ useHandCursor: true });
      g.on('pointerdown', () => { if (this.modal) return; this.tweens.add({ targets: f, displayWidth: SIZE[c] * 0.9, displayHeight: SIZE[c] * 0.9, duration: 60 }); });
      g.on('pointerout', () => this.tweens.add({ targets: f, displayWidth: SIZE[c], displayHeight: SIZE[c], duration: 90 }));
      g.on('pointerup', () => {
        this.tweens.add({ targets: f, displayWidth: SIZE[c], displayHeight: SIZE[c], duration: 180, ease: 'Back.Out' });
        if (this.modal) return;
        if (!(ctx.state.gens[c] > 0)) {
          ctx.sfx.play('error');
          this.toast(`The ${CHAINS[c].gen} wakes at Vault Rank ${CHAINS[c].unlockRank}. Patrons pay rank fastest.`);
          return;
        }
        this.doForge(c);
      });
      this.gens.push(g);
    }
    this.forgeBtn = this.gens[0];
    this.knownGens = ctx.state.gens.slice();
    // chest
    this.chestBtn = this.add.container(ox + 128, y + 10).setDepth(20);
    this.chestIcon = this.add.image(0, -14, 'ic_chest').setDisplaySize(128, 128);
    const tag = this.add.nineslice(0, 58, 'pill', undefined, 170, 58, 30, 30, 26, 26);
    this.chestLabel = txt(this, 0, 58, '40', { size: 28, font: 'num', weight: '700' });
    this.chestBtn.add([this.chestIcon, tag, this.chestLabel]);
    this.chestBtn.setSize(170, 180).setInteractive({ useHandCursor: true });
    this.chestBtn.on('pointerup', () => { if (this.modal) return; ctx.sfx.play('tick'); this.onChestButton(); });
    this.tweens.add({ targets: this.chestIcon, angle: { from: -3, to: 3 }, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    // sell scales (drop target)
    this.sellBin = this.add.container(ox + 956, y + 10).setDepth(20);
    const sg = this.add.image(0, -8, 'relicGlow').setDisplaySize(220, 220).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
    const si = this.add.image(0, -14, 'ic_sell').setDisplaySize(124, 124);
    const st = txt(this, 0, 58, 'SELL', { size: 28, gold: true, weight: '900', strokeW: 5 });
    this.sellBin.add([sg, si, st]);
    (this.sellBin as any).glow = sg;
    this.sellBin.setSize(170, 180).setInteractive({ useHandCursor: true });
    this.sellBin.on('pointerup', () => {
      if (this.modal || this.dragging) return;
      if (this.selected >= 0) { this.sellAt(this.selected); return; }
      ctx.sfx.play('tick');
      this.toast('Drag a relic onto the scales to sell it.');
    });
    // satchel (overflow) + VIP crate float just above the row corners
    this.satchelBtn = this.add.container(ox + 128, y - 150).setDepth(21);
    const sb = this.add.image(0, 0, 'ic_satchel').setDisplaySize(104, 104);
    const sd = this.add.image(36, -36, 'seal_blue').setDisplaySize(52, 52);
    this.satchelText = txt(this, 36, -36, '0', { size: 26, font: 'num', weight: '700' });
    this.satchelBtn.add([sb, sd, this.satchelText]);
    this.satchelBtn.setSize(120, 120).setInteractive({ useHandCursor: true });
    this.satchelBtn.on('pointerup', () => { if (this.modal) return; this.dropSatchel(); });
    this.vipBtn = this.add.container(ox + 956, y - 150).setDepth(21);
    const vb = this.add.image(0, 0, 'ic_chest').setDisplaySize(104, 104).setTint(0xffe9a3);
    const vc = this.add.image(0, -52, 'crown').setDisplaySize(52, 52);
    this.vipBtn.add([this.add.image(0, 0, 'relicGlow').setDisplaySize(170, 170).setTint(0xf4c45a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.5), vb, vc]);
    this.vipBtn.setSize(120, 120).setInteractive({ useHandCursor: true });
    this.vipBtn.on('pointerup', () => { if (this.modal) return; this.claimVip(); });
    this.tweens.add({ targets: this.vipBtn, y: this.vipBtn.y - 8, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    this.refreshGenerators(true);
  }

  /** Lock/level state of the three generators; celebrates a chain waking up. */
  refreshGenerators(instant = false) {
    const s = ctx.state;
    this.gens.forEach((g, c) => {
      const P = (g as any).parts;
      const on = (s.gens[c] ?? 0) > 0;
      P.lock.setVisible(!on);
      P.lvl.setVisible(on);
      P.lvlT.setText(String(s.gens[c] ?? 0));
      P.f.setAlpha(on ? 1 : 0.35);
      P.aura.setVisible(on);
      if (!instant && on && !(this.knownGens[c] > 0)) this.chainWakes(c);
    });
    this.knownGens = s.gens.slice();
  }

  private chainWakes(c: number) {
    const g = this.gens[c];
    this.fx.ring(g.x, g.y, CHAINS[c].color, 3, 900);
    this.fx.burst(g.x, g.y, 50, CHAINS[c].color);
    this.fx.confetti(g.x, g.y - 100, 50);
    this.tweens.add({ targets: g, scale: { from: 1.4, to: 1 }, duration: 700, ease: 'Elastic.Out' });
    ctx.sfx.play('rank');
    ctx.telemetry.track('chain_unlock', { chain: c });
    const line = c === 1
      ? 'The Crypt Brazier wakes. Bone, candle, soul-glass. Some relics need a binding from another chain.'
      : 'The Star Well opens. Draw it up. The sky pays well for its missing pieces.';
    this.time.delayedCall(700, () => { if (!this.modal) this.keeperSays(line); else this.toast(line); });
  }

  refreshButtons() {
    const s = ctx.state;
    if (s.freeChests > 0) this.chestLabel.setText(`FREE x${s.freeChests}`).setColor('#8CF08A');
    else if (!chestsAllowed(s)) { this.chestLabel.setText('EXACT').setColor('#7EE0FF'); }
    else this.chestLabel.setText(`${ECON.chestGemCost} GEMS`).setColor('#7EE0FF');
    this.satchelBtn.setVisible(s.satchel.length > 0);
    this.satchelText.setText(String(s.satchel.length));
    this.vipBtn.setVisible(s.ent.vip && s.daily.vipCrateDay !== Math.floor(Date.now() / 86400000));
  }

  // ------------------------------------------------------------------ input
  private buildInput() {
    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      ctx.sfx.unlock();
      if (this.modal || this.tut.blocking) return;
      const i = this.cellAt(p.x, p.y);
      if (i < 0) return;
      if (ctx.state.board[i] > 0) {
        this.press = { i, x: p.x, y: p.y, dragging: false };
        this.press.timer = this.time.delayedCall(480, () => {
          if (this.press && !this.press.dragging && this.press.i === i) {
            this.press = null;
            this.deselect();
            this.openModal(new InspectCard(this, i));
          }
        });
      } else if (this.selected >= 0) {
        const from = this.selected;
        this.deselect();
        this.moveRelic(from, i);
      }
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (!this.press || this.modal) return;
      const v = this.relics[this.press.i];
      if (!v) return;
      if (!this.press.dragging && Math.hypot(p.x - this.press.x, p.y - this.press.y) > 14) {
        this.press.dragging = true;
        this.dragging = true;
        this.press.timer?.remove();
        this.deselect();
        this.liftRelic(v, this.press.i);
      }
      if (this.press.dragging) {
        v.spr.setPosition(p.x, p.y - 30);
        v.iris?.setPosition(p.x, p.y - 34);
        v.glow?.setPosition(p.x, p.y - 30);
        v.gild?.setPosition(p.x, p.y - 30);
        v.shadow.setPosition(p.x, p.y + 60);
        const t = this.cellAt(p.x, p.y);
        if (t >= 0 && t !== this.press.i) {
          const pp = this.cellPos(t);
          this.hoverRing.setPosition(pp.x, pp.y).setVisible(true).setTint(canMerge(ctx.state, this.press.i, t) ? 0x8cf08a : 0x7ee0ff);
        } else this.hoverRing.setVisible(false);
        const overSell = this.overSell(p);
        (this.sellBin as any).glow.setAlpha(overSell ? 0.8 : 0.15);
      }
    });
    const up = (p: Phaser.Input.Pointer) => {
      const pr = this.press;
      this.press = null;
      if (!pr) return;
      pr.timer?.remove();
      this.hoverRing.setVisible(false);
      (this.sellBin as any).glow.setAlpha(0);
      if (pr.dragging) {
        this.dragging = false;
        this.stopMatchPulse();
        const v = this.relics[pr.i];
        if (!v) return;
        v.lifted = false;
        if (this.overSell(p)) { this.sellAt(pr.i); return; }
        const t = this.cellAt(p.x, p.y);
        if (t >= 0 && t !== pr.i) {
          if (canMerge(ctx.state, pr.i, t)) { if (!this.doMerge(pr.i, t)) this.settle(v, pr.i); return; }
          this.moveRelic(pr.i, t);
          return;
        }
        this.settle(v, pr.i);
        return;
      }
      this.handleTap(pr.i);
    };
    this.input.on('pointerup', up);
    this.input.on('pointerupoutside', up);
  }

  private overSell(p: { x: number; y: number }) {
    return Math.hypot(p.x - this.sellBin.x, p.y - this.sellBin.y) < 110;
  }

  private liftRelic(v: RelicView, i: number) {
    v.lifted = true;
    const base = RELIC_SIZE / BOARD_FRAME;
    this.tweens.add({ targets: v.spr, scale: base * 1.18, duration: 120, ease: 'Back.Out' });
    for (const o of [v.spr, v.iris, v.glow, v.gild]) o?.setDepth((o.depth % 10) + 50);
    v.shadow.setAlpha(0.35);
    ctx.sfx.play('whoosh');
    ctx.haptic(6);
    this.pulseMatches(i);
  }

  private settle(v: RelicView, i: number) {
    const p = this.cellPos(i);
    const base = RELIC_SIZE / BOARD_FRAME;
    this.tweens.add({ targets: [v.spr, v.glow, v.gild].filter(Boolean), x: p.x, y: p.y, duration: 160, ease: 'Back.Out' });
    this.tweens.add({ targets: v.spr, scale: base, duration: 160 });
    v.iris?.setPosition(p.x, p.y);
    v.shadow.setPosition(p.x, p.y + 58).setAlpha(0.7);
    v.spr.setDepth(14); v.iris?.setDepth(14.5); v.glow?.setDepth(13); v.gild?.setDepth(13);
    ctx.sfx.play('land');
  }

  private pulseMatches(i: number) {
    this.stopMatchPulse();
    const t = ctx.state.board[i];
    for (let j = 0; j < BOARD_SIZE; j++) {
      const v = this.relics[j];
      if (j === i || !v || v.tier !== t) continue;
      const base = RELIC_SIZE / BOARD_FRAME;
      this.matchPulse.push(this.tweens.add({ targets: v.spr, scale: base * 1.1, duration: 260, yoyo: true, repeat: -1 }));
      v.spr.setTint(0xfff2c0);
    }
  }
  private stopMatchPulse() {
    for (const tw of this.matchPulse) { tw.stop(); (tw.targets[0] as Phaser.GameObjects.Image).setScale(RELIC_SIZE / BOARD_FRAME).clearTint(); }
    this.matchPulse = [];
  }

  private handleTap(i: number) {
    const s = ctx.state;
    if (!s.board[i]) return;
    if (this.selected === -1) { this.select(i); return; }
    if (this.selected === i) { this.deselect(); return; }
    if (canMerge(s, this.selected, i)) { const a = this.selected; this.deselect(); this.doMerge(a, i); return; }
    this.select(i);
  }
  private select(i: number) {
    this.selected = i;
    const p = this.cellPos(i);
    this.selRing.setPosition(p.x, p.y).setVisible(true);
    const v = this.relics[i]!;
    const base = RELIC_SIZE / BOARD_FRAME;
    this.tweens.add({ targets: v.spr, scaleX: base * 1.12, scaleY: base * 0.92, duration: 80, yoyo: true });
    ctx.sfx.play('tick');
    this.pulseMatches(i);
  }
  deselect() {
    this.selected = -1;
    this.selRing.setVisible(false);
    this.stopMatchPulse();
  }

  private moveRelic(from: number, to: number) {
    const s = ctx.state;
    if (!move(s, from, to)) return;
    const a = this.relics[from], b = this.relics[to];
    this.relics[from] = b; this.relics[to] = a;
    if (a) { a.lifted = false; this.settle(a, to); }
    if (b) this.settle(b, from);
    ctx.persist();
  }

  // ------------------------------------------------------------------ core verbs
  doForge(chain = 0) {
    const s = ctx.state;
    ctx.sfx.unlock();
    this.lastActionAt = Date.now(); this.idleHinted = false;
    const prefer = chain === 0 ? this.tut.forgePrefer() : undefined;
    const r = forge(s, ctx.rng, prefer, chain);
    const gen = this.gens[chain] ?? this.forgeBtn;
    const fp = { x: gen.x, y: gen.y - 30 };
    if (!r.ok) {
      ctx.sfx.play('error');
      ctx.haptic([30, 30, 30]);
      this.tweens.add({ targets: gen, x: gen.x + 12, duration: 50, yoyo: true, repeat: 3 });
      this.cameras.main.shake(160, 0.004);
      ctx.telemetry.track('board_full', { merges: s.stats.merges });
      // Board, 2026-09-20: a full board is not a crisis and does not need a shop. In practice the player can
      // almost always merge two like relics and find them without help, so the old Vault Jammed sheet - sell the
      // lowest, gem-clear three, watch an ad - answered a question nobody was asking, and interrupted the one
      // moment the player was already reacting to. The screen already shakes and buzzes; it just needed words.
      this.toast(COPY.boardFull);
      return;
    }
    ctx.sfx.play('forge');
    ctx.haptic(8);
    ctx.telemetry.actions++;
    ctx.telemetry.track('forge', { tier: r.tier, chain });
    this.fx.burst(fp.x, fp.y, 14, CHAINS[chain].color);
    if (chain === 0) this.fx.emberPuff(fp.x, fp.y, 8);
    const v = this.makeRelic(r.index, r.item);
    const p = this.cellPos(r.index);
    const base = RELIC_SIZE / BOARD_FRAME;
    const parts = [v.spr, v.iris, v.glow, v.gild].filter(Boolean) as Phaser.GameObjects.Image[];
    parts.forEach((o) => o.setPosition(fp.x, fp.y));
    v.spr.setScale(base * 0.3);
    v.lifted = true;
    v.shadow.setAlpha(0);
    const path = new Phaser.Curves.QuadraticBezier(new Phaser.Math.Vector2(fp.x, fp.y), new Phaser.Math.Vector2((fp.x + p.x) / 2, Math.min(fp.y, p.y) - 260), new Phaser.Math.Vector2(p.x, p.y));
    const o = { t: 0 };
    this.tweens.add({
      targets: o, t: 1, duration: 360, ease: 'Sine.InOut',
      onUpdate: () => { const q = path.getPoint(o.t); parts.forEach((x) => x.setPosition(q.x, q.y)); v.spr.setScale(base * (0.3 + 0.7 * o.t)); v.spr.angle = (1 - o.t) * 200; },
      onComplete: () => {
        v.lifted = false;
        v.spr.angle = 0;
        v.shadow.setAlpha(0.7);
        v.spr.setScale(base * 1.2, base * 0.8);
        this.tweens.add({ targets: v.spr, scaleX: base, scaleY: base, duration: 260, ease: 'Back.Out' });
        this.fx.dust(p.x, p.y);
        ctx.sfx.play('land');
        if (r.tier > 1) { this.fx.floatText(p.x, p.y - 40, r.tier === 3 ? 'LUCKY!!' : 'LUCKY!', { size: 48, gold: true }); this.fx.ring(p.x, p.y, 0x3fe39a, 1.2); ctx.sfx.play('gem'); }
      },
    });
    this.afterAction();
    this.updateVaultMood();
    this.tut.onForge(r.index);
    this.hud.refresh();
  }

  /** Every core action advances order refills (action-based, never wall-clock) and saves. */
  afterAction() {
    tickOrders(ctx.state, ctx.rng);
    this.orders?.poll();
    this.maybeHintOrders();
    ctx.persist();
  }

  /** Board, #327: orders are easy to miss. The first time one can be filled from the board, the Keeper says so, once. */
  private maybeHintOrders() {
    const s = ctx.state;
    if (s.flags.hint_orders || this.tut.step < 3) return;
    if (!s.orders.some((o) => o && matchOrder(s, o))) return;
    s.flags.hint_orders = 1;
    this.time.delayedCall(500, () => { if (!this.modal) this.keeperSays(COPY.ordersHint); else this.toast(COPY.ordersHintShort); });
  }

  // ------------------------------------------------------------------ patron orders (RV-D2)
  onOrderTap(i: number) {
    const s = ctx.state;
    if (this.modal || this.dragging) return;
    const o = s.orders[i];
    if (!o) { ctx.sfx.play('tick'); this.toast('A patron is on the way. Keep merging.'); return; }
    const pos = o.want.map((id) => s.board.findIndex((t) => t === id));
    const res = deliver(s, i, ctx.rng);
    if (!res.ok) {
      ctx.sfx.play('tick');
      this.orders.pop(i);
      const missing = o.want.filter((_, k) => pos[k] < 0 || o.want.slice(0, k).includes(o.want[k]));
      const need = missing[0] ?? o.want[0];
      const bind = BINDINGS[need];
      this.toast(`${patronLine(o.patron)}  Wants: ${o.want.map((id) => ITEMS[id].name).join(', ')}${bind ? ` (needs a ${ITEMS[bind].name} binding)` : ''}.`);
      return;
    }
    this.lastActionAt = Date.now(); this.idleHinted = false;
    ctx.telemetry.actions++;
    ctx.telemetry.track('order_filled', { items: o.want.length, gold: o.gold, patron: o.patron });
    const to = this.orders.anchor(i);
    // relics fly from their sockets into the patron's card
    res.sockets.forEach((sock, k) => {
      const v = this.relics[sock];
      this.relics[sock] = null;
      if (!v) return;
      v.lifted = true;
      v.shadow.setVisible(false);
      const parts = [v.spr, v.iris, v.glow, v.gild].filter(Boolean) as Phaser.GameObjects.Image[];
      parts.forEach((p) => p.setDepth(55));
      this.tweens.add({
        targets: parts, x: to.x, y: to.y, scale: 0.3, duration: 420, delay: k * 90, ease: 'Cubic.In',
        onComplete: () => { this.destroyRelic(v); this.fx.flash(to.x, to.y, 0.8, 0x8cf08a); this.orders.pop(i); ctx.sfx.play('coin', k + 2); },
      });
    });
    this.time.delayedCall(420 + res.sockets.length * 90, () => {
      ctx.sfx.play('purchase');
      ctx.haptic([12, 30, 20]);
      this.fx.ring(to.x, to.y, 0x8cf08a, 1.8);
      this.fx.burst(to.x, to.y, 24, 0xf4c45a);
      this.fx.floatText(to.x, to.y - 40, `+${fmt(o.gold)}`, { size: 50, gold: true, rise: 90 });
      this.fx.flyTo('coin', to.x, to.y, this.hud.anchor('gold'), Math.min(12, 3 + o.want.length * 3), (k) => { ctx.sfx.play('coin', k); this.hud.bump('gold'); if (k === 0) this.time.delayedCall(450, () => this.hud.tickGold()); });
      if (o.gems) this.fx.flyTo('gem', to.x, to.y, this.hud.anchor('gems'), Math.min(8, o.gems + 2), (k) => { ctx.sfx.play('gem'); if (k === 0) this.time.delayedCall(450, () => this.hud.tickGems()); });
      if (this.dock.unlocked('events')) { const ev = this.hud.anchor('event'); this.fx.floatText(ev.x + 120, ev.y + 40, `+${o.pts}`, { size: 34, color: '#8CF08A', rise: 50, dur: 600 }); }
      if (res.card) this.cardDrop(res.card, to);
      if (res.rankUps > 0) this.time.delayedCall(300, () => this.rankUp(res.rankUps));
      this.hud.refresh();
      this.dock.refresh();
      this.refreshGenerators();
      this.orders.refresh();
    });
    if (!s.flags.firstOrder) { s.flags.firstOrder = 1; this.time.delayedCall(900, () => this.toast('Patrons pay best: gold, rank, Pass and Rush points. Keep what they want.')); }
    this.afterAction();
    this.updateVaultMood();
    this.pumpOffers();
  }

  onOrderDismiss(i: number) {
    if (this.modal) return;
    const o = ctx.state.orders[i];
    if (!o || !dismissOrder(ctx.state, i)) return;
    ctx.sfx.play('whoosh');
    ctx.telemetry.track('order_dismissed', { patron: o.patron });
    this.toast('The patron leaves. Another arrives after a few actions.');
    this.orders.refresh();
    ctx.persist();
  }

  doMerge(a: number, b: number): boolean {
    const s = ctx.state;
    this.lastActionAt = Date.now(); this.idleHinted = false;
    const res = merge(s, a, b, ctx.rng);
    if (!res.ok) {
      if (res.reason === 'binding' && res.binding) this.bindingHint(b, res.item, res.binding);
      return false;
    }
    ctx.telemetry.verb();
    const now = Date.now();
    this.combo = now - this.lastMergeAt < 1800 ? this.combo + 1 : 1;
    this.lastMergeAt = now;
    let comboGold = 0;
    if (this.combo >= 3) { comboGold = this.combo * 2 + Math.min(res.tier, 9) * this.combo; grantGold(s, comboGold); }
    ctx.telemetry.track('merge', { tier: res.tier, ascended: res.ascended, card: !!res.card });
    const va = this.relics[a], vb = this.relics[b];
    this.relics[a] = null; this.relics[b] = null;
    const pb = this.cellPos(b);
    const tier = Math.min(res.tier, 9);
    const color = res.ascended ? CHAINS[res.chain].color : ITEMS[res.item].color;
    // the binding relic from another chain is drawn in and consumed
    if (res.bindingIndex !== undefined) {
      const vbind = this.relics[res.bindingIndex];
      this.relics[res.bindingIndex] = null;
      if (vbind) {
        vbind.lifted = true;
        const parts = [vbind.spr, vbind.iris, vbind.glow, vbind.gild].filter(Boolean) as Phaser.GameObjects.Image[];
        this.tweens.add({ targets: parts, x: pb.x, y: pb.y, scale: 0.4, duration: 150, ease: 'Quad.In', onComplete: () => this.destroyRelic(vbind) });
        const link = this.add.image(pb.x, pb.y - 70, 'ic_link').setDisplaySize(90, 90).setDepth(60);
        this.tweens.add({ targets: link, y: pb.y - 150, alpha: 0, duration: 900, onComplete: () => link.destroy() });
        vbind.shadow.setVisible(false);
      }
    }
    this.busy++;
    if (va) {
      va.lifted = true;
      this.tweens.add({ targets: [va.spr, va.iris, va.glow].filter(Boolean), x: pb.x, y: pb.y, duration: 110, ease: 'Quad.In' });
    }
    if (vb) this.tweens.add({ targets: vb.spr, scaleX: vb.spr.scaleX * 1.15, scaleY: vb.spr.scaleY * 0.85, duration: 110 });
    this.time.delayedCall(115, () => {
      // impact: freeze-frame (2 frames) on white silhouettes
      va?.spr.setTintFill(0xffffff); vb?.spr.setTintFill(0xffffff);
      this.fx.flash(pb.x, pb.y, 1.2 + tier * 0.12);
      this.time.delayedCall(34, () => {
        this.destroyRelic(va); this.destroyRelic(vb);
        this.mergeJuice(res, pb, tier, color, comboGold);
        if (!res.ascended && res.tier >= 3 && !s.flags[`disc_${res.item}`]) { s.flags[`disc_${res.item}`] = 1; this.discoveries.push(res.item); this.time.delayedCall(1100, () => this.pumpOffers()); }
        this.busy--;
      });
    });
    ctx.director.onMerge(res);
    this.afterAction();
    this.tut.onMerge(b);
    this.updateVaultMood();
    return true;
  }

  /** A top-tier merge is missing its binding: say which relic, from which chain, and show it. */
  private bindingHint(at: number, making: number, binding: number) {
    ctx.sfx.play('error');
    ctx.haptic([20, 20]);
    const p = this.cellPos(at);
    const box = this.add.container(p.x, p.y - 120).setDepth(70);
    const bg = this.add.nineslice(0, 0, 'panelDark', undefined, 250, 130, 50, 50, 50, 50);
    const ic = this.add.image(-60, 0, 'relic96', `i${binding}`).setDisplaySize(84, 84);
    const ln = this.add.image(10, 0, 'ic_link').setDisplaySize(52, 52);
    const out = this.add.image(76, 0, 'relic96', `i${making}`).setDisplaySize(84, 84).setAlpha(0.6);
    box.add([bg, ic, ln, out]);
    box.setScale(0.5).setAlpha(0);
    this.tweens.add({ targets: box, scale: 1, alpha: 1, duration: 220, ease: 'Back.Out' });
    this.time.delayedCall(2200, () => this.tweens.add({ targets: box, alpha: 0, duration: 250, onComplete: () => box.destroy() }));
    const locked = (ctx.state.gens[Math.floor(binding / 10)] ?? 0) <= 0;
    this.toast(`${ITEMS[making].name} needs a binding: one ${ITEMS[binding].name} on the board${locked ? ` (from the ${CHAINS[Math.floor(binding / 10)].gen}, which wakes at rank ${CHAINS[Math.floor(binding / 10)].unlockRank})` : ''}.`);
    ctx.telemetry.track('binding_missing', { making, binding });
  }

  private mergeJuice(res: MergeResult, pb: { x: number; y: number }, tier: number, color: number, comboGold = 0) {
    const base = RELIC_SIZE / BOARD_FRAME;
    if (!res.ascended) {
      const v = this.makeRelic(res.to, res.item);
      v.spr.setScale(base * 0.3);
      this.tweens.chain({
        targets: v.spr,
        tweens: [
          { scaleX: base * 1.35, scaleY: base * 1.1, duration: 120, ease: 'Quad.Out' },
          { scaleX: base * 0.9, scaleY: base * 1.18, duration: 90 },
          { scaleX: base, scaleY: base, duration: 220, ease: 'Back.Out' },
        ],
      });
    }
    // layered VFX
    this.fx.ring(pb.x, pb.y, color, 1.2 + tier * 0.14);
    this.fx.burst(pb.x, pb.y, 8 + tier * 4, color);
    if (tier >= 4) {
      this.time.delayedCall(90, () => this.fx.ring(pb.x, pb.y, 0xffffff, 1.8 + tier * 0.1, 600));
      this.fx.shards(pb.x, pb.y, 6 + tier, color);
      this.fx.emberPuff(pb.x, pb.y, 6 + tier * 2);
    }
    if (tier >= 7 || res.ascended) {
      this.fx.flash(this.boardCenter.x, this.boardCenter.y, 5, color);
      this.fx.confetti(pb.x, pb.y, 40);
    }
    this.cameras.main.shake(80 + tier * 24, 0.0012 * tier + 0.0015);
    ctx.haptic(tier >= 6 ? [18, 40, 28] : 10 + tier * 4);
    ctx.sfx.chime(res.ascended ? 10 : Math.min(10, tier + Math.max(0, this.combo - 2)));
    if (comboGold > 0) {
      this.fx.floatText(pb.x, pb.y - 130, `COMBO x${this.combo}`, { size: 44 + Math.min(30, this.combo * 4), color: '#7EE0FF', rise: 110, delay: 80 });
      this.fx.floatText(pb.x - 70, pb.y + 20, `+${comboGold}`, { size: 36, color: '#8CF08A', rise: 70, delay: 160 });
    }
    this.fx.floatText(pb.x, pb.y - 50, FLOAT_WORD(tier, res.ascended), { size: 52 + tier * 5, gold: true, rise: 140 });
    // gold fountain into the pill
    const goldTo = this.hud.anchor('gold');
    const n = Math.min(14, 2 + tier + (res.ascended ? 10 : 0));
    if (res.gold > 0) {
      this.fx.floatText(pb.x + 60, pb.y + 10, '+' + fmt(res.gold), { size: 40, color: '#FFE9A3', rise: 80, delay: 120 });
      this.fx.flyTo('coin', pb.x, pb.y, goldTo, n, (k) => {
        ctx.sfx.play('coin', k);
        this.hud.bump('gold');
        if (k === n - 1) { this.hud.tickGold(); this.hud.bump('piggy'); this.hud.refresh(); }
      });
    }
    if (res.gems > 0) this.fx.flyTo('gem', pb.x, pb.y, this.hud.anchor('gems'), 8, (k) => { ctx.sfx.play('gem'); this.hud.bump('gems'); if (k === 7) this.hud.tickGems(); });
    // event points ping
    if (res.eventPts > 0 && this.dock.unlocked('events')) {
      const ev = this.hud.anchor('event');
      this.fx.floatText(ev.x + 120, ev.y + 40, `+${res.eventPts}`, { size: 34, color: '#8CF08A', rise: 50, dur: 600 });
    }
    // sarcophagus reacts to big merges
    if (tier >= 5) this.sarcoReact(tier);
    // rank ups
    if (res.rankUps > 0) this.time.delayedCall(500, () => this.rankUp(res.rankUps));
    if (res.card) this.time.delayedCall(420, () => this.cardDrop(res.card!, pb));
    this.dock.refresh();
    this.refreshButtons();
    this.pumpOffers();
  }

  sarcoReact(tier: number) {
    for (const e of this.eyes) {
      this.tweens.killTweensOf(e);
      e.setAlpha(1).setDisplaySize(64 + tier * 10, 40 + tier * 6);
      this.tweens.add({ targets: e, alpha: 0.3, displayWidth: 64, displayHeight: 40, duration: 1400, ease: 'Cubic.Out', onComplete: () => this.tweens.add({ targets: this.eyes, alpha: this.eyeBase(), duration: 2400, yoyo: true, repeat: -1 }) });
    }
    this.tweens.add({ targets: this.sarco.list[0], x: 6, duration: 45, yoyo: true, repeat: 3 + Math.floor(tier / 2) });
    this.tweens.add({ targets: this.doorGlow, alpha: 0.6, duration: 120, yoyo: true });
  }

  rankUp(n: number) {
    const s = ctx.state;
    ctx.telemetry.track('rank_up', { rank: s.rank });
    this.hud.refresh();
    this.hud.rankUpFx();
    ctx.sfx.play('rank');
    const a = this.hud.anchor('rank');
    this.fx.floatText(a.x + 170, a.y + 120, `RANK ${s.rank}!`, { size: 60, gold: true, rise: 60, dur: 1200 });
    this.fx.flyTo('gem', a.x, a.y + 80, this.hud.anchor('gems'), ECON.rankGems * n, (k) => { ctx.sfx.play('gem'); if (k === ECON.rankGems * n - 1) this.hud.tickGems(); });
    this.toast(`${COPY.rankUp}  +${ECON.rankGems * n} gems`);
    this.dock.refresh();
    this.refreshGenerators();
  }

  cardDrop(card: CardResult, from: { x: number; y: number }) {
    const def = CARDS[card.id];
    const c = this.add.image(from.x, from.y, 'cards', `c${card.id}`).setDisplaySize(40, 56).setDepth(60);
    ctx.sfx.play('card');
    ctx.state.flags.albumUnlocked = 1;
    this.tweens.add({
      targets: c, displayWidth: 200, displayHeight: 280, y: from.y - 160, duration: 380, ease: 'Back.Out',
      onComplete: () => {
        this.fx.ring(c.x, c.y, 0x7ee0ff, 1.6);
        this.time.delayedCall(500, () => {
          const to = this.dock.anchor('album');
          this.tweens.add({ targets: c, x: to.x, y: to.y, displayWidth: 60, displayHeight: 84, angle: 20, duration: 520, ease: 'Cubic.In', onComplete: () => { c.destroy(); this.dock.refresh(); this.dock.setDot('album', true); } });
        });
      },
    });
    this.toast(card.duplicate ? `Duplicate card: ${def.name}  +${ECON.duplicateCardGems} gems` : `New album card: ${def.name}`);
    if (card.pageCompleted >= 0) this.time.delayedCall(1200, () => this.pageComplete(card.pageCompleted));
  }

  pageComplete(p: number) {
    const bc = this.boardCenter;
    this.fx.confetti(bc.x, bc.y - 200, 120);
    this.fx.confetti(bc.x, bc.y - 200, 40, true);
    ctx.sfx.play('purchase');
    this.refreshDecor();
    for (const d of this.decor) { d.setAlpha(0); this.tweens.add({ targets: d, alpha: 1, duration: 900 }); }
    this.toast(`Page complete: ${ALBUM_PAGES[p].name}! ${ALBUM_PAGES[p].reward} now hangs in your vault. +1% luck`);
    ctx.persist();
  }

  sellAt(i: number) {
    const s = ctx.state;
    const tier = s.board[i];
    const r = sell(s, i);
    if (!r.ok) return;
    const v = this.relics[i];
    this.relics[i] = null;
    const p = v ? { x: v.spr.x, y: v.spr.y } : this.cellPos(i);
    this.destroyRelic(v);
    if (this.selected === i) this.deselect();
    ctx.sfx.play('sell');
    ctx.haptic(12);
    this.fx.flash(p.x, p.y, 1);
    this.fx.shards(p.x, p.y, 8 + Math.min(6, tierOf(tier)), ITEMS[tier].color, this.hud.anchor('gold'), () => { this.hud.tickGold(); this.hud.bump('gold'); });
    this.fx.floatText(p.x, p.y - 30, `+${r.gold}`, { size: 44, color: '#FFE9A3', rise: 90 });
    this.afterAction();
    this.updateVaultMood();
    this.hud.refresh();
  }

  /** Remove sprites for cleared indices (gem-clear / salvage) with shatter. */
  shatterCells(idx: number[]) {
    for (const i of idx) {
      const v = this.relics[i];
      if (!v) continue;
      this.relics[i] = null;
      this.fx.shards(v.spr.x, v.spr.y, 10, ITEMS[v.tier].color, this.hud.anchor('gold'));
      this.fx.flash(v.spr.x, v.spr.y, 0.9);
      this.destroyRelic(v);
    }
    ctx.sfx.play('sell');
    this.time.delayedCall(700, () => { this.hud.tickGold(); this.hud.refresh(); });
    this.updateVaultMood();
  }

  /** Drop a freshly granted relic onto its cell from above with a flourish. */
  dropRelic(index: number, tier: number, delay = 0, from?: { x: number; y: number }) {
    if (index < 0) { this.refreshButtons(); return; }
    this.time.delayedCall(delay, () => {
      if (this.relics[index]) this.destroyRelic(this.relics[index]);
      const v = this.makeRelic(index, tier);
      const p = this.cellPos(index);
      const base = RELIC_SIZE / BOARD_FRAME;
      const start = from ?? { x: p.x, y: p.y - 700 };
      const parts = [v.spr, v.iris, v.glow, v.gild].filter(Boolean) as Phaser.GameObjects.Image[];
      parts.forEach((o) => o.setPosition(start.x, start.y));
      v.lifted = true;
      v.spr.setScale(base * 1.6);
      this.tweens.add({
        targets: parts, x: p.x, y: p.y, duration: 480, ease: 'Bounce.Out',
        onComplete: () => {
          v.lifted = false;
          this.fx.ring(p.x, p.y, ITEMS[tier].color, 1.4);
          this.fx.burst(p.x, p.y, 12, ITEMS[tier].color);
          this.fx.dust(p.x, p.y);
          ctx.sfx.play('land');
        },
      });
      this.tweens.add({ targets: v.spr, scale: base, duration: 480, ease: 'Cubic.Out' });
    });
  }

  updateVaultMood(instant = false) {
    const fill = fillRatio(ctx.state);
    const a = fill > 0.72 ? Math.min(0.55, (fill - 0.72) * 2.2) : 0;
    this.tweens.add({ targets: this.redVignette, alpha: a, duration: instant ? 0 : 600 });
    if (fill >= 0.9 && !instant) {
      const bc = this.boardCenter;
      for (let k = 0; k < 6; k++) this.fx.dust(bc.x + (Math.random() - 0.5) * 900, bc.y + 380);
    }
  }

  // ------------------------------------------------------------------ satchel / VIP
  dropSatchel() {
    const r = dropFromSatchel(ctx.state, ctx.rng);
    if (!r) { ctx.sfx.play('error'); this.toast(canForge(ctx.state) ? 'The satchel is empty.' : 'No room. Merge or sell to make space.'); return; }
    this.dropRelic(r.index, r.tier, 0, { x: this.satchelBtn.x, y: this.satchelBtn.y });
    this.refreshButtons();
    ctx.persist();
  }
  claimVip() {
    const got = claimVipCrate(ctx.state, Date.now(), ctx.rng);
    if (got === false) return;
    ctx.sfx.play('purchase');
    got.forEach((r, k) => this.dropRelic(r.index, r.tier, 300 + k * 200, { x: this.vipBtn.x, y: this.vipBtn.y }));
    this.fx.flyTo('gem', this.vipBtn.x, this.vipBtn.y, this.hud.anchor('gems'), 5, (k) => { if (k === 4) this.hud.tickGems(); });
    this.toast(got.length ? 'VIP crate: +5 gems and a Gold Mask.' : 'VIP crate: +5 gems and a free Lucky Chest.');
    this.refreshButtons();
    ctx.persist();
  }

  // ------------------------------------------------------------------ chests
  onChestButton() {
    const s = ctx.state;
    if (s.freeChests > 0) { this.openChest('free', 'chest_button'); return; }
    if (!chestsAllowed(s)) { this.openShop('chest_button', 'exact'); return; }
    this.openShop('chest_button', 'chest');
  }

  openChest(source: 'free' | 'gems', trigger: string, preRolled?: import('../systems/Economy').ChestResult) {
    if (!empties(ctx.state).length && !preRolled) {
      ctx.sfx.play('error');
      this.toast('No free socket. The chest will wait — merge or sell first.');
      return;
    }
    const m = new ChestOpen(this, source, trigger, preRolled);
    this.openModal(m);
  }

  // ------------------------------------------------------------------ modals & tabs
  openModal(m: Modal) {
    // UI lives in the world camera: snap any onboarding punch-in back so panels are never offset
    const cam = this.cameras.main;
    if (cam.zoom !== 1 || cam.scrollX !== 0 || cam.scrollY !== 0) { cam.panEffect.reset(); cam.zoomEffect.reset(); cam.setZoom(1); cam.setScroll(0, 0); }
    if (this.modal && this.modal !== m) { const old = this.modal; old.onClosed = undefined; old.destroy(); }
    this.modal = m;
    this.deselect();
    if (this.press) { this.press.timer?.remove(); this.press = null; }
  }
  onModalClosed(m: Modal) {
    if (this.modal === m) this.modal = null;
    this.dock.selectTab('vault');
    this.hud.refresh();
    this.refreshButtons();
    this.pumpOffers();
  }

  openTab(id: TabId) {
    this.dock.selectTab(id);
    this.dock.setDot(id, false);
    // Board: "Vault doesn't do anything?" - it did not. Tapping Vault closes whatever is open, and tapping it
    // again (already on the board) opens the Vault itself: identity, rank landmarks and standings.
    if (id === 'vault') {
      if (this.modal) { this.modal.close(); return; }
      this.openModal(new VaultPanel(this));
      return;
    }
    if (id === 'album') this.openModal(new AlbumBook(this));
    if (id === 'pass') this.openPass('dock');
    if (id === 'events') this.openEvents('dock');
    if (id === 'shop') this.openShop('dock');
    this.dock.selectTab(id);
  }
  openShop(trigger: string, focus?: 'gems' | 'best' | 'chest' | 'exact' | 'offers') { this.openModal(new ShopModal(this, trigger, focus)); this.dock.selectTab('shop'); }
  openPass(trigger: string, upsell = false) { this.openModal(new PassRoad(this, trigger, upsell)); this.dock.selectTab('pass'); }
  openEvents(trigger: string) {
    if (!this.dock.unlocked('events')) { this.toast(this.dock.lockHint('events')); return; }
    this.openModal(new EventPanel(this, trigger)); this.dock.selectTab('events');
  }
  openPiggy(trigger: string) { this.openModal(new PiggySheet(this, trigger)); }
  openWheel(trigger: string) { this.openModal(new WheelModal(this, trigger)); }
  openSettings() { this.openModal(new SettingsModal(this)); }
  openQuests() { this.openModal(new QuestsModal(this)); }
  showRankInfo() { this.openModal(new RankInfo(this)); }

  // ------------------------------------------------------------------ offers
  pumpOffers(now = false) {
    if (this.pendingOffer || this.modal || this.tut.blocking || this.dragging) return;
    // Board RV-B8: never sell into a streak. The offer waits rather than being dropped.
    if (this.streaking) { this.time.delayedCall(600, () => this.pumpOffers()); return; }
    if (this.discoveries.length && this.busy === 0 && this.tut.step >= 3) { this.openModal(new DiscoveryCard(this, this.discoveries.shift()!)); return; }
    const req = ctx.director.queue[0];
    if (!req) return;
    this.pendingOffer = true;
    this.offerTimer = this.time.delayedCall(now ? 0 : req.delayMs, () => {
      this.pendingOffer = false;
      if (this.modal || this.dragging || this.busy > 0 || this.tut.blocking || this.streaking) { this.time.delayedCall(400, () => this.pumpOffers()); return; }
      if (this.tut.step < 3 && ctx.director.queue[0]?.id !== 'welcome') { this.time.delayedCall(800, () => this.pumpOffers()); return; }
      const r = ctx.director.next();
      if (r) this.showOffer(r);
    });
  }

  showOffer(r: OfferRequest) {
    const s = ctx.state;
    switch (r.id) {
      case 'welcome': if (!s.ent.welcome) this.openModal(new WelcomePack(this, r.trigger)); break;
      case 'comeback': if (!s.ent.comeback) this.openModal(new OfferSheet(this, 'comeback', r.trigger)); break;
      case 'shopBest': this.openShop(r.trigger, 'best'); break;
      case 'doubleIt': this.openModal(new OfferSheet(this, 'doubleIt', r.trigger)); break;
      case 'piggy': this.openPiggy(r.trigger); break;
      case 'passUpsell': if (!s.ent.passPremium) this.openPass(r.trigger, true); break;
      case 'vip': if (!s.ent.vip) this.openModal(new OfferSheet(this, 'vip', r.trigger)); break;
    }
  }

  private secondTick() {
    const now = Date.now();
    const s = ctx.state;
    rollover(s, now);
    s.stats.playSeconds++;
    this.hud.tick(now);
    ctx.director.tick(now, eventEndsAt(now));
    this.pumpOffers();
    // auto-drop satchel items when space frees
    if (s.satchel.length && canForge(s) && !this.modal && !this.dragging && Math.random() < 0.25) this.dropSatchel();
    if (s.stats.playSeconds % 10 === 0) this.hud.refresh();
    // idle for 8s with a merge available: the ghost finger shows it once
    if (!this.idleHinted && !this.modal && !this.dragging && this.tut.step >= 3 && now - this.lastActionAt > 8000) {
      const pair = findPair(s);
      if (pair) { this.idleHinted = true; this.tut.hintPair(pair); ctx.telemetry.track('funnel_step', { step: 'idle_hint' }); }
    }
  }

  // ------------------------------------------------------------------ purchases
  async buy(sku: SkuId, trigger: string, after?: () => void) {
    const s = ctx.state;
    ctx.analytics.log('iap_click', { sku, trigger, price: SKUS[sku].price });
    if (!skuAvailable(s, sku)) { ctx.sfx.play('error'); this.toast('Already owned.'); return; }
    if (this.modal) this.modal.converted = true;
    const veil = this.processingVeil();
    const res = await ctx.purchases.purchase(sku);
    veil.destroy();
    if (!res.ok) { ctx.sfx.play('error'); return; }
    const g = applyPurchase(s, sku, ctx.rng);
    ctx.analytics.log('iap_purchase', { sku, trigger, price: SKUS[sku].price, receipt: res.receipt });
    ctx.persistNow();
    this.purchaseJuice(sku);
    const bc = this.boardCenter;
    if (g.gems) this.fx.flyTo('gem', bc.x, bc.y - 300, this.hud.anchor('gems'), Math.min(16, 4 + Math.floor(g.gems / 40)), (k, ) => { ctx.sfx.play('gem'); this.hud.bump('gems'); if (k === 0) this.time.delayedCall(500, () => this.hud.tickGems()); });
    if (g.gold) this.fx.flyTo('coin', bc.x, bc.y - 300, this.hud.anchor('gold'), 14, (k) => { ctx.sfx.play('coin', k); this.hud.bump('gold'); if (k === 13) this.hud.tickGold(); });
    if (g.relics.length) {
      // camera flourish: punch toward the board, relics rain in
      this.cameras.main.zoomTo(1.06, 300, 'Sine.easeInOut');
      this.time.delayedCall(1300, () => this.cameras.main.zoomTo(1, 400, 'Sine.easeInOut'));
      g.relics.forEach((r, k) => this.dropRelic(r.index, r.tier, 250 + k * 220));
    }
    if (sku === 'welcome' && s.freeChests > 0) this.time.delayedCall(1700, () => this.openChest('free', 'welcome_pack'));
    if (sku === 'piggy') this.hud.refresh();
    this.hud.refresh();
    this.refreshButtons();
    this.syncBoardSoon();
    after?.();
  }

  private syncBoardSoon() { this.time.delayedCall(1400, () => this.syncBoard()); }

  private processingVeil() {
    const c = this.add.container(0, 0).setDepth(300);
    const d = this.add.image(this.W / 2, this.H / 2, 'dim').setDisplaySize(this.W, this.H).setAlpha(0.5).setInteractive();
    const seal = this.add.image(this.W / 2, this.H / 2, 'seal_gold').setDisplaySize(180, 180);
    const t = txt(this, this.W / 2, this.H / 2 + 140, 'Sealing the deal…', { size: 38, gold: true });
    this.tweens.add({ targets: seal, angle: 360, duration: 900, repeat: -1 });
    c.add([d, seal, t]);
    return c;
  }

  purchaseJuice(sku: SkuId) {
    const cx = this.W / 2, cy = this.H / 2;
    ctx.sfx.play('purchase');
    ctx.haptic([20, 50, 40]);
    const stamp = this.add.container(cx, cy).setDepth(310);
    const seal = this.add.image(0, 0, 'seal_red').setDisplaySize(340, 340);
    const t = txt(this, 0, -6, 'SEALED', { size: 64, weight: '900', color: '#ffe0e4', stroke: '#4a0010', strokeW: 8 });
    const t2 = txt(this, 0, 58, SKUS[sku].title.toUpperCase(), { size: 26, font: 'num', weight: '700', color: '#ffe0e4', strokeW: 0 });
    stamp.add([seal, t, t2]);
    stamp.setScale(3).setAlpha(0).setAngle(-18);
    this.tweens.add({
      targets: stamp, scale: 1, alpha: 1, duration: 220, ease: 'Cubic.In',
      onComplete: () => {
        ctx.sfx.play('stamp');
        this.cameras.main.shake(180, 0.006);
        this.fx.ring(cx, cy, 0xff5d6c, 2.4);
        this.fx.flash(cx, cy, 3);
        this.tweens.add({ targets: stamp, alpha: 0, scale: 1.1, delay: 700, duration: 300, onComplete: () => stamp.destroy() });
      },
    });
    // coin rain
    for (let k = 0; k < 26; k++) {
      const c = this.add.image(Math.random() * this.W, -60 - Math.random() * 400, Math.random() < 0.25 ? 'gem' : 'coin').setDisplaySize(64, 64).setDepth(305);
      this.tweens.add({ targets: c, y: this.H + 80, angle: (Math.random() - 0.5) * 720, duration: 1100 + Math.random() * 700, ease: 'Quad.In', delay: 150 + Math.random() * 300, onComplete: () => c.destroy() });
    }
  }

  // ------------------------------------------------------------------ ads
  watchAd(reason: string, onReward: () => void) {
    ctx.analytics.log('ad_request', { reason });
    const veil = new AdVeil(this, true, () => {
      ctx.state.stats.ads++;
      ctx.analytics.log('ad_rewarded', { reason });
      ctx.sfx.play('adDone');
      onReward();
      ctx.director.onAdComplete();
      ctx.persist();
      this.pumpOffers();
    });
    void veil;
  }

  /** Board RV-B8: a combo streak is the best part of the loop; nothing interrupts it, and not for a beat after. */
  get streaking() { return this.combo >= 2 && Date.now() - this.lastMergeAt < STREAK_GRACE_MS; }

  maybeInterstitial(trigger: string) {
    if (ctx.adsSuppressed || this.dragging || this.streaking) return;
    const now = Date.now();
    if (now - this.lastInterstitial < AD_GAP_MS) return;
    this.lastInterstitial = now;
    ctx.analytics.log('ad_interstitial', { trigger });
    this.time.delayedCall(350, () => new AdVeil(this, false, () => {}));
  }

  // ------------------------------------------------------------------ grants
  showGrant(g: Granted, from: { x: number; y: number }) {
    if (g.gold) this.fx.flyTo('coin', from.x, from.y, this.hud.anchor('gold'), Math.min(12, 3 + Math.floor(g.gold / 100)), (k) => { ctx.sfx.play('coin', k); if (k === 0) this.time.delayedCall(400, () => this.hud.tickGold()); });
    if (g.gems) this.fx.flyTo('gem', from.x, from.y, this.hud.anchor('gems'), Math.min(10, 2 + Math.floor(g.gems / 5)), (k) => { ctx.sfx.play('gem'); if (k === 0) this.time.delayedCall(400, () => this.hud.tickGems()); });
    for (const r of g.relics) this.dropRelic(r.index, r.tier, 300);
    for (const c of g.cards) this.cardDrop(c, from);
    if (g.chests) this.toast(`+${g.chests} free Lucky Chest${g.chests > 1 ? 's' : ''} — tap the chest by the forge.`);
    if (g.skin) this.toast('Gilded skin unlocked. Your relics now wear gold.');
    if (g.crumbs) this.toast('Luck crumb collected. The vault favors you, slightly.');
    this.hud.refresh();
    this.refreshButtons();
    ctx.persist();
  }

  // ------------------------------------------------------------------ toast
  private toasts: Phaser.GameObjects.Container[] = [];
  toast(msg: string) {
    // at most two on screen: the newest pushes out the oldest so they never bury the order cards
    while (this.toasts.length >= 2) {
      const old = this.toasts.shift()!;
      this.tweens.killTweensOf(old);
      this.tweens.add({ targets: old, alpha: 0, duration: 150, onComplete: () => old.destroy() });
    }
    const y0 = this.safeTop + 320;
    const c = this.add.container(this.W / 2, y0 - 40).setDepth(400).setAlpha(0);
    const t = txt(this, 30, 0, msg, { size: 32, font: 'num', weight: '500', color: '#FFE9A3', wrap: 760 });
    const bg = this.add.nineslice(0, 0, 'panelDark', undefined, Math.max(420, t.width + 170), t.height + 70, 70, 70, 60, 60);
    const k = this.add.image(-bg.width / 2 + 58, 0, 'keeper').setDisplaySize(84, 84);
    t.x = 30;
    c.add([bg, k, t]);
    this.toasts.forEach((o) => this.tweens.add({ targets: o, y: o.y + bg.height + 12, duration: 200 }));
    this.toasts.push(c);
    this.tweens.add({ targets: c, alpha: 1, y: y0, duration: 240, ease: 'Back.Out' });
    this.time.delayedCall(2600, () => this.tweens.add({ targets: c, alpha: 0, duration: 300, onComplete: () => { c.destroy(); this.toasts = this.toasts.filter((o) => o !== c); } }));
  }

  keeperSays(line: string, onDone?: () => void) {
    this.openModal(new KeeperDialog(this, line, onDone));
  }

  /** debug helpers */
  showDiscovery(t: number) { this.openModal(new DiscoveryCard(this, t)); }
  debugFill() { const s = ctx.state; for (let i = 0; i < BOARD_SIZE; i++) if (!s.board[i]) s.board[i] = 1 + (i % 7); this.syncBoard(); this.updateVaultMood(); }
  get pair() { return findPair(ctx.state); }
}
