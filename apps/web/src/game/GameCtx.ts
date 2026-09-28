import { GameState, createState, rollover } from './systems/State';
import { SaveService } from './systems/SaveService';
import { Analytics } from './systems/Analytics';
import { PurchaseService, type PurchaseGrant } from './systems/PurchaseService';
import { RevenueCatBackend, type StoreBackend } from './systems/PlayStore'; // AB#4725
import { STORE_MODE, REVENUECAT_KEY } from './buildMode';
import type { SkuId } from './data/catalog';
import { OfferDirector } from './systems/OfferDirector';
import { Telemetry, hashString } from './systems/Telemetry';
import { platformOf, telemetryEndpoint, setNativeTelemetrySink, reportPluginError } from './systems/NativeTelemetry'; // AB#4739
import { Sfx } from './audio/Sfx';
import { defaultRng, Rng } from './systems/Rng';

declare const __APP_VERSION__: string;

function platform() {
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  // AB#4739: in the Android app Capacitor names the platform, and the WebView's version is in the user agent
  const cap = typeof window !== 'undefined' ? (window as any).Capacitor : undefined;
  const native = cap?.isNativePlatform?.() ? cap.getPlatform?.() : null;
  return platformOf(ua, !!standalone, native);
}

/** Analytics ring-buffer types that map onto Orchestrata TELEMETRY.md events. */
const TELEMETRY_MAP: Record<string, string> = {
  offer_impression: 'offer_shown',
  offer_decline: 'offer_dismiss',
  offer_dismiss: 'offer_dismiss',
  // AB#4725: a Play build's purchases are real ones; ANALYTICS.md and the Console's funnel read both names
  iap_purchase: STORE_MODE === 'play' ? 'purchase' : 'purchase_demo',
};

/**
 * AB#4725: the store behind the PurchaseService. A Play build uses RevenueCat; an e2e run of a play-mode web build may
 * put a fake one on window.__rvStoreBackend before the game loads (there is no Play Billing in a browser). The demo
 * build uses none.
 */
function storeBackend(): StoreBackend | null {
  if (STORE_MODE !== 'play') return null;
  const injected = typeof window !== 'undefined' ? (window as any).__rvStoreBackend : undefined;
  return injected ?? new RevenueCatBackend(REVENUECAT_KEY);
}

/** Process-wide game context: the pure state plus the services around it. */
export class GameCtx {
  state: GameState = createState();
  save = new SaveService();
  sfx = new Sfx();
  rng: Rng = defaultRng;
  purchases = new PurchaseService(STORE_MODE, storeBackend());
  /** AB#4725: told when the store changes something while the game runs (a pending pack paid, a refund). */
  onStoreChange: ((changed: SkuId[], grants: PurchaseGrant[]) => void) | null = null;
  sessionStart = Date.now();
  telemetry = new Telemetry(
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    platform(),
    telemetryEndpoint((import.meta as any).env?.VITE_TELEMETRY_URL || undefined), // AB#4739: ?g=relic-vault
  );
  analytics = new Analytics(256, () => ({
    sessionSeconds: Math.round((Date.now() - this.sessionStart) / 1000),
    rank: this.state.rank, gems: this.state.gems, gold: this.state.gold,
  }), (e) => {
    const mapped = TELEMETRY_MAP[e.type];
    if (!mapped) return;
    // RV-M8 (AB#383): an offer event carries the offer and its trigger and nothing else (docs/ANALYTICS.md); the
    // envelope adds the anonymous device id and the per-boot session id, which is what the per-session cap is read by.
    if (mapped === 'offer_shown' || mapped === 'offer_dismiss') this.telemetry.track(mapped, { sku: e.sku ?? e.offer, trigger: e.trigger });
    else this.telemetry.track(mapped, { sku: e.sku ?? e.offer, trigger: e.trigger, gems: e.gems, gold: e.gold, rank: e.rank });
  });
  director = new OfferDirector(() => this.state);
  private saveTimer: number | null = null;

  async boot() {
    // AB#4739: plugin and ad failures that no window.onerror sees reach telemetry through this
    setNativeTelemetrySink((event, props) => this.telemetry.track(event, event === 'error' ? { ...props, hash: hashString(String(props.message)) } : props));
    this.state = await this.save.load();
    this.analytics.load(await this.save.loadAnalytics());
    rollover(this.state, Date.now());
    this.state.stats.sessions++;
    this.sfx.muted = this.state.settings.muted;
    this.sfx.music = this.state.settings.music;
    // AB#4725: a Play build's prices and entitlements, before the vault opens; a store that cannot be reached is kept
    // as unavailable (the shop says so), never a reason not to open the game.
    // Waited for at most 6 s: a slow store keeps loading behind the vault, and the shop shows its prices when they come.
    const store = this.purchases.start(this.state, this.rng, (changed, grants) => this.storeChanged(changed, grants));
    await Promise.race([store, new Promise((r) => setTimeout(r, 6000))]);
    this.analytics.log('session_start', { session: this.state.stats.sessions });
    const src = new URLSearchParams(location.search).get('src') || (document.referrer ? 'referral' : 'direct');
    this.telemetry.track('app_open', { source: src, returning: this.state.stats.sessions > 1, session_n: this.state.stats.sessions });
    document.addEventListener('visibilitychange', () => {
      // Bug #326: hiding a tab is a pause, not an end. Saving still happens on every hide, because losing
      // progress is the one thing worth being paranoid about; only the telemetry meaning changed.
      if (document.hidden) { this.persistNow(); this.telemetry.pause(); } else { this.telemetry.resume(); void this.resyncStore(); }
    });
    window.addEventListener('pagehide', () => { this.persistNow(); this.telemetry.sessionEnd('pagehide'); });
    window.addEventListener('error', (ev) => this.error(ev.message || String(ev.error)));
    window.addEventListener('unhandledrejection', (ev) => this.error(String((ev as PromiseRejectionEvent).reason)));
  }

  /** AB#4725: on resume, the entitlements again (a refund or a lapsed VIP while the app was away). */
  async resyncStore() {
    const r = await this.purchases.sync(this.state, this.rng).catch((e) => { reportPluginError('Purchases', 'getCustomerInfo', e); return null; });
    if (r && (r.changed.length || r.grants.length)) this.storeChanged(r.changed, r.grants);
  }

  private storeChanged(changed: SkuId[], grants: PurchaseGrant[]) {
    this.persistNow();
    this.onStoreChange?.(changed, grants);
  }

  error(message: string) {
    this.telemetry.track('error', { message: message.slice(0, 200), hash: hashString(message) });
  }

  /** Coalesced autosave (merge, purchase, etc). */
  persist() {
    if (this.saveTimer) return;
    this.saveTimer = window.setTimeout(() => { this.saveTimer = null; this.persistNow(); }, 250);
  }
  persistNow() {
    if (this.saveTimer) { clearTimeout(this.saveTimer); this.saveTimer = null; }
    void this.save.save(this.state);
    void this.save.saveAnalytics(this.analytics.buf);
  }

  haptic(p: number | number[]) { this.sfx.vibrate(p, this.state.settings.haptics); }

  get adsSuppressed() { return this.state.ent.vip || this.state.ent.removeAds; }
}

export const ctx = new GameCtx();
(window as any).__rv = ctx; // debug handle
