import type { AdError, AdService, InterstitialOutcome, RewardedOutcome } from './AdService';

/**
 * AB#4724: the Android app's ads, through @capacitor-community/admob (Google Mobile Ads and the UMP consent SDK).
 *
 * The plugin is reached through AdMobLike, the few calls this uses, so the tests drive a fake with the same events.
 * Event names are the plugin's own (RewardAdPluginEvents, InterstitialAdPluginEvents), written out here so that this
 * file does not load the plugin: the web build never does (createAdService, config/ads.ts).
 */
export const REWARD_EVENTS = {
  Loaded: 'onRewardedVideoAdLoaded',
  FailedToLoad: 'onRewardedVideoAdFailedToLoad',
  FailedToShow: 'onRewardedVideoAdFailedToShow',
  Dismissed: 'onRewardedVideoAdDismissed',
  Rewarded: 'onRewardedVideoAdReward',
} as const;
export const INTERSTITIAL_EVENTS = {
  Loaded: 'interstitialAdLoaded',
  FailedToLoad: 'interstitialAdFailedToLoad',
  FailedToShow: 'interstitialAdFailedToShow',
  Dismissed: 'interstitialAdDismissed',
} as const;

export interface ConsentInfo {
  status: 'NOT_REQUIRED' | 'OBTAINED' | 'REQUIRED' | 'UNKNOWN';
  isConsentFormAvailable?: boolean;
  canRequestAds: boolean;
  privacyOptionsRequirementStatus: 'NOT_REQUIRED' | 'REQUIRED' | 'UNKNOWN';
}
export interface ListenerHandle { remove(): Promise<void> | void }
export interface AdMobLike {
  requestConsentInfo(o?: { debugGeography?: number; testDeviceIdentifiers?: string[]; tagForUnderAgeOfConsent?: boolean }): Promise<ConsentInfo>;
  showConsentForm(): Promise<ConsentInfo>;
  showPrivacyOptionsForm(): Promise<void>;
  initialize(o?: { testingDevices?: string[]; initializeForTesting?: boolean; tagForUnderAgeOfConsent?: boolean }): Promise<void>;
  prepareRewardVideoAd(o: { adId: string; isTesting?: boolean; npa?: boolean }): Promise<unknown>;
  showRewardVideoAd(): Promise<unknown>;
  prepareInterstitial(o: { adId: string; isTesting?: boolean; npa?: boolean }): Promise<unknown>;
  showInterstitial(): Promise<void>;
  addListener(event: string, fn: (data: any) => void): Promise<ListenerHandle>;
}

export interface AdMobConfig {
  rewardedId: string;
  interstitialId: string;
  /** Test ads: Google's test unit ids, and the device registered as a test device. */
  testing: boolean;
  /** UMP debug geography (1 = EEA) for trying the consent form outside Europe; test devices only. */
  debugGeography?: number;
  testDeviceIds?: string[];
  /** How long after a failed load the next is tried. */
  retryMs?: number;
  /** How long after a dismissal a late reward callback still counts (the SDK sends it before dismissal). */
  rewardGraceMs?: number;
}

const errorOf = (e: any, fallback: string): AdError => ({ code: e?.code != null ? String(e.code) : fallback, message: e?.message ? String(e.message) : undefined });

export class AdMobAdService implements AdService {
  readonly kind = 'admob' as const;
  private rewardedLoaded = false;
  private interstitialLoaded = false;
  private canRequest = false;
  private npa = false;
  private privacyRequired = false;
  private consentOptions: Parameters<AdMobLike['requestConsentInfo']>[0] = {};
  private listeners = new Set<() => void>();
  private timers = new Set<ReturnType<typeof setTimeout>>();
  /** The last load failure, for the log. */
  lastLoadError: AdError | null = null;

  constructor(private plugin: AdMobLike, private cfg: AdMobConfig) {}

  async init({ underAge }: { underAge: boolean }) {
    this.npa = underAge;
    // UMP before any ad request (Google: gather consent on every launch). An under-16 player is tagged under the age
    // of consent, which UMP answers without a form, and is served non-personalised ads (npa) on every request.
    const debug = this.cfg.testing ? { debugGeography: this.cfg.debugGeography, testDeviceIdentifiers: this.cfg.testDeviceIds } : {};
    this.consentOptions = { ...debug, tagForUnderAgeOfConsent: underAge };
    let info: ConsentInfo;
    try {
      info = await this.plugin.requestConsentInfo(this.consentOptions);
      if (info.status === 'REQUIRED' && info.isConsentFormAvailable) info = await this.plugin.showConsentForm();
    } catch (e) {
      this.lastLoadError = errorOf(e, 'consent_failed');
      info = { status: 'UNKNOWN', canRequestAds: false, privacyOptionsRequirementStatus: 'UNKNOWN' };
    }
    this.applyConsent(info);
    await this.plugin.initialize({ initializeForTesting: this.cfg.testing, testingDevices: this.cfg.testDeviceIds, tagForUnderAgeOfConsent: underAge });
    this.loadRewarded();
    this.loadInterstitial();
  }

  private applyConsent(info: ConsentInfo) {
    this.canRequest = info.canRequestAds;
    this.privacyRequired = info.privacyOptionsRequirementStatus === 'REQUIRED';
    this.notify();
  }

  rewardedReady() { return this.rewardedLoaded; }
  onChange(fn: () => void) { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; }
  private notify() { for (const fn of this.listeners) { try { fn(); } catch { /* a closed modal's button */ } } }

  private later(fn: () => void, ms: number) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  private loading = { rewarded: false, interstitial: false };
  private loadRewarded() {
    if (!this.canRequest || this.rewardedLoaded || this.loading.rewarded) return;
    this.loading.rewarded = true;
    this.plugin.prepareRewardVideoAd({ adId: this.cfg.rewardedId, isTesting: this.cfg.testing, npa: this.npa })
      .then(() => { this.rewardedLoaded = true; this.notify(); })
      .catch((e) => { this.lastLoadError = errorOf(e, 'load_failed'); this.later(() => this.loadRewarded(), this.cfg.retryMs ?? 30_000); })
      .finally(() => { this.loading.rewarded = false; });
  }
  private loadInterstitial() {
    if (!this.canRequest || this.interstitialLoaded || this.loading.interstitial) return;
    this.loading.interstitial = true;
    this.plugin.prepareInterstitial({ adId: this.cfg.interstitialId, isTesting: this.cfg.testing, npa: this.npa })
      .then(() => { this.interstitialLoaded = true; })
      .catch((e) => { this.lastLoadError = errorOf(e, 'load_failed'); this.later(() => this.loadInterstitial(), this.cfg.retryMs ?? 30_000); })
      .finally(() => { this.loading.interstitial = false; });
  }

  async showRewarded(): Promise<RewardedOutcome> {
    if (!this.rewardedLoaded) return { rewarded: false, error: { code: this.canRequest ? 'not_ready' : 'no_consent' } };
    this.rewardedLoaded = false; // one show per load; the next is loaded when this one ends
    this.notify();
    let rewarded = false;
    const handles: ListenerHandle[] = [];
    const out = await new Promise<RewardedOutcome>((resolve) => {
      let settled = false;
      const done = (r: RewardedOutcome) => { if (!settled) { settled = true; resolve(r); } };
      const listen = async () => {
        // The grant is decided here and nowhere else: the SDK's reward callback. The show promise is not used for it
        // (the plugin resolves it on reward and leaves it pending when the ad is closed early).
        handles.push(await this.plugin.addListener(REWARD_EVENTS.Rewarded, () => { rewarded = true; }));
        handles.push(await this.plugin.addListener(REWARD_EVENTS.Dismissed, () => this.later(() => done({ rewarded }), this.cfg.rewardGraceMs ?? 300)));
        handles.push(await this.plugin.addListener(REWARD_EVENTS.FailedToShow, (e) => done({ rewarded: false, error: errorOf(e, 'show_failed') })));
        this.plugin.showRewardVideoAd().catch((e) => done({ rewarded: false, error: errorOf(e, 'show_failed') }));
      };
      listen().catch((e) => done({ rewarded: false, error: errorOf(e, 'show_failed') }));
    });
    for (const h of handles) await h.remove();
    this.loadRewarded();
    return out;
  }

  async showInterstitial(): Promise<InterstitialOutcome> {
    if (!this.interstitialLoaded) {
      this.loadInterstitial();
      return { shown: false, error: { code: this.canRequest ? 'not_ready' : 'no_consent' } };
    }
    this.interstitialLoaded = false;
    const handles: ListenerHandle[] = [];
    const out = await new Promise<InterstitialOutcome>((resolve) => {
      let settled = false;
      const done = (r: InterstitialOutcome) => { if (!settled) { settled = true; resolve(r); } };
      const listen = async () => {
        handles.push(await this.plugin.addListener(INTERSTITIAL_EVENTS.Dismissed, () => done({ shown: true })));
        handles.push(await this.plugin.addListener(INTERSTITIAL_EVENTS.FailedToShow, (e) => done({ shown: false, error: errorOf(e, 'show_failed') })));
        this.plugin.showInterstitial().catch((e) => done({ shown: false, error: errorOf(e, 'show_failed') }));
      };
      listen().catch((e) => done({ shown: false, error: errorOf(e, 'show_failed') }));
    });
    for (const h of handles) await h.remove();
    this.loadInterstitial();
    return out;
  }

  privacyOptionsRequired() { return this.privacyRequired; }

  async showPrivacyOptions() {
    await this.plugin.showPrivacyOptionsForm();
    // The choice may have changed what can be requested: read it again, and load if it now can.
    try {
      this.applyConsent(await this.plugin.requestConsentInfo(this.consentOptions));
    } catch { /* keep what we had */ }
    this.loadRewarded();
    this.loadInterstitial();
  }

  /** For tests: stop the retry timers. */
  dispose() { for (const t of this.timers) clearTimeout(t); this.timers.clear(); this.listeners.clear(); }
}
