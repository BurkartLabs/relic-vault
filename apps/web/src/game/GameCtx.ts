import { GameState, createState, rollover } from './systems/State';
import { SaveService } from './systems/SaveService';
import { Analytics } from './systems/Analytics';
import { PurchaseService } from './systems/PurchaseService';
import { OfferDirector } from './systems/OfferDirector';
import { Telemetry, hashString } from './systems/Telemetry';
import { Sfx } from './audio/Sfx';
import { defaultRng, Rng } from './systems/Rng';

declare const __APP_VERSION__: string;

function platform() {
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone);
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  const os = /Android/i.test(ua) ? 'android' : /iPhone|iPad|iPod/i.test(ua) ? 'ios' : /Windows/i.test(ua) ? 'windows' : /Mac/i.test(ua) ? 'mac' : 'other';
  return `pwa-${standalone ? 'standalone' : 'browser'}-${os}`;
}

/** Analytics ring-buffer types that map onto Orchestrata TELEMETRY.md events. */
const TELEMETRY_MAP: Record<string, string> = {
  offer_impression: 'offer_shown',
  offer_decline: 'offer_dismiss',
  offer_dismiss: 'offer_dismiss',
  iap_purchase: 'purchase_demo',
};

/** Process-wide game context: the pure state plus the services around it. */
export class GameCtx {
  state: GameState = createState();
  save = new SaveService();
  sfx = new Sfx();
  rng: Rng = defaultRng;
  purchases = new PurchaseService('demo');
  sessionStart = Date.now();
  telemetry = new Telemetry(
    typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : 'dev',
    platform(),
    (import.meta as any).env?.VITE_TELEMETRY_URL || undefined,
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
    this.state = await this.save.load();
    this.analytics.load(await this.save.loadAnalytics());
    rollover(this.state, Date.now());
    this.state.stats.sessions++;
    this.sfx.muted = this.state.settings.muted;
    this.sfx.music = this.state.settings.music;
    this.analytics.log('session_start', { session: this.state.stats.sessions });
    const src = new URLSearchParams(location.search).get('src') || (document.referrer ? 'referral' : 'direct');
    this.telemetry.track('app_open', { source: src, returning: this.state.stats.sessions > 1, session_n: this.state.stats.sessions });
    document.addEventListener('visibilitychange', () => {
      // Bug #326: hiding a tab is a pause, not an end. Saving still happens on every hide, because losing
      // progress is the one thing worth being paranoid about; only the telemetry meaning changed.
      if (document.hidden) { this.persistNow(); this.telemetry.pause(); } else this.telemetry.resume();
    });
    window.addEventListener('pagehide', () => { this.persistNow(); this.telemetry.sessionEnd('pagehide'); });
    window.addEventListener('error', (ev) => this.error(ev.message || String(ev.error)));
    window.addEventListener('unhandledrejection', (ev) => this.error(String((ev as PromiseRejectionEvent).reason)));
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
