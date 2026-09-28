import { describe, it, expect, vi, afterEach } from 'vitest';
import { AD_GAP_MS, DemoAdService, NO_AD_TEXT, interstitialBlocked, runRewarded, type AdService, type RewardedHooks } from './AdService';
import { AdMobAdService, INTERSTITIAL_EVENTS, REWARD_EVENTS, type AdMobLike, type ConsentInfo } from './AdMobAdService';

// AB#4724: the rules every ad adapter keeps, run against both: the demo veil (web, e2e) and AdMob (Android), the
// second through a fake of the plugin that raises the plugin's own events.

const flush = () => new Promise((r) => setTimeout(r, 0));

/** A fake @capacitor-community/admob: consent answers, loads and shows are scripted, events are raised by the test. */
function fakePlugin(o: { consent?: Partial<ConsentInfo>; afterForm?: Partial<ConsentInfo>; loadFails?: number } = {}) {
  const handlers = new Map<string, Set<(d: any) => void>>();
  const calls: string[] = [];
  let loadFails = o.loadFails ?? 0;
  const consent: ConsentInfo = { status: 'NOT_REQUIRED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED', ...o.consent };
  const p = {
    calls,
    consentOptions: [] as any[],
    initOptions: null as any,
    loadOptions: [] as any[],
    emit(event: string, data?: unknown) { for (const fn of handlers.get(event) ?? []) fn(data); },
    listening(event: string) { return handlers.get(event)?.size ?? 0; },
    async requestConsentInfo(opts: any) { calls.push('requestConsentInfo'); p.consentOptions.push(opts); return consent; },
    async showConsentForm() { calls.push('showConsentForm'); return { ...consent, status: 'OBTAINED', canRequestAds: true, ...o.afterForm } as ConsentInfo; },
    async showPrivacyOptionsForm() { calls.push('showPrivacyOptionsForm'); },
    async initialize(opts: any) { calls.push('initialize'); p.initOptions = opts; },
    async prepareRewardVideoAd(opts: any) { calls.push('prepareRewardVideoAd'); p.loadOptions.push(opts); if (loadFails > 0) { loadFails--; throw { code: 3, message: 'No fill' }; } return { adUnitId: opts.adId }; },
    async showRewardVideoAd() { calls.push('showRewardVideoAd'); return new Promise(() => {}); }, // the plugin's: pending unless rewarded
    async prepareInterstitial(opts: any) { calls.push('prepareInterstitial'); p.loadOptions.push(opts); return { adUnitId: opts.adId }; },
    async showInterstitial() { calls.push('showInterstitial'); },
    async addListener(event: string, fn: (d: any) => void) {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(fn);
      return { remove: () => { handlers.get(event)!.delete(fn); } };
    },
  };
  return p satisfies AdMobLike & Record<string, unknown>;
}

const CFG = { rewardedId: 'test-rewarded', interstitialId: 'test-interstitial', testing: true, retryMs: 5, rewardGraceMs: 1 };

function hooks() {
  const log: [string, Record<string, unknown>][] = [];
  const told: string[] = [];
  let grants = 0;
  const h: RewardedHooks = { log: (t, e) => log.push([t, e]), tell: (m) => told.push(m), grant: () => { grants++; } };
  return { h, log, told, get grants() { return grants; } };
}

/** Each adapter, with a way to finish a rewarded show as rewarded or closed early. */
const ADAPTERS: { name: string; make(): Promise<{ ads: AdService; complete(rewarded: boolean): Promise<void> }> }[] = [
  {
    name: 'demo (the veil)',
    async make() {
      const ads = new DemoAdService();
      let finish: (r: boolean) => void = () => {};
      ads.attach({ showVeil: (rewarded) => new Promise((resolve) => { finish = rewarded ? resolve : () => resolve(false); }) });
      await ads.init();
      // The demo veil cannot be closed early: its skip appears at 1.2 s and counts as watched, as it always has.
      return { ads, complete: async (rewarded) => { finish(rewarded); await flush(); } };
    },
  },
  {
    name: 'AdMob (fake plugin)',
    async make() {
      const plugin = fakePlugin();
      const ads = new AdMobAdService(plugin, CFG);
      await ads.init({ underAge: false });
      await flush();
      return {
        ads,
        complete: async (rewarded) => {
          await flush();
          if (rewarded) plugin.emit(REWARD_EVENTS.Rewarded, { type: 'coins', amount: 1 });
          plugin.emit(REWARD_EVENTS.Dismissed);
          await new Promise((r) => setTimeout(r, 5));
        },
      };
    },
  },
];

describe('the interstitial cadence (AB#4724: unchanged, Board RV-B7 and RV-B8)', () => {
  const base = { suppressed: false, dragging: false, streaking: false, now: 100_000, last: 0 };
  it('shows once the gap has passed, and not before', () => {
    expect(interstitialBlocked(base)).toBeNull();
    expect(interstitialBlocked({ ...base, last: base.now - AD_GAP_MS })).toBeNull();
    expect(interstitialBlocked({ ...base, last: base.now - AD_GAP_MS + 1 })).toBe('gap');
    expect(AD_GAP_MS).toBe(45_000);
  });
  it('never while dragging or in a streak, and never when ads are suppressed (Silence the Criers, VIP)', () => {
    expect(interstitialBlocked({ ...base, dragging: true })).toBe('dragging');
    expect(interstitialBlocked({ ...base, streaking: true })).toBe('streaking');
    expect(interstitialBlocked({ ...base, suppressed: true })).toBe('suppressed');
  });
});

describe.each(ADAPTERS)('the rewarded contract: $name', ({ make }) => {
  it('grants once, after the reward callback, and logs ad_request then ad_rewarded', async () => {
    const { ads, complete } = await make();
    const r = hooks();
    expect(ads.rewardedReady()).toBe(true);
    const done = runRewarded(ads, 'wheel', false, r.h);
    expect(r.grants).toBe(0); // nothing before the ad has run
    await complete(true);
    expect(await done).toBe('rewarded');
    expect(r.grants).toBe(1);
    expect(r.log.map(([t]) => t)).toEqual(['ad_request', 'ad_rewarded']);
    expect(r.log[1][1]).toEqual({ reason: 'wheel' });
  });

  it('with ads suppressed, grants with no ad and logs nothing', async () => {
    const { ads } = await make();
    const r = hooks();
    expect(await runRewarded(ads, 'double_it', true, r.h)).toBe('suppressed');
    expect(r.grants).toBe(1);
    expect(r.log).toEqual([]);
  });
});

describe('the AdMob adapter (AB#4724)', () => {
  afterEach(() => vi.useRealTimers());

  it('closing an ad early grants nothing, says so, and loads the next', async () => {
    const plugin = fakePlugin();
    const ads = new AdMobAdService(plugin, CFG);
    await ads.init({ underAge: false });
    await flush();
    const r = hooks();
    const done = runRewarded(ads, 'wheel', false, r.h);
    await flush();
    expect(ads.rewardedReady()).toBe(false); // the shown ad is used up
    plugin.emit(REWARD_EVENTS.Dismissed); // closed before the reward
    expect(await done).toBe('closed');
    expect(r.grants).toBe(0);
    expect(r.told[0]).toMatch(/closed early.*no reward/);
    expect(r.log.map(([t]) => t)).toEqual(['ad_request']);
    await flush();
    expect(plugin.calls.filter((c) => c === 'prepareRewardVideoAd')).toHaveLength(2); // the next one, loading
    expect(ads.rewardedReady()).toBe(true);
    expect(plugin.listening(REWARD_EVENTS.Rewarded)).toBe(0); // no listener left behind to grant a later ad twice
    ads.dispose();
  });

  it('a late reward callback, just after the dismissal, still grants; the dismissal alone never does', async () => {
    const plugin = fakePlugin();
    const ads = new AdMobAdService(plugin, { ...CFG, rewardGraceMs: 20 });
    await ads.init({ underAge: false });
    await flush();
    const r = hooks();
    const done = runRewarded(ads, 'wheel', false, r.h);
    await flush();
    plugin.emit(REWARD_EVENTS.Dismissed);
    plugin.emit(REWARD_EVENTS.Rewarded, { type: 'coins', amount: 1 });
    expect(await done).toBe('rewarded');
    expect(r.grants).toBe(1);
    ads.dispose();
  });

  it('with no ad loaded, the button is off, and a request says "no ad available" and logs ad_failed', async () => {
    const plugin = fakePlugin({ loadFails: 1 });
    const ads = new AdMobAdService(plugin, { ...CFG, retryMs: 60_000 });
    let changes = 0;
    ads.onChange(() => changes++);
    await ads.init({ underAge: false });
    await flush();
    expect(ads.rewardedReady()).toBe(false);
    const r = hooks();
    expect(await runRewarded(ads, 'double_it', false, r.h)).toBe('unavailable');
    expect(r.grants).toBe(0);
    expect(r.told[0]).toContain(NO_AD_TEXT);
    expect(r.log).toEqual([['ad_request', { reason: 'double_it' }], ['ad_failed', { reason: 'double_it', code: 'not_ready' }]]);
    expect(plugin.calls).not.toContain('showRewardVideoAd');
    expect(ads.lastLoadError).toEqual({ code: '3', message: 'No fill' });
    ads.dispose();
  });

  it('a show the SDK refuses is logged with its code and grants nothing', async () => {
    const plugin = fakePlugin();
    const ads = new AdMobAdService(plugin, CFG);
    await ads.init({ underAge: false });
    await flush();
    const r = hooks();
    const done = runRewarded(ads, 'wheel', false, r.h);
    await flush();
    plugin.emit(REWARD_EVENTS.FailedToShow, { code: 1, message: 'The ad has already been shown.' });
    expect(await done).toBe('failed');
    expect(r.grants).toBe(0);
    expect(r.log[1]).toEqual(['ad_failed', { reason: 'wheel', code: '1' }]);
    expect(r.told[0]).toContain(NO_AD_TEXT);
    ads.dispose();
  });

  it('asks for consent before any ad request, shows the form when it is required, and offers Privacy options', async () => {
    const plugin = fakePlugin({ consent: { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false, privacyOptionsRequirementStatus: 'REQUIRED' } });
    const ads = new AdMobAdService(plugin, { ...CFG, debugGeography: 1 });
    await ads.init({ underAge: false });
    await flush();
    expect(plugin.calls.slice(0, 3)).toEqual(['requestConsentInfo', 'showConsentForm', 'initialize']);
    expect(plugin.consentOptions[0]).toMatchObject({ debugGeography: 1, tagForUnderAgeOfConsent: false });
    expect(ads.privacyOptionsRequired()).toBe(true);
    await ads.showPrivacyOptions();
    expect(plugin.calls).toContain('showPrivacyOptionsForm');
    expect(plugin.consentOptions[1]).toEqual(plugin.consentOptions[0]); // read again with the same settings
    ads.dispose();
  });

  it('requests nothing while consent does not allow it', async () => {
    const plugin = fakePlugin({ consent: { status: 'REQUIRED', isConsentFormAvailable: true }, afterForm: { canRequestAds: false } });
    const ads = new AdMobAdService(plugin, CFG);
    await ads.init({ underAge: false });
    await flush();
    expect(plugin.calls).not.toContain('prepareRewardVideoAd');
    expect(plugin.calls).not.toContain('prepareInterstitial');
    expect(await ads.showInterstitial()).toEqual({ shown: false, error: { code: 'no_consent' } });
    ads.dispose();
  });

  it('an under-16 profile is tagged under the age of consent and served non-personalised ads', async () => {
    const plugin = fakePlugin();
    const ads = new AdMobAdService(plugin, CFG);
    await ads.init({ underAge: true });
    await flush();
    expect(plugin.consentOptions[0]).toMatchObject({ tagForUnderAgeOfConsent: true });
    expect(plugin.initOptions).toMatchObject({ tagForUnderAgeOfConsent: true });
    expect(plugin.loadOptions.length).toBeGreaterThan(0);
    for (const o of plugin.loadOptions) expect(o.npa).toBe(true);
    ads.dispose();
  });

  it('an adult profile is not tagged, and its ads may be personalised', async () => {
    const plugin = fakePlugin();
    const ads = new AdMobAdService(plugin, CFG);
    await ads.init({ underAge: false });
    await flush();
    expect(plugin.initOptions).toMatchObject({ tagForUnderAgeOfConsent: false });
    for (const o of plugin.loadOptions) expect(o.npa).toBe(false);
    ads.dispose();
  });

  it('an interstitial shows when loaded, ends on dismissal, and loads the next; none loaded is a logged miss, not a wait', async () => {
    const plugin = fakePlugin();
    const ads = new AdMobAdService(plugin, CFG);
    await ads.init({ underAge: false });
    await flush();
    const shown = ads.showInterstitial();
    await flush();
    plugin.emit(INTERSTITIAL_EVENTS.Dismissed);
    expect(await shown).toEqual({ shown: true });
    expect(plugin.calls.filter((c) => c === 'prepareInterstitial')).toHaveLength(2);
    const plugin2 = fakePlugin({ consent: { canRequestAds: true } });
    const cold = new AdMobAdService(plugin2, CFG); // not initialised: nothing loaded
    expect(await cold.showInterstitial()).toEqual({ shown: false, error: { code: 'no_consent' } });
    ads.dispose();
  });

  it('the demo veil on the web and in an Android build without admob; AdMob only in the admob Android build', async () => {
    const { createAdService } = await import('./createAdService');
    expect(createAdService(CFG, 'demo', false).kind).toBe('demo');
    expect(createAdService(CFG, 'admob', false).kind).toBe('demo'); // the web build of an admob release
    expect(createAdService(CFG, 'demo', true).kind).toBe('demo');
    expect(createAdService(CFG, 'admob', true).kind).toBe('admob');
  });

  it('starts with a plugin that answers every property, then() included, as Capacitor\'s does (Bug #4785)', async () => {
    const { createAdService } = await import('./createAdService');
    const fake = fakePlugin();
    // Capacitor's plugin object: a Proxy with a method for every name; then() is "not implemented on android"
    const capacitorLike = new Proxy(fake, {
      get: (t, k) => (k === 'then' ? () => { throw new Error('"AdMob.then()" is not implemented on android'); } : (t as any)[k]),
    });
    const ads = createAdService(CFG, 'admob', true, async () => ({ AdMob: capacitorLike }));
    await ads.init({ underAge: false });
    await flush();
    expect(fake.calls.slice(0, 2)).toEqual(['requestConsentInfo', 'initialize']);
    expect(ads.rewardedReady()).toBe(true);
    (ads as AdMobAdService).dispose();
  });

  it('a failed load is retried', async () => {
    const plugin = fakePlugin({ loadFails: 1 });
    const ads = new AdMobAdService(plugin, { ...CFG, retryMs: 5 });
    await ads.init({ underAge: false });
    await new Promise((r) => setTimeout(r, 30));
    expect(plugin.calls.filter((c) => c === 'prepareRewardVideoAd')).toHaveLength(2);
    expect(ads.rewardedReady()).toBe(true);
    ads.dispose();
  });
});
