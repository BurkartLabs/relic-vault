/**
 * AB#4724: the ads the game shows, behind one interface, so the scene never knows which network serves them.
 *
 * Two adapters: DemoAdService (the Criers' Guild veil, AdVeil: the web build and every e2e run) and AdMobAdService (the
 * Android app, @capacitor-community/admob). The rules every adapter keeps, tested against both in ads.test.ts:
 *
 * - A rewarded grant is decided by the network's own reward callback. Closing an ad early grants nothing, and says so.
 * - A rewarded ad is offered only when one is loaded: the next one is loaded after each show, and a button that needs
 *   one is disabled with "No ad available right now" until then. Never a silent failure, never a free grant.
 * - The interstitial cadence is the scene's, unchanged: AD_GAP_MS apart, never while dragging or in a streak, never
 *   in front of play (interstitialBlocked below).
 * - adsSuppressed (Silence the Criers, or VIP) short-circuits both: no interstitial, and a rewarded grant with no ad.
 * - A failure is logged as ad_failed with its code; ad_request, ad_rewarded and ad_interstitial are as they were.
 */

export interface AdError {
  /** The network's error code as text, or one of ours: not_ready, show_failed, no_consent. */
  code: string;
  message?: string;
}

export interface RewardedOutcome {
  /** True only when the network's reward callback fired for this show. */
  rewarded: boolean;
  error?: AdError;
}

export interface InterstitialOutcome {
  shown: boolean;
  error?: AdError;
}

/** Where a demo veil is drawn: the scene, attached when it is created. */
export interface AdHost {
  /** Show the demo veil; resolves when it closes, with whether a rewarded veil ran to its end. */
  showVeil(rewarded: boolean): Promise<boolean>;
}

export interface AdService {
  readonly kind: 'demo' | 'admob';
  /**
   * Consent first (UMP, where it applies), then the network, then the first loads. Nothing is requested from the
   * network before this has run. `underAge` is the age gate's under-16: non-personalised ads, tagged under age.
   */
  init(opts: { underAge: boolean }): Promise<void>;
  attach?(host: AdHost): void;
  /** A rewarded ad can be shown now. */
  rewardedReady(): boolean;
  /** Called when rewardedReady() may have changed; returns the unsubscribe. */
  onChange(fn: () => void): () => void;
  showRewarded(): Promise<RewardedOutcome>;
  showInterstitial(): Promise<InterstitialOutcome>;
  /** Settings shows "Privacy options" when this is true (UMP: the player must be able to change their choice). */
  privacyOptionsRequired(): boolean;
  showPrivacyOptions(): Promise<void>;
}

export const AD_GAP_MS = 45_000;
export const NO_AD_TEXT = 'No ad available right now';

/** Why an interstitial may not show now, or null when it may. The scene's cadence, unchanged (AB#4724). */
export function interstitialBlocked(p: { suppressed: boolean; dragging: boolean; streaking: boolean; now: number; last: number; gapMs?: number }):
  'suppressed' | 'dragging' | 'streaking' | 'gap' | null {
  if (p.suppressed) return 'suppressed';
  if (p.dragging) return 'dragging';
  if (p.streaking) return 'streaking';
  if (p.now - p.last < (p.gapMs ?? AD_GAP_MS)) return 'gap';
  return null;
}

export type RewardedResult = 'suppressed' | 'rewarded' | 'closed' | 'unavailable' | 'failed';

export interface RewardedHooks {
  log(type: string, extra: Record<string, unknown>): void;
  /** Called once, and only for 'suppressed' or 'rewarded'. */
  grant(): void;
  /** What the player is told when nothing is granted. */
  tell(message: string): void;
}

/**
 * One rewarded ad for `reason`: the grant runs only if the network's reward callback fired (or ads are suppressed,
 * which grants with no ad). Every other ending tells the player why nothing was granted, and a failure is logged.
 */
export async function runRewarded(service: AdService, reason: string, suppressed: boolean, h: RewardedHooks): Promise<RewardedResult> {
  if (suppressed) { h.grant(); return 'suppressed'; }
  h.log('ad_request', { reason });
  if (!service.rewardedReady()) {
    h.log('ad_failed', { reason, code: 'not_ready' });
    h.tell(`${NO_AD_TEXT}. Nothing was spent; try again in a moment.`);
    return 'unavailable';
  }
  let out: RewardedOutcome;
  try {
    out = await service.showRewarded();
  } catch (e) {
    out = { rewarded: false, error: { code: 'show_failed', message: String((e as Error)?.message ?? e) } };
  }
  if (out.rewarded) {
    h.log('ad_rewarded', { reason });
    h.grant();
    return 'rewarded';
  }
  if (out.error) {
    h.log('ad_failed', { reason, code: out.error.code });
    h.tell(`${NO_AD_TEXT}. Nothing was spent; try again in a moment.`);
    return 'failed';
  }
  h.tell('The ad was closed early, so there is no reward this time.');
  return 'closed';
}

/**
 * The demo adapter: the Criers' Guild veil, drawn by the scene. Always ready, contacts no network; a rewarded veil
 * rewards when it runs to its end (its skip appears at 1.2 s and also counts, as it always has).
 */
export class DemoAdService implements AdService {
  readonly kind = 'demo' as const;
  private host: AdHost | null = null;
  async init() { /* nothing to consent to: no network is contacted */ }
  attach(host: AdHost) { this.host = host; }
  rewardedReady() { return true; }
  onChange() { return () => {}; }
  async showRewarded(): Promise<RewardedOutcome> {
    if (!this.host) return { rewarded: false, error: { code: 'not_ready' } };
    return { rewarded: await this.host.showVeil(true) };
  }
  async showInterstitial(): Promise<InterstitialOutcome> {
    if (!this.host) return { shown: false, error: { code: 'not_ready' } };
    await this.host.showVeil(false);
    return { shown: true };
  }
  privacyOptionsRequired() { return false; }
  async showPrivacyOptions() {}
}
